import { z } from 'zod';

export const createLostReportSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1).optional(),
  lastSeenLocation: z.string().trim().min(1).optional(),
  lastSeenAt: z.string().datetime().optional(),
  contactEmail: z.string().email().optional(),
  photoDataUrl: z.string().startsWith('data:image/', 'photo must be an image data URL').optional(),
});

export type CreateLostReportInput = z.infer<typeof createLostReportSchema>;
