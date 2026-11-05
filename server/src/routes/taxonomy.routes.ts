import { Router } from 'express';

import { BOARD_ZONE_BY_TYPE, buildTaxonomy } from '../lib/clothing-taxonomy.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Serves the category/type structure so the client's type picker cannot offer a
 * value the API would reject. Without this the taxonomy would be duplicated on
 * both sides and free to drift.
 */
export const taxonomyRouter: Router = Router();

taxonomyRouter.use(requireAuth);

taxonomyRouter.get('/', (_req, res) => {
  res.status(200).json({
    taxonomy: buildTaxonomy(),
    // Sent alongside the taxonomy rather than from a second endpoint: the
    // board needs a zone for every type it can display, and the client should
    // not be able to hold a stale half of the pair. A separate field, not a
    // `zone` key inside each group's `types`, so the existing picker — which
    // reads `types` as a string array — keeps working unchanged.
    boardZones: BOARD_ZONE_BY_TYPE,
  });
});
