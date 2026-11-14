/** Mirrors `PublicUser` on the server. Never contains credentials. */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  /** True only for the seeded demo account; set by the server. */
  isDemo?: boolean;
}

export interface AuthResponse {
  user: User;
}

/**
 * `loading` matters: on first paint we do not yet know whether the httpOnly
 * cookie is valid, and treating that as "signed out" would bounce a logged-in
 * user to /login on every refresh.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
