import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ClaimStatus, ItemStatus } from '../../contracts/index.js';
import type { Claim, CreateClaimRequest, UpdateClaimRequest } from '../../contracts/index.js';
import { createChangesFromPatch, recordItemHistoryEvent } from '../item-history.service.js';
import {
  ClaimConflictError,
  ClaimForbiddenError,
  ClaimItemNotEligibleError,
  ClaimItemNotFoundError,
  ClaimNotFoundError,
} from './claim-errors.js';
import { findClaimableItemByReferenceCode, isClaimAwaitingReview } from './claim-shared.js';
import type { ClaimEditResult, StoredClaim, StoredClaimEditPatch } from './claim-types.js';

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
  if (payload.phone?.trim()) claimToSave.phone = payload.phone.trim();

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
      actor: { type: 'USER', uid: actor.uid, email: payload.claimantEmail },
      metadata: { referenceCode: payload.referenceCode, claimStatus: ClaimStatus.PENDING, itemStatus: targetItem.status },
    });
  } catch (error) {
    console.error('Failed to record item history for claim creation', { error, itemId: targetItem.id, claimId: docRef.id });
  }

  return { id: docRef.id, claim: { id: docRef.id, ...claimToSave } };
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
    if (!claimSnap.exists) throw new ClaimNotFoundError();

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) throw new ClaimNotFoundError();

    const claimantUid = claim.claimantUid?.trim();
    if (!claimantUid || claimantUid !== actor.uid) {
      throw new ClaimForbiddenError('You can only edit your own claim requests.');
    }

    const itemId = claim.itemId?.trim();
    if (!itemId) throw new ClaimItemNotFoundError();
    if (!isClaimAwaitingReview(claim.status)) {
      throw new ClaimConflictError('Only pending or proof-requested claims can be edited.');
    }

    const nextPhone = payload.phone?.trim() ? payload.phone.trim() : undefined;
    const patch: StoredClaimEditPatch & { phone?: string } = {
      itemName: payload.itemName.trim(),
      claimReason: payload.claimReason.trim(),
      proofDetails: payload.proofDetails.trim(),
    };
    if (nextPhone) patch.phone = nextPhone;
    else if (typeof claim.phone === 'string') patch.phone = '';

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
        actor: { type: 'USER', uid: actor.uid },
        metadata: { claimStatus: claim.status, referenceCode: claim.referenceCode },
        changes,
      }, { transaction });
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
