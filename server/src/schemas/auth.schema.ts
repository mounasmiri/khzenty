import { z } from 'zod';

/** Normalised before validation so `  Demo@X.com ` and `demo@x.com` are one account. */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('A valid email address is required'));

export const registerSchema = z.object({
  email: emailField,
  // Argon2 has no bcrypt-style 72-byte truncation, so the only reason for an
  // upper bound is to stop a huge body becoming expensive to hash.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  name: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  // No length rule: a wrong password is a 401, not a validation error, and
  // echoing the policy here would leak it to unauthenticated callers.
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
