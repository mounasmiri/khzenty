import { Router } from 'express';

import { authRouter } from './auth.routes.js';
import { clothingItemRouter } from './clothing-item.routes.js';
import { healthRouter } from './health.routes.js';
import { taxonomyRouter } from './taxonomy.routes.js';

/**
 * Aggregates every feature router. Mounted once, under `/api`, by `app.ts`.
 */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/items', clothingItemRouter);
apiRouter.use('/taxonomy', taxonomyRouter);
