import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads CLI configuration from this file rather than from
 * `package.json`. It does not load `.env` on its own, hence the import above.
 *
 * Migrations prefer `DIRECT_URL`. On Neon, `DATABASE_URL` is the pooled
 * ("-pooler") address, which goes through PgBouncer in transaction mode;
 * `prisma migrate` takes a session-level advisory lock that pooling cannot
 * honour, so it needs the direct address. Everywhere else `DIRECT_URL` is unset
 * and this is just `DATABASE_URL`. The running server never reads `DIRECT_URL`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
