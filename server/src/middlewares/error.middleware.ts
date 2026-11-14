import type { ErrorRequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

/**
 * The single place that turns a thrown error into an HTTP response.
 *
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so controllers do not need try/catch just to reach this.
 */
/**
 * Request-parsing failures raised by body-parser (malformed JSON, body too
 * large). They carry a 4xx `status` but are not `HttpError`s, and without this
 * they would be reported as a 500 and logged as an incident.
 */
function parserFailure(err: unknown): { status: number; message: string } | null {
  if (typeof err !== 'object' || err === null || !('type' in err)) return null;

  switch ((err as { type: unknown }).type) {
    case 'entity.parse.failed':
      return { status: 400, message: 'Request body is not valid JSON' };
    case 'entity.too.large':
      return { status: 413, message: 'Request body is too large' };
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return { status: 415, message: 'Unsupported request encoding' };
    default:
      return null;
  }
}

/**
 * What goes to the log for an unexpected error.
 *
 * Prisma error messages embed the query's arguments — emails, ids — so in
 * production only the error's name and code are logged for those. Stack traces
 * stay server-side (never in a response) because without them an incident is
 * undebuggable; they contain code paths, not user data.
 */
function describeForLog(err: unknown): unknown {
  if (env.NODE_ENV !== 'production') return err;

  const name = err instanceof Error ? err.name : typeof err;
  const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined;

  if (name.startsWith('PrismaClient') || (typeof code === 'string' && /^P\d{4}$/.test(code))) {
    return { name, code };
  }

  return err instanceof Error ? { name, message: err.message, stack: err.stack } : { name };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const parsing = parserFailure(err);

  if (parsing) {
    res.status(parsing.status).json({ error: { status: parsing.status, message: parsing.message } });
    return;
  }

  const isHttpError = err instanceof HttpError;
  const status = isHttpError ? err.status : 500;

  // Never leak an unexpected error's message to the client.
  const message = isHttpError && err.expose ? err.message : 'Internal Server Error';

  // Log anything whose message we would not show the client — i.e. genuinely
  // unexpected failures. A deliberate, exposed 5xx (such as "upload is not
  // configured") is a known state, not an incident, so it stays out of the log.
  if (!isHttpError || !err.expose) {
    console.error('[khzenty] Unhandled error:', describeForLog(err));
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
