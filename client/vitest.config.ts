import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Only pure logic is tested here — the concurrency limiter in particular.
 *
 * `environment: 'node'` because nothing under test touches the DOM. Image
 * compression needs canvas and `createImageBitmap`, which a node environment
 * cannot provide; testing it would mean adding jsdom and still stubbing the
 * canvas, which would assert the stub rather than the resizing.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 15_000,
    include: ['src/**/*.test.ts'],
    pool: 'vmForks',
  },
});
