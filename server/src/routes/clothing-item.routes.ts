import { Router } from 'express';

import {
  deleteItemById,
  getItemById,
  getItems,
  patchItem,
  postItem,
} from '../controllers/clothing-item.controller.js';
import { deleteItemImage, putItemImage } from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createClothingItemSchema,
  updateClothingItemSchema,
} from '../schemas/clothing-item.schema.js';
import { confirmItemImageSchema } from '../schemas/upload.schema.js';

export const clothingItemRouter: Router = Router();

// Applied to the whole router: a new route cannot forget the auth gate.
clothingItemRouter.use(requireAuth);

clothingItemRouter.get('/', getItems);
clothingItemRouter.post('/', validateBody(createClothingItemSchema), postItem);
clothingItemRouter.get('/:id', getItemById);
clothingItemRouter.patch('/:id', validateBody(updateClothingItemSchema), patchItem);
clothingItemRouter.delete('/:id', deleteItemById);

// Attaches an image the client has already uploaded straight to Cloudinary.
clothingItemRouter.put('/:id/image', validateBody(confirmItemImageSchema), putItemImage);
clothingItemRouter.delete('/:id/image', deleteItemImage);
