import { Router } from 'express';

import { getWearLog, postUndoWear } from '../controllers/wear-log.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateIdParam } from '../middlewares/validate.middleware.js';

export const wearLogRouter: Router = Router();

wearLogRouter.use(requireAuth);
wearLogRouter.param('id', validateIdParam);


wearLogRouter.get('/', getWearLog);
wearLogRouter.post('/:id/undo', postUndoWear);
