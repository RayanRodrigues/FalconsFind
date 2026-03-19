import { z } from 'zod';

export const createClaimSchema = z.object({
  referenceCode: z.string().trim().min(1, 'referenceCode is required'),
  itemName: z.string().trim().min(2, 'itemName is required').max(200, 'itemName must be 200 characters or fewer'),
  claimReason: z.string().trim().min(20, 'claimReason must be at least 20 characters').max(2000, 'claimReason must be 2000 characters or fewer'),
  proofDetails: z.string().trim().min(20, 'proofDetails must be at least 20 characters').max(2000, 'proofDetails must be 2000 characters or fewer'),
  claimantName: z.string().trim().min(1, 'claimantName is required'),
  claimantEmail: z.string().email('claimantEmail must be a valid email'),
  phone: z.string().trim().min(1).max(50).optional(),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;

export const updateClaimSchema = z.object({
  itemName: z.string().trim().min(2, 'itemName is required').max(200, 'itemName must be 200 characters or fewer'),
  claimReason: z.string().trim().min(20, 'claimReason must be at least 20 characters').max(2000, 'claimReason must be 2000 characters or fewer'),
  proofDetails: z.string().trim().min(20, 'proofDetails must be at least 20 characters').max(2000, 'proofDetails must be 2000 characters or fewer'),
  phone: z.string().trim().min(1).max(50).optional(),
});

export type UpdateClaimInput = z.infer<typeof updateClaimSchema>;

export const requestAdditionalProofSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(2000, 'message must be 2000 characters or fewer'),
});

export type RequestAdditionalProofInput = z.infer<typeof requestAdditionalProofSchema>;

export const submitClaimProofSchema = z.object({
  message: z.string().trim().min(10, 'message must be at least 10 characters').max(2000, 'message must be 2000 characters or fewer'),
});

export type SubmitClaimProofInput = z.infer<typeof submitClaimProofSchema>;

export const updateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
