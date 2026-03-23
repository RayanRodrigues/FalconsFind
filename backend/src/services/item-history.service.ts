import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus } from '../contracts/index.js';
import type { Claim, ItemHistoryEventResponse, ItemHistoryResponse, Report } from '../contracts/index.js';

type HistoryActionType = ItemHistoryEventResponse['actionType'];
type HistoryEntityType = ItemHistoryEventResponse['entityType'];
type HistoryActor = ItemHistoryEventResponse['actor'];
type HistoryChange = ItemHistoryEventResponse['changes'];
type HistoryMetadata = ItemHistoryEventResponse['metadata'];

type StoredItem = {
  reportId?: string;
  title?: string;
  referenceCode?: string;
  status?: ItemStatus;
};

type StoredClaim = Claim & {
  reviewedAt?: string;
  cancelledAt?: string;
};

type StoredHistoryEvent = Omit<ItemHistoryEventResponse, 'id'>;

type HistoryWriteOptions = {
  transaction?: Transaction;
};

type ResolvedItemAggregate = {
  resolvedFrom: string;
  canonicalItemId: string;
  candidateItemIds: string[];
  title?: string;
  referenceCode?: string;
  currentStatus?: ItemStatus;
  reportDoc?: { id: string; data: Partial<Report> };
  itemDoc?: { id: string; data: StoredItem };
};

export class ItemHistoryNotFoundError extends Error {
  constructor() {
    super('Item not found');
    this.name = 'ItemHistoryNotFoundError';
  }
}

const isPrimitiveHistoryValue = (
  value: unknown,
): value is string | number | boolean | null => value === null || ['string', 'number', 'boolean'].includes(typeof value);

const sanitizeForStorage = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeForStorage(entry))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, sanitizeForStorage(entry)] as const)
      .filter(([, entry]) => entry !== undefined);

    return Object.fromEntries(entries);
  }

  return String(value);
};

const toStoredHistoryEvent = (event: StoredHistoryEvent): StoredHistoryEvent => (
  sanitizeForStorage(event) as StoredHistoryEvent
);

const dedupeById = <T extends { id: string }>(values: T[]): T[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) {
      return false;
    }

    seen.add(value.id);
    return true;
  });
};

const buildHistoryKey = (
  entityType: HistoryEntityType,
  entityId: string,
  actionType: HistoryActionType,
): string => `${entityType}:${entityId}:${actionType}`;

const sortEventsDescending = (left: ItemHistoryEventResponse, right: ItemHistoryEventResponse): number => {
  const timestampCompare = right.timestamp.localeCompare(left.timestamp);
  if (timestampCompare !== 0) {
    return timestampCompare;
  }

  return right.id.localeCompare(left.id);
};

const toHistoryEventResponse = (
  id: string,
  data: Partial<StoredHistoryEvent> | undefined,
): ItemHistoryEventResponse | null => {
  if (
    !data
    || typeof data.itemId !== 'string'
    || typeof data.entityType !== 'string'
    || typeof data.entityId !== 'string'
    || typeof data.actionType !== 'string'
    || typeof data.timestamp !== 'string'
    || typeof data.summary !== 'string'
  ) {
    return null;
  }

  return {
    id,
    itemId: data.itemId,
    entityType: data.entityType as HistoryEntityType,
    entityId: data.entityId,
    actionType: data.actionType as HistoryActionType,
    timestamp: data.timestamp,
    summary: data.summary,
    actor: data.actor,
    metadata: data.metadata,
    changes: data.changes,
  };
};

const queryCollectionByItemIds = async <T>(
  db: Firestore,
  collectionName: string,
  itemIds: string[],
): Promise<Array<{ id: string; data: T }>> => {
  const snapshots = await Promise.all(
    itemIds.map((itemId) => db.collection(collectionName).where('itemId', '==', itemId).get()),
  );

  const docs = snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as T,
  })));

  return dedupeById(docs);
};

