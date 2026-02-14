import { z } from 'zod';

export const createLostReportSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1).optional(),
  lastSeenLocation: z.string().trim().min(1).optional(),
  lastSeenAt: z.string().datetime().optional(),
  contactEmail: z.string().email().optional(),
  photoDataUrl: z.string().startsWith('data:image/', 'photo must be an image data URL').optional(),
});

export const createFoundReportSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1).optional(),
  foundLocation: z.string().trim().min(1, 'foundLocation is required'),
  foundAt: z.string().datetime().optional(),
  contactEmail: z.string().email().optional(),
  photoDataUrl: z.string().startsWith('data:image/', 'photo must be an image data URL'),
});

export type CreateLostReportInput = z.infer<typeof createLostReportSchema>;
export type CreateFoundReportInput = z.infer<typeof createFoundReportSchema>;
