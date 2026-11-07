import { Router } from 'express';

import { postUndoWear } from '../controllers/wear-log.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const wearLogRouter: Router = Router();

wearLogRouter.use(requireAuth);

wearLogRouter.post('/:id/undo', postUndoWear);
