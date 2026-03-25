import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import { ItemStatus } from '../contracts/index.js';
import type {
  ItemDetailsResponse,
  ItemPublicResponse,
  ItemStatusResponse,
  Report,
  UpdateItemStatusRequest,
  UpdateItemStatusResponse,
} from '../contracts/index.js';
import { randomUUID } from 'node:crypto';
import { isProductionApp } from '../utils/app-env.js';
import { normalizeDateReported } from '../utils/date-normalization.js';
import { recordItemHistoryEvent } from './item-history.service.js';
export { ItemHistoryNotFoundError, getItemHistory } from './item-history.service.js';

// Cache signed URLs for 50 min; the URL itself is valid for 60 min (10 min buffer)
const SIGNED_URL_CACHE_TTL_SECONDS = 3000;

type StoredItem = {
  id?: string;
  reportId?: string;
  title?: string;
  category?: string;
  description?: string;
  status?: ItemStatus;
  referenceCode?: string;
  location?: string;
  dateReported?: unknown;
  imageUrls?: string[];
  photoUrl?: string;
  claimStatus?: ItemDetailsResponse['claimStatus'];
  kind?: Report['kind'];
  contactEmail?: string;
  sourceEnv?: Report['sourceEnv'];
  archivedAt?: string | null;
  updatedAt?: string;
  statusUpdatedAt?: string;
  statusUpdatedByUid?: string;
  statusUpdatedByEmail?: string | null;
  statusUpdatedByRole?: 'ADMIN' | 'SECURITY' | 'SYSTEM';
};

type ItemStatusUpdateActor = {
  uid: string;
  email?: string | null;
  role: 'ADMIN' | 'SECURITY';
};

type ItemAutomationActor = {
  type: 'SYSTEM';
  uid?: string;
  email?: string | null;
  role?: 'SYSTEM';
};

type StatusChangeActor = ItemStatusUpdateActor | ItemAutomationActor;

type ItemStatusHistoryRecord = {
  itemId: string;
  previousStatus: ItemStatus;
  nextStatus: ItemStatus;
  changedAt: string;
  changedByUid?: string;
  changedByEmail?: string | null;
  changedByRole?: 'ADMIN' | 'SECURITY' | 'SYSTEM';
};

type TransactionReader = {
  get<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  get<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
};

const isVisibleInCurrentEnvironment = (sourceEnv: Report['sourceEnv'] | undefined): boolean => {
  if (!isProductionApp()) {
    return true;
  }

  return sourceEnv === undefined || sourceEnv === 'production';
};

const getRefCollectionName = (ref: DocumentReference<DocumentData>): string => {
  const parentId = (ref.parent as { id?: string } | undefined)?.id;
  if (typeof parentId === 'string') {
    return parentId;
  }

  return (ref as { collectionName?: string }).collectionName ?? '';
};

const isPublicItemStatus = (status: ItemStatus | undefined): status is ItemStatus.VALIDATED | ItemStatus.CLAIMED => (
  status === ItemStatus.VALIDATED || status === ItemStatus.CLAIMED
);

const toItemAvailability = (
  status: ItemStatus.VALIDATED | ItemStatus.CLAIMED,
): ItemStatusResponse['availability'] => (
  status === ItemStatus.CLAIMED ? 'CLAIMED' : 'AVAILABLE'
);

type ListValidatedItemsParams = {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'most_recent' | 'oldest';
};

export class InvalidItemDataError extends Error {
  constructor() {
    super(
      'This item was incorrectly reported. If this was your report, please submit it again or contact Campus Security.',
    );
    this.name = 'InvalidItemDataError';
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super('Item not found');
    this.name = 'ItemNotFoundError';
  }
}

export class ItemStatusConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemStatusConflictError';
  }
}

