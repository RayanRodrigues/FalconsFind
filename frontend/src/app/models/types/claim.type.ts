import type { ClaimStatus } from '../enums/claim-status.enum';

export type Claim = {
  id: string;
  itemId: string;
  referenceCode: string;
  status: ClaimStatus;
  itemName: string;
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
