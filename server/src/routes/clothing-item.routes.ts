import { Router } from 'express';

import {
  deleteItemById,
  getItemById,
  getItems,
  patchItem,
  postItem,
} from '../controllers/clothing-item.controller.js';
import { patchLaundryStatus, postMarkWashed } from '../controllers/laundry.controller.js';
import { deleteItemImage, putItemImage } from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody, validateIdParam } from '../middlewares/validate.middleware.js';
import {
  createClothingItemSchema,
  updateClothingItemSchema,
} from '../schemas/clothing-item.schema.js';
import { markWashedSchema, setLaundryStatusSchema } from '../schemas/laundry.schema.js';
import { confirmItemImageSchema } from '../schemas/upload.schema.js';

export const clothingItemRouter: Router = Router();

// Applied to the whole router: a new route cannot forget the auth gate.
clothingItemRouter.use(requireAuth);
clothingItemRouter.param('id', validateIdParam);


clothingItemRouter.get('/', getItems);
clothingItemRouter.post('/', validateBody(createClothingItemSchema), postItem);

// Declared before the `/:id` routes so the literal segment always wins, even
// if a parameterised POST is added here later.
clothingItemRouter.post('/laundry/washed', validateBody(markWashedSchema), postMarkWashed);
clothingItemRouter.get('/:id', getItemById);
clothingItemRouter.patch('/:id', validateBody(updateClothingItemSchema), patchItem);
clothingItemRouter.delete('/:id', deleteItemById);

// Attaches an image the client has already uploaded straight to Cloudinary.
clothingItemRouter.put('/:id/image', validateBody(confirmItemImageSchema), putItemImage);
clothingItemRouter.delete('/:id/image', deleteItemImage);

clothingItemRouter.patch(
  '/:id/laundry',
  validateBody(setLaundryStatusSchema),
  patchLaundryStatus,
);
