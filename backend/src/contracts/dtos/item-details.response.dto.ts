import type { ItemStatus } from '../enums/item-status.enum.js';
import type { ClaimStatus } from '../enums/claim-status.enum.js';
import type { ItemAvailability } from './item-status.response.dto.js';

export type ItemDetailsResponse = {
  id: string;
  title: string;
  category?: string;
  description?: string;
  status: ItemStatus;
  availability: ItemAvailability;
  referenceCode: string;
  location?: string;
  dateReported: string;
  listedDurationMs: number;
  imageUrls?: string[];
  claimStatus?: ClaimStatus;
};
