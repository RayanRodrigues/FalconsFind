import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { CreateLostReportRequest } from '../../models/dtos/create-lost-report.request.dto';
import type { CreateReportResponse } from '../../models/responses/create-report.response.dto';
import { ApiClientService } from '../http/api-client.service';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  constructor(private apiClient: ApiClientService) {}

  createLostReport(
    request: CreateLostReportRequest
  ): Observable<CreateReportResponse> {
    return this.apiClient.post<CreateReportResponse, CreateLostReportRequest>(
      '/reports/lost',
      request
    );
  }

  createFoundReport(formData: FormData): Observable<CreateReportResponse> {
    return this.apiClient.post<CreateReportResponse, FormData>(
      '/reports/found',
      formData
    );
  }
}
