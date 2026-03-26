import type { ClaimStatus } from '../enums/claim-status.enum.js';
import type { ItemStatus } from '../enums/item-status.enum.js';

export type ItemHistoryActor = {
  type: 'SYSTEM' | 'USER' | 'SECURITY' | 'ADMIN';
  uid?: string;
  role?: string;
  email?: string;
};

export type ItemHistoryChange = {
  field: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
};

export type ItemHistoryEventResponse = {
  id: string;
  itemId: string;
  entityType: 'REPORT' | 'ITEM' | 'CLAIM';
  entityId: string;
  actionType:
    | 'REPORT_CREATED'
    | 'REPORT_UPDATED'
    | 'REPORT_VALIDATED'
    | 'REPORT_MERGED'
    | 'ITEM_ARCHIVED'
    | 'ITEM_STATUS_RESTORED'
    | 'CLAIM_CREATED'
    | 'CLAIM_UPDATED'
    | 'CLAIM_PROOF_REQUESTED'
    | 'CLAIM_PROOF_SUBMITTED'
    | 'CLAIM_APPROVED'
    | 'CLAIM_REJECTED'
    | 'CLAIM_CANCELLED';
  timestamp: string;
  summary: string;
  actor?: ItemHistoryActor;
  metadata?: {
    referenceCode?: string;
    reportKind?: 'LOST' | 'FOUND';
    claimStatus?: ClaimStatus;
    itemStatus?: ItemStatus;
    [key: string]: string | number | boolean | null | undefined;
  };
  changes?: ItemHistoryChange[];
};

export type ItemHistoryResponse = {
  itemId: string;
  resolvedFrom: string;
  title?: string;
  referenceCode?: string;
  currentStatus?: ItemStatus;
  total: number;
  events: ItemHistoryEventResponse[];
};
