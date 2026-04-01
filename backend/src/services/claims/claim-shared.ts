import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { AdminClaimResponse, ClaimStatus, Report } from '../../contracts/index.js';
import { ClaimStatus as ClaimStatusEnum, ItemStatus } from '../../contracts/index.js';
import { ClaimItemNotFoundError } from './claim-errors.js';
import type {
  ResolvedStoredItem,
  StoredItem,
  StoredItemLike,
  TransactionReader,
} from './claim-types.js';

export const getFirstExistingItemRef = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<DocumentReference<DocumentData>> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await reader.get(directItemRef);
  if (directItemSnap.exists) return directItemRef;

  const byReportIdQuery = db.collection('items').where('reportId', '==', itemId).limit(1);
  const byReportIdSnap = await reader.get(byReportIdQuery);
  if (!byReportIdSnap.empty) return byReportIdSnap.docs[0].ref as DocumentReference<DocumentData>;

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await reader.get(legacyReportRef);
  if (legacyReportSnap.exists) return legacyReportRef;

  throw new ClaimItemNotFoundError();
};

export const getFirstExistingItem = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<ResolvedStoredItem> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await reader.get(directItemRef);
  if (directItemSnap.exists) {
    return { ref: directItemRef, data: (directItemSnap.data() as StoredItem | undefined) ?? {} };
  }

  const byReportIdQuery = db.collection('items').where('reportId', '==', itemId).limit(1);
  const byReportIdSnap = await reader.get(byReportIdQuery);
  if (!byReportIdSnap.empty) {
    const matchedRef = byReportIdSnap.docs[0].ref as DocumentReference<DocumentData>;
    return { ref: matchedRef, data: (byReportIdSnap.docs[0].data() as StoredItem | undefined) ?? {} };
  }

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await reader.get(legacyReportRef);
  if (legacyReportSnap.exists) {
    return { ref: legacyReportRef, data: (legacyReportSnap.data() as StoredItem | undefined) ?? {} };
  }

  throw new ClaimItemNotFoundError();
};

export const findClaimableItemByReferenceCode = async (db: Firestore, referenceCode: string): Promise<StoredItemLike> => {
  const reportsSnap = await db.collection('reports').where('referenceCode', '==', referenceCode).limit(1).get();
  if (!reportsSnap.empty) {
    const doc = reportsSnap.docs[0];
    return { id: doc.id, ...(doc.data() as DocumentData) } as StoredItemLike;
  }

  const itemsSnap = await db.collection('items').where('referenceCode', '==', referenceCode).limit(1).get();
  if (!itemsSnap.empty) {
    const doc = itemsSnap.docs[0];
    return { id: doc.id, ...(doc.data() as DocumentData) } as StoredItemLike;
  }

  throw new ClaimItemNotFoundError();
};

export const resolveTargetItemStatus = (
  targetClaimStatus: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>,
): ItemStatus => (targetClaimStatus === ClaimStatusEnum.APPROVED ? ItemStatus.CLAIMED : ItemStatus.VALIDATED);

export const isClaimAwaitingReview = (status: ClaimStatus | undefined): boolean => {
  return status === ClaimStatusEnum.PENDING || status === ClaimStatusEnum.NEEDS_PROOF;
};

export const extractLegacyClaimFields = (
  message?: string,
): Pick<AdminClaimResponse, 'claimReason' | 'proofDetails' | 'phone'> => {
  if (!message?.trim()) return { claimReason: '', proofDetails: '' };

  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let claimReason = '';
  let proofDetails = '';
  let phone: string | undefined;

  for (const line of lines) {
    if (line.startsWith('Claim Reason:')) {
      claimReason = line.slice('Claim Reason:'.length).trim();
      continue;
    }
    if (line.startsWith('Proof of Ownership:')) {
      proofDetails = line.slice('Proof of Ownership:'.length).trim();
      continue;
    }
    if (line.startsWith('Phone:')) {
      const value = line.slice('Phone:'.length).trim();
      phone = value || undefined;
    }
  }

  if (!claimReason && !proofDetails) claimReason = message.trim();
  return { claimReason, proofDetails, phone };
};

export const getRelatedItemMetadata = async (
  db: Firestore,
  itemId: string,
): Promise<{ referenceCode?: string; itemName?: string }> => {
  const directItemSnap = await db.collection('items').doc(itemId).get();
  if (directItemSnap.exists) {
    const data = directItemSnap.data() as StoredItemLike | undefined;
    return { referenceCode: data?.referenceCode, itemName: data?.title };
  }

  const byReportIdSnap = await db.collection('items').where('reportId', '==', itemId).limit(1).get();
  if (!byReportIdSnap.empty) {
    const data = byReportIdSnap.docs[0].data() as StoredItemLike | undefined;
    return { referenceCode: data?.referenceCode, itemName: data?.title };
  }

  const legacyReportSnap = await db.collection('reports').doc(itemId).get();
  if (legacyReportSnap.exists) {
    const data = legacyReportSnap.data() as Report | undefined;
    return { referenceCode: data?.referenceCode, itemName: data?.title };
  }

  return {};
};
