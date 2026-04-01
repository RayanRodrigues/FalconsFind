import { Injectable } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import { ObservableCache } from '../../../core/utils/observable-cache';
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
  private readonly reportsListCache = new ObservableCache(10_000);

  constructor(private readonly apiClient: ApiClientService) {}

  listReports(params: ListAdminReportsParams): Observable<AdminReportsResponse> {
    const normalizedParams = {
      page: params.page,
      limit: params.limit,
      kind: params.kind,
      status: params.status?.trim() || undefined,
      search: params.search?.trim() || undefined,
      flagged: params.flagged,
    };
    const cacheKey = JSON.stringify(normalizedParams);

    return this.reportsListCache.getOrCreate(cacheKey, () => {
      const searchParams = new URLSearchParams();

      if (normalizedParams.page !== undefined) searchParams.set('page', String(normalizedParams.page));
      if (normalizedParams.limit !== undefined) searchParams.set('limit', String(normalizedParams.limit));
      if (normalizedParams.kind) searchParams.set('kind', normalizedParams.kind);
      if (normalizedParams.status) searchParams.set('status', normalizedParams.status);
      if (normalizedParams.search) searchParams.set('search', normalizedParams.search);
      if (normalizedParams.flagged !== undefined) searchParams.set('flagged', String(normalizedParams.flagged));

      return this.apiClient.get<AdminReportsResponse>(`/admin/reports?${searchParams.toString()}`);
    });
  }

  validateFoundReport(reportId: string): Observable<ValidateFoundReportResponse> {
    return this.apiClient.patch<ValidateFoundReportResponse, Record<string, never>>(
      `/reports/found/${reportId}/validate`,
      {},
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }

  flagReport(reportId: string, suspiciousReason: string): Observable<FlagReportResponse> {
    return this.apiClient.patch<FlagReportResponse, { suspiciousReason: string }>(
      `/admin/reports/${reportId}/flag`,
      { suspiciousReason },
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }

  unflagReport(reportId: string): Observable<FlagReportResponse> {
    return this.apiClient.patch<FlagReportResponse, { flagged: false }>(
      `/admin/reports/${reportId}/flag`,
      { flagged: false },
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }

  mergeReports(primaryReportId: string, duplicateReportIds: string[]): Observable<MergeReportsResponse> {
    return this.apiClient.post<MergeReportsResponse, { primaryReportId: string; duplicateReportIds: string[] }>(
      '/admin/reports/merge',
      { primaryReportId, duplicateReportIds },
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }

  getItemHistory(itemId: string): Observable<ItemHistoryResponse> {
    return this.apiClient.get<ItemHistoryResponse>(`/admin/items/${itemId}/history`);
  }

  updateItemStatus(itemId: string, status: string): Observable<UpdateItemStatusResponse> {
    return this.apiClient.patch<UpdateItemStatusResponse, { status: string }>(
      `/admin/items/${itemId}/status`,
      { status: status.trim().toUpperCase() },
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }

  restoreItemStatus(itemId: string, status: string): Observable<{ id: string; status: string }> {
    return this.apiClient.post<{ id: string; status: string }, { status: string }>(
      `/admin/items/${itemId}/restore-status`,
      { status: status.trim().toUpperCase() },
    ).pipe(
      tap(() => this.reportsListCache.clear()),
    );
  }
}
