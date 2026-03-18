import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CreateClaimRequest } from '../../models';
import { ApiClientService } from '../http/api-client.service';

export type CreateClaimResponse = {
  id: string;
  status: string;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class ClaimsApiService {
  constructor(private readonly apiClient: ApiClientService) {}

  createClaim(payload: CreateClaimRequest): Observable<CreateClaimResponse> {
    return this.apiClient.post<CreateClaimResponse, CreateClaimRequest>('/claims', payload);
  }
}
