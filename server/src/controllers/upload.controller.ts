import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import {
  confirmItemImage,
  createUploadSignature,
  removeItemImage,
} from '../services/upload.service.js';

function userIdOf(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

/** Issues a signature scoped to the caller's own folder. */
export const postUploadSignature: RequestHandler = (req, res) => {
  res.status(200).json({ upload: createUploadSignature(userIdOf(req)) });
};

/** Who is asking, for the one question services must answer: may this destroy an asset? */
function actorOf(req: Parameters<RequestHandler>[0]): { isDemo: boolean } {
  return { isDemo: req.user?.isDemo ?? false };
}

function itemIdOf(req: Parameters<RequestHandler>[0]): string {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An item id is required');
  }

  return id;
}

/** Records an already-uploaded image against one of the caller's items. */
export const putItemImage: RequestHandler = async (req, res) => {
  const item = await confirmItemImage(userIdOf(req), itemIdOf(req), req.body.publicId, actorOf(req));
  res.status(200).json({ item });
};

/** Detaches the image and deletes the asset behind it. */
export const deleteItemImage: RequestHandler = async (req, res) => {
  const item = await removeItemImage(userIdOf(req), itemIdOf(req), actorOf(req));
  res.status(200).json({ item });
};
