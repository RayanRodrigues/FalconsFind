import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { ClaimStatus, ItemStatus, UserRole } from '../contracts/index.js';
import type {
  AdminClaimsListResponse,
  AdminClaimResponse,
  Claim,
  CreateClaimRequest,
  RequestAdditionalProofRequest,
  Report,
  SubmitClaimProofRequest,
  UpdateClaimRequest,
  UserClaimsListResponse,
} from '../contracts/index.js';
import { createChangesFromPatch, recordItemHistoryEvent } from './item-history.service.js';

type StoredClaim = {
  itemId?: string;
  referenceCode?: string;
  claimantUid?: string;
  itemName?: string;
  status?: ClaimStatus;
  claimantName?: string;
  claimantEmail?: string;
  claimReason?: string;
  proofDetails?: string;
  phone?: string;
  createdAt?: string;
  reviewedAt?: string;
  additionalProofRequest?: string;
  proofRequestedAt?: string;
  proofResponseMessage?: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt?: string;
  cancelledAt?: string;
  message?: string;
};

type StoredItem = {
  status?: ItemStatus;
  claimStatus?: ClaimStatus;
  updatedAt?: string;
};

type StoredItemLike = {
  id: string;
  title?: string;
  referenceCode?: string;
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

type StoredItemProofResponsePatch = Partial<StoredItem> & {
  claimStatus: Extract<ClaimStatus, 'PENDING'>;
  updatedAt: string;
};

type StoredClaimCancellationPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'CANCELLED'>;
  cancelledAt: string;
};

type StoredClaimEditPatch = Partial<StoredClaim> & {
  itemName: string;
  claimReason: string;
  proofDetails: string;
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

type ClaimEditResult = Pick<Claim, 'id' | 'itemName' | 'claimReason' | 'proofDetails' | 'phone' | 'status'>;

type SubmitClaimProofResult = {
  id: string;
  status: Extract<ClaimStatus, 'PENDING'>;
  proofResponseMessage: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt: string;
};

type ClaimActor = {
  uid: string;
  role: UserRole;
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

export class ClaimForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimForbiddenError';
  }
}

type SupportedPhotoMimeType = 'image/jpeg' | 'image/png';

const uploadProofPhotoBuffer = async (
  bucket: Bucket,
  buffer: Buffer,
  contentType: SupportedPhotoMimeType,
): Promise<string> => {
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  const fileName = `claims/${Date.now()}-${randomUUID()}.${extension}`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
    public: false,
  });

  return `gs://${bucket.name}/${fileName}`;
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

const toClaimPhotoUrl = async (
  defaultBucket: Bucket,
  value: string,
): Promise<string> => {
  const gs = parseGsUrl(value);
  if (!gs) {
    return value;
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

  return url;
};

const toClaimPhotoUrls = async (
  bucket: Bucket,
  values: string[] | undefined,
): Promise<string[] | undefined> => {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const urls = await Promise.all(
    values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => toClaimPhotoUrl(bucket, value)),
  );

  return urls.length > 0 ? urls : undefined;
};

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

  throw new ClaimItemNotFoundError();
};

