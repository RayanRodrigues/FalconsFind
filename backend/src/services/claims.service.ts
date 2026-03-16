import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus } from '../contracts/index.js';
import type { Claim, CreateClaimRequest } from '../contracts/index.js';

type StoredItemLike = {
  reportId?: string;
  status?: ItemStatus;
};

export class ClaimItemNotFoundError extends Error {
  constructor() {
    super('Item not found');
    this.name = 'ClaimItemNotFoundError';
  }
}

export class ClaimItemNotEligibleError extends Error {
  constructor() {
    super('This item is not eligible for claim requests.');
    this.name = 'ClaimItemNotEligibleError';
  }
}

const findClaimableItem = async (db: Firestore, itemId: string): Promise<StoredItemLike> => {
  const directItemSnapshot = await db.collection('items').doc(itemId).get();
  if (directItemSnapshot.exists) {
    return directItemSnapshot.data() as DocumentData;
  }

  const itemByReportSnapshot = await db
    .collection('items')
    .where('reportId', '==', itemId)
    .limit(1)
    .get();
  if (!itemByReportSnapshot.empty) {
    return itemByReportSnapshot.docs[0].data() as DocumentData;
  }

  const reportSnapshot = await db.collection('reports').doc(itemId).get();
  if (reportSnapshot.exists) {
    return reportSnapshot.data() as DocumentData;
  }

  throw new ClaimItemNotFoundError();
};

export const createClaim = async (
  db: Firestore,
  payload: CreateClaimRequest,
): Promise<{ id: string; claim: Claim }> => {
  const targetItem = await findClaimableItem(db, payload.itemId);
  if (targetItem.status !== ItemStatus.VALIDATED) {
    throw new ClaimItemNotEligibleError();
  }

  const createdAt = new Date().toISOString();
  const claimToSave: Omit<Claim, 'id'> = {
    itemId: payload.itemId,
    status: ClaimStatus.PENDING,
    claimantName: payload.claimantName,
    claimantEmail: payload.claimantEmail,
    createdAt,
  };

  if (payload.message) {
    claimToSave.message = payload.message;
  }

  const docRef = db.collection('claims').doc();
  await docRef.set(claimToSave);

  return {
    id: docRef.id,
    claim: {
      id: docRef.id,
      ...claimToSave,
    },
  };
};
