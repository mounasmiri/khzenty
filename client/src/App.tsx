import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from '@/components/app-shell';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { useAuth } from '@/features/auth/use-auth';
import { ItemDetailPage } from '@/pages/item-detail-page';
import { ItemEditPage } from '@/pages/item-edit-page';
import { ItemNewPage } from '@/pages/item-new-page';
import { BulkAddPage } from '@/pages/bulk-add-page';
import { LoginPage } from '@/pages/login-page';
import { LaundryPage } from '@/pages/laundry-page';
import { OutfitEditPage } from '@/pages/outfit-edit-page';
import { OutfitNewPage } from '@/pages/outfit-new-page';
import { OutfitsPage } from '@/pages/outfits-page';
import { QuickAddPage } from '@/pages/quick-add-page';
import { QuickSortPage } from '@/pages/quick-sort-page';
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
          {/* Declared before /items/:id so the literal segments win. */}
          <Route path="/items/quick-add" element={<QuickAddPage />} />
          <Route path="/items/bulk-add" element={<BulkAddPage />} />
          <Route path="/items/sort" element={<QuickSortPage />} />
          <Route path="/laundry" element={<LaundryPage />} />
          <Route path="/outfits" element={<OutfitsPage />} />
          {/* Declared before /outfits/:id/edit so the literal segment wins. */}
          <Route path="/outfits/new" element={<OutfitNewPage />} />
          <Route path="/outfits/:id/edit" element={<OutfitEditPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/items/:id/edit" element={<ItemEditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
