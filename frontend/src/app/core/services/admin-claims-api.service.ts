import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ClaimStatus } from '../../models';
import type { Claim } from '../../models';
import { ApiClientService } from '../http/api-client.service';

export type AdminClaimsListResponse = {
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

type ClaimStatusUpdateResponse = {
  id: string;
  status: Extract<ClaimStatus, ClaimStatus.APPROVED | ClaimStatus.REJECTED>;
  itemId: string;
  itemStatus: string;
};

type RequestAdditionalProofResponse = {
  id: string;
  status: ClaimStatus.NEEDS_PROOF;
  additionalProofRequest: string;
  proofRequestedAt: string;
};

@Injectable({ providedIn: 'root' })
export class AdminClaimsApiService {
  constructor(private readonly apiClient: ApiClientService) {}

  listClaims(): Observable<AdminClaimsListResponse> {
    return this.apiClient.get<AdminClaimsListResponse>('/admin/claims');
  }

  approveClaim(id: string): Observable<ClaimStatusUpdateResponse> {
    return this.apiClient.patch<ClaimStatusUpdateResponse, { status: ClaimStatus.APPROVED }>(
      `/claims/${id}/status`,
      { status: ClaimStatus.APPROVED },
    );
  }

  rejectClaim(id: string): Observable<ClaimStatusUpdateResponse> {
    return this.apiClient.patch<ClaimStatusUpdateResponse, { status: ClaimStatus.REJECTED }>(
      `/claims/${id}/status`,
      { status: ClaimStatus.REJECTED },
    );
  }

  requestAdditionalProof(id: string, message: string): Observable<RequestAdditionalProofResponse> {
    return this.apiClient.patch<RequestAdditionalProofResponse, { message: string }>(
      `/claims/${id}/proof-request`,
      { message },
    );
  }
}
