import type { ItemStatus } from '../enums/item-status.enum.js';
import type { AdminReportResponse } from './admin-report.response.dto.js';

export type AdminReportsListResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  filters: {
    kind: 'LOST' | 'FOUND' | null;
    status: ItemStatus | null;
    search: string | null;
  };
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Partial<Record<ItemStatus, number>>;
  };
  reports: AdminReportResponse[];
};