const findClaimableItemByReferenceCode = async (db: Firestore, referenceCode: string): Promise<StoredItemLike> => {
  const reportsSnap = await db
    .collection('reports')
    .where('referenceCode', '==', referenceCode)
    .limit(1)
    .get();
  if (!reportsSnap.empty) {
    const doc = reportsSnap.docs[0];
    return { id: doc.id, ...(doc.data() as DocumentData) } as StoredItemLike;
  }

  const itemsSnap = await db
    .collection('items')
    .where('referenceCode', '==', referenceCode)
    .limit(1)
    .get();
  if (!itemsSnap.empty) {
    const doc = itemsSnap.docs[0];
    return { id: doc.id, ...(doc.data() as DocumentData) } as StoredItemLike;
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

const extractLegacyClaimFields = (
  message?: string,
): Pick<AdminClaimResponse, 'claimReason' | 'proofDetails' | 'phone'> => {
  if (!message?.trim()) {
    return {
      claimReason: '',
      proofDetails: '',
    };
  }

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

  if (!claimReason && !proofDetails) {
    claimReason = message.trim();
  }

  return {
    claimReason,
    proofDetails,
    phone,
  };
};

const getRelatedItemMetadata = async (
  db: Firestore,
  itemId: string,
): Promise<{ referenceCode?: string; itemName?: string }> => {
  const directItemRef = db.collection('items').doc(itemId);
  const directItemSnap = await directItemRef.get();
  if (directItemSnap.exists) {
    const data = directItemSnap.data() as StoredItemLike | undefined;
    return {
      referenceCode: data?.referenceCode,
      itemName: data?.title,
    };
  }

  const byReportIdSnap = await db.collection('items').where('reportId', '==', itemId).limit(1).get();
  if (!byReportIdSnap.empty) {
    const data = byReportIdSnap.docs[0].data() as StoredItemLike | undefined;
    return {
      referenceCode: data?.referenceCode,
      itemName: data?.title,
    };
  }

  const legacyReportRef = db.collection('reports').doc(itemId);
  const legacyReportSnap = await legacyReportRef.get();
  if (legacyReportSnap.exists) {
    const data = legacyReportSnap.data() as Report | undefined;
    return {
      referenceCode: data?.referenceCode,
      itemName: data?.title,
    };
  }

  return {};
};

export const createClaim = async (
  db: Firestore,
  payload: CreateClaimRequest,
  actor: { uid: string },
): Promise<{ id: string; claim: Claim }> => {
  const targetItem = await findClaimableItemByReferenceCode(db, payload.referenceCode);
  if (targetItem.status !== ItemStatus.VALIDATED || targetItem.kind !== 'FOUND') {
    throw new ClaimItemNotEligibleError();
  }

  const createdAt = new Date().toISOString();
  const claimToSave: Omit<Claim, 'id'> = {
    itemId: targetItem.id,
    referenceCode: payload.referenceCode,
    claimantUid: actor.uid,
    itemName: payload.itemName,
    status: ClaimStatus.PENDING,
    claimantName: payload.claimantName,
    claimantEmail: payload.claimantEmail,
    claimReason: payload.claimReason,
    proofDetails: payload.proofDetails,
    createdAt,
  };

  if (payload.phone?.trim()) {
    claimToSave.phone = payload.phone.trim();
  }

  const docRef = db.collection('claims').doc();
  await docRef.set(claimToSave);
  try {
    await recordItemHistoryEvent(db, {
      itemId: targetItem.id,
      entityType: 'CLAIM',
      entityId: docRef.id,
      actionType: 'CLAIM_CREATED',
      timestamp: createdAt,
      summary: 'Claim request submitted.',
      actor: {
        type: 'USER',
        uid: actor.uid,
        email: payload.claimantEmail,
      },
      metadata: {
        referenceCode: payload.referenceCode,
        claimStatus: ClaimStatus.PENDING,
        itemStatus: targetItem.status,
      },
    });
  } catch (error) {
    console.error('Failed to record item history for claim creation', {
      error,
      itemId: targetItem.id,
      claimId: docRef.id,
    });
  }

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

    const { ref: itemRef, data: item } = await getFirstExistingItem(transaction, db, itemId);
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
    await recordItemHistoryEvent(db, {
      itemId,
      entityType: 'CLAIM',
      entityId: claimId,
      actionType: targetStatus === ClaimStatus.APPROVED ? 'CLAIM_APPROVED' : 'CLAIM_REJECTED',
      timestamp: reviewedAt,
      summary: targetStatus === ClaimStatus.APPROVED ? 'Claim approved by staff.' : 'Claim rejected by staff.',
      actor: {
        type: 'SECURITY',
      },
      metadata: {
        claimStatus: targetStatus,
        itemStatus: nextItemStatus,
        referenceCode: claim.referenceCode,
      },
      changes: [
        {
          field: 'claim.status',
          previousValue: claim.status,
          newValue: targetStatus,
        },
        {
          field: 'item.status',
          previousValue: item.status,
          newValue: nextItemStatus,
        },
      ],
    }, {
      transaction,
    });

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
    await recordItemHistoryEvent(db, {
      itemId,
      entityType: 'CLAIM',
      entityId: claimId,
      actionType: 'CLAIM_PROOF_REQUESTED',
      timestamp: proofRequestedAt,
      summary: 'Additional proof requested for claim.',
      actor: {
        type: 'SECURITY',
      },
      metadata: {
        claimStatus: ClaimStatus.NEEDS_PROOF,
        referenceCode: claim.referenceCode,
      },
      changes: [{
        field: 'claim.status',
        previousValue: claim.status,
        newValue: ClaimStatus.NEEDS_PROOF,
      }],
    }, {
      transaction,
    });

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
  actor: ClaimActor,
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

    if (
      actor.role === UserRole.STUDENT &&
      (!claim.claimantUid || claim.claimantUid !== actor.uid)
    ) {
      throw new ClaimForbiddenError('You can only cancel your own claim requests.');
    }

    const { ref: itemRef, data: item } = await getFirstExistingItem(transaction, db, itemId);
    const cancelledAt = new Date().toISOString();
    const nextItemStatus = item.status ?? ItemStatus.VALIDATED;

    transaction.update(claimRef, {
      status: ClaimStatus.CANCELLED,
      cancelledAt,
    } satisfies StoredClaimCancellationPatch);

    transaction.update(itemRef, {
      status: nextItemStatus,
      claimStatus: ClaimStatus.CANCELLED,
      updatedAt: cancelledAt,
    } satisfies StoredItemCancellationPatch);
    await recordItemHistoryEvent(db, {
      itemId,
      entityType: 'CLAIM',
      entityId: claimId,
      actionType: 'CLAIM_CANCELLED',
      timestamp: cancelledAt,
      summary: actor.role === UserRole.STUDENT ? 'Claim cancelled by claimant.' : 'Claim cancelled by staff.',
      actor: {
        type: actor.role === UserRole.ADMIN ? 'ADMIN' : actor.role === UserRole.SECURITY ? 'SECURITY' : 'USER',
        uid: actor.uid,
        role: actor.role,
      },
      metadata: {
        claimStatus: ClaimStatus.CANCELLED,
        itemStatus: nextItemStatus,
        referenceCode: claim.referenceCode,
      },
      changes: [{
        field: 'claim.status',
        previousValue: claim.status,
        newValue: ClaimStatus.CANCELLED,
      }],
    }, {
      transaction,
    });

    return {
      id: claimId,
      status: ClaimStatus.CANCELLED,
      itemId,
      itemStatus: nextItemStatus,
    };
  });
};

