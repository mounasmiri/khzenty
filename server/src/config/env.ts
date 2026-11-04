import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the server depends on is declared here and nowhere
 * else. Reading `process.env` directly outside this file is a bug: it bypasses
 * validation and loses the types.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // No default: a wrong-but-present database URL is far easier to debug than
  // a silently missing one.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Deliberately no default. A fallback secret is the kind of thing that ships
  // to production unnoticed and forges every session.
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  AUTH_COOKIE_NAME: z.string().min(1).default('khzenty_session'),

  // Optional on purpose. Requiring them would stop the server booting for
  // anyone without a Cloudinary account — including CI. Image upload instead
  // reports 503 while unconfigured; see `isCloudinaryConfigured`.
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  /** Root folder for uploads; each user gets `<root>/users/<userId>`. */
  CLOUDINARY_FOLDER: z.string().min(1).default('khzenty'),
  /** Enforced after upload, by reading the asset's real byte count. */
  CLOUDINARY_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  /** Signed into the upload request, so the client cannot widen it. */
  CLOUDINARY_ALLOWED_FORMATS: z.string().min(1).default('jpg,jpeg,png,webp,avif'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  // Fail at boot rather than at the first request that needs the value.
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
