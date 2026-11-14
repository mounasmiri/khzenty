import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

interface LimiterOptions {
  /** Requests allowed per window, per client IP. */
  limit: number;
  windowMs: number;
  /**
   * The suite signs in dozens of times from one address, so limiting is off
   * under test unless a test opts in to exercise the limiter itself.
   */
  enabledInTest?: boolean;
}

/**
 * Per-IP limiter whose rejection flows through the normal error middleware, so
 * a 429 has the same JSON shape as every other error.
 *
 * In-memory store: correct for one process. Behind several instances each
 * keeps its own count, so the effective limit is `limit × instances` — see
 * SECURITY.md.
 */
export function createRateLimiter({
  limit,
  windowMs,
  enabledInTest = false,
}: LimiterOptions): RequestHandler {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test' && !enabledInTest,
    handler: (_req, _res, next) => {
      next(new HttpError(429, 'Too many attempts. Please wait a little and try again.'));
    },
  });
}

/** Sign-in: slows password guessing without locking out a forgetful user. */
export const loginLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

/** Sign-up: each attempt costs an Argon2 hash, so it is also a CPU-abuse vector. */
export const registerLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

/** City search proxies a third-party API; keep one account from hammering it. */
export const destinationSearchLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });
