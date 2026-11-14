import type { Pool, PoolClient } from 'pg';

/**
 * Makes a `pg` pool patient while a serverless Postgres wakes up.
 *
 * Neon's free tier suspends the compute after a few idle minutes. The first
 * connection afterwards can be refused, can hang, or can be answered with
 * "the database system is starting up" for a couple of seconds. Without this,
 * that first request after a quiet period fails with a 500; with it, the
 * request simply takes a little longer.
 *
 * Retries happen only while *acquiring a connection* — before any SQL has been
 * sent — so a retry can never run a statement twice. A query that fails after
 * it was sent is reported as it is.
 */

export interface ConnectRetryOptions {
  /** Retries after the first attempt. */
  retries?: number;
  /** Delay before retry n (0-based). */
  delayMs?: (attempt: number) => number;
  /** Called on each retry, for logging. */
  onRetry?: (error: unknown, attempt: number) => void;
}

const TRANSIENT_CODES = new Set([
  'ECONNREFUSED', // compute not accepting connections yet
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND', // a DNS record that is briefly missing while an endpoint wakes
  'EAI_AGAIN',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now ("the database system is starting up")
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
]);

const TRANSIENT_MESSAGES = [
  'timeout exceeded when trying to connect', // pg's connectionTimeoutMillis
  'connection terminated',
  'the database system is starting up',
  'connection refused',
];

export function isTransientConnectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { code, message } = error as { code?: unknown; message?: unknown };

  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;

  const text = typeof message === 'string' ? message.toLowerCase() : '';

  return TRANSIENT_MESSAGES.some((fragment) => text.includes(fragment));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 0.5 s, 1 s, then 2 s each: with 8 retries, about 13 s of patience on top of each attempt's own timeout. */
const defaultDelay = (attempt: number) => Math.min(2000, 500 * 2 ** attempt);

/**
 * Replaces `pool.connect` with a version that retries transient failures.
 *
 * `Pool.query` acquires its client through `this.connect`, so wrapping the
 * instance method covers both plain queries and transactions (which call
 * `connect` themselves). Both call styles of `connect` are supported, because
 * `pg` uses the callback form internally.
 */
export function withConnectRetry<T extends Pool>(
  pool: T,
  { retries = 8, delayMs = defaultDelay, onRetry }: ConnectRetryOptions = {},
): T {
  const connect = pool.connect.bind(pool) as unknown as () => Promise<PoolClient>;

  async function acquire(): Promise<PoolClient> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await connect();
      } catch (error) {
        if (attempt >= retries || !isTransientConnectError(error)) {
          throw error;
        }

        onRetry?.(error, attempt);
        await sleep(delayMs(attempt));
      }
    }
  }

  const patched = (
    onConnected?: (error: Error | undefined, client?: PoolClient, done?: (release?: unknown) => void) => void,
  ): Promise<PoolClient> | void => {
    if (!onConnected) {
      return acquire();
    }

    acquire().then(
      (client) => onConnected(undefined, client, (release) => client.release(release as boolean | undefined)),
      (error: Error) => onConnected(error, undefined, () => undefined),
    );
  };

  (pool as unknown as { connect: typeof patched }).connect = patched;

  return pool;
}
