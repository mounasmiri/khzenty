import type { PublicUser } from './auth.js';

/**
 * Adds the authenticated user to Express's request type. Populated only by
 * `requireAuth`; optional because most requests never pass through it.
 */
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}
