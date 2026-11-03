import { Router } from 'express';

import { buildTaxonomy } from '../lib/clothing-taxonomy.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Serves the category/type structure so the client's type picker cannot offer a
 * value the API would reject. Without this the taxonomy would be duplicated on
 * both sides and free to drift.
 */
export const taxonomyRouter: Router = Router();

taxonomyRouter.use(requireAuth);

taxonomyRouter.get('/', (_req, res) => {
  res.status(200).json({ taxonomy: buildTaxonomy() });
});
