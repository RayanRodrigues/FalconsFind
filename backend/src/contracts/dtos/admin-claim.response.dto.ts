import type { ClaimStatus } from '../enums/claim-status.enum.js';

export type AdminClaimResponse = {
  id: string;
  itemId: string;
  referenceCode: string;
  itemName: string;
  claimantName: string;
  claimantEmail: string;
  claimReason: string;
  proofDetails: string;
  phone?: string;
  status: ClaimStatus;
  additionalProofRequest?: string;
  proofRequestedAt?: string;
  proofResponseMessage?: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt?: string;
  createdAt: string;
};
