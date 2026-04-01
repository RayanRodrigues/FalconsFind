import type { DocumentData, DocumentReference } from 'firebase-admin/firestore';
import type { Claim, ClaimStatus, ItemStatus, UserRole } from '../../contracts/index.js';

export type StoredClaim = {
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

export type StoredItem = {
  status?: ItemStatus;
  claimStatus?: ClaimStatus;
  updatedAt?: string;
};

export type StoredItemLike = {
  id: string;
  title?: string;
  referenceCode?: string;
  reportId?: string;
  status?: ItemStatus;
  kind?: string;
};

export type StoredClaimReviewPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
  reviewedAt: string;
};

export type StoredProofRequestPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  additionalProofRequest: string;
  proofRequestedAt: string;
};

export type StoredItemProofRequestPatch = Partial<StoredItem> & {
  claimStatus: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  updatedAt: string;
};

export type StoredItemProofResponsePatch = Partial<StoredItem> & {
  claimStatus: Extract<ClaimStatus, 'PENDING'>;
  updatedAt: string;
};

export type StoredClaimCancellationPatch = Partial<StoredClaim> & {
  status: Extract<ClaimStatus, 'CANCELLED'>;
  cancelledAt: string;
};

export type StoredClaimEditPatch = Partial<StoredClaim> & {
  itemName: string;
  claimReason: string;
  proofDetails: string;
};

export type StoredItemCancellationPatch = Partial<StoredItem> & {
  status: ItemStatus;
  claimStatus: Extract<ClaimStatus, 'CANCELLED'>;
  updatedAt: string;
};

export type StoredItemReviewPatch = Partial<StoredItem> & {
  updatedAt: string;
};

export type ClaimUpdateResult = {
  id: string;
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
  itemId: string;
  itemStatus: ItemStatus;
};

export type AdditionalProofRequestResult = {
  id: string;
  status: Extract<ClaimStatus, 'NEEDS_PROOF'>;
  additionalProofRequest: string;
  proofRequestedAt: string;
};

export type ClaimCancellationResult = {
  id: string;
  status: Extract<ClaimStatus, 'CANCELLED'>;
  itemId: string;
  itemStatus: ItemStatus;
};

export type ClaimEditResult = Pick<Claim, 'id' | 'itemName' | 'claimReason' | 'proofDetails' | 'phone' | 'status'>;

export type SubmitClaimProofResult = {
  id: string;
  status: Extract<ClaimStatus, 'PENDING'>;
  proofResponseMessage: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt: string;
};

export type ClaimActor = {
  uid: string;
  role: UserRole;
};

export type SupportedPhotoMimeType = 'image/jpeg' | 'image/png';

export type TransactionReader = {
  get<T>(ref: DocumentReference<T>): Promise<import('firebase-admin/firestore').DocumentSnapshot<T>>;
  get<T>(query: import('firebase-admin/firestore').Query<T>): Promise<import('firebase-admin/firestore').QuerySnapshot<T>>;
};

export type ResolvedStoredItem = {
  ref: DocumentReference<DocumentData>;
  data: StoredItem;
};
