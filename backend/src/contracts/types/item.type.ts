import type { ItemStatus } from '../enums/item-status.enum';

export type Item = {
  id: string;
  title: string;
  description?: string;
  status: ItemStatus;
  location?: string;
  dateReported: string;
  referenceCode: string;
  imageUrls?: string[];
};