const resolveItemAggregate = async (
  db: Firestore,
  requestedItemId: string,
): Promise<ResolvedItemAggregate> => {
  const itemsCollection = db.collection('items');
  const reportsCollection = db.collection('reports');

  const [directItemSnapshot, itemsByReportIdSnapshot, directReportSnapshot] = await Promise.all([
    itemsCollection.doc(requestedItemId).get(),
    itemsCollection.where('reportId', '==', requestedItemId).limit(1).get(),
    reportsCollection.doc(requestedItemId).get(),
  ]);

  let itemDoc: ResolvedItemAggregate['itemDoc'];
  if (directItemSnapshot.exists) {
    itemDoc = {
      id: directItemSnapshot.id,
      data: (directItemSnapshot.data() as StoredItem | undefined) ?? {},
    };
  } else if (!itemsByReportIdSnapshot.empty) {
    const linkedDoc = itemsByReportIdSnapshot.docs[0];
    itemDoc = {
      id: linkedDoc.id,
      data: (linkedDoc.data() as StoredItem | undefined) ?? {},
    };
  }

  let reportDoc: ResolvedItemAggregate['reportDoc'];
  if (directReportSnapshot.exists) {
    reportDoc = {
      id: directReportSnapshot.id,
      data: (directReportSnapshot.data() as Partial<Report> | undefined) ?? {},
    };
  }

  const relatedReportId = itemDoc?.data.reportId?.trim();
  if (!reportDoc && relatedReportId) {
    const relatedReportSnapshot = await reportsCollection.doc(relatedReportId).get();
    if (relatedReportSnapshot.exists) {
      reportDoc = {
        id: relatedReportSnapshot.id,
        data: (relatedReportSnapshot.data() as Partial<Report> | undefined) ?? {},
      };
    }
  }

  if (!itemDoc && !reportDoc) {
    throw new ItemHistoryNotFoundError();
  }

  const canonicalItemId = relatedReportId || reportDoc?.id || itemDoc?.id;
  if (!canonicalItemId) {
    throw new ItemHistoryNotFoundError();
  }

  const candidateItemIds = Array.from(
    new Set([canonicalItemId, requestedItemId, itemDoc?.id, reportDoc?.id].filter((value): value is string => Boolean(value))),
  );

  return {
    resolvedFrom: requestedItemId,
    canonicalItemId,
    candidateItemIds,
    title: reportDoc?.data.title ?? itemDoc?.data.title,
    referenceCode: reportDoc?.data.referenceCode ?? itemDoc?.data.referenceCode,
    currentStatus: (itemDoc?.data.status ?? reportDoc?.data.status) as ItemStatus | undefined,
    reportDoc,
    itemDoc,
  };
};

const createLegacyClaimEvents = (
  itemId: string,
  claimDoc: { id: string; data: StoredClaim },
  existingKeys: Set<string>,
): ItemHistoryEventResponse[] => {
  const events: ItemHistoryEventResponse[] = [];
  const claim = claimDoc.data;
  const actor: HistoryActor | undefined = claim.claimantUid
    ? { type: 'USER', uid: claim.claimantUid, email: claim.claimantEmail }
    : undefined;

  const maybePush = (event: Omit<ItemHistoryEventResponse, 'id'>) => {
    const key = buildHistoryKey(event.entityType, event.entityId, event.actionType);
    if (existingKeys.has(key)) {
      return;
    }

    existingKeys.add(key);
    events.push({
      id: `legacy-${claimDoc.id}-${event.actionType.toLowerCase()}`,
      ...event,
    });
  };

  if (claim.createdAt) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_CREATED',
      timestamp: claim.createdAt,
      summary: 'Claim request submitted.',
      actor,
      metadata: {
        claimStatus: claim.status,
        referenceCode: claim.referenceCode,
      },
    });
  }

  if (claim.proofRequestedAt) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_PROOF_REQUESTED',
      timestamp: claim.proofRequestedAt,
      summary: 'Additional proof requested for claim.',
      actor: { type: 'SECURITY' },
      metadata: {
        claimStatus: ClaimStatus.NEEDS_PROOF,
      },
    });
  }

  if (claim.proofRespondedAt) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_PROOF_SUBMITTED',
      timestamp: claim.proofRespondedAt,
      summary: 'Additional proof submitted for claim.',
      actor,
      metadata: {
        claimStatus: ClaimStatus.PENDING,
      },
    });
  }

  if (claim.reviewedAt && claim.status === ClaimStatus.APPROVED) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_APPROVED',
      timestamp: claim.reviewedAt,
      summary: 'Claim approved by staff.',
      actor: { type: 'SECURITY' },
      metadata: {
        claimStatus: ClaimStatus.APPROVED,
        itemStatus: ItemStatus.CLAIMED,
      },
    });
  }

  if (claim.reviewedAt && claim.status === ClaimStatus.REJECTED) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_REJECTED',
      timestamp: claim.reviewedAt,
      summary: 'Claim rejected by staff.',
      actor: { type: 'SECURITY' },
      metadata: {
        claimStatus: ClaimStatus.REJECTED,
        itemStatus: ItemStatus.VALIDATED,
      },
    });
  }

  if (claim.cancelledAt && claim.status === ClaimStatus.CANCELLED) {
    maybePush({
      itemId,
      entityType: 'CLAIM',
      entityId: claimDoc.id,
      actionType: 'CLAIM_CANCELLED',
      timestamp: claim.cancelledAt,
      summary: 'Claim cancelled.',
      actor,
      metadata: {
        claimStatus: ClaimStatus.CANCELLED,
      },
    });
  }

  return events;
};

