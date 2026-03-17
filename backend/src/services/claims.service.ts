import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus } from '../contracts/index.js';
import type { Claim, CreateClaimRequest } from '../contracts/index.js';

type StoredItemLike = {
  id: string;
  reportId?: string;
  status?: ItemStatus;
  // `kind` differentiates between LOST and FOUND (and possibly other kinds).
  // It is used to ensure only found items are eligible for claim creation.
  kind?: string;
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
    const data = directItemSnapshot.data() as DocumentData;
    return {
      id: directItemSnapshot.id,
      ...data,
    } as StoredItemLike;
  }

  const itemByReportSnapshot = await db
    .collection('items')
    .where('reportId', '==', itemId)
    .limit(1)
    .get();
  if (!itemByReportSnapshot.empty) {
    const doc = itemByReportSnapshot.docs[0];
    const data = doc.data() as DocumentData;
    return {
      id: doc.id,
      ...data,
    } as StoredItemLike;
  }

  const reportSnapshot = await db.collection('reports').doc(itemId).get();
  if (reportSnapshot.exists) {
    const data = reportSnapshot.data() as DocumentData;
    return {
      id: reportSnapshot.id,
      ...data,
    } as StoredItemLike;
  }

  throw new ClaimItemNotFoundError();
};

export const createClaim = async (
  db: Firestore,
  payload: CreateClaimRequest,
): Promise<{ id: string; claim: Claim }> => {
  const targetItem = await findClaimableItem(db, payload.itemId);
  if (targetItem.status !== ItemStatus.VALIDATED || targetItem.kind !== 'FOUND') {
    throw new ClaimItemNotEligibleError();
  }

  const createdAt = new Date().toISOString();
  const claimToSave: Omit<Claim, 'id'> = {
    itemId: targetItem.id,
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