export const updateClaim = async (
  db: Firestore,
  claimId: string,
  payload: UpdateClaimRequest,
  actor: { uid: string },
): Promise<ClaimEditResult> => {
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

    const claimantUid = claim.claimantUid?.trim();
    if (!claimantUid || claimantUid !== actor.uid) {
      throw new ClaimForbiddenError('You can only edit your own claim requests.');
    }

    const itemId = claim.itemId?.trim();
    if (!itemId) {
      throw new ClaimItemNotFoundError();
    }

    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be edited.');
    }

    const nextPhone = payload.phone?.trim() ? payload.phone.trim() : undefined;
    const patch: StoredClaimEditPatch & { phone?: string } = {
      itemName: payload.itemName.trim(),
      claimReason: payload.claimReason.trim(),
      proofDetails: payload.proofDetails.trim(),
    };

    if (nextPhone) {
      patch.phone = nextPhone;
    } else if (typeof claim.phone === 'string') {
      patch.phone = '';
    }

    transaction.update(claimRef, patch);
    const changes = createChangesFromPatch(claim as Record<string, unknown>, patch as Record<string, unknown>);
    if (changes.length > 0) {
      await recordItemHistoryEvent(db, {
        itemId,
        entityType: 'CLAIM',
        entityId: claimId,
        actionType: 'CLAIM_UPDATED',
        timestamp: new Date().toISOString(),
        summary: 'Claim details updated.',
        actor: {
          type: 'USER',
          uid: actor.uid,
        },
        metadata: {
          claimStatus: claim.status,
          referenceCode: claim.referenceCode,
        },
        changes,
      }, {
        transaction,
      });
    }

    return {
      id: claimId,
      status: claim.status as ClaimStatus,
      itemName: patch.itemName,
      claimReason: patch.claimReason,
      proofDetails: patch.proofDetails,
      phone: nextPhone,
    };
  });
};

