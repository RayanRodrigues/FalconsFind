import type { ClaimStatus } from '../enums/claim-status.enum.js';

export type Claim = {
  id: string;
  itemId: string;
  referenceCode: string;
  claimantUid: string;
  itemName: string;
  status: ClaimStatus;
  claimantName: string;
  claimantEmail: string;
  claimReason: string;
  proofDetails: string;
  phone?: string;
  additionalProofRequest?: string;
  proofRequestedAt?: string;
  proofResponseMessage?: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt?: string;
  createdAt: string;
};
