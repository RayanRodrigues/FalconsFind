import type { Claim } from '../types/claim.type.js';

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
