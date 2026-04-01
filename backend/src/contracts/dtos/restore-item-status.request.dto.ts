import type { ItemStatus } from '../enums/item-status.enum.js';

export type RestoreItemStatusRequest = {
  status: ItemStatus;
};