const getFirstExistingItem = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<{ ref: DocumentReference<DocumentData>; data: StoredItem }> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await reader.get(directItemRef);
  if (directItemSnap.exists) {
    return {
      ref: directItemRef,
      data: (directItemSnap.data() as StoredItem | undefined) ?? {},
    };
  }

  const byReportIdQuery = db.collection('items').where('reportId', '==', itemId).limit(1);
  const byReportIdSnap = await reader.get(byReportIdQuery);
  if (!byReportIdSnap.empty) {
    const matchedRef = byReportIdSnap.docs[0].ref as DocumentReference<DocumentData>;
    return {
      ref: matchedRef,
      data: (byReportIdSnap.docs[0].data() as StoredItem | undefined) ?? {},
    };
  }

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await reader.get(legacyReportRef);
  if (legacyReportSnap.exists) {
    return {
      ref: legacyReportRef,
      data: (legacyReportSnap.data() as StoredItem | undefined) ?? {},
    };
  }

  throw new ItemNotFoundError();
};

const allowedStatusTransitions: Record<ItemStatus, ItemStatus[]> = {
  [ItemStatus.REPORTED]: [ItemStatus.VALIDATED, ItemStatus.ARCHIVED],
  [ItemStatus.PENDING_VALIDATION]: [ItemStatus.VALIDATED, ItemStatus.ARCHIVED],
  [ItemStatus.VALIDATED]: [ItemStatus.CLAIMED, ItemStatus.RETURNED, ItemStatus.ARCHIVED],
  [ItemStatus.CLAIMED]: [ItemStatus.RETURNED, ItemStatus.ARCHIVED],
  [ItemStatus.RETURNED]: [ItemStatus.ARCHIVED],
  [ItemStatus.ARCHIVED]: [],
};

const createStatusPatch = (
  nextStatus: ItemStatus,
  updatedAt: string,
  actor: StatusChangeActor,
): Partial<StoredItem> => {
  const patch: Partial<StoredItem> = {
    status: nextStatus,
    updatedAt,
    statusUpdatedAt: updatedAt,
    statusUpdatedByEmail: actor.email ?? null,
  };

  if (nextStatus === ItemStatus.ARCHIVED) {
    patch.archivedAt = updatedAt;
  }

  if (actor.uid) {
    patch.statusUpdatedByUid = actor.uid;
  }

  if (actor.role) {
    patch.statusUpdatedByRole = actor.role;
  }

  return patch;
};

const getStatusSyncTargets = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<{
  primaryRef: DocumentReference<DocumentData>;
  primaryData: StoredItem;
  targetRefs: Array<DocumentReference<DocumentData>>;
  canonicalItemId: string;
  referenceCode?: string;
}> => {
  const { ref, data } = await getFirstExistingItem(reader, db, itemId);
  const targetRefs: Array<DocumentReference<DocumentData>> = [ref];
  let canonicalItemId = ref.id;
  let referenceCode = data.referenceCode;

  if (getRefCollectionName(ref) === 'items') {
    const reportId = data.reportId?.trim();
    if (reportId) {
      canonicalItemId = reportId;
      const reportRef = db.collection('reports').doc(reportId);
      const reportSnap = await reader.get(reportRef);
      if (reportSnap.exists) {
        const reportData = (reportSnap.data() as StoredItem | undefined) ?? {};
        referenceCode ??= reportData.referenceCode;
        targetRefs.push(reportRef);
      }
    }
  } else if (getRefCollectionName(ref) === 'reports') {
    const linkedItemsSnap = await reader.get(db.collection('items').where('reportId', '==', ref.id).limit(1));
    if (!linkedItemsSnap.empty) {
      targetRefs.push(linkedItemsSnap.docs[0].ref as DocumentReference<DocumentData>);
    }
  }

  return {
    primaryRef: ref,
    primaryData: data,
    targetRefs: targetRefs.filter(
      (targetRef, index, refs) => refs.findIndex((value) => value.path === targetRef.path) === index,
    ),
    canonicalItemId,
    referenceCode,
  };
};

