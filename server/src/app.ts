import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { requireSameOrigin } from './middlewares/origin-check.middleware.js';
import { apiRouter } from './routes/index.js';

/**
 * Builds the Express application without binding a port, so tests can import
 * it directly. Port binding lives in `server.ts`.
 */
export function createApp(): Express {
  const app = express();

  // Helmet already drops it; stated so removing helmet cannot bring it back.
  app.disable('x-powered-by');
  // Hops of reverse proxy to trust for the client IP. 0 (the default) trusts
  // none, so `X-Forwarded-For` cannot be used to dodge the rate limiter.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  // JSON only, and small: the largest legitimate body (a 500-id wash list or
  // an outfit layout) is a few KiB. No urlencoded parser — nothing here takes
  // form posts, and leaving it off means a cross-site <form> cannot reach a
  // handler at all.
  app.use(express.json({ limit: '100kb' }));
  // Populates `req.cookies`, which `requireAuth` reads the session token from.
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // After cookies are parsed and before any route: state-changing requests
  // that declare a foreign Origin never reach a handler.
  app.use('/api', requireSameOrigin, apiRouter);

  // Order matters: unmatched routes first, then the single error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
