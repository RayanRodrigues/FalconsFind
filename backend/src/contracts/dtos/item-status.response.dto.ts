import type { ClaimStatus } from '../enums/claim-status.enum.js';

export type ItemAvailability = 'AVAILABLE' | 'CLAIMED';
export type PublicItemStatus = 'VALIDATED' | 'CLAIMED';

export type ItemStatusResponse = {
  id: string;
  status: PublicItemStatus;
  availability: ItemAvailability;
  claimStatus?: ClaimStatus;
};
