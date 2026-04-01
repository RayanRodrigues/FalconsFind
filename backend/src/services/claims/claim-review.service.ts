import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus, UserRole } from '../../contracts/index.js';
import type { RequestAdditionalProofRequest } from '../../contracts/index.js';
import { recordItemHistoryEvent } from '../item-history.service.js';
import {
  ClaimConflictError,
  ClaimForbiddenError,
  ClaimItemNotFoundError,
  ClaimNotFoundError,
} from './claim-errors.js';
import {
  getFirstExistingItem,
  getFirstExistingItemRef,
  isClaimAwaitingReview,
  resolveTargetItemStatus,
} from './claim-shared.js';
import type {
  AdditionalProofRequestResult,
  ClaimActor,
  ClaimCancellationResult,
  ClaimUpdateResult,
  StoredClaim,
  StoredClaimCancellationPatch,
  StoredClaimReviewPatch,
  StoredItemCancellationPatch,
  StoredItemProofRequestPatch,
  StoredItemReviewPatch,
  StoredProofRequestPatch,
} from './claim-types.js';

export const updateClaimStatus = async (
  db: Firestore,
  claimId: string,
  targetStatus: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>,
): Promise<ClaimUpdateResult> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const claimRef = db.collection('claims').doc(claimId);
    const claimSnap = await transaction.get(claimRef);
    if (!claimSnap.exists) throw new ClaimNotFoundError();

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) throw new ClaimNotFoundError();

    const itemId = claim.itemId?.trim();
    if (!itemId) throw new ClaimItemNotFoundError();
    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be reviewed.');
    }

    const { ref: itemRef, data: item } = await getFirstExistingItem(transaction, db, itemId);
    const nextItemStatus = resolveTargetItemStatus(targetStatus);
    const reviewedAt = new Date().toISOString();

    transaction.update(claimRef, { status: targetStatus, reviewedAt } satisfies StoredClaimReviewPatch);
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
      actor: { type: 'SECURITY' },
      metadata: { claimStatus: targetStatus, itemStatus: nextItemStatus, referenceCode: claim.referenceCode },
      changes: [
        { field: 'claim.status', previousValue: claim.status, newValue: targetStatus },
        { field: 'item.status', previousValue: item.status, newValue: nextItemStatus },
      ],
    }, { transaction });

    return { id: claimId, status: targetStatus, itemId, itemStatus: nextItemStatus };
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
    if (!claimSnap.exists) throw new ClaimNotFoundError();

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) throw new ClaimNotFoundError();

    const itemId = claim.itemId?.trim();
    if (!itemId) throw new ClaimItemNotFoundError();
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
      actor: { type: 'SECURITY' },
      metadata: { claimStatus: ClaimStatus.NEEDS_PROOF, referenceCode: claim.referenceCode },
      changes: [{ field: 'claim.status', previousValue: claim.status, newValue: ClaimStatus.NEEDS_PROOF }],
    }, { transaction });

    return { id: claimId, status: ClaimStatus.NEEDS_PROOF, additionalProofRequest: payload.message, proofRequestedAt };
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
    if (!claimSnap.exists) throw new ClaimNotFoundError();

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) throw new ClaimNotFoundError();

    const itemId = claim.itemId?.trim();
    if (!itemId) throw new ClaimItemNotFoundError();
    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be cancelled.');
    }
    if (actor.role === UserRole.STUDENT && (!claim.claimantUid || claim.claimantUid !== actor.uid)) {
      throw new ClaimForbiddenError('You can only cancel your own claim requests.');
    }

    const { ref: itemRef, data: item } = await getFirstExistingItem(transaction, db, itemId);
    const cancelledAt = new Date().toISOString();
    const nextItemStatus = item.status ?? ItemStatus.VALIDATED;

    transaction.update(claimRef, { status: ClaimStatus.CANCELLED, cancelledAt } satisfies StoredClaimCancellationPatch);
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
      metadata: { claimStatus: ClaimStatus.CANCELLED, itemStatus: nextItemStatus, referenceCode: claim.referenceCode },
      changes: [{ field: 'claim.status', previousValue: claim.status, newValue: ClaimStatus.CANCELLED }],
    }, { transaction });

    return { id: claimId, status: ClaimStatus.CANCELLED, itemId, itemStatus: nextItemStatus };
  });
};
