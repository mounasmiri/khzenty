import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import { undoWear, wearOutfit } from '../services/wear-log.service.js';

function userIdOf(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

function idOf(req: Parameters<RequestHandler>[0]): string {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An id is required');
  }

  return id;
}

export const postWear: RequestHandler = async (req, res) => {
  res.status(201).json({ wearLog: await wearOutfit(userIdOf(req), idOf(req)) });
};

export const postUndoWear: RequestHandler = async (req, res) => {
  await undoWear(userIdOf(req), idOf(req));
  res.status(204).send();
};
