import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { DEMO_EMAIL, DEMO_TTL_MS } from '../src/lib/demo.js';
import { purgeExpiredDemoUsers } from '../src/services/demo-session.service.js';
import { seedDemoTemplate } from '../prisma/demo-template.js';
import { app, createUser, resetDatabase, signIn, TEST_PASSWORD } from './helpers.js';

const { destroyMock } = vi.hoisted(() => ({ destroyMock: vi.fn() }));

vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: true,
  ALLOWED_FORMATS: ['jpg', 'png'],
  userFolder: (userId: string) => `khzenty/users/${userId}`,
  cloudinary: {
    api: { resource: vi.fn() },
    uploader: { destroy: destroyMock },
    utils: { api_sign_request: () => 'fake-signature' },
  },
}));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const setEnv = <K extends 'DEMO_LOGIN_ENABLED' | 'DEMO_MAX_USERS' | 'NODE_ENV'>(
  key: K,
  value: (typeof env)[K],
) => {
  (env as Record<string, unknown>)[key] = value;
};

/** Signs a fresh visitor into their own demo copy. */
async function startDemo() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/demo').expect(200);

  return { agent, user: res.body.user as { id: string; email: string; isDemo: boolean } };
}

async function counts(userId: string) {
  const [items, outfits, outfitItems, trips, entries, manual, wears] = await Promise.all([
    prisma.clothingItem.count({ where: { userId } }),
    prisma.outfit.count({ where: { userId } }),
    prisma.outfitItem.count({ where: { outfit: { userId } } }),
    prisma.trip.count({ where: { userId } }),
    prisma.tripEntry.count({ where: { trip: { userId } } }),
    prisma.tripCategoryCount.count({ where: { trip: { userId } } }),
    prisma.wearLog.count({ where: { userId } }),
  ]);

  return { items, outfits, outfitItems, trips, entries, manual, wears };
}

