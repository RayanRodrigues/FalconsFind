import type { ItemStatus } from '../enums/item-status.enum.js';

export type ItemPublicResponse = {
  id: string;
  title: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  thumbnailUrl?: string;
};
