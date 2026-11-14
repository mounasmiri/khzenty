import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { withConnectRetry } from '../lib/db-connect-retry.js';
import { env } from './env.js';

/**
 * Prisma 7 removed the Rust query engine, so a driver adapter is required
 * rather than optional.
 *
 * The pool is built here, rather than left to the adapter, for three reasons
 * that matter on a serverless Postgres such as Neon:
 *
 * - **Idle connections are dropped early** (`idleTimeoutMillis`), well before
 *   the provider suspends the compute or its pooler closes them, so a request
 *   rarely picks up a connection that is already dead.
 * - **A dropped connection must not crash the process.** `pg` emits `error` on
 *   the pool when an idle client's socket dies, and an unhandled `error` event
 *   terminates Node. `onPoolError` handles it; the pool discards that client.
 * - **A cold start is waited out, not failed.** `connectionTimeoutMillis`
 *   leaves room for a waking compute, and `withConnectRetry` retries the
 *   connection (never a statement) while it comes up.
 *
 * Prepared statements are not cached (the adapter's default), which is also
 * what lets this work through PgBouncer's transaction pooling — Neon's
 * "-pooler" endpoint.
 */
function createPrismaClient() {
  const pool = withConnectRetry(
    new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
    }),
    {
      onRetry: (error, attempt) => {
        const { code, message } = error as { code?: string; message?: string };
        // ECONNREFUSED carries no message, so the code is the useful part.
        const reason = [code, message].filter(Boolean).join(' ') || 'unknown';
        console.warn(`[khzenty] Database not ready (attempt ${String(attempt + 1)}): ${reason}. Retrying…`);
      },
    },
  );

  return new PrismaClient({
    adapter: new PrismaPg(pool, {
      onPoolError: (error) => {
        // An idle connection died (the database restarted or went to sleep).
        // The pool throws it away and opens a fresh one on the next query.
        console.warn(`[khzenty] Idle database connection dropped: ${error.message}`);
      },
      onConnectionError: (error) => {
        console.warn(`[khzenty] Database connection error: ${error.message}`);
      },
    }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * `tsx watch` re-imports modules on every change. Without this guard each
 * reload would build a new client and leak its connection pool until Postgres
 * refused new connections.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  __khzentyPrisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.__khzentyPrisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__khzentyPrisma = prisma;
}