export const submitClaimProof = async (
  db: Firestore,
  bucket: Bucket,
  claimId: string,
  payload: SubmitClaimProofRequest,
  photos: Array<{ buffer: Buffer; mimeType: SupportedPhotoMimeType }>,
  actor: { uid: string },
): Promise<SubmitClaimProofResult> => {
  const storedProofResponsePhotoUrls = photos.length > 0
    ? await Promise.all(photos.map((photo) => uploadProofPhotoBuffer(bucket, photo.buffer, photo.mimeType)))
    : undefined;

  const result = await db.runTransaction(async (transaction: Transaction) => {
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
    const claimantUid = claim.claimantUid?.trim();
    if (!itemId) {
      throw new ClaimItemNotFoundError();
    }

    if (!claimantUid || claimantUid !== actor.uid) {
      throw new ClaimForbiddenError('You can only submit proof for your own claim requests.');
    }

    if (claim.status !== ClaimStatus.NEEDS_PROOF) {
      throw new ClaimConflictError('Additional proof can only be submitted when a claim is awaiting more proof.');
    }

    const itemRef = await getFirstExistingItemRef(transaction, db, itemId);
    const proofRespondedAt = new Date().toISOString();

    transaction.update(claimRef, {
      status: ClaimStatus.PENDING,
      proofResponseMessage: payload.message,
      proofResponsePhotoUrls: storedProofResponsePhotoUrls,
      proofRespondedAt,
    } satisfies Partial<StoredClaim> & {
      status: Extract<ClaimStatus, 'PENDING'>;
      proofResponseMessage: string;
      proofResponsePhotoUrls?: string[];
      proofRespondedAt: string;
    });

    transaction.update(itemRef, {
      claimStatus: ClaimStatus.PENDING,
      updatedAt: proofRespondedAt,
    } satisfies StoredItemProofResponsePatch);
    await recordItemHistoryEvent(db, {
      itemId,
      entityType: 'CLAIM',
      entityId: claimId,
      actionType: 'CLAIM_PROOF_SUBMITTED',
      timestamp: proofRespondedAt,
      summary: 'Additional proof submitted for claim.',
      actor: {
        type: 'USER',
        uid: actor.uid,
      },
      metadata: {
        claimStatus: ClaimStatus.PENDING,
        referenceCode: claim.referenceCode,
      },
      changes: [{
        field: 'claim.status',
        previousValue: claim.status,
        newValue: ClaimStatus.PENDING,
      }],
    }, {
      transaction,
    });

    return {
      id: claimId,
      status: ClaimStatus.PENDING,
      proofResponseMessage: payload.message,
      proofResponsePhotoUrls: storedProofResponsePhotoUrls,
      proofRespondedAt,
    };
  });

  return {
    id: result.id,
    status: ClaimStatus.PENDING,
    proofResponseMessage: result.proofResponseMessage,
    proofResponsePhotoUrls: await toClaimPhotoUrls(bucket, result.proofResponsePhotoUrls),
    proofRespondedAt: result.proofRespondedAt,
  };
};

