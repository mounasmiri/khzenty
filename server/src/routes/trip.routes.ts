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
} from '../controllers/trip.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  addTripEntrySchema,
  createTripSchema,
  updateTripEntrySchema,
  updateTripSchema,
} from '../schemas/trip.schema.js';

export const tripRouter: Router = Router();

// Applied to the whole router: a new route cannot forget the auth gate.
tripRouter.use(requireAuth);

tripRouter.get('/', getTrips);
tripRouter.post('/', validateBody(createTripSchema), postTrip);

// Declared before `/:id`, which would otherwise swallow "destinations".
tripRouter.get('/destinations', getDestinations);

tripRouter.get('/:id', getTripById);
tripRouter.patch('/:id', validateBody(updateTripSchema), patchTrip);
tripRouter.delete('/:id', deleteTripById);

tripRouter.get('/:id/weather', getWeatherForTrip);

tripRouter.post('/:id/entries', validateBody(addTripEntrySchema), postTripEntry);
tripRouter.patch('/:id/entries/:entryId', validateBody(updateTripEntrySchema), patchTripEntry);
tripRouter.delete('/:id/entries/:entryId', deleteTripEntry);
