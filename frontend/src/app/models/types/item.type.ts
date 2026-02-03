import type { ItemStatus } from '../enums/item-status.enum';

export type Item = {
  id: string;
  title: string;
  description?: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  imageUrls?: string[];
};
