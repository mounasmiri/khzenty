import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import {
  createOutfit,
  deleteOutfit,
  getOutfit,
  listOutfits,
  updateOutfit,
} from '../services/outfit.service.js';

/**
 * `requireAuth` guarantees `req.user`, but narrowing it here keeps the service
 * calls honest and guards against the route being mounted without the gate.
 */
function userIdOf(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

function outfitIdOf(req: Parameters<RequestHandler>[0]): string {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An outfit id is required');
  }

  return id;
}

export const getOutfits: RequestHandler = async (req, res) => {
  res.status(200).json({ outfits: await listOutfits(userIdOf(req)) });
};

export const getOutfitById: RequestHandler = async (req, res) => {
  res.status(200).json({ outfit: await getOutfit(userIdOf(req), outfitIdOf(req)) });
};

export const postOutfit: RequestHandler = async (req, res) => {
  res.status(201).json({ outfit: await createOutfit(userIdOf(req), req.body) });
};

export const patchOutfit: RequestHandler = async (req, res) => {
  res.status(200).json({ outfit: await updateOutfit(userIdOf(req), outfitIdOf(req), req.body) });
};

export const deleteOutfitById: RequestHandler = async (req, res) => {
  await deleteOutfit(userIdOf(req), outfitIdOf(req));
  res.status(204).send();
};
