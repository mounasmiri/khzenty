import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import { markWashed, setLaundryStatus } from '../services/laundry.service.js';

function userIdOf(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

export const patchLaundryStatus: RequestHandler = async (req, res) => {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An item id is required');
  }

  const item = await setLaundryStatus(userIdOf(req), id, req.body.status);
  res.status(200).json({ item });
};

/** Returns how many garments actually moved, since foreign ids are skipped. */
export const postMarkWashed: RequestHandler = async (req, res) => {
  const result = await markWashed(userIdOf(req), req.body.ids);
  res.status(200).json(result);
};
