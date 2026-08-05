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
