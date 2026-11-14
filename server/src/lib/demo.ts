/**
 * The one account demo login may ever sign in as.
 *
 * A constant, never read from a request: the client sends no credentials and no
 * email, so there is nothing to point demo login at a different account.
 * `.test` is reserved by RFC 2606, so no real user can hold this address. The
 * seed script creates the account.
 */
export const DEMO_EMAIL = 'demo@khzenty.test';

export function isDemoEmail(email: string): boolean {
  return email === DEMO_EMAIL;
}
