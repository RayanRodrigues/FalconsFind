import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('email must be a valid email'),
  password: z.string().min(1, 'password is required'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('email must be a valid email'),
  password: z.string().min(8, 'password must be at least 8 characters'),
  displayName: z.string().trim().min(2, 'display name must be at least 2 characters').max(100).optional(),
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().trim().min(1, 'refreshToken is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;
