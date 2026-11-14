import type { RequestHandler, RequestParamHandler } from 'express';
import { z, type ZodType } from 'zod';

import { HttpError } from '../lib/http-error.js';

/**
 * Validates and replaces `req.body` with the parsed result, so controllers
 * receive normalised data (trimmed, lower-cased email) rather than raw input.
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');

      next(new HttpError(400, message));
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Resource ids are opaque strings (cuid). Constraining them to a short run of
 * URL-safe characters rejects junk — control characters, megabyte paths, SQL-
 * or path-looking text — before it reaches a query or a log line.
 */
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'must contain only letters, numbers, "-" and "_"');

/**
 * For `router.param('id', validateIdParam)`: runs once per matching route
 * parameter, so every `/:id` route on the router is covered without each
 * handler remembering to check.
 */
export const validateIdParam: RequestParamHandler = (_req, _res, next, value, name) => {
  const result = idSchema.safeParse(value);

  if (!result.success) {
    next(new HttpError(400, `${name}: not a valid id`));
    return;
  }

  next();
};
