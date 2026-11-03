import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from './use-auth';

/**
 * Wraps routes that require a session.
 *
 * While `status` is `loading` it renders a placeholder rather than redirecting:
 * redirecting on an unresolved session would sign out every user who refreshes.
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Checking your session…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // `state` lets the login page send the user back where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
