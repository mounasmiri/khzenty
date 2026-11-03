import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { verifySessionToken } from '../lib/jwt.js';
import { findUserById } from '../services/auth.service.js';

/**
 * Gate for routes that need a signed-in user. On success `req.user` is set.
 *
 * Express 5 forwards rejected promises to the error middleware, so no
 * try/catch is needed here.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[env.AUTH_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    next(new HttpError(401, 'Session is invalid or has expired'));
    return;
  }

  // Re-read the user rather than trusting the token's claims alone, so a
  // deleted account cannot keep working until its token expires.
  const user = await findUserById(payload.sub);

  if (!user) {
    next(new HttpError(401, 'Session is invalid or has expired'));
    return;
  }

  req.user = user;
  next();
};
