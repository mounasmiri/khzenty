import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from './tests/test-database-url.js';

/**
 * Tests run against a SEPARATE database so they can truncate tables freely
 * without touching development data. `global-setup.ts` refuses to run unless
 * the database name ends in `_test`.
 */
export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Files share one database, so running them in parallel would let one
    // suite's truncate wipe another's fixtures mid-test.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      // dotenv does not overwrite variables that are already set, so these win
      // over server/.env.
      JWT_SECRET: 'test-only-secret-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      AUTH_COOKIE_NAME: 'khzenty_session',
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
  },
});
