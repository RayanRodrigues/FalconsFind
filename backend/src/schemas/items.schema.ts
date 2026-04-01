import { z } from 'zod';

export const updateItemStatusSchema = z.object({
  status: z.enum(['VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED']),
});

export const restoreItemStatusSchema = z.object({
  status: z.enum(['REPORTED', 'PENDING_VALIDATION', 'VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED']),
});

export type UpdateItemStatusInput = z.infer<typeof updateItemStatusSchema>;
export type RestoreItemStatusInput = z.infer<typeof restoreItemStatusSchema>;
