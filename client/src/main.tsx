import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from '@/App.tsx';
import { AuthProvider } from '@/features/auth/auth-provider';
import '@/index.css';

const rootElement = document.getElementById('root');

// Prefer a clear message over the non-null assertion the scaffold shipped with.
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    {/* Router outside AuthProvider: ProtectedRoute needs both, and the
        provider's redirects rely on router context already existing. */}
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
