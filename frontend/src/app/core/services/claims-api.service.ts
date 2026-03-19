import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CreateClaimRequest } from '../../models';
import type { Claim } from '../../models';
import { ApiClientService } from '../http/api-client.service';

export type CreateClaimResponse = {
  id: string;
  status: string;
  createdAt: string;
};

export type UserClaimsListResponse = {
  claims: Claim[];
  total: number;
  summary: {
    totalClaims: number;
    pendingClaims: number;
    needsProofClaims: number;
    approvedClaims: number;
    rejectedClaims: number;
    cancelledClaims: number;
  };
};

export type CancelClaimResponse = {
  id: string;
  status: string;
  itemId: string;
  itemStatus: string;
};

export type SubmitClaimProofResponse = {
  id: string;
  status: string;
  proofResponseMessage: string;
  proofResponsePhotoUrls?: string[];
  proofRespondedAt: string;
};

@Injectable({ providedIn: 'root' })
export class ClaimsApiService {
  constructor(private readonly apiClient: ApiClientService) {}

  createClaim(payload: CreateClaimRequest): Observable<CreateClaimResponse> {
    return this.apiClient.post<CreateClaimResponse, CreateClaimRequest>('/claims', payload);
  }

  listMyClaims(): Observable<UserClaimsListResponse> {
    return this.apiClient.get<UserClaimsListResponse>('/claims/me');
  }

  cancelClaim(id: string): Observable<CancelClaimResponse> {
    return this.apiClient.patch<CancelClaimResponse, Record<string, never>>(`/claims/${id}/cancel`, {});
  }

  submitProof(id: string, formData: FormData): Observable<SubmitClaimProofResponse> {
    return this.apiClient.patch<SubmitClaimProofResponse, FormData>(`/claims/${id}/proof-response`, formData);
  }
}
