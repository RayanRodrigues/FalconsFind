export type AdminReport = {
  id: string;
  kind: 'LOST' | 'FOUND';
  title: string;
  description?: string;
  category?: string;
  location?: string;
  dateReported: string;
  status: string;
  referenceCode: string;
  contactEmail?: string;
  photoUrl?: string;
  photoUrls?: string[];
  archivedAt?: string | null;
  isSuspicious?: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
};

export type AdminReportsResponse = {
  reports: AdminReport[];
  total: number;
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Record<string, number>;
  };
};

export type ViewFilter = 'active' | 'archived' | 'all';

export type ItemHistoryChange = {
  field: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
};

export type ItemHistoryEvent = {
  id: string;
  itemId: string;
  entityType: 'REPORT' | 'CLAIM' | 'ITEM';
  entityId: string;
  actionType: string;
  timestamp: string;
  summary: string;
  actor?: {
    type?: string;
    uid?: string;
    email?: string;
  };
  metadata?: {
    itemStatus?: string;
    referenceCode?: string;
    reportKind?: string;
    claimStatus?: string;
    isSuspicious?: boolean;
    flagReason?: string;
    flaggedAt?: string;
  };
  changes?: ItemHistoryChange[];
};

export type ItemHistoryResponse = {
  itemId: string;
  resolvedFrom?: string;
  title?: string;
  referenceCode?: string;
  currentStatus?: string;
  total: number;
  events: ItemHistoryEvent[];
};
