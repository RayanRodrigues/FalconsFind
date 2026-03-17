import { z } from 'zod';

export const createClaimSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required'),
  claimantName: z.string().trim().min(1, 'claimantName is required'),
  claimantEmail: z.string().email('claimantEmail must be a valid email'),
  message: z.string().trim().min(1).max(2000).optional(),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
