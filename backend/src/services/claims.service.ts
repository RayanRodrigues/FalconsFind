import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus } from '../contracts/index.js';
import type { Claim, CreateClaimRequest, RequestAdditionalProofRequest } from '../contracts/index.js';

type StoredClaim = {
  itemId?: string;
  status?: ClaimStatus;
  reviewedAt?: string;
  additionalProofRequest?: string;
  proofRequestedAt?: string;
};

type StoredItem = {
  status?: ItemStatus;
  claimStatus?: ClaimStatus;
  updatedAt?: string;
};

type StoredItemLike = {
  id: string;
  reportId?: string;
  status?: ItemStatus;
  kind?: string;
};

type StoredClaimReviewPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
  reviewedAt: string;
};

type StoredProofRequestPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  additionalProofRequest: string;
  proofRequestedAt: string;
};

type StoredItemProofRequestPatch = Partial<StoredItem> & {
  claimStatus: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  updatedAt: string;
};

type StoredClaimCancellationPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'CANCELLED'>;
};

type StoredItemCancellationPatch = Partial<StoredItem> & {
  status: ItemStatus;
  claimStatus: Extract<ClaimStatus, 'CANCELLED'>;
  updatedAt: string;
};

type StoredItemReviewPatch = Partial<StoredItem> & {
  updatedAt: string;
};

type ClaimUpdateResult = {
  id: string;
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
  itemId: string;
  itemStatus: ItemStatus;
};

type AdditionalProofRequestResult = {
  id: string;
  status: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  additionalProofRequest: string;
  proofRequestedAt: string;
};

type ClaimCancellationResult = {
  id: string;
  status: Extract<ClaimStatus, 'CANCELLED'>;
  itemId: string;
  itemStatus: ItemStatus;
};

export class ClaimNotFoundError extends Error {
  constructor() {
    super('Claim not found');
    this.name = 'ClaimNotFoundError';
  }
}

export class ClaimConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimConflictError';
  }
}

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

type TransactionReader = {
  get<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  get<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
};

const getFirstExistingItemRef = async (
  reader: TransactionReader,
  db: Firestore,
  itemId: string,
): Promise<DocumentReference<DocumentData>> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await reader.get(directItemRef);
  if (directItemSnap.exists) {
    return directItemRef;
  }

  const byReportIdQuery = db.collection('items').where('reportId', '==', itemId).limit(1);
  const byReportIdSnap = await reader.get(byReportIdQuery);
  if (!byReportIdSnap.empty) {
    return byReportIdSnap.docs[0].ref as DocumentReference<DocumentData>;
  }

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await reader.get(legacyReportRef);
  if (legacyReportSnap.exists) {
    return legacyReportRef;
  }

  throw new ClaimItemNotFoundError();
};

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

const resolveTargetItemStatus = (
  targetClaimStatus: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>,
): ItemStatus => (
  targetClaimStatus === ClaimStatus.APPROVED ? ItemStatus.CLAIMED : ItemStatus.VALIDATED
);

const isClaimAwaitingReview = (status: ClaimStatus | undefined): boolean => {
  return status === ClaimStatus.PENDING || status === ClaimStatus.NEEDS_PROOF;
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

export const updateClaimStatus = async (
  db: Firestore,
  claimId: string,
  targetStatus: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>,
): Promise<ClaimUpdateResult> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const claimRef = db.collection('claims').doc(claimId);
    const claimSnap = await transaction.get(claimRef);

    if (!claimSnap.exists) {
      throw new ClaimNotFoundError();
    }

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) {
      throw new ClaimNotFoundError();
    }

    const itemId = claim.itemId?.trim();
    if (!itemId) {
      throw new ClaimItemNotFoundError();
    }

    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be reviewed.');
    }

    const itemRef = await getFirstExistingItemRef(transaction, db, itemId);
    const nextItemStatus = resolveTargetItemStatus(targetStatus);
    const reviewedAt = new Date().toISOString();

    transaction.update(claimRef, {
      status: targetStatus,
      reviewedAt,
    } satisfies StoredClaimReviewPatch);

    transaction.update(itemRef, {
      status: nextItemStatus,
      claimStatus: targetStatus,
      updatedAt: reviewedAt,
    } satisfies StoredItemReviewPatch);

    return {
      id: claimId,
      status: targetStatus,
      itemId,
      itemStatus: nextItemStatus,
    };
  });
};

export const requestAdditionalProof = async (
  db: Firestore,
  claimId: string,
  payload: RequestAdditionalProofRequest,
): Promise<AdditionalProofRequestResult> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const claimRef = db.collection('claims').doc(claimId);
    const claimSnap = await transaction.get(claimRef);

    if (!claimSnap.exists) {
      throw new ClaimNotFoundError();
    }

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) {
      throw new ClaimNotFoundError();
    }

    const itemId = claim.itemId?.trim();
    if (!itemId) {
      throw new ClaimItemNotFoundError();
    }

    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Additional proof can only be requested for pending or proof-requested claims.');
    }

    const itemRef = await getFirstExistingItemRef(transaction, db, itemId);
    const proofRequestedAt = new Date().toISOString();

    transaction.update(claimRef, {
      status: ClaimStatus.NEEDS_PROOF,
      additionalProofRequest: payload.message,
      proofRequestedAt,
    } satisfies StoredProofRequestPatch);

    transaction.update(itemRef, {
      claimStatus: ClaimStatus.NEEDS_PROOF,
      updatedAt: proofRequestedAt,
    } satisfies StoredItemProofRequestPatch);

    return {
      id: claimId,
      status: ClaimStatus.NEEDS_PROOF,
      additionalProofRequest: payload.message,
      proofRequestedAt,
    };
  });
};

export const cancelClaim = async (
  db: Firestore,
  claimId: string,
): Promise<ClaimCancellationResult> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const claimRef = db.collection('claims').doc(claimId);
    const claimSnap = await transaction.get(claimRef);

    if (!claimSnap.exists) {
      throw new ClaimNotFoundError();
    }

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) {
      throw new ClaimNotFoundError();
    }

    const itemId = claim.itemId?.trim();
    if (!itemId) {
      throw new ClaimItemNotFoundError();
    }

    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be cancelled.');
    }

    const itemRef = await getFirstExistingItemRef(transaction, db, itemId);
    const cancelledAt = new Date().toISOString();

    transaction.update(claimRef, {
      status: ClaimStatus.CANCELLED,
    } satisfies StoredClaimCancellationPatch);

    transaction.update(itemRef, {
      status: ItemStatus.VALIDATED,
      claimStatus: ClaimStatus.CANCELLED,
      updatedAt: cancelledAt,
    } satisfies StoredItemCancellationPatch);

    return {
      id: claimId,
      status: ClaimStatus.CANCELLED,
      itemId,
      itemStatus: ItemStatus.VALIDATED,
    };
  });
};
