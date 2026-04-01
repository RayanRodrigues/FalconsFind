import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import type { AdminReportsResponse, ItemHistoryResponse } from './admin-reports.types';

type ListAdminReportsParams = {
  page?: number;
  limit?: number;
  kind?: 'LOST' | 'FOUND';
  status?: string;
  search?: string;
  flagged?: boolean;
};

export type ValidateFoundReportResponse = {
  id: string;
  referenceCode: string;
  status: string;
};

export type FlagReportResponse = {
  id: string;
  isSuspicious: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
  suspiciousReason?: string | null;
  suspiciousFlaggedAt?: string | null;
};

export type MergeReportsResponse = {
  primaryReportId: string;
  mergedReportIds: string[];
  primaryReport: {
    id: string;
    referenceCode: string;
    kind: 'LOST' | 'FOUND';
    status: string;
    title: string;
  };
};

export type UpdateItemStatusResponse = {
  id: string;
  previousStatus: string;
  status: string;
  updatedAt: string;
  updatedByUid?: string;
  updatedByEmail?: string | null;
  updatedByRole?: string;
};

@Injectable({ providedIn: 'root' })
export class AdminReportsApiService {
  constructor(private readonly apiClient: ApiClientService) {}

  listReports(params: ListAdminReportsParams): Observable<AdminReportsResponse> {
    const searchParams = new URLSearchParams();

    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.kind) searchParams.set('kind', params.kind);
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.flagged !== undefined) searchParams.set('flagged', String(params.flagged));

    return this.apiClient.get<AdminReportsResponse>(`/admin/reports?${searchParams.toString()}`);
  }

  validateFoundReport(reportId: string): Observable<ValidateFoundReportResponse> {
    return this.apiClient.patch<ValidateFoundReportResponse, Record<string, never>>(
      `/reports/found/${reportId}/validate`,
      {},
    );
  }

  flagReport(reportId: string, suspiciousReason: string): Observable<FlagReportResponse> {
    return this.apiClient.patch<FlagReportResponse, { suspiciousReason: string }>(
      `/admin/reports/${reportId}/flag`,
      { suspiciousReason },
    );
  }

  unflagReport(reportId: string): Observable<FlagReportResponse> {
    return this.apiClient.patch<FlagReportResponse, { flagged: false }>(
      `/admin/reports/${reportId}/flag`,
      { flagged: false },
    );
  }

  mergeReports(primaryReportId: string, duplicateReportIds: string[]): Observable<MergeReportsResponse> {
    return this.apiClient.post<MergeReportsResponse, { primaryReportId: string; duplicateReportIds: string[] }>(
      '/admin/reports/merge',
      { primaryReportId, duplicateReportIds },
    );
  }

  getItemHistory(itemId: string): Observable<ItemHistoryResponse> {
    return this.apiClient.get<ItemHistoryResponse>(`/admin/items/${itemId}/history`);
  }

  updateItemStatus(itemId: string, status: string): Observable<UpdateItemStatusResponse> {
    return this.apiClient.patch<UpdateItemStatusResponse, { status: string }>(
      `/admin/items/${itemId}/status`,
      { status: status.trim().toUpperCase() },
    );
  }

  restoreItemStatus(itemId: string, status: string): Observable<{ id: string; status: string }> {
    return this.apiClient.post<{ id: string; status: string }, { status: string }>(
      `/admin/items/${itemId}/restore-status`,
      { status: status.trim().toUpperCase() },
    );
  }
}
