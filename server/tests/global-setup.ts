import { execSync } from 'node:child_process';

import { TEST_DATABASE_URL } from './test-database-url.js';

/**
 * Creates the test database if it is missing, then applies migrations to it.
 *
 * Runs once for the whole suite. `migrate deploy` rather than `migrate dev`:
 * deploy only applies existing migrations and never prompts or generates new
 * ones, which is what a non-interactive run needs.
 */
export default async function setup(): Promise<void> {
  const parsed = new URL(TEST_DATABASE_URL);
  const testDbName = parsed.pathname.replace(/^\//, '');

  if (!testDbName) {
    throw new Error(`Could not read a database name from: ${TEST_DATABASE_URL}`);
  }

  // Guard against ever pointing the suite at the development database, since
  // the helpers truncate every table.
  if (!testDbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${testDbName}": the database name must end in "_test".`,
    );
  }

  await createDatabaseIfMissing(parsed, testDbName);

  // A single command string rather than an args array: passing args with
  // `shell: true` is deprecated, and npx needs a shell on Windows.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

/**
 * `CREATE DATABASE` cannot run from inside the database being created, so this
 * connects to the server's default `postgres` database instead.
 */
async function createDatabaseIfMissing(parsed: URL, testDbName: string): Promise<void> {
  const adminUrl = new URL(parsed.toString());
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const { Client } = await import('pg');
  const client = new Client({ connectionString: adminUrl.toString() });

  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDbName,
    ]);

    if (existing.rowCount === 0) {
      // An identifier cannot be parameterised; the name is validated above.
      await client.query(`CREATE DATABASE "${testDbName}"`);
      console.log(`[tests] Created database ${testDbName}`);
    }
  } finally {
    await client.end();
  }
}
