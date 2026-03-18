import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../bootstrap/redis.js';
import { ItemStatus } from '../contracts/index.js';
import type { ItemDetailsResponse, ItemPublicResponse, Report } from '../contracts/index.js';

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
};

const isProductionApp =
  (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase() === 'production';

const isVisibleInCurrentEnvironment = (sourceEnv: Report['sourceEnv'] | undefined): boolean => {
  if (!isProductionApp) {
    return true;
  }

  return sourceEnv === undefined || sourceEnv === 'production';
};

type ListValidatedItemsParams = {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
};

export class InvalidItemDataError extends Error {
  constructor() {
    super(
      'This item was incorrectly reported. If this was your report, please submit it again or contact Campus Security.',
    );
    this.name = 'InvalidItemDataError';
  }
}

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

const normalizeDateReported = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (
    typeof value === 'object'
    && value !== null
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return undefined;
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

const mapItemDetails = async (
  bucket: Bucket,
  id: string,
  source: StoredItem,
  redis: RedisClient | null,
): Promise<ItemDetailsResponse> => {
  const dateReported = normalizeDateReported(source.dateReported);

  if (
    typeof source.title !== 'string'
    || source.title.trim().length === 0
    || typeof source.referenceCode !== 'string'
    || source.referenceCode.trim().length === 0
    || !dateReported
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
    location: source.location,
    referenceCode: source.referenceCode,
    dateReported,
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
  const itemSnapshot = await db.collection('items').doc(itemId).get();
  if (itemSnapshot.exists) {
    const data = itemSnapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, itemSnapshot.id, data, redis);
  }

  const byReportId = await db
    .collection('items')
    .where('reportId', '==', itemId)
    .limit(1)
    .get();
  if (!byReportId.empty) {
    const snapshot = byReportId.docs[0];
    const data = snapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, snapshot.id, data, redis);
  }

  const reportSnapshot = await db.collection('reports').doc(itemId).get();
  if (reportSnapshot.exists) {
    const data = reportSnapshot.data() as DocumentData;
    if (!isVisibleInCurrentEnvironment((data as StoredItem).sourceEnv)) {
      return null;
    }
    return mapItemDetails(bucket, reportSnapshot.id, data, redis);
  }

  return null;
};

export const isItemPubliclyVisible = (item: ItemDetailsResponse): boolean => {
  return item.status === 'VALIDATED';
};

export const listValidatedItems = async (
  db: Firestore,
  bucket: Bucket,
  redis: RedisClient | null,
  params: ListValidatedItemsParams,
): Promise<{ items: Array<ItemPublicResponse>; total: number }> => {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = (page - 1) * limit;
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim().toLowerCase() : '';

  let baseQuery = db
    .collection('reports')
    .where('kind', '==', 'FOUND')
    .where('status', '==', 'VALIDATED');

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

  const orderedQuery = baseQuery.orderBy('dateReported', 'desc');

  let pageSnap;
  let total = 0;

  if (keyword.length > 0) {
    const MAX_KEYWORD_SCAN = 1000;
    const scanLimit = Math.min(MAX_KEYWORD_SCAN, offset + limit);

    pageSnap = await orderedQuery
      .limit(scanLimit)
      .get();
  } else {
    const totalAgg = await baseQuery.count().get();
    total = totalAgg.data().count;

    pageSnap = await orderedQuery
      .offset(offset)
      .limit(limit)
      .get();
  }

  const itemCandidates = await Promise.all(pageSnap.docs.map(async (doc) => {
    const data = doc.data() as Omit<Report, 'id'> & { dateReported?: unknown; imageUrls?: string[] };
    if (!isVisibleInCurrentEnvironment(data.sourceEnv)) {
      return null;
    }

    const dateReported = normalizeDateReported(data.dateReported);
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
      || !data.status
      || !Object.values(ItemStatus).includes(data.status)
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
      referenceCode: data.referenceCode,
      location: data.location,
      dateReported,
      thumbnailUrl: thumbnailSource,
    } as ItemPublicResponse;
  }));

  const items = itemCandidates.filter((item): item is ItemPublicResponse => item !== null);

  const pagedItems = keyword.length > 0
    ? items.slice(offset, offset + limit)
    : items;

  if (keyword.length > 0) {
    total = items.length;
  }

  const itemsWithSignedThumbnails = await Promise.all(pagedItems.map(async (item) => {
    const source = item.thumbnailUrl;
    if (typeof source !== 'string' || source.trim().length === 0) {
      return item;
    }

    let signedUrl = source;
    try {
      signedUrl = await toPublicImageUrl(bucket, source, redis);
    } catch {
      signedUrl = source;
    }

    return {
      ...item,
      thumbnailUrl: signedUrl,
    };
  }));

  return { items: itemsWithSignedThumbnails, total };
};
