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
  // The one origin CORS and the CSRF origin check allow. Never `*`: with
  // credentials the browser would refuse it anyway, and a wildcard here would
  // mean someone had stopped thinking about it.
  CLIENT_ORIGIN: z
    .string()
    .url()
    .refine((value) => !value.includes('*'), 'CLIENT_ORIGIN must be one exact origin, not a wildcard')
    // Reduced to the bare origin. Browsers send `Origin: https://app.example`
    // with no path and no trailing slash, so a pasted "https://app.example/"
    // would otherwise fail the CORS and CSRF origin comparisons on every write.
    .transform((value) => new URL(value).origin)
    .default('http://localhost:5173'),

  // One-click sign-in to the seeded demo account (POST /api/auth/demo). Off by
  // default and must be switched on deliberately; when off the routes 404.
  DEMO_LOGIN_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // Most live demo copies at once. Past this, demo sign-in answers 503 until
  // older copies expire (24 h), which bounds how much a flood of visitors can
  // write to the database.
  DEMO_MAX_USERS: z.coerce.number().int().min(1).max(10_000).default(200),

  // Reverse-proxy hops to trust when reading the client IP (rate limiting,
  // logs). 0 means none. Set to the real number behind a proxy (1 for a single
  // load balancer): too high lets a client spoof its IP, too low rate-limits
  // the proxy instead of the client.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

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

/**
 * Rules that only apply in production, where a copied `.env.example` or a
 * guessable secret would be a real hole rather than a local convenience.
 */
const productionChecks = envSchema.superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;

  const placeholder = /replace-me|changeme|change-me|example|secret|password/i.test(value.JWT_SECRET);
  const lowEntropy = new Set(value.JWT_SECRET).size < 12;

  if (placeholder || lowEntropy) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message:
        'JWT_SECRET looks like a placeholder or is too repetitive for production; generate a random one',
    });
  }

  if (!value.CLIENT_ORIGIN.startsWith('https://')) {
    context.addIssue({
      code: 'custom',
      path: ['CLIENT_ORIGIN'],
      message: 'CLIENT_ORIGIN must be an https:// origin in production',
    });
  }
});

const parsed = productionChecks.safeParse(process.env);

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
