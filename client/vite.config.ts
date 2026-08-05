import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 is configured in CSS (see src/index.css), not a JS config file.
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      // Keep in sync with `paths` in tsconfig.app.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Fail loudly rather than silently drifting to 5174, which would break both
    // the API's CORS origin and the proxy target below.
    strictPort: true,
    proxy: {
      // Lets the app call `/api/...` same-origin in dev, so no CORS round trip.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
