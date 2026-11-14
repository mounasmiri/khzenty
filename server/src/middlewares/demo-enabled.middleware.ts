import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

/**
 * Makes the demo routes not exist unless `DEMO_LOGIN_ENABLED=true`.
 *
 * The 404 is the same one an unknown path gets, so a deployment that has the
 * feature off does not reveal that the code is there.
 */
export const requireDemoEnabled: RequestHandler = (_req, _res, next) => {
  if (!env.DEMO_LOGIN_ENABLED) {
    next(new HttpError(404, 'Route not found'));
    return;
  }

  next();
};
