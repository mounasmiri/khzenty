import type { RequestHandler } from 'express';

import { healthService } from '../services/health.service.js';

/**
 * Controllers stay this thin: read the request, delegate, shape the response.
 * No business logic lives here.
 */
export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(healthService.getStatus());
};
