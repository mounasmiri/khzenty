import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from '@/components/app-shell';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { useAuth } from '@/features/auth/use-auth';
import { ItemDetailPage } from '@/pages/item-detail-page';
import { ItemEditPage } from '@/pages/item-edit-page';
import { ItemNewPage } from '@/pages/item-new-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { WardrobePage } from '@/pages/wardrobe-page';

/**
 * Keeps signed-in users off /login and /register, so a bookmarked login page
 * does not look like a signed-out state.
 */
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return null;
  }

  return status === 'authenticated' ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Everything below needs a session, and shares the app header. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<WardrobePage />} />
          <Route path="/items/new" element={<ItemNewPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/items/:id/edit" element={<ItemEditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