describe('per-visitor demo sandbox', () => {
  let templateId: string;

  beforeAll(async () => {
    await resetDatabase();
    // The real seed builder, so the clone is tested against what the seed makes.
    templateId = await seedDemoTemplate();
    await createUser('bystander@khzenty.test');

    // Give two template garments a photo, as the seeded account has.
    await prisma.clothingItem.updateMany({
      where: { userId: templateId, id: { in: ['seed_white_shirt', 'seed_blue_jeans'] } },
      data: { imageUrl: 'https://res.cloudinary.com/x/image/upload/a.webp', imagePublicId: 'khzenty/users/template/a' },
    });
  });

  beforeEach(async () => {
    setEnv('DEMO_LOGIN_ENABLED', true);
    destroyMock.mockReset();
    destroyMock.mockResolvedValue({ result: 'ok' });
    await prisma.user.deleteMany({ where: { isDemo: true } });
  });

  afterEach(() => {
    setEnv('DEMO_LOGIN_ENABLED', false);
    setEnv('DEMO_MAX_USERS', 200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('feature flag', () => {
    it('answers 404 to sign-in and the probe when off, creating nothing', async () => {
      setEnv('DEMO_LOGIN_ENABLED', false);
      const before = await prisma.user.count();

      const post = await request(app).post('/api/auth/demo').expect(404);
      const get = await request(app).get('/api/auth/demo').expect(404);

      expect(post.headers['set-cookie']).toBeUndefined();
      expect(get.headers['set-cookie']).toBeUndefined();
      expect(await prisma.user.count()).toBe(before);

      const unknown = await request(app).post('/api/auth/nothing-here').expect(404);
      expect(post.body).toEqual(unknown.body);
    });

    it('reports availability when on', async () => {
      const res = await request(app).get('/api/auth/demo').expect(200);

      expect(res.body).toEqual({ enabled: true });
    });
  });

  describe('session', () => {
    it('creates a fresh demo user with a random address and no usable password', async () => {
      const { user } = await startDemo();

      expect(user.isDemo).toBe(true);
      expect(user.email).toMatch(/^demo-[0-9a-f]{24}@demo\.khzenty\.test$/);
      expect(user.id).not.toBe(templateId);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.isDemo).toBe(true);
      expect(row.passwordHash).toBe('!');

      // The address cannot be signed into with any password.
      await request(app).post('/api/auth/login').send({ email: user.email, password: '!' }).expect(401);
      await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(401);
    });

    it('issues the normal cookie session', async () => {
      const agent = request.agent(app);
      const res = await agent.post('/api/auth/demo').expect(200);

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Expires=/i);

      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.user).toMatchObject({ isDemo: true });
      expect(me.body.user.passwordHash).toBeUndefined();

      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
    });

    it('gives every visitor a different account', async () => {
      const a = await startDemo();
      const b = await startDemo();

      expect(a.user.id).not.toBe(b.user.id);
      expect(a.user.email).not.toBe(b.user.email);
    });

    it('ignores anything the client sends', async () => {
      const res = await request(app)
        .post('/api/auth/demo')
        .send({ email: 'bystander@khzenty.test', password: TEST_PASSWORD, userId: templateId })
        .expect(200);

      expect(res.body.user.isDemo).toBe(true);
      expect(res.body.user.email).not.toBe('bystander@khzenty.test');
    });

    it('never signs into the template, which stays untouched and is not a demo user', async () => {
      const before = await counts(templateId);
      await startDemo();

      const template = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
      expect(template.id).toBe(templateId);
      expect(template.isDemo).toBe(false);
      expect(await counts(templateId)).toEqual(before);
    });

    it('does not mark ordinary accounts as demo', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bystander@khzenty.test', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.user.isDemo).toBe(false);
    });

    it('answers 404 when the template has not been seeded', async () => {
      await prisma.user.update({ where: { id: templateId }, data: { email: 'renamed@khzenty.test' } });

      try {
        const res = await request(app).post('/api/auth/demo').expect(404);
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(await prisma.user.count({ where: { isDemo: true } })).toBe(0);
      } finally {
        await prisma.user.update({ where: { id: templateId }, data: { email: DEMO_EMAIL } });
      }
    });
  });

  describe('clone', () => {
    it('copies every table, with counts matching the template', async () => {
      const { user } = await startDemo();

      const copy = await counts(user.id);
      expect(copy).toEqual(await counts(templateId));
      // Not vacuous: the seed really does make all of these.
      expect(copy).toMatchObject({ items: 29, outfits: 10, trips: 2, wears: 5 });
      expect(copy.entries).toBeGreaterThan(0);
      expect(copy.manual).toBe(1);
    });

    it('uses fresh ids and wires everything to the copy, never to the template', async () => {
      const { user } = await startDemo();
      const templateItems = new Set(
        (await prisma.clothingItem.findMany({ where: { userId: templateId }, select: { id: true } })).map((i) => i.id),
      );

      const items = await prisma.clothingItem.findMany({ where: { userId: user.id }, select: { id: true } });
      expect(items.every((item) => !templateItems.has(item.id))).toBe(true);

      // Every join row points at the copy's own garments and outfits.
      const strays = await prisma.outfitItem.count({
        where: { outfit: { userId: user.id }, clothingItem: { userId: { not: user.id } } },
      });
      const strayEntries = await prisma.tripEntry.count({
        where: {
          trip: { userId: user.id },
          OR: [
            { clothingItem: { userId: { not: user.id } } },
            { outfit: { userId: { not: user.id } } },
          ],
        },
      });
      const wears = await prisma.wearLog.findMany({ where: { userId: user.id }, include: { outfit: true } });

      expect(strays).toBe(0);
      expect(strayEntries).toBe(0);
      expect(wears.every((log) => log.outfit.userId === user.id)).toBe(true);
    });

    it('keeps the details: names, favourites, laundry, packed flags and manual counts', async () => {
      const { user } = await startDemo();

      const template = await prisma.clothingItem.findMany({
        where: { userId: templateId },
        select: { name: true, favorite: true, laundryStatus: true, category: true },
        orderBy: { name: 'asc' },
      });
      const copy = await prisma.clothingItem.findMany({
        where: { userId: user.id },
        select: { name: true, favorite: true, laundryStatus: true, category: true },
        orderBy: { name: 'asc' },
      });
      expect(copy).toEqual(template);

      const dubai = await prisma.trip.findFirstOrThrow({
        where: { userId: user.id, name: 'Dubai, 7 days' },
        include: { entries: true, categoryCounts: true },
      });
      expect(dubai.entries.filter((entry) => entry.packed)).toHaveLength(3);
      expect(dubai.categoryCounts).toMatchObject([{ category: 'UNDERWEAR', count: 6 }]);
    });

    it('references the template\'s images without copying or changing them', async () => {
      const { user } = await startDemo();

      const photographed = await prisma.clothingItem.findMany({
        where: { userId: user.id, imageUrl: { not: null } },
        select: { imageUrl: true, imagePublicId: true },
      });

      expect(photographed).toHaveLength(2);
      expect(photographed.every((row) => row.imagePublicId === 'khzenty/users/template/a')).toBe(true);
      expect(destroyMock).not.toHaveBeenCalled();
    });

    it('serves the copy through the normal API', async () => {
      const { agent } = await startDemo();

      const items = await agent.get('/api/items').expect(200);
      expect(items.body.items).toHaveLength(29);

      const outfits = await agent.get('/api/outfits').expect(200);
      expect(outfits.body.outfits).toHaveLength(10);
      expect(outfits.body.outfits.every((o: { items: unknown[] }) => o.items.length >= 3)).toBe(true);

      const trips = await agent.get('/api/trips').expect(200);
      const dubai = trips.body.trips.find((t: { name: string }) => t.name === 'Dubai, 7 days');
      const detail = await agent.get(`/api/trips/${dubai.id}`).expect(200);
      expect(detail.body.trip.entries).toHaveLength(11);
      expect(detail.body.trip.packing.categories.find((c: { category: string }) => c.category === 'UNDERWEAR').manual).toBe(6);

      const wear = await agent.get('/api/wear-log').expect(200);
      expect(wear.body.entries).toHaveLength(5);
    });

    it('shifts trip dates by how long ago the template was seeded, so Dubai stays in the forecast window', async () => {
      const original = await prisma.user.findUniqueOrThrow({ where: { id: templateId }, select: { createdAt: true } });
      await prisma.user.update({
        where: { id: templateId },
        data: { createdAt: new Date(original.createdAt.getTime() - 10 * MS_PER_DAY) },
      });

      try {
        const templateDubai = await prisma.trip.findFirstOrThrow({ where: { userId: templateId, name: 'Dubai, 7 days' } });
        const { user } = await startDemo();
        const copyDubai = await prisma.trip.findFirstOrThrow({ where: { userId: user.id, name: 'Dubai, 7 days' } });

        expect(copyDubai.startDate.getTime() - templateDubai.startDate.getTime()).toBe(10 * MS_PER_DAY);
        expect(copyDubai.endDate.getTime() - copyDubai.startDate.getTime()).toBe(6 * MS_PER_DAY);
      } finally {
        await prisma.user.update({ where: { id: templateId }, data: { createdAt: original.createdAt } });
      }
    });
  });

  describe('isolation', () => {
    it('keeps two visitors\' changes apart, and the template unchanged', async () => {
      const a = await startDemo();
      const b = await startDemo();
      const templateBefore = await counts(templateId);

      const aItems = (await a.agent.get('/api/items').expect(200)).body.items as { id: string; name: string }[];
      const bItems = (await b.agent.get('/api/items').expect(200)).body.items as { id: string }[];

      await a.agent.delete(`/api/items/${aItems[0]?.id}`).expect(204);
      await a.agent.post('/api/items').send({ type: 'TSHIRT', color: 'Red', name: 'Only in A' }).expect(201);

      expect((await a.agent.get('/api/items').expect(200)).body.items).toHaveLength(29);
      const bAfter = (await b.agent.get('/api/items').expect(200)).body.items as { name: string }[];
      expect(bAfter).toHaveLength(29);
      expect(bAfter.some((item) => item.name === 'Only in A')).toBe(false);
      expect(await counts(templateId)).toEqual(templateBefore);

      // B cannot reach A's rows, by id.
      const aOwn = (await a.agent.get('/api/items').expect(200)).body.items as { id: string }[];
      const aOnly = aOwn.find((item) => !bItems.some((b2) => b2.id === item.id));
      await b.agent.get(`/api/items/${aOnly?.id}`).expect(404);
      await b.agent.delete(`/api/items/${aOnly?.id}`).expect(404);
    });

    it('cannot read a real user\'s data, or the template\'s', async () => {
      const { agent } = await startDemo();
      const templateItem = await prisma.clothingItem.findFirstOrThrow({ where: { userId: templateId } });
      const templateTrip = await prisma.trip.findFirstOrThrow({ where: { userId: templateId } });

      await agent.get(`/api/items/${templateItem.id}`).expect(404);
      await agent.get(`/api/trips/${templateTrip.id}`).expect(404);
      await agent.patch(`/api/items/${templateItem.id}`).send({ name: 'Hijacked' }).expect(404);
    });
  });

  describe('Cloudinary safety', () => {
    it('never destroys an asset when a demo user deletes a garment', async () => {
      const { agent } = await startDemo();
      const items = (await agent.get('/api/items').expect(200)).body.items as { id: string; imageUrl: string | null }[];
      const photographed = items.find((item) => item.imageUrl);

      await agent.delete(`/api/items/${photographed?.id}`).expect(204);

      expect(destroyMock).not.toHaveBeenCalled();
      // And the template's garment, which owns the same asset, is untouched.
      expect(await prisma.clothingItem.count({ where: { userId: templateId, imagePublicId: 'khzenty/users/template/a' } })).toBe(2);
    });

    it('never destroys an asset when a demo user removes a photo, but does clear their link', async () => {
      const { agent, user } = await startDemo();
      const photographed = await prisma.clothingItem.findFirstOrThrow({
        where: { userId: user.id, imageUrl: { not: null } },
      });

      await agent.delete(`/api/items/${photographed.id}/image`).expect(200);

      expect(destroyMock).not.toHaveBeenCalled();
      const after = await prisma.clothingItem.findUniqueOrThrow({ where: { id: photographed.id } });
      expect(after.imageUrl).toBeNull();
      expect(after.imagePublicId).toBeNull();
    });

    it('does not destroy when expired copies are cleaned up', async () => {
      const { user } = await startDemo();
      await prisma.user.update({ where: { id: user.id }, data: { createdAt: new Date(Date.now() - DEMO_TTL_MS - 1000) } });

      expect(await purgeExpiredDemoUsers()).toBe(1);
      expect(destroyMock).not.toHaveBeenCalled();
    });

    it('also protects a shared asset from an ordinary user (second line of defence)', async () => {
      const owner = await createUser('shared-owner@khzenty.test');
      const other = await createUser('shared-other@khzenty.test');
      const make = (userId: string) =>
        prisma.clothingItem.create({
          data: { userId, category: 'TOP', type: 'TSHIRT', imageUrl: 'https://x/y.webp', imagePublicId: 'khzenty/users/shared/z' },
        });
      const first = await make(owner.id);
      const second = await make(other.id);

      const ownerAgent = await signIn('shared-owner@khzenty.test');
      const otherAgent = await signIn('shared-other@khzenty.test');

      await ownerAgent.delete(`/api/items/${first.id}`).expect(204);
      expect(destroyMock).not.toHaveBeenCalled();

      await otherAgent.delete(`/api/items/${second.id}`).expect(204);
      expect(destroyMock).toHaveBeenCalledWith('khzenty/users/shared/z', { resource_type: 'image' });
    });
  });

  describe('uploads', () => {
    it('refuses a signature to a demo user with 403', async () => {
      const { agent } = await startDemo();

      const res = await agent.post('/api/uploads/signature').expect(403);

      expect(res.body.error.message).toBe('Photo upload is turned off in the demo');
    });

    it('refuses to attach an image to a garment with 403', async () => {
      const { agent, user } = await startDemo();
      const item = await prisma.clothingItem.findFirstOrThrow({ where: { userId: user.id } });

      await agent
        .put(`/api/items/${item.id}/image`)
        .send({ publicId: `khzenty/users/${user.id}/anything` })
        .expect(403);
    });

    it('leaves uploads working for ordinary accounts', async () => {
      const agent = await signIn('bystander@khzenty.test');

      await agent.post('/api/uploads/signature').expect(200);
    });
  });

  describe('cleanup', () => {
    async function demoUserAged(hours: number) {
      return prisma.user.create({
        data: {
          email: `aged-${hours}-${Math.random().toString(16).slice(2)}@demo.khzenty.test`,
          passwordHash: '!',
          isDemo: true,
          createdAt: new Date(Date.now() - hours * 60 * 60 * 1000),
          clothingItems: { create: { category: 'TOP', type: 'TSHIRT' } },
        },
      });
    }

    it('removes demo copies older than 24 hours, with everything they own, and only those', async () => {
      const stale = await demoUserAged(25);
      const fresh = await demoUserAged(1);
      const justUnder = await demoUserAged(23);
      // Old, but not a demo copy: must never be touched.
      const realOld = await prisma.user.create({
        data: {
          email: 'long-time-user@khzenty.test',
          passwordHash: 'x',
          createdAt: new Date(Date.now() - 400 * MS_PER_DAY),
          clothingItems: { create: { category: 'TOP', type: 'TSHIRT' } },
        },
      });

      expect(await purgeExpiredDemoUsers()).toBe(1);

      expect(await prisma.user.findUnique({ where: { id: stale.id } })).toBeNull();
      expect(await prisma.clothingItem.count({ where: { userId: stale.id } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: fresh.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: justUnder.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: realOld.id } })).not.toBeNull();
      expect(await prisma.clothingItem.count({ where: { userId: realOld.id } })).toBe(1);
      expect(await prisma.user.findUnique({ where: { id: templateId } })).not.toBeNull();

      await prisma.user.delete({ where: { id: realOld.id } });
    });

    it('runs on every demo sign-in', async () => {
      const stale = await demoUserAged(30);

      await startDemo();

      expect(await prisma.user.findUnique({ where: { id: stale.id } })).toBeNull();
    });

    it('frees room under the cap by expiring old copies first', async () => {
      setEnv('DEMO_MAX_USERS', 1);
      await demoUserAged(48);

      await request(app).post('/api/auth/demo').expect(200);
    });
  });

  describe('capacity', () => {
    it('answers 503 with a friendly message once the cap is reached', async () => {
      setEnv('DEMO_MAX_USERS', 2);
      await startDemo();
      await startDemo();

      const res = await request(app).post('/api/auth/demo').expect(503);

      expect(res.body.error.message).toBe('The demo is busy right now. Please try again in a little while.');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await prisma.user.count({ where: { isDemo: true } })).toBe(2);
    });

    it('recovers when room appears', async () => {
      setEnv('DEMO_MAX_USERS', 1);
      const first = await startDemo();
      await request(app).post('/api/auth/demo').expect(503);

      await prisma.user.delete({ where: { id: first.user.id } });

      await request(app).post('/api/auth/demo').expect(200);
    });
  });

  describe('rate limit', () => {
    it('shares login\'s budget', async () => {
      const original = env.NODE_ENV;
      // The limiter is skipped under test; switch the environment so it runs.
      setEnv('NODE_ENV', 'development');

      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await request(app).post('/api/auth/demo').expect(200);
        }

        const blocked = await request(app).post('/api/auth/demo').expect(429);
        expect(blocked.body.error.status).toBe(429);

        await request(app)
          .post('/api/auth/login')
          .send({ email: 'bystander@khzenty.test', password: 'wrong' })
          .expect(429);
      } finally {
        setEnv('NODE_ENV', original);
      }
    });
  });
});
