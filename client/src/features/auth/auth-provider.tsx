import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, api } from '@/lib/api';
import { AuthContext, type AuthContextValue } from './auth-context';
import type { AuthResponse, AuthStatus, User } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  /**
   * The session cookie is httpOnly, so the only way to learn whether we are
   * signed in is to ask the server.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .get<AuthResponse>('/auth/me')
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        // A 401 is the expected "not signed in" answer, not a failure.
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error('[auth] Session check failed:', error);
        }

        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await api.post<AuthResponse>('/auth/login', { email, password });
    setUser(me);
    setStatus('authenticated');
  }, []);

  const loginAsDemo = useCallback(async () => {
    const { user: me } = await api.post<AuthResponse>('/auth/demo');
    setUser(me);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { user: me } = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      // Omit rather than send an empty string, which would fail the min(1) rule.
      ...(name && name.trim().length > 0 ? { name: name.trim() } : {}),
    });

    setUser(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<void>('/auth/logout');
    } finally {
      // Sign out locally even if the request failed; the alternative is a UI
      // stuck in a signed-in state the server no longer honours.
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, loginAsDemo, register, logout }),
    [user, status, login, loginAsDemo, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
