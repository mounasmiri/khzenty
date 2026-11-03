import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads CLI configuration from this file rather than from
 * `package.json`. It does not load `.env` on its own, hence the import above.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
