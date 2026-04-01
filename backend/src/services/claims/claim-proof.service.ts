import type { Bucket } from '@google-cloud/storage';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ClaimStatus } from '../../contracts/index.js';
import type { SubmitClaimProofRequest } from '../../contracts/index.js';
import { recordItemHistoryEvent } from '../item-history.service.js';
import {
  ClaimConflictError,
  ClaimForbiddenError,
  ClaimItemNotFoundError,
  ClaimNotFoundError,
} from './claim-errors.js';
import { toClaimPhotoUrls, uploadProofPhotoBuffer } from './claim-media.service.js';
import { getFirstExistingItemRef } from './claim-shared.js';
import type {
  StoredClaim,
  StoredItemProofResponsePatch,
  SubmitClaimProofResult,
  SupportedPhotoMimeType,
} from './claim-types.js';

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
    if (!claimSnap.exists) throw new ClaimNotFoundError();

    const claim = claimSnap.data() as StoredClaim | undefined;
    if (!claim) throw new ClaimNotFoundError();

    const itemId = claim.itemId?.trim();
    const claimantUid = claim.claimantUid?.trim();
    if (!itemId) throw new ClaimItemNotFoundError();
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
      actor: { type: 'USER', uid: actor.uid },
      metadata: { claimStatus: ClaimStatus.PENDING, referenceCode: claim.referenceCode },
      changes: [{ field: 'claim.status', previousValue: claim.status, newValue: ClaimStatus.PENDING }],
    }, { transaction });

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
