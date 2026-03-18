import type { ClaimStatus } from '../enums/claim-status.enum.js';

export type UpdateClaimStatusRequest = {
  status: Extract<ClaimStatus, 'APPROVED' | 'REJECTED'>;
};
