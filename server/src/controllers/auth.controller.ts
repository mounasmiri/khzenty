import type { RequestHandler } from 'express';

import { clearSessionCookie, setSessionCookie } from '../lib/cookies.js';
import { HttpError } from '../lib/http-error.js';
import { signSessionToken } from '../lib/jwt.js';
import { login, register } from '../services/auth.service.js';

/**
 * Registering signs the user in immediately — there is no email verification
 * step in scope, so forcing a second round trip to /login would be pointless.
 */
export const postRegister: RequestHandler = async (req, res) => {
  const user = await register(req.body);

  setSessionCookie(res, signSessionToken(user.id));
  res.status(201).json({ user });
};

export const postLogin: RequestHandler = async (req, res) => {
  const user = await login(req.body);

  setSessionCookie(res, signSessionToken(user.id));
  res.status(200).json({ user });
};

/** Idempotent: clearing an absent cookie is still a successful logout. */
export const postLogout: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
};

export const getMe: RequestHandler = (req, res) => {
  if (!req.user) {
    // Unreachable behind `requireAuth`; guards against the route being
    // remounted without it.
    throw new HttpError(401, 'Authentication required');
  }

  res.status(200).json({ user: req.user });
};
