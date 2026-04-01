import type { ItemStatus } from '../enums/item-status.enum.js';

export type UpdateItemStatusRequest = {
  status: Extract<ItemStatus, 'VALIDATED' | 'CLAIMED' | 'RETURNED' | 'ARCHIVED'>;
};
