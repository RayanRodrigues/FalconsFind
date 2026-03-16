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

type StoredClaim = {
  itemId?: string;
  status?: ClaimStatus;
  reviewedAt?: string;
};

type StoredItem = {
  status?: ItemStatus;
  claimStatus?: ClaimStatus;
  updatedAt?: string;
};

type StoredClaimReviewPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
  reviewedAt: string;
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
    super('Claim item not found');
    this.name = 'ClaimItemNotFoundError';
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

const resolveTargetItemStatus = (
  targetClaimStatus: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>,
): ItemStatus => (
  targetClaimStatus === ClaimStatus.APPROVED ? ItemStatus.CLAIMED : ItemStatus.VALIDATED
);

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

    if (claim.status !== ClaimStatus.PENDING) {
      throw new ClaimConflictError('Only pending claims can be reviewed.');
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
