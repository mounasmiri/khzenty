import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import { confirmItemImage, createUploadSignature } from '../services/upload.service.js';

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

/** Records an already-uploaded image against one of the caller's items. */
export const putItemImage: RequestHandler = async (req, res) => {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An item id is required');
  }

  const item = await confirmItemImage(userIdOf(req), id, req.body.publicId);
  res.status(200).json({ item });
};
