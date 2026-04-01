import type { DocumentData, DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { ItemStatus } from '../../contracts/index.js';
import type {
  ItemStatusResponse,
  Report,
} from '../../contracts/index.js';
import { isProductionApp } from '../../utils/app-env.js';
import { ItemNotFoundError } from './item-errors.js';
import type {
  ItemStatusHistoryRecord,
  StatusChangeActor,
  StoredItem,
  TransactionReader,
} from './item-types.js';

export const isVisibleInCurrentEnvironment = (sourceEnv: Report['sourceEnv'] | undefined): boolean => {
  if (!isProductionApp()) {
    return true;
  }

  return sourceEnv === undefined || sourceEnv === 'production';
};

export const getRefCollectionName = (ref: DocumentReference<DocumentData>): string => {
  const parentId = (ref.parent as { id?: string } | undefined)?.id;
  if (typeof parentId === 'string') {
    return parentId;
  }

  return (ref as { collectionName?: string }).collectionName ?? '';
};

export const isPublicItemStatus = (status: ItemStatus | undefined): status is ItemStatus.VALIDATED | ItemStatus.CLAIMED => (
  status === ItemStatus.VALIDATED || status === ItemStatus.CLAIMED
);

export const toItemAvailability = (
  status: ItemStatus.VALIDATED | ItemStatus.CLAIMED,
): ItemStatusResponse['availability'] => (
  status === ItemStatus.CLAIMED ? 'CLAIMED' : 'AVAILABLE'
);

export const getFirstExistingItem = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<{ ref: DocumentReference<DocumentData>; data: StoredItem }> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await reader.get(directItemRef);
  if (directItemSnap.exists) {
    return { ref: directItemRef, data: (directItemSnap.data() as StoredItem | undefined) ?? {} };
  }

  const byReportIdSnap = await reader.get(db.collection('items').where('reportId', '==', itemId).limit(1));
  if (!byReportIdSnap.empty) {
    const matchedRef = byReportIdSnap.docs[0].ref as DocumentReference<DocumentData>;
    return { ref: matchedRef, data: (byReportIdSnap.docs[0].data() as StoredItem | undefined) ?? {} };
  }

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await reader.get(legacyReportRef);
  if (legacyReportSnap.exists) {
    return { ref: legacyReportRef, data: (legacyReportSnap.data() as StoredItem | undefined) ?? {} };
  }

  throw new ItemNotFoundError();
};

export const getStatusHistoryEntries = async (
  reader: TransactionReader,
  db: Firestore,
  historyItemId: string,
): Promise<ItemStatusHistoryRecord[]> => {
  const snapshot = await reader.get(db.collection('itemStatusHistory').where('itemId', '==', historyItemId));
  return snapshot.docs
    .map((doc) => doc.data() as ItemStatusHistoryRecord)
    .filter((entry) => Object.values(ItemStatus).includes(entry.previousStatus) && Object.values(ItemStatus).includes(entry.nextStatus));
};

export const writeStatusHistoryRecord = (
  db: Firestore,
  transaction: Transaction,
  itemId: string,
  previousStatus: ItemStatus,
  nextStatus: ItemStatus,
  actor: StatusChangeActor,
  changedAt: string,
) => {
  const historyRef = db.collection('itemStatusHistory').doc(randomUUID());
  const record: ItemStatusHistoryRecord = {
    itemId,
    previousStatus,
    nextStatus,
    changedAt,
  };

  if (actor.uid) record.changedByUid = actor.uid;
  if (actor.email !== undefined) record.changedByEmail = actor.email ?? null;
  if (actor.role) record.changedByRole = actor.role;

  transaction.set(historyRef, record);
};

export const allowedStatusTransitions: Record<ItemStatus, ItemStatus[]> = {
  [ItemStatus.REPORTED]: [ItemStatus.VALIDATED, ItemStatus.ARCHIVED],
  [ItemStatus.PENDING_VALIDATION]: [ItemStatus.VALIDATED, ItemStatus.ARCHIVED],
  [ItemStatus.VALIDATED]: [ItemStatus.CLAIMED, ItemStatus.RETURNED, ItemStatus.ARCHIVED],
  [ItemStatus.CLAIMED]: [ItemStatus.RETURNED, ItemStatus.ARCHIVED],
  [ItemStatus.RETURNED]: [ItemStatus.ARCHIVED],
  [ItemStatus.ARCHIVED]: [],
};

export const createStatusPatch = (
  nextStatus: ItemStatus,
  updatedAt: string,
  actor: StatusChangeActor,
): Partial<StoredItem> => {
  const patch: Partial<StoredItem> = {
    status: nextStatus,
    updatedAt,
    statusUpdatedAt: updatedAt,
    statusUpdatedByEmail: actor.email ?? null,
    archivedAt: nextStatus === ItemStatus.ARCHIVED ? updatedAt : null,
  };

  if (actor.uid) patch.statusUpdatedByUid = actor.uid;
  if (actor.role) patch.statusUpdatedByRole = actor.role;
  return patch;
};

export const getStatusSyncTargets = async (
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
    targetRefs: targetRefs.filter((targetRef, index, refs) => refs.findIndex((value) => value.path === targetRef.path) === index),
    canonicalItemId,
    referenceCode,
  };
};
