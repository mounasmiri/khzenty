import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

/**
 * Prisma 7 removed the Rust query engine, so a driver adapter is required
 * rather than optional. `PrismaPg` owns the underlying `pg` connection pool.
 */
function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * `tsx watch` re-imports modules on every change. Without this guard each
 * reload would build a new client and leak its connection pool until Postgres
 * refused new connections.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  __khzentyPrisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.__khzentyPrisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__khzentyPrisma = prisma;
}
