import { z } from 'zod';

export const updateItemStatusSchema = z.object({
  status: z.enum(['VALIDATED', 'CLAIMED', 'RETURNED', 'ARCHIVED']),
});

export type UpdateItemStatusInput = z.infer<typeof updateItemStatusSchema>;
