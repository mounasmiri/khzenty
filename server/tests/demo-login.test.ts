import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { app, createUser, resetDatabase, TEST_PASSWORD } from './helpers.js';

const setDemoEnabled = (value: boolean) => {
  (env as { DEMO_LOGIN_ENABLED: boolean }).DEMO_LOGIN_ENABLED = value;
};

describe('demo login', () => {
  let demoId: string;
  let otherId: string;

  beforeAll(async () => {
    await resetDatabase();
    demoId = (await createUser(DEMO_EMAIL)).id;
    otherId = (await createUser('someone-else@khzenty.test')).id;

    await prisma.clothingItem.create({
      data: { userId: demoId, category: 'TOP', type: 'TSHIRT', color: 'White', name: 'Demo tee' },
    });
    await prisma.clothingItem.create({
      data: { userId: otherId, category: 'TOP', type: 'TSHIRT', color: 'Black', name: 'Private tee' },
    });
  });

  afterEach(() => {
    setDemoEnabled(false);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('when disabled (the default)', () => {
    it('is off unless switched on', () => {
      expect(env.DEMO_LOGIN_ENABLED).toBe(false);
    });

    it('answers 404 to the sign-in and the availability probe, and sets no cookie', async () => {
      const post = await request(app).post('/api/auth/demo').expect(404);
      const get = await request(app).get('/api/auth/demo').expect(404);

      expect(post.headers['set-cookie']).toBeUndefined();
      expect(get.headers['set-cookie']).toBeUndefined();
      // Identical to an unknown path, so the feature's presence is not revealed.
      const unknown = await request(app).post('/api/auth/nothing-here').expect(404);
      expect(post.body).toEqual(unknown.body);
    });
  });

  describe('when enabled', () => {
    it('reports availability', async () => {
      setDemoEnabled(true);

      const res = await request(app).get('/api/auth/demo').expect(200);

      expect(res.body).toEqual({ enabled: true });
    });

    it('signs in as the demo user with a normal session, using no credentials', async () => {
      setDemoEnabled(true);
      const agent = request.agent(app);

      const res = await agent.post('/api/auth/demo').expect(200);

      expect(res.body.user).toMatchObject({ email: DEMO_EMAIL, isDemo: true });
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Expires=/i);

      // The cookie is a regular session: /me works, and logout ends it.
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.user).toMatchObject({ email: DEMO_EMAIL, isDemo: true });

      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
    });

    it('cannot be pointed at another account', async () => {
      setDemoEnabled(true);
      const agent = request.agent(app);

      // Everything a client might try to send is ignored.
      const res = await agent
        .post('/api/auth/demo')
        .send({ email: 'someone-else@khzenty.test', password: TEST_PASSWORD, userId: otherId })
        .expect(200);

      expect(res.body.user.email).toBe(DEMO_EMAIL);
      expect(res.body.user.id).toBe(demoId);

      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.user.id).toBe(demoId);
    });

    it('keeps the demo session inside the demo user\'s own data', async () => {
      setDemoEnabled(true);
      const agent = request.agent(app);
      await agent.post('/api/auth/demo').expect(200);

      const items = await agent.get('/api/items').expect(200);
      expect(items.body.items.map((item: { name: string }) => item.name)).toEqual(['Demo tee']);

      const foreign = await prisma.clothingItem.findFirstOrThrow({ where: { userId: otherId } });
      await agent.get(`/api/items/${foreign.id}`).expect(404);
      await agent.delete(`/api/items/${foreign.id}`).expect(404);
    });

    it('does not mark an ordinary account as the demo', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'someone-else@khzenty.test', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.user.isDemo).toBe(false);
    });

    it('answers 404 when the demo account has not been seeded', async () => {
      setDemoEnabled(true);
      await prisma.user.update({ where: { id: demoId }, data: { email: 'renamed@khzenty.test' } });

      try {
        const res = await request(app).post('/api/auth/demo').expect(404);
        expect(res.headers['set-cookie']).toBeUndefined();
      } finally {
        await prisma.user.update({ where: { id: demoId }, data: { email: DEMO_EMAIL } });
      }
    });

    it('is rate limited, sharing login\'s budget', async () => {
      setDemoEnabled(true);
      // The limiter is skipped under test; switch the environment so it runs.
      const original = env.NODE_ENV;
      (env as { NODE_ENV: string }).NODE_ENV = 'development';

      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await request(app).post('/api/auth/demo').expect(200);
        }

        const blocked = await request(app).post('/api/auth/demo').expect(429);
        expect(blocked.body.error.status).toBe(429);

        // Login draws on the same budget, so demo cannot be used to dodge it.
        await request(app)
          .post('/api/auth/login')
          .send({ email: DEMO_EMAIL, password: 'wrong' })
          .expect(429);
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = original;
      }
    });
  });
});
