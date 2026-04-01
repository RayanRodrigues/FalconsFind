import { Injectable } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import type { CreateClaimRequest } from '../../models';
import type { Claim } from '../../models';
import { ApiClientService } from '../http/api-client.service';
import { ObservableCache } from '../utils/observable-cache';

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

export type UpdateClaimResponse = {
  id: string;
  status: string;
  itemName: string;
  claimReason: string;
  proofDetails: string;
  phone?: string;
};

@Injectable({ providedIn: 'root' })
export class ClaimsApiService {
  private readonly myClaimsCache = new ObservableCache(15_000);

  constructor(private readonly apiClient: ApiClientService) {}

  createClaim(payload: CreateClaimRequest): Observable<CreateClaimResponse> {
    return this.apiClient.post<CreateClaimResponse, CreateClaimRequest>('/claims', payload).pipe(
      tap(() => this.myClaimsCache.clear()),
    );
  }

  listMyClaims(): Observable<UserClaimsListResponse> {
    return this.myClaimsCache.getOrCreate('claims:me', () => (
      this.apiClient.get<UserClaimsListResponse>('/claims/me')
    ));
  }

  cancelClaim(id: string): Observable<CancelClaimResponse> {
    return this.apiClient.patch<CancelClaimResponse, Record<string, never>>(`/claims/${id}/cancel`, {}).pipe(
      tap(() => this.myClaimsCache.clear()),
    );
  }

  updateClaim(
    id: string,
    payload: { itemName: string; claimReason: string; proofDetails: string; phone?: string },
  ): Observable<UpdateClaimResponse> {
    return this.apiClient.patch<UpdateClaimResponse, typeof payload>(`/claims/${id}`, payload).pipe(
      tap(() => this.myClaimsCache.clear()),
    );
  }

  submitProof(id: string, formData: FormData): Observable<SubmitClaimProofResponse> {
    return this.apiClient.patch<SubmitClaimProofResponse, FormData>(`/claims/${id}/proof-response`, formData).pipe(
      tap(() => this.myClaimsCache.clear()),
    );
  }
}
