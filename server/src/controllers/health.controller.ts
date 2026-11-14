import type { RequestHandler } from 'express';

import { healthService } from '../services/health.service.js';

/**
 * Controllers stay this thin: read the request, delegate, shape the response.
 * No business logic lives here. 503 when the database is unreachable, so a load
 * balancer or orchestrator can take the instance out of rotation.
 */
export const getHealth: RequestHandler = async (_req, res) => {
  const { httpStatus, body } = await healthService.getStatus();

  res.status(httpStatus).json(body);
};
