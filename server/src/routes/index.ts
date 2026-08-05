import { Router } from 'express';

import { healthRouter } from './health.routes.js';

/**
 * Aggregates every feature router. Mounted once, under `/api`, by `app.ts`.
 */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
