import type { ItemStatus } from '../enums/item-status.enum.js';
export type UpdateItemStatusResponse = {
  id: string;
  previousStatus: ItemStatus;
  status: ItemStatus;
  updatedAt: string;
  updatedByUid: string;
  updatedByEmail?: string | null;
  updatedByRole: 'ADMIN' | 'SECURITY';
};
