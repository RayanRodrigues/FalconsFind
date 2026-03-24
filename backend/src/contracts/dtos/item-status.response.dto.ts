import type { ItemStatus } from '../enums/item-status.enum.js';
import type { ClaimStatus } from '../enums/claim-status.enum.js';

export type ItemAvailability = 'AVAILABLE' | 'CLAIMED';

export type ItemStatusResponse = {
  id: string;
  status: ItemStatus;
  availability: ItemAvailability;
  claimStatus?: ClaimStatus;
};
