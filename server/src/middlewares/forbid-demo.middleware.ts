import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';

/**
 * Keeps demo copies away from anything that writes to Cloudinary.
 *
 * Visitors share a pre-built wardrobe and its images; letting them upload would
 * put anonymous files into the project's storage with nobody to clean up after
 * them. Mount after `requireAuth`, which is what sets `req.user`.
 */
export const forbidDemoUsers: RequestHandler = (req, _res, next) => {
  if (req.user?.isDemo) {
    next(new HttpError(403, 'Photo upload is turned off in the demo'));
    return;
  }

  next();
};
