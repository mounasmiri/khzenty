import type { RequestHandler } from 'express';

import { clearSessionCookie, setSessionCookie } from '../lib/cookies.js';
import { HttpError } from '../lib/http-error.js';
import { signSessionToken } from '../lib/jwt.js';
import { login, register } from '../services/auth.service.js';
import { createDemoSession } from '../services/demo-session.service.js';

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

/**
 * Gives the visitor a private, temporary copy of the demo account and signs
 * them into it with the normal cookie session. The request body is ignored.
 */
export const postDemoLogin: RequestHandler = async (_req, res) => {
  const user = await createDemoSession();

  setSessionCookie(res, signSessionToken(user.id));
  res.status(200).json({ user });
};

/**
 * Lets the login page decide whether to show the button. Only reachable when
 * demo login is enabled (otherwise `requireDemoEnabled` has already answered
 * 404), so a 200 here simply means "yes".
 */
export const getDemoAvailable: RequestHandler = (_req, res) => {
  res.status(200).json({ enabled: true });
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
