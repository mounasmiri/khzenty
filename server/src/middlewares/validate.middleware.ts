import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

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
