import request from 'supertest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * The app is built without binding a port — the reason `app.ts` and
 * `server.ts` are separate files. Supertest drives it in-process.
 */
export const app = createApp();

export const TEST_PASSWORD = 'test-password-123';

/**
 * Wipes every table. Safe because `global-setup.ts` refuses to run unless the
 * database name ends in `_test`.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OutfitItem", "Outfit", "ClothingItem", "User" CASCADE',
  );
}

export async function createUser(email: string): Promise<{ id: string; email: string }> {
  return prisma.user.create({
    data: {
      email,
      name: email.split('@')[0] ?? null,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
    select: { id: true, email: true },
  });
}

/**
 * Signs in and returns an agent that carries the httpOnly session cookie, so
 * tests exercise the same cookie path a browser would.
 */
export async function signIn(email: string) {
  const agent = request.agent(app);

  await agent.post('/api/auth/login').send({ email, password: TEST_PASSWORD }).expect(200);

  return agent;
}
