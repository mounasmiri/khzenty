/**
 * The seeded demo account that per-visitor sandboxes are cloned *from*.
 *
 * Nobody ever signs in as it through the demo flow: a visitor gets a private,
 * temporary copy (see `demo-session.service.ts`). A constant, never read from a
 * request, so nothing a client sends can change which account is cloned.
 * `.test` is reserved by RFC 2606, so no real user can hold this address. The
 * seed script (`npm run db:seed`) is how the template is created and refreshed.
 */
export const DEMO_EMAIL = 'demo@khzenty.test';

/** How long a visitor's private copy lives before cleanup deletes it. */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Stored as the password hash of every demo copy.
 *
 * Not an Argon2 digest, so `verifyPassword` can never accept any password
 * against it (it reports a malformed digest as a mismatch). A demo copy is only
 * ever reachable through the session cookie issued when it was created.
 */
export const UNUSABLE_PASSWORD_HASH = '!';

/** A random, unguessable address in the reserved `.test` domain. */
export function randomDemoEmail(randomHex: string): string {
  return `demo-${randomHex}@demo.khzenty.test`;
}
