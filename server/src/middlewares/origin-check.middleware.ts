import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth for the cookie session.
 *
 * The primary protections are `SameSite=Lax` on the cookie and the fact that
 * the API only parses `application/json`, which a cross-site form cannot send
 * without a CORS preflight that this server refuses. This adds a third layer:
 * a state-changing request that *declares* an origin must declare ours.
 *
 * A missing `Origin` is allowed — non-browser clients and same-origin requests
 * from some browsers omit it, and none of them can be a cross-site forgery.
 * (Browsers always send it on cross-origin POST/PUT/PATCH/DELETE.)
 */
export const requireSameOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');

  if (origin !== undefined && origin !== env.CLIENT_ORIGIN) {
    next(new HttpError(403, 'Cross-origin request refused'));
    return;
  }

  next();
};