const recordArchivedHistory = async (
  db: Firestore,
  canonicalItemId: string,
  entityId: string,
  previousStatus: ItemStatus,
  archivedAt: string,
  actor: StatusChangeActor,
  referenceCode?: string,
  options: { transaction?: Transaction; summary?: string; automatic?: boolean } = {},
): Promise<void> => {
  const historyActor =
    actor.role === 'SYSTEM'
      ? { type: 'SYSTEM' as const }
      : actor.role === 'ADMIN' || actor.role === 'SECURITY'
        ? {
          type: actor.role,
          uid: actor.uid,
          email: actor.email ?? undefined,
          role: actor.role,
        }
        : undefined;

  await recordItemHistoryEvent(db, {
    itemId: canonicalItemId,
    entityType: 'ITEM',
    entityId,
    actionType: 'ITEM_ARCHIVED',
    timestamp: archivedAt,
    summary: options.summary ?? 'Item archived.',
    actor: historyActor,
    metadata: {
      referenceCode,
      itemStatus: ItemStatus.ARCHIVED,
      automatic: options.automatic === true,
    },
    changes: [{
      field: 'status',
      previousValue: previousStatus,
      newValue: ItemStatus.ARCHIVED,
    }],
  }, options);
};

const parseGsUrl = (value: string): { bucketName: string; filePath: string } | null => {
  if (!value.startsWith('gs://')) {
    return null;
  }

  const normalized = value.slice('gs://'.length);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return {
    bucketName: normalized.slice(0, slashIndex),
    filePath: normalized.slice(slashIndex + 1),
  };
};

