import { z } from 'zod';

export const createLostReportSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  category: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  additionalInfo: z.string().trim().min(1).optional(),
  lastSeenLocation: z.string().trim().min(1).optional(),
  lastSeenAt: z.string().datetime().optional(),
  contactEmail: z.string().email().optional(),
});

export const createFoundReportSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  category: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  foundLocation: z.string().trim().min(1, 'foundLocation is required'),
  foundAt: z.string().datetime().optional(),
  contactEmail: z.string().email().optional(),
});

export const updateReportByReferenceSchema = z.object({
  title: z.string().trim().min(1, 'title cannot be empty').optional(),
  category: z.string().trim().min(1, 'category cannot be empty').optional(),
  description: z.string().trim().min(1, 'description cannot be empty').optional(),
  location: z.string().trim().min(1, 'location cannot be empty').optional(),
  dateReported: z.string().datetime('dateReported must be a valid ISO date-time').optional(),
  contactEmail: z.string().email('contactEmail must be a valid email').optional(),
}).refine(
  (payload) => Object.keys(payload).length > 0,
  { message: 'At least one editable field must be provided' },
);

export type CreateLostReportInput = z.infer<typeof createLostReportSchema>;
export type CreateFoundReportInput = z.infer<typeof createFoundReportSchema>;
export type UpdateReportByReferenceInput = z.infer<typeof updateReportByReferenceSchema>;

export const flagReportSchema = z.object({
  flagged: z.boolean(),
  reason: z.string().trim().min(1, 'reason cannot be empty').optional(),
}).superRefine((payload, ctx) => {
  if (!payload.flagged && payload.reason !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reason can only be provided when flagged is true',
      path: ['reason'],
    });
  }
});

export type FlagReportInput = z.infer<typeof flagReportSchema>;

export const mergeDuplicateReportsSchema = z.object({
  primaryReportId: z.string().trim().min(1, 'primaryReportId is required'),
  duplicateReportIds: z.array(z.string().trim().min(1, 'duplicate report id cannot be empty'))
    .min(1, 'At least one duplicate report id is required')
    .max(100, 'You can specify at most 100 duplicate report ids per request'),
}).superRefine((payload, ctx) => {
  const seen = new Set<string>();

  for (const [index, reportId] of payload.duplicateReportIds.entries()) {
    if (seen.has(reportId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicateReportIds must be unique',
        path: ['duplicateReportIds', index],
      });
      continue;
    }

    seen.add(reportId);
  }

  if (payload.duplicateReportIds.includes(payload.primaryReportId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'primaryReportId cannot also be listed as a duplicate',
      path: ['duplicateReportIds'],
    });
  }
});

export type MergeDuplicateReportsInput = z.infer<typeof mergeDuplicateReportsSchema>;
