import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import { destinationSearchSchema } from '../schemas/trip.schema.js';
import { searchDestinations } from '../services/geocoding.service.js';
import {
  addTripEntry,
  createTrip,
  deleteTrip,
  getTrip,
  getTripWeather,
  listTrips,
  removeTripEntry,
  setEntryPacked,
  updateTrip,
} from '../services/trip.service.js';

type Req = Parameters<RequestHandler>[0];

function userIdOf(req: Req): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

function param(req: Req, name: string, label: string): string {
  const value = req.params[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, `${label} is required`);
  }

  return value;
}

const tripIdOf = (req: Req) => param(req, 'id', 'A trip id');
const entryIdOf = (req: Req) => param(req, 'entryId', 'An entry id');

export const getTrips: RequestHandler = async (req, res) => {
  res.status(200).json({ trips: await listTrips(userIdOf(req)) });
};

export const getTripById: RequestHandler = async (req, res) => {
  res.status(200).json({ trip: await getTrip(userIdOf(req), tripIdOf(req)) });
};

export const postTrip: RequestHandler = async (req, res) => {
  res.status(201).json({ trip: await createTrip(userIdOf(req), req.body) });
};

export const patchTrip: RequestHandler = async (req, res) => {
  res.status(200).json({ trip: await updateTrip(userIdOf(req), tripIdOf(req), req.body) });
};

export const deleteTripById: RequestHandler = async (req, res) => {
  await deleteTrip(userIdOf(req), tripIdOf(req));
  res.status(204).send();
};

export const getWeatherForTrip: RequestHandler = async (req, res) => {
  res.status(200).json({ weather: await getTripWeather(userIdOf(req), tripIdOf(req)) });
};

export const getDestinations: RequestHandler = async (req, res) => {
  const parsed = destinationSearchSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new HttpError(400, 'q: enter at least 2 characters');
  }

  res.status(200).json({ destinations: await searchDestinations(parsed.data.q) });
};

export const postTripEntry: RequestHandler = async (req, res) => {
  res.status(201).json({ trip: await addTripEntry(userIdOf(req), tripIdOf(req), req.body) });
};

export const patchTripEntry: RequestHandler = async (req, res) => {
  const { packed } = req.body as { packed: boolean };

  res
    .status(200)
    .json({ entry: await setEntryPacked(userIdOf(req), tripIdOf(req), entryIdOf(req), packed) });
};

export const deleteTripEntry: RequestHandler = async (req, res) => {
  await removeTripEntry(userIdOf(req), tripIdOf(req), entryIdOf(req));
  res.status(204).send();
};