const toPublicImageUrl = async (
  defaultBucket: Bucket,
  value: string,
  redis: RedisClient | null,
): Promise<string> => {
  const gs = parseGsUrl(value);
  if (!gs) {
    return value;
  }

  const cacheKey = `signed_url:v1:${Buffer.from(value).toString('base64')}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {
      // Redis unavailable – fall through to generate fresh URL
    }
  }

  const targetBucket =
    gs.bucketName === defaultBucket.name
      ? defaultBucket
      : defaultBucket.storage.bucket(gs.bucketName);

  const [url] = await targetBucket.file(gs.filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60,
  });

  if (redis) {
    try {
      await redis.set(cacheKey, url, { EX: SIGNED_URL_CACHE_TTL_SECONDS });
    } catch {
      // Redis unavailable – proceed without caching
    }
  }

  return url;
};

const resolveImageUrls = async (
  bucket: Bucket,
  source: StoredItem,
  redis: RedisClient | null,
): Promise<string[] | undefined> => {
  const rawUrls = source.imageUrls ?? (source.photoUrl ? [source.photoUrl] : undefined);
  if (!rawUrls || rawUrls.length === 0) {
    return undefined;
  }

  const urls = await Promise.all(
    rawUrls
      .filter((url) => typeof url === 'string' && url.trim().length > 0)
      .map(async (url) => {
        try {
          return await toPublicImageUrl(bucket, url, redis);
        } catch {
          return url;
        }
      }),
  );

  return urls.length > 0 ? urls : undefined;
};

const calculateListedDurationMs = (dateReported: string, nowMs: number = Date.now()): number => {
  const reportedAtMs = Date.parse(dateReported);
  if (Number.isNaN(reportedAtMs)) {
    return 0;
  }

  return Math.max(0, nowMs - reportedAtMs);
};

const parseListedDurationMs = (dateReported: string, nowMs: number): number | null => {
  const durationMs = calculateListedDurationMs(dateReported, nowMs);
  if (!Number.isFinite(durationMs)) {
    return null;
  }

  const reportedAtMs = Date.parse(dateReported);
  return Number.isNaN(reportedAtMs) ? null : durationMs;
};

const mapItemDetails = async (
  bucket: Bucket,
  id: string,
  source: StoredItem,
  redis: RedisClient | null,
  nowMs: number = Date.now(),
): Promise<ItemDetailsResponse> => {
  const dateReported = normalizeDateReported(source.dateReported);
  const listedDurationMs = dateReported ? parseListedDurationMs(dateReported, nowMs) : null;

  if (
    typeof source.title !== 'string'
    || source.title.trim().length === 0
    || typeof source.referenceCode !== 'string'
    || source.referenceCode.trim().length === 0
    || !dateReported
    || listedDurationMs === null
    || !source.status
    || !Object.values(ItemStatus).includes(source.status)
  ) {
    throw new InvalidItemDataError();
  }

  const imageUrls = await resolveImageUrls(bucket, source, redis);

  return {
    id,
    title: source.title,
    category: source.category,
    description: source.description,
    status: source.status,
    availability: isPublicItemStatus(source.status) ? toItemAvailability(source.status) : 'AVAILABLE',
    location: source.location,
    referenceCode: source.referenceCode,
    dateReported,
    listedDurationMs,
    imageUrls,
    claimStatus: source.claimStatus,
  };
};

export const getItemById = async (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  itemId: string,
): Promise<ItemDetailsResponse | null> => {
  const nowMs = Date.now();
  const itemsCollection = db.collection('items');
  const reportsCollection = db.collection('reports');

  const [itemSnapshot, itemsByReportIdSnapshot, reportSnapshot] = await Promise.all([
    itemsCollection.doc(itemId).get(),
    itemsCollection.where('reportId', '==', itemId).limit(1).get(),
    reportsCollection.doc(itemId).get(),
  ]);

  if (itemSnapshot.exists) {
    const data = itemSnapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, itemSnapshot.id, data, redis, nowMs);
  }

  if (!itemsByReportIdSnapshot.empty) {
    const snapshot = itemsByReportIdSnapshot.docs[0];
    const data = snapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, snapshot.id, data, redis, nowMs);
  }

  if (reportSnapshot.exists) {
    const data = reportSnapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, reportSnapshot.id, data, redis, nowMs);
  }

  return null;
};

export const isItemPubliclyVisible = (item: ItemDetailsResponse): boolean => {
  return isPublicItemStatus(item.status);
};

export const getPublicItemStatus = (item: ItemDetailsResponse): ItemStatusResponse => ({
  id: item.id,
  status: isPublicItemStatus(item.status) ? item.status : ItemStatus.VALIDATED,
  availability: item.availability,
  claimStatus: item.claimStatus,
});

export const updateItemStatus = async (
  db: Firestore,
  itemId: string,
  payload: UpdateItemStatusRequest,
  actor: ItemStatusUpdateActor,
): Promise<UpdateItemStatusResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const { primaryRef, primaryData, targetRefs, canonicalItemId, referenceCode } = await getStatusSyncTargets(transaction, db, itemId);
    const currentStatus = primaryData.status;

    if (!currentStatus || !Object.values(ItemStatus).includes(currentStatus)) {
      throw new InvalidItemDataError();
    }

    if (currentStatus === payload.status) {
      throw new ItemStatusConflictError(`Item is already in status ${payload.status}.`);
    }

    if (!allowedStatusTransitions[currentStatus].includes(payload.status)) {
      throw new ItemStatusConflictError(`Cannot change item status from ${currentStatus} to ${payload.status}.`);
    }

    const updatedAt = new Date().toISOString();
    const patch = createStatusPatch(payload.status, updatedAt, actor);
    for (const targetRef of targetRefs) {
      transaction.update(targetRef, patch);
    }

    const historyRef = db.collection('itemStatusHistory').doc(randomUUID());
    transaction.set(historyRef, {
      itemId: primaryRef.id,
      previousStatus: currentStatus,
      nextStatus: payload.status,
      changedAt: updatedAt,
      changedByUid: actor.uid,
      changedByEmail: actor.email ?? null,
      changedByRole: actor.role,
    } satisfies ItemStatusHistoryRecord);

    if (payload.status === ItemStatus.ARCHIVED) {
      await recordArchivedHistory(
        db,
        canonicalItemId,
        primaryRef.id,
        currentStatus,
        updatedAt,
        actor,
        referenceCode,
        {
          transaction,
          summary: 'Item archived by staff.',
        },
      );
    }

    return {
      id: primaryRef.id,
      previousStatus: currentStatus,
      status: payload.status,
      updatedAt,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? null,
      updatedByRole: actor.role,
    };
  });
};

// Public item listing now intentionally includes both available and claimed items.
export const listValidatedItems = async (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  params: ListValidatedItemsParams,
): Promise<{ items: Array<ItemPublicResponse>; total: number }> => {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim().toLowerCase() : '';
  const sort = params.sort === 'oldest' ? 'oldest' : 'most_recent';
  const nowMs = Date.now();

  let baseQuery = db
    .collection('reports')
    .where('kind', '==', 'FOUND')
    .where('status', 'in', [ItemStatus.VALIDATED, ItemStatus.CLAIMED]);

  if (params.category) {
    baseQuery = baseQuery.where('category', '==', params.category);
  }

  if (params.location) {
    baseQuery = baseQuery.where('location', '==', params.location);
  }

  if (params.dateFrom) {
    baseQuery = baseQuery.where('dateReported', '>=', params.dateFrom);
  }

  if (params.dateTo) {
    baseQuery = baseQuery.where('dateReported', '<=', params.dateTo);
  }

  const orderedQuery = baseQuery.orderBy('dateReported', sort === 'oldest' ? 'asc' : 'desc');

  const getCursorPage = async (
    query: Query,
    pageNumber: number,
    pageSize: number,
  ) => {
    let lastDoc: QueryDocumentSnapshot | undefined;

    for (let currentPage = 1; currentPage < pageNumber; currentPage += 1) {
      const cursorQuery = lastDoc ? query.startAfter(lastDoc) : query;
      const cursorSnap = await cursorQuery.limit(pageSize).get();
      if (cursorSnap.empty) {
        return cursorSnap;
      }

      lastDoc = cursorSnap.docs[cursorSnap.docs.length - 1];
    }

    const pageQuery = lastDoc ? query.startAfter(lastDoc) : query;
    return pageQuery.limit(pageSize).get();
  };

  let pageSnap;
  let total = 0;

  if (keyword.length > 0) {
    const MAX_KEYWORD_SCAN = 1000;
    const scanLimit = Math.min(MAX_KEYWORD_SCAN, page * limit);

    pageSnap = await orderedQuery
      .limit(scanLimit)
      .get();
  } else {
    const totalAgg = await baseQuery.count().get();
    total = totalAgg.data().count;

    pageSnap = await getCursorPage(orderedQuery, page, limit);
  }

  const itemCandidates = await Promise.all(pageSnap.docs.map(async (doc) => {
    const data = doc.data() as Omit<Report, 'id'> & { dateReported?: unknown; imageUrls?: string[] };
    if (!isVisibleInCurrentEnvironment(data.sourceEnv)) {
      return null;
    }

    const dateReported = normalizeDateReported(data.dateReported);
    const listedDurationMs = dateReported ? parseListedDurationMs(dateReported, nowMs) : null;
    const thumbnailSource =
      (Array.isArray(data.imageUrls) && data.imageUrls.length > 0 ? data.imageUrls[0] : undefined)
      ?? data.photoUrl;

    let thumbnailUrl: string | undefined;
    if (typeof thumbnailSource === 'string' && thumbnailSource.trim().length > 0) {
      try {
        thumbnailUrl = await toPublicImageUrl(bucket, thumbnailSource, redis);
      } catch {
        thumbnailUrl = thumbnailSource;
      }
    }

    if (
      typeof data.title !== 'string'
      || data.title.trim().length === 0
      || typeof data.referenceCode !== 'string'
      || data.referenceCode.trim().length === 0
      || !dateReported
      || listedDurationMs === null
      || !isPublicItemStatus(data.status)
    ) {
      return null;
    }

    const descriptionText = typeof data.description === 'string' ? data.description : '';
    const searchableText = `${data.title} ${descriptionText}`.toLowerCase();

    if (keyword.length > 0 && !searchableText.includes(keyword)) {
      return null;
    }

    return {
      id: doc.id,
      title: data.title,
      category: data.category,
      status: data.status,
      availability: toItemAvailability(data.status),
      referenceCode: data.referenceCode,
      location: data.location,
      dateReported,
      listedDurationMs,
      thumbnailUrl,
    } as ItemPublicResponse;
  }));

  const items = itemCandidates.filter((item): item is ItemPublicResponse => item !== null);

  const pagedItems = keyword.length > 0
    ? items.slice((page - 1) * limit, page * limit)
    : items;

  if (keyword.length > 0) {
    total = items.length;
  }

  return { items: pagedItems, total };
};
