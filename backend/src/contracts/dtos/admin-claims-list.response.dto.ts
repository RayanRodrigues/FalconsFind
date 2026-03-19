import type { AdminClaimResponse } from './admin-claim.response.dto.js';

export type AdminClaimsListResponse = {
  claims: AdminClaimResponse[];
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
