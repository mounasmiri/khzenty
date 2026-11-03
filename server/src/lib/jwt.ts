import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export interface SessionPayload {
  /** The user's id, in the standard `sub` claim. */
  sub: string;
}

export interface IssuedSession {
  token: string;
  /**
   * Taken from the token's own `exp` claim rather than recomputed, so the
   * cookie's lifetime can never drift from the token's.
   */
  expiresAt: Date;
}

const EXPIRES_IN = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export function signSessionToken(userId: string): IssuedSession {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: EXPIRES_IN });

  const decoded = jwt.decode(token);
  const exp =
    typeof decoded === 'object' && decoded !== null && typeof decoded.exp === 'number'
      ? decoded.exp
      : null;

  if (exp === null) {
    // Unreachable with an `expiresIn` set, but a session without an expiry is
    // worse than a failed login.
    throw new Error('Signed session token is missing its exp claim');
  }

  return { token, expiresAt: new Date(exp * 1000) };
}

/** Returns `null` for anything untrustworthy — expired, tampered, malformed. */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      return null;
    }

    return { sub: decoded.sub };
  } catch {
    return null;
  }
}