const createLegacyReportEvents = (
  itemId: string,
  reportDoc: { id: string; data: Partial<Report> } | undefined,
  existingKeys: Set<string>,
): ItemHistoryEventResponse[] => {
  if (!reportDoc || typeof reportDoc.data.dateReported !== 'string') {
    return [];
  }

  const key = buildHistoryKey('REPORT', reportDoc.id, 'REPORT_CREATED');
  if (existingKeys.has(key)) {
    return [];
  }

  existingKeys.add(key);
  return [{
    id: `legacy-${reportDoc.id}-report_created`,
    itemId,
    entityType: 'REPORT',
    entityId: reportDoc.id,
    actionType: 'REPORT_CREATED',
    timestamp: reportDoc.data.dateReported,
    summary: reportDoc.data.kind === 'FOUND' ? 'Found-item report created.' : 'Lost-item report created.',
    actor: { type: 'USER', email: reportDoc.data.contactEmail },
    metadata: {
      referenceCode: reportDoc.data.referenceCode,
      reportKind: reportDoc.data.kind,
      itemStatus: reportDoc.data.status,
    },
    changes: reportDoc.data.status
      ? [{
        field: 'status',
        newValue: reportDoc.data.status,
      }]
      : undefined,
  }];
};

export const createChangesFromPatch = (
  previousValues: Record<string, unknown>,
  nextValues: Record<string, unknown>,
): NonNullable<HistoryChange> => {
  const changes: NonNullable<HistoryChange> = [];

  for (const [field, nextValue] of Object.entries(nextValues)) {
    const previousValue = previousValues[field];
    if (previousValue === undefined && nextValue === undefined) {
      continue;
    }

    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
      continue;
    }

    changes.push({
      field,
      previousValue: isPrimitiveHistoryValue(previousValue) ? previousValue : null,
      newValue: isPrimitiveHistoryValue(nextValue) ? nextValue : null,
    });
  }

  return changes;
};

export const recordItemHistoryEvent = async (
  db: Firestore,
  event: StoredHistoryEvent,
  options: HistoryWriteOptions = {},
): Promise<void> => {
  const docRef = db.collection('itemHistory').doc();
  const payload = toStoredHistoryEvent(event);

  if (options.transaction) {
    options.transaction.set(docRef as DocumentReference<DocumentData>, payload);
    return;
  }

  await docRef.set(payload);
};

export const getItemHistory = async (
  db: Firestore,
  requestedItemId: string,
): Promise<ItemHistoryResponse> => {
  const aggregate = await resolveItemAggregate(db, requestedItemId);
  const [storedHistoryDocs, claimDocs] = await Promise.all([
    queryCollectionByItemIds<StoredHistoryEvent>(db, 'itemHistory', aggregate.candidateItemIds),
    queryCollectionByItemIds<StoredClaim>(db, 'claims', aggregate.candidateItemIds),
  ]);

  const persistedEvents = storedHistoryDocs
    .map((doc) => toHistoryEventResponse(doc.id, doc.data))
    .filter((event): event is ItemHistoryEventResponse => event !== null);

  const existingKeys = new Set(
    persistedEvents.map((event) => buildHistoryKey(event.entityType, event.entityId, event.actionType)),
  );

  const legacyEvents = [
    ...createLegacyReportEvents(aggregate.canonicalItemId, aggregate.reportDoc, existingKeys),
    ...claimDocs.flatMap((claimDoc) => createLegacyClaimEvents(aggregate.canonicalItemId, claimDoc, existingKeys)),
  ];

  const events = [...persistedEvents, ...legacyEvents].sort(sortEventsDescending);

  return {
    itemId: aggregate.canonicalItemId,
    resolvedFrom: aggregate.resolvedFrom,
    title: aggregate.title,
    referenceCode: aggregate.referenceCode,
    currentStatus: aggregate.currentStatus,
    total: events.length,
    events,
  };
};
