import type { ItemStatus } from '../enums/item-status.enum';

export type ItemPublicResponse = {
  id: string;
  title: string;
  status: ItemStatus;
  referenceCode: string;
  location?: string;
  dateReported: string;
  thumbnailUrl?: string;
};
