import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';

/**
 * Registered after all routes. Converts an unmatched request into a 404 that
 * flows through the normal error middleware, so every response has one shape.
 */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Route not found'));
};
