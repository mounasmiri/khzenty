/**
 * The database the suite runs against.
 *
 * Shared by `vitest.config.ts` and `global-setup.ts`: `test.env` only reaches
 * the test workers, not global setup, so global setup cannot read it from the
 * environment and must import the value directly.
 *
 * `TEST_DATABASE_URL` overrides the default, which points at the Postgres
 * published by compose.yaml. CI sets it to its own service container.
 */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5433/khzenty_test?schema=public';
