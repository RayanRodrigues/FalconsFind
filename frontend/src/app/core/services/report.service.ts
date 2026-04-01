import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { ItemStatus, Report } from '../../models';
import type { CreateReportResponse } from '../../models/responses/create-report.response.dto';
import { ApiClientService } from '../http/api-client.service';

export type EditableReportResponse = {
  id: string;
  referenceCode: string;
  kind: Report['kind'];
  status: ItemStatus;
  title: string;
  category?: string;
  description?: string;
  location?: string;
  dateReported: string;
  contactEmail?: string;
};

export type UpdateReportByReferenceRequest = {
  title?: string;
  category?: string;
  description?: string;
  location?: string;
  dateReported?: string;
  contactEmail?: string;
};

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  constructor(private apiClient: ApiClientService) {}

  createLostReport(formData: FormData): Observable<CreateReportResponse> {
    return this.apiClient.post<CreateReportResponse, FormData>(
      '/reports/lost',
      formData
    );
  }

  createFoundReport(formData: FormData): Observable<CreateReportResponse> {
    return this.apiClient.post<CreateReportResponse, FormData>(
      '/reports/found',
      formData
    );
  }

  getEditableReport(referenceCode: string): Observable<EditableReportResponse> {
    const normalizedReferenceCode = encodeURIComponent(referenceCode.trim().toUpperCase());
    return this.apiClient.get<EditableReportResponse>(`/reports/${normalizedReferenceCode}`);
  }

  updateEditableReport(
    referenceCode: string,
    payload: UpdateReportByReferenceRequest,
  ): Observable<EditableReportResponse> {
    const normalizedReferenceCode = encodeURIComponent(referenceCode.trim().toUpperCase());
    return this.apiClient.patch<EditableReportResponse, UpdateReportByReferenceRequest>(
      `/reports/${normalizedReferenceCode}`,
      payload,
    );
  }
}
