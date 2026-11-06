import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

/**
 * Outfits are the first feature where one user's request names another user's
 * rows directly: an outfit is built from garment ids the client chooses. The
 * scoping is therefore not just "don't show me someone else's outfits" but
 * "don't let me *build* one out of someone else's wardrobe".
 *
 * Every probe below asserts a 404 rather than a 403. A 403 would confirm that
 * the id exists in another user's wardrobe, which is exactly the fact an
 * attacker enumerating ids is after.
 */
describe('outfit ownership', () => {
  let owner: Awaited<ReturnType<typeof signIn>>;
  let intruder: Awaited<ReturnType<typeof signIn>>;

  let ownerTop: string;
  let ownerShoes: string;
  let intruderTop: string;

  let ownerOutfit: string;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('owner@khzenty.test');
    await createUser('intruder@khzenty.test');

    owner = await signIn('owner@khzenty.test');
    intruder = await signIn('intruder@khzenty.test');

    const top = await owner.post('/api/items').send({ type: 'HOODIE', color: 'Grey' }).expect(201);
    ownerTop = top.body.item.id;

    const shoes = await owner
      .post('/api/items')
      .send({ type: 'SNEAKERS', color: 'White' })
      .expect(201);
    ownerShoes = shoes.body.item.id;

    const theirs = await intruder
      .post('/api/items')
      .send({ type: 'SHIRT', color: 'Blue' })
      .expect(201);
    intruderTop = theirs.body.item.id;

    const outfit = await owner
      .post('/api/outfits')
      .send({ name: 'Weekend', itemIds: [ownerTop, ownerShoes] })
      .expect(201);
    ownerOutfit = outfit.body.outfit.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('attaching garments', () => {
    it('accepts the caller’s own garments', async () => {
      const res = await owner
        .post('/api/outfits')
        .send({ name: 'Own items', itemIds: [ownerTop, ownerShoes] })
        .expect(201);

      expect(res.body.outfit.items).toHaveLength(2);
      expect(res.body.outfit.items.map((i: { id: string }) => i.id).sort()).toEqual(
        [ownerTop, ownerShoes].sort(),
      );
    });

    it('refuses an outfit containing another user’s garment', async () => {
      // The single most important assertion in this file.
      await intruder
        .post('/api/outfits')
        .send({ name: 'Stolen', itemIds: [intruderTop, ownerTop] })
        .expect(404);
    });

    it('refuses an outfit made entirely of another user’s garments', async () => {
      await intruder
        .post('/api/outfits')
        .send({ name: 'All stolen', itemIds: [ownerTop, ownerShoes] })
        .expect(404);
    });

    it('persists nothing when one id is foreign', async () => {
      const before = await intruder.get('/api/outfits').expect(200);

      await intruder
        .post('/api/outfits')
        .send({ name: 'Partial', itemIds: [intruderTop, ownerShoes] })
        .expect(404);

      const after = await intruder.get('/api/outfits').expect(200);

      // Not a partial save with only the owned garment: the whole request is
      // refused, so no outfit appears at all.
      expect(after.body.outfits).toHaveLength(before.body.outfits.length);
    });

    it('refuses a garment id that does not exist anywhere', async () => {
      await owner
        .post('/api/outfits')
        .send({ name: 'Ghost', itemIds: ['cl00000000000000000000000'] })
        .expect(404);
    });

    it('refuses to graft a foreign garment on with PATCH', async () => {
      // The update path is a second way in, and needs its own check.
      await owner
        .patch(`/api/outfits/${ownerOutfit}`)
        .send({ itemIds: [ownerTop, intruderTop] })
        .expect(404);

      const after = await owner.get(`/api/outfits/${ownerOutfit}`).expect(200);

      // Membership untouched: the replacement did not half-apply.
      expect(after.body.outfit.items.map((i: { id: string }) => i.id).sort()).toEqual(
        [ownerTop, ownerShoes].sort(),
      );
    });

    it('de-duplicates a repeated id rather than failing on the unique constraint', async () => {
      const res = await owner
        .post('/api/outfits')
        .send({ name: 'Doubled', itemIds: [ownerTop, ownerTop] })
        .expect(201);

      expect(res.body.outfit.items).toHaveLength(1);
    });
  });

  describe('reading, updating and deleting an outfit', () => {
    it('hides another user’s outfit from the list', async () => {
      const res = await intruder.get('/api/outfits').expect(200);

      expect(res.body.outfits.map((o: { id: string }) => o.id)).not.toContain(ownerOutfit);
    });

    it('reports another user’s outfit as not found', async () => {
      await intruder.get(`/api/outfits/${ownerOutfit}`).expect(404);
    });

    it('refuses to update another user’s outfit', async () => {
      await intruder.patch(`/api/outfits/${ownerOutfit}`).send({ name: 'Renamed' }).expect(404);

      const after = await owner.get(`/api/outfits/${ownerOutfit}`).expect(200);
      expect(after.body.outfit.name).toBe('Weekend');
    });

    it('refuses to delete another user’s outfit', async () => {
      await intruder.delete(`/api/outfits/${ownerOutfit}`).expect(404);

      // Still there afterwards — the delete was refused, not merely unreported.
      await owner.get(`/api/outfits/${ownerOutfit}`).expect(200);
    });

    it('lets the owner do all three', async () => {
      const created = await owner
        .post('/api/outfits')
        .send({ name: 'Throwaway', itemIds: [ownerTop] })
        .expect(201);

      const id = created.body.outfit.id as string;

      const renamed = await owner
        .patch(`/api/outfits/${id}`)
        .send({ name: 'Kept' })
        .expect(200);
      expect(renamed.body.outfit.name).toBe('Kept');

      await owner.delete(`/api/outfits/${id}`).expect(204);
      await owner.get(`/api/outfits/${id}`).expect(404);
    });

    it('leaves the garments alone when an outfit is deleted', async () => {
      const created = await owner
        .post('/api/outfits')
        .send({ name: 'Temporary', itemIds: [ownerTop, ownerShoes] })
        .expect(201);

      await owner.delete(`/api/outfits/${created.body.outfit.id as string}`).expect(204);

      // Deleting an outfit is not a wardrobe operation.
      await owner.get(`/api/items/${ownerTop}`).expect(200);
      await owner.get(`/api/items/${ownerShoes}`).expect(200);
    });
  });

  describe('requires authentication at all', () => {
    it('rejects every outfit route without a session', async () => {
      const { app } = await import('./helpers.js');
      const request = (await import('supertest')).default;

      await request(app).get('/api/outfits').expect(401);
      await request(app).post('/api/outfits').send({ name: 'Anon' }).expect(401);
      await request(app).get(`/api/outfits/${ownerOutfit}`).expect(401);
      await request(app).patch(`/api/outfits/${ownerOutfit}`).send({ name: 'x' }).expect(401);
      await request(app).delete(`/api/outfits/${ownerOutfit}`).expect(401);
    });
  });
});