const mapStoredClaimToAdminClaim = async (
  db: Firestore,
  bucket: Bucket,
  id: string,
  data: StoredClaim,
): Promise<AdminClaimResponse | null> => {
  const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
  const claimantName = typeof data.claimantName === 'string' ? data.claimantName.trim() : '';
  const claimantEmail = typeof data.claimantEmail === 'string' ? data.claimantEmail.trim() : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt.trim() : '';
  const status = data.status;

  if (!itemId || !claimantName || !claimantEmail || !createdAt || !status) {
    return null;
  }

  const relatedItem = await getRelatedItemMetadata(db, itemId);
  const legacyFields = extractLegacyClaimFields(data.message);
  const referenceCode = typeof data.referenceCode === 'string' && data.referenceCode.trim()
    ? data.referenceCode.trim()
    : (relatedItem.referenceCode?.trim() || itemId);
  const itemName = typeof data.itemName === 'string' && data.itemName.trim()
    ? data.itemName.trim()
    : (relatedItem.itemName?.trim() || 'Unknown item');
  const claimReason = typeof data.claimReason === 'string' && data.claimReason.trim()
    ? data.claimReason.trim()
    : (legacyFields.claimReason || 'No claim reason provided.');
  const proofDetails = typeof data.proofDetails === 'string' && data.proofDetails.trim()
    ? data.proofDetails.trim()
    : (legacyFields.proofDetails || 'No proof details provided.');
  const phone = typeof data.phone === 'string' && data.phone.trim()
    ? data.phone.trim()
    : legacyFields.phone;
  const proofResponsePhotoUrls = await toClaimPhotoUrls(
    bucket,
    Array.isArray(data.proofResponsePhotoUrls)
      ? data.proofResponsePhotoUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined,
  );

  return {
    id,
    itemId,
    referenceCode,
    itemName,
    claimantName,
    claimantEmail,
    claimReason,
    proofDetails,
    phone,
    status,
    additionalProofRequest:
      typeof data.additionalProofRequest === 'string' && data.additionalProofRequest.trim()
        ? data.additionalProofRequest.trim()
        : undefined,
    proofRequestedAt:
      typeof data.proofRequestedAt === 'string' && data.proofRequestedAt.trim()
        ? data.proofRequestedAt.trim()
        : undefined,
    proofResponseMessage:
      typeof data.proofResponseMessage === 'string' && data.proofResponseMessage.trim()
        ? data.proofResponseMessage.trim()
        : undefined,
    proofResponsePhotoUrls,
    proofRespondedAt:
      typeof data.proofRespondedAt === 'string' && data.proofRespondedAt.trim()
        ? data.proofRespondedAt.trim()
        : undefined,
    createdAt,
  };
};

export const listAdminClaims = async (db: Firestore, bucket: Bucket): Promise<AdminClaimsListResponse> => {
  const snapshot = await db.collection('claims').get();
  const claims = (await Promise.all(
    snapshot.docs.map((doc) => mapStoredClaimToAdminClaim(db, bucket, doc.id, (doc.data() as StoredClaim | undefined) ?? {})),
  ))
    .filter((claim): claim is AdminClaimResponse => claim !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    claims,
    total: claims.length,
    summary: {
      totalClaims: claims.length,
      pendingClaims: claims.filter((claim) => claim.status === ClaimStatus.PENDING).length,
      needsProofClaims: claims.filter((claim) => claim.status === ClaimStatus.NEEDS_PROOF).length,
      approvedClaims: claims.filter((claim) => claim.status === ClaimStatus.APPROVED).length,
      rejectedClaims: claims.filter((claim) => claim.status === ClaimStatus.REJECTED).length,
      cancelledClaims: claims.filter((claim) => claim.status === ClaimStatus.CANCELLED).length,
    },
  };
};

