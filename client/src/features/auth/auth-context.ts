import { createContext } from 'react';

import type { AuthStatus, User } from './types';

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  /** One-click sign-in to the demo account; the server decides which one. */
  loginAsDemo: () => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Kept in its own module, separate from the provider component: a file that
 * exports both a context and a component breaks React Fast Refresh.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
