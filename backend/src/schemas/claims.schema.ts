import { z } from 'zod';

export const updateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