const mapStoredClaimToUserClaim = async (
  bucket: Bucket,
  id: string,
  data: StoredClaim,
): Promise<Claim | null> => {
  const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
  const claimantUid = typeof data.claimantUid === 'string' ? data.claimantUid.trim() : '';
  const claimantName = typeof data.claimantName === 'string' ? data.claimantName.trim() : '';
  const claimantEmail = typeof data.claimantEmail === 'string' ? data.claimantEmail.trim() : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt.trim() : '';
  const status = data.status;

  if (!itemId || !claimantUid || !claimantName || !claimantEmail || !createdAt || !status) {
    return null;
  }

  const legacyFields = extractLegacyClaimFields(data.message);
  const referenceCode = typeof data.referenceCode === 'string' && data.referenceCode.trim()
    ? data.referenceCode.trim()
    : itemId;
  const itemName = typeof data.itemName === 'string' && data.itemName.trim()
    ? data.itemName.trim()
    : 'Unknown item';
  const claimReason = typeof data.claimReason === 'string' && data.claimReason.trim()
    ? data.claimReason.trim()
    : (legacyFields.claimReason || 'No claim reason provided.');
  const proofDetails = typeof data.proofDetails === 'string' && data.proofDetails.trim()
    ? data.proofDetails.trim()
    : (legacyFields.proofDetails || 'No proof details provided.');
  const phone = typeof data.phone === 'string' && data.phone.trim()
    ? data.phone.trim()
    : legacyFields.phone;
  const proofResponsePhotoUrls = await toClaimPhotoUrls(
    bucket,
    Array.isArray(data.proofResponsePhotoUrls)
      ? data.proofResponsePhotoUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined,
  );

  return {
    id,
    itemId,
    claimantUid,
    referenceCode,
    itemName,
    claimantName,
    claimantEmail,
    claimReason,
    proofDetails,
    phone,
    status,
    additionalProofRequest:
      typeof data.additionalProofRequest === 'string' && data.additionalProofRequest.trim()
        ? data.additionalProofRequest.trim()
        : undefined,
    proofRequestedAt:
      typeof data.proofRequestedAt === 'string' && data.proofRequestedAt.trim()
        ? data.proofRequestedAt.trim()
        : undefined,
    proofResponseMessage:
      typeof data.proofResponseMessage === 'string' && data.proofResponseMessage.trim()
        ? data.proofResponseMessage.trim()
        : undefined,
    proofResponsePhotoUrls,
    proofRespondedAt:
      typeof data.proofRespondedAt === 'string' && data.proofRespondedAt.trim()
        ? data.proofRespondedAt.trim()
        : undefined,
    createdAt,
  };
};

export const listClaimsForUser = async (
  db: Firestore,
  bucket: Bucket,
  uid: string,
): Promise<UserClaimsListResponse> => {
  const snapshot = await db.collection('claims').where('claimantUid', '==', uid).get();
  const claims = (await Promise.all(
    snapshot.docs.map((doc) => mapStoredClaimToUserClaim(bucket, doc.id, (doc.data() as StoredClaim | undefined) ?? {})),
  ))
    .filter((claim): claim is Claim => claim !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    claims,
    total: claims.length,
    summary: {
      totalClaims: claims.length,
      pendingClaims: claims.filter((claim) => claim.status === ClaimStatus.PENDING).length,
      needsProofClaims: claims.filter((claim) => claim.status === ClaimStatus.NEEDS_PROOF).length,
      approvedClaims: claims.filter((claim) => claim.status === ClaimStatus.APPROVED).length,
      rejectedClaims: claims.filter((claim) => claim.status === ClaimStatus.REJECTED).length,
      cancelledClaims: claims.filter((claim) => claim.status === ClaimStatus.CANCELLED).length,
    },
  };
};
