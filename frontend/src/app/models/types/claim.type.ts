import type { ClaimStatus } from '../enums/claim-status.enum';

export type Claim = {
  id: string;
  itemId: string;
  status: ClaimStatus;
  claimantName: string;
  claimantEmail: string;
  message?: string;
  createdAt: string;
};
