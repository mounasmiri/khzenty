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

  // Log anything whose message we would not show the client — i.e. genuinely
  // unexpected failures. A deliberate, exposed 5xx (such as "upload is not
  // configured") is a known state, not an incident, so it stays out of the log.
  if (!isHttpError || !err.expose) {
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
