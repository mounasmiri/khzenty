import { Router } from 'express';

import {
  deleteTripById,
  deleteTripEntry,
  getDestinations,
  getTripById,
  getTrips,
  getWeatherForTrip,
  patchTrip,
  patchTripEntry,
  postTrip,
  postTripEntry,
  putCategoryCount,
} from '../controllers/trip.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { destinationSearchLimiter } from '../middlewares/rate-limit.middleware.js';
import { validateBody, validateIdParam } from '../middlewares/validate.middleware.js';
import {
  addTripEntrySchema,
  createTripSchema,
  setCategoryCountSchema,
  updateTripEntrySchema,
  updateTripSchema,
} from '../schemas/trip.schema.js';

export const tripRouter: Router = Router();

// Applied to the whole router: a new route cannot forget the auth gate.
tripRouter.use(requireAuth);
tripRouter.param('id', validateIdParam);
tripRouter.param('entryId', validateIdParam);


tripRouter.get('/', getTrips);
tripRouter.post('/', validateBody(createTripSchema), postTrip);

// Declared before `/:id`, which would otherwise swallow "destinations".
tripRouter.get('/destinations', destinationSearchLimiter, getDestinations);

tripRouter.get('/:id', getTripById);
tripRouter.patch('/:id', validateBody(updateTripSchema), patchTrip);
tripRouter.delete('/:id', deleteTripById);

tripRouter.get('/:id/weather', getWeatherForTrip);

tripRouter.post('/:id/entries', validateBody(addTripEntrySchema), postTripEntry);
tripRouter.patch('/:id/entries/:entryId', validateBody(updateTripEntrySchema), patchTripEntry);
tripRouter.delete('/:id/entries/:entryId', deleteTripEntry);

tripRouter.put('/:id/category-counts/:category', validateBody(setCategoryCountSchema), putCategoryCount);
