import type { ErrorRequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

/**
 * The single place that turns a thrown error into an HTTP response.
 *
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so controllers do not need try/catch just to reach this.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isHttpError = err instanceof HttpError;
  const status = isHttpError ? err.status : 500;

  // Never leak an unexpected error's message to the client.
  const message = isHttpError && err.expose ? err.message : 'Internal Server Error';

  if (status >= 500) {
    console.error('[khzenty] Unhandled error:', err);
  }

  res.status(status).json({
    error: {
      status,
      message,
      ...(env.NODE_ENV === 'development' && err instanceof Error && !isHttpError
        ? { stack: err.stack }
        : {}),
    },
  });
};
