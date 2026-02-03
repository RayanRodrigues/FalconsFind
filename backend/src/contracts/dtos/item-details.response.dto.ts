import type { ItemStatus } from '../enums/item-status.enum';
import type { ClaimStatus } from '../enums/claim-status.enum';

export type ItemDetailsResponse = {
  id: string;
  title: string;
  description?: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  imageUrls?: string[];
  claimStatus?: ClaimStatus;
};
