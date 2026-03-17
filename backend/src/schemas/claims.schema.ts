import { z } from 'zod';

export const createClaimSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  claimantName: z.string().trim().min(1, 'claimantName is required'),
  claimantEmail: z.string().email('claimantEmail must be a valid email'),
  message: z.string().trim().min(1).max(2000).optional(),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;

export const requestAdditionalProofSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(2000, 'message must be 2000 characters or fewer'),
});

export type RequestAdditionalProofInput = z.infer<typeof requestAdditionalProofSchema>;

export const updateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
