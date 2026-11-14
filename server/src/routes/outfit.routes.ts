import { Router } from 'express';

import {
  deleteOutfitById,
  getOutfitById,
  getOutfits,
  patchOutfit,
  postOutfit,
} from '../controllers/outfit.controller.js';
import { postWear } from '../controllers/wear-log.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody, validateIdParam } from '../middlewares/validate.middleware.js';
import { createOutfitSchema, updateOutfitSchema } from '../schemas/outfit.schema.js';

export const outfitRouter: Router = Router();

// Applied to the whole router: a new route cannot forget the auth gate.
outfitRouter.use(requireAuth);
outfitRouter.param('id', validateIdParam);


outfitRouter.get('/', getOutfits);
outfitRouter.post('/', validateBody(createOutfitSchema), postOutfit);

outfitRouter.get('/:id', getOutfitById);
outfitRouter.patch('/:id', validateBody(updateOutfitSchema), patchOutfit);
outfitRouter.delete('/:id', deleteOutfitById);
outfitRouter.post('/:id/wear', postWear);
