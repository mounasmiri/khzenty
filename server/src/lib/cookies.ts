import type { CookieOptions, Response } from 'express';

import { env } from '../config/env.js';
import type { IssuedSession } from './jwt.js';

/**
 * Cookie flags live here alone so the set and clear calls cannot drift — a
 * mismatch on `path` or `sameSite` leaves an uncleared cookie behind on logout.
 *
 * `sameSite: 'lax'` suits the current setup, where the Vite proxy makes the API
 * same-origin in development. A cross-origin production deployment would need
 * `'none'` plus `secure: true`.
 */
const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function setSessionCookie(res: Response, session: IssuedSession): void {
  res.cookie(env.AUTH_COOKIE_NAME, session.token, {
    ...BASE_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.AUTH_COOKIE_NAME, BASE_COOKIE_OPTIONS);
}
