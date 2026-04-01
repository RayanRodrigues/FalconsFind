import type {
  ItemDetailsResponse,
  ItemStatusResponse,
  Report,
} from '../../contracts/index.js';
import type { ItemStatus } from '../../contracts/index.js';

export type StoredItem = {
  id?: string;
  reportId?: string;
  title?: string;
  category?: string;
  description?: string;
  status?: ItemStatus;
  referenceCode?: string;
  location?: string;
  dateReported?: unknown;
  imageUrls?: string[];
  photoUrl?: string;
  claimStatus?: ItemDetailsResponse['claimStatus'];
  kind?: Report['kind'];
  contactEmail?: string;
  sourceEnv?: Report['sourceEnv'];
  archivedAt?: string | null;
  updatedAt?: string;
  statusUpdatedAt?: string;
  statusUpdatedByUid?: string;
  statusUpdatedByEmail?: string | null;
  statusUpdatedByRole?: 'ADMIN' | 'SECURITY' | 'SYSTEM';
};

export type ItemStatusUpdateActor = {
  uid: string;
  email?: string | null;
  role: 'ADMIN' | 'SECURITY';
};

export type ItemAutomationActor = {
  type: 'SYSTEM';
  uid?: string;
  email?: string | null;
  role?: 'SYSTEM';
};

export type StatusChangeActor = ItemStatusUpdateActor | ItemAutomationActor;

export type ItemStatusHistoryRecord = {
  itemId: string;
  previousStatus: ItemStatus;
  nextStatus: ItemStatus;
  changedAt: string;
  changedByUid?: string;
  changedByEmail?: string | null;
  changedByRole?: 'ADMIN' | 'SECURITY' | 'SYSTEM';
};

export type TransactionReader = {
  get<T>(ref: import('firebase-admin/firestore').DocumentReference<T>): Promise<import('firebase-admin/firestore').DocumentSnapshot<T>>;
  get<T>(query: import('firebase-admin/firestore').Query<T>): Promise<import('firebase-admin/firestore').QuerySnapshot<T>>;
};

export type ListValidatedItemsParams = {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'most_recent' | 'oldest';
};

export type PublicAvailability = ItemStatusResponse['availability'];
