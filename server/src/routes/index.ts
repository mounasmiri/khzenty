import { Router } from 'express';

import { authRouter } from './auth.routes.js';
import { clothingItemRouter } from './clothing-item.routes.js';
import { healthRouter } from './health.routes.js';
import { outfitRouter } from './outfit.routes.js';
import { taxonomyRouter } from './taxonomy.routes.js';
import { uploadRouter } from './upload.routes.js';

/**
 * Aggregates every feature router. Mounted once, under `/api`, by `app.ts`.
 */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/items', clothingItemRouter);
apiRouter.use('/outfits', outfitRouter);
apiRouter.use('/taxonomy', taxonomyRouter);
apiRouter.use('/uploads', uploadRouter);
