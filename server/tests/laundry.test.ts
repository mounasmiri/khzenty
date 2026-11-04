import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { app, createUser, resetDatabase, signIn } from './helpers.js';

describe('laundry status', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let intruderAgent: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('washer@khzenty.test');
    await createUser('intruder@khzenty.test');

    agent = await signIn('washer@khzenty.test');
    intruderAgent = await signIn('intruder@khzenty.test');
  });

  beforeEach(async () => {
    // Each block starts from a known wardrobe, since several create items.
    await prisma.clothingItem.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createItem(agentToUse = agent): Promise<string> {
    const created = await agentToUse
      .post('/api/items')
      .send({ type: 'TSHIRT', color: 'White' })
      .expect(201);

    return created.body.item.id as string;
  }

  function row(id: string) {
    return prisma.clothingItem.findUniqueOrThrow({
      where: { id },
      select: { laundryStatus: true, laundryAt: true },
    });
  }

  describe('defaults', () => {
    it('creates garments clean, with no timestamp yet', async () => {
      const id = await createItem();

      const res = await agent.get(`/api/items/${id}`).expect(200);
      expect(res.body.item.laundryStatus).toBe('CLEAN');
      // Null rather than now(): nothing has set the status yet.
      expect(res.body.item.laundryAt).toBeNull();
    });
  });

  describe('setting one garment', () => {
    it('moves a garment into the laundry and stamps the time', async () => {
      const id = await createItem();

      const res = await agent
        .patch(`/api/items/${id}/laundry`)
        .send({ status: 'IN_LAUNDRY' })
        .expect(200);

      expect(res.body.item.laundryStatus).toBe('IN_LAUNDRY');
      expect(res.body.item.laundryAt).not.toBeNull();
    });

    it('moves it back to clean', async () => {
      const id = await createItem();

      await agent.patch(`/api/items/${id}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
      const res = await agent
        .patch(`/api/items/${id}/laundry`)
        .send({ status: 'CLEAN' })
        .expect(200);

      expect(res.body.item.laundryStatus).toBe('CLEAN');
    });

    it('rejects a status outside the enum', async () => {
      const id = await createItem();
      await agent.patch(`/api/items/${id}/laundry`).send({ status: 'SOAKING' }).expect(400);
      await agent.patch(`/api/items/${id}/laundry`).send({}).expect(400);
    });

    it('requires authentication', async () => {
      const id = await createItem();
      await request(app)
        .patch(`/api/items/${id}/laundry`)
        .send({ status: 'IN_LAUNDRY' })
        .expect(401);
    });
  });

  describe('idempotency', () => {
    it('re-sending the same status does not move laundryAt', async () => {
      const id = await createItem();

      await agent.patch(`/api/items/${id}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
      const first = await row(id);

      await new Promise((resolve) => setTimeout(resolve, 15));

      await agent.patch(`/api/items/${id}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
      const second = await row(id);

      // The status did not change, so the clock on "how long has this been in
      // the basket" must not restart.
      expect(second.laundryStatus).toBe('IN_LAUNDRY');
      expect(second.laundryAt?.getTime()).toBe(first.laundryAt?.getTime());
    });
  });

  describe('ownership', () => {
    it("returns 404 for another user's item and changes nothing", async () => {
      const id = await createItem();

      await intruderAgent
        .patch(`/api/items/${id}/laundry`)
        .send({ status: 'IN_LAUNDRY' })
        .expect(404);

      await expect(row(id)).resolves.toMatchObject({ laundryStatus: 'CLEAN' });
    });

    it('returns the same 404 for an id that does not exist', async () => {
      await intruderAgent
        .patch('/api/items/does-not-exist/laundry')
        .send({ status: 'IN_LAUNDRY' })
        .expect(404);
    });
  });

  describe('bulk mark as washed', () => {
    it('washes the listed garments and reports the count', async () => {
      const ids = [await createItem(), await createItem(), await createItem()];

      for (const id of ids) {
        await agent.patch(`/api/items/${id}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
      }

      const res = await agent
        .post('/api/items/laundry/washed')
        .send({ ids })
        .expect(200);

      expect(res.body.updated).toBe(3);

      for (const id of ids) {
        await expect(row(id)).resolves.toMatchObject({ laundryStatus: 'CLEAN' });
      }
    });

    it('is idempotent: a second call matches nothing', async () => {
      const id = await createItem();
      await agent.patch(`/api/items/${id}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);

      const first = await agent.post('/api/items/laundry/washed').send({ ids: [id] }).expect(200);
      expect(first.body.updated).toBe(1);

      const washedAt = (await row(id)).laundryAt?.getTime();
      await new Promise((resolve) => setTimeout(resolve, 15));

      const second = await agent.post('/api/items/laundry/washed').send({ ids: [id] }).expect(200);
      // Already clean, so nothing moved and the timestamp stands.
      expect(second.body.updated).toBe(0);
      expect((await row(id)).laundryAt?.getTime()).toBe(washedAt);
    });

    it("skips another user's ids rather than failing the batch", async () => {
      const mine = await createItem();
      const theirs = await createItem(intruderAgent);

      await agent.patch(`/api/items/${mine}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
      await intruderAgent
        .patch(`/api/items/${theirs}/laundry`)
        .send({ status: 'IN_LAUNDRY' })
        .expect(200);

      const res = await agent
        .post('/api/items/laundry/washed')
        .send({ ids: [mine, theirs, 'not-a-real-id'] })
        .expect(200);

      // Only the caller's own garment moved; the batch still succeeded.
      expect(res.body.updated).toBe(1);
      await expect(row(mine)).resolves.toMatchObject({ laundryStatus: 'CLEAN' });
      await expect(row(theirs)).resolves.toMatchObject({ laundryStatus: 'IN_LAUNDRY' });
    });

    it('leaves already-clean garments alone', async () => {
      const dirty = await createItem();
      const clean = await createItem();
      await agent.patch(`/api/items/${dirty}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);

      const res = await agent
        .post('/api/items/laundry/washed')
        .send({ ids: [dirty, clean] })
        .expect(200);

      expect(res.body.updated).toBe(1);
      // The clean one never had a status set, so it still has no timestamp.
      await expect(row(clean)).resolves.toMatchObject({
        laundryStatus: 'CLEAN',
        laundryAt: null,
      });
    });

    it('validates the body', async () => {
      await agent.post('/api/items/laundry/washed').send({ ids: [] }).expect(400);
      await agent.post('/api/items/laundry/washed').send({}).expect(400);
    });

    it('requires authentication', async () => {
      await request(app).post('/api/items/laundry/washed').send({ ids: ['x'] }).expect(401);
    });
  });
});
