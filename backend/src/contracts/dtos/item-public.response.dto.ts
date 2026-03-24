import type { ItemStatus } from '../enums/item-status.enum.js';
import type { ItemAvailability } from './item-status.response.dto.js';

export type ItemPublicResponse = {
  id: string;
  title: string;
  category?: string;
  status: ItemStatus;
  availability: ItemAvailability;
  referenceCode: string;
  location?: string;
  dateReported: string;
  listedDurationMs: number;
  thumbnailUrl?: string;
};
