import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { LAYOUT_VERSION, MAX_OUTFIT_ITEMS } from '../src/schemas/outfit.schema.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

describe('outfit CRUD', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let top: string;
  let bottom: string;
  let shoes: string;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('outfits@khzenty.test');
    agent = await signIn('outfits@khzenty.test');

    // Sequential rather than Promise.all: these share one session agent, and
    // `noUncheckedIndexedAccess` would make a destructured map `string |
    // undefined` anyway.
    const create = async (body: Record<string, string>): Promise<string> => {
      const res = await agent.post('/api/items').send(body).expect(201);

      return res.body.item.id as string;
    };

    top = await create({ type: 'HOODIE', color: 'Grey' });
    bottom = await create({ type: 'JEANS', color: 'Indigo' });
    shoes = await create({ type: 'SNEAKERS', color: 'White' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('occasions are optional', () => {
    it('saves an outfit with a name and nothing else', async () => {
      const res = await agent.post('/api/outfits').send({ name: 'Unnamed plan' }).expect(201);

      expect(res.body.outfit.name).toBe('Unnamed plan');
      expect(res.body.outfit.occasions).toEqual([]);
      expect(res.body.outfit.items).toEqual([]);
      expect(res.body.outfit.layout).toBeNull();
    });

    it('saves several occasions', async () => {
      const res = await agent
        .post('/api/outfits')
        .send({ name: 'Office', occasions: ['WORK', 'FORMAL'], itemIds: [top, bottom] })
        .expect(201);

      expect(res.body.outfit.occasions).toEqual(['WORK', 'FORMAL']);
    });

    it('adds occasions to an outfit saved without any', async () => {
      const created = await agent.post('/api/outfits').send({ name: 'Later' }).expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ occasions: ['CASUAL'] })
        .expect(200);

      expect(updated.body.outfit.occasions).toEqual(['CASUAL']);
    });

    it('clears occasions back to none', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Undecided', occasions: ['PARTY'] })
        .expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ occasions: [] })
        .expect(200);

      expect(updated.body.outfit.occasions).toEqual([]);
    });

    it('rejects an occasion outside the enum', async () => {
      await agent
        .post('/api/outfits')
        .send({ name: 'Bad', occasions: ['BRUNCH'] })
        .expect(400);
    });
  });

  describe('membership is replaced, not merged', () => {
    it('swaps the whole set on PATCH', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Swap', itemIds: [top, bottom] })
        .expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ itemIds: [shoes] })
        .expect(200);

      // The board saves what it shows, so this is a replace rather than an add.
      expect(updated.body.outfit.items.map((i: { id: string }) => i.id)).toEqual([shoes]);
    });

    it('empties an outfit with an empty array', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Emptied', itemIds: [top] })
        .expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ itemIds: [] })
        .expect(200);

      expect(updated.body.outfit.items).toEqual([]);
    });

    it('leaves membership alone when itemIds is absent', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Rename only', itemIds: [top, shoes] })
        .expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ name: 'Renamed' })
        .expect(200);

      // Absent means unchanged, which is what distinguishes it from [].
      expect(updated.body.outfit.items).toHaveLength(2);
      expect(updated.body.outfit.name).toBe('Renamed');
    });

    it('caps the number of garments', async () => {
      await agent
        .post('/api/outfits')
        .send({ name: 'Too many', itemIds: Array.from({ length: MAX_OUTFIT_ITEMS + 1 }, () => top) })
        .expect(400);
    });
  });

  describe('the layout field', () => {
    const placement = (itemId: string) => ({ itemId, x: 0.1, y: 0.2, width: 0.5, height: 0.4 });

    it('stores and returns a layout', async () => {
      const layout = { version: LAYOUT_VERSION, placements: [placement(top)] };

      const res = await agent
        .post('/api/outfits')
        .send({ name: 'Positioned', itemIds: [top], layout })
        .expect(201);

      expect(res.body.outfit.layout).toEqual(layout);
    });

    it('saves an outfit with no layout at all', async () => {
      const res = await agent
        .post('/api/outfits')
        .send({ name: 'Auto', itemIds: [top] })
        .expect(201);

      // Null, not JSON null or an empty object — the board falls back to the
      // auto-layout on exactly this value.
      expect(res.body.outfit.layout).toBeNull();
    });

    it('clears a layout back to null', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({
          name: 'Reset me',
          itemIds: [top],
          layout: { version: LAYOUT_VERSION, placements: [placement(top)] },
        })
        .expect(201);

      const updated = await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ layout: null })
        .expect(200);

      expect(updated.body.outfit.layout).toBeNull();
    });

    it('accepts a layout covering only some of the garments', async () => {
      // The client leaves a garment out of the layout when its type has no
      // board zone — a type the server knows and that client build does not.
      // The outfit still contains it, so a subset has to be allowed.
      const layout = { version: LAYOUT_VERSION, placements: [placement(top)] };

      const res = await agent
        .post('/api/outfits')
        .send({ name: 'Subset', itemIds: [top, bottom, shoes], layout })
        .expect(201);

      expect(res.body.outfit.items).toHaveLength(3);
      expect(res.body.outfit.layout.placements).toHaveLength(1);
    });

    it('rejects a layout positioning a garment not in the outfit', async () => {
      // Otherwise the layout column is a second, unchecked place to store ids.
      await agent
        .post('/api/outfits')
        .send({
          name: 'Stray',
          itemIds: [top],
          layout: { version: LAYOUT_VERSION, placements: [placement(shoes)] },
        })
        .expect(400);
    });

    it('rejects a layout that goes stale when membership shrinks', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Shrinking', itemIds: [top, shoes] })
        .expect(201);

      await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({
          itemIds: [top],
          layout: { version: LAYOUT_VERSION, placements: [placement(shoes)] },
        })
        .expect(400);
    });

    it('validates a new layout against existing membership', async () => {
      const created = await agent
        .post('/api/outfits')
        .send({ name: 'Existing members', itemIds: [top] })
        .expect(201);

      // itemIds absent, so the check has to read the current set.
      await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ layout: { version: LAYOUT_VERSION, placements: [placement(shoes)] } })
        .expect(400);

      await agent
        .patch(`/api/outfits/${created.body.outfit.id as string}`)
        .send({ layout: { version: LAYOUT_VERSION, placements: [placement(top)] } })
        .expect(200);
    });

    it('rejects an unknown layout version', async () => {
      await agent
        .post('/api/outfits')
        .send({ name: 'Future', itemIds: [top], layout: { version: 99, placements: [] } })
        .expect(400);
    });

    it('rejects unexpected keys instead of persisting dead weight', async () => {
      await agent
        .post('/api/outfits')
        .send({
          name: 'Extra',
          itemIds: [top],
          layout: { version: LAYOUT_VERSION, placements: [], rotation: 45 },
        })
        .expect(400);
    });

    it('rejects nonsense geometry', async () => {
      for (const bad of [
        { itemId: top, x: 0, y: 0, width: 0, height: 0.5 },
        { itemId: top, x: 0, y: 0, width: 1.5, height: 0.5 },
        { itemId: top, x: 99, y: 0, width: 0.5, height: 0.5 },
        { itemId: top, x: 0, y: 0, width: -0.5, height: 0.5 },
      ]) {
        await agent
          .post('/api/outfits')
          .send({ name: 'Bad geometry', itemIds: [top], layout: { version: LAYOUT_VERSION, placements: [bad] } })
          .expect(400);
      }
    });

    it('rejects free-form JSON in the layout column', async () => {
      await agent
        .post('/api/outfits')
        .send({ name: 'Blob', itemIds: [top], layout: { anything: 'goes' } })
        .expect(400);
    });
  });

  describe('validation', () => {
    it('requires a name', async () => {
      await agent.post('/api/outfits').send({ itemIds: [top] }).expect(400);
      await agent.post('/api/outfits').send({ name: '   ' }).expect(400);
    });

    it('rejects an empty PATCH', async () => {
      const created = await agent.post('/api/outfits').send({ name: 'Untouched' }).expect(201);

      await agent.patch(`/api/outfits/${created.body.outfit.id as string}`).send({}).expect(400);
    });

    it('reports an unknown outfit id as not found', async () => {
      await agent.get('/api/outfits/cl00000000000000000000000').expect(404);
      await agent.patch('/api/outfits/cl00000000000000000000000').send({ name: 'x' }).expect(404);
      await agent.delete('/api/outfits/cl00000000000000000000000').expect(404);
    });
  });

  describe('the list', () => {
    it('returns newest first and carries each outfit’s garments', async () => {
      await resetDatabase();
      await createUser('listing@khzenty.test');
      const listing = await signIn('listing@khzenty.test');

      const item = await listing.post('/api/items').send({ type: 'DRESS' }).expect(201);
      const itemId = item.body.item.id as string;

      await listing.post('/api/outfits').send({ name: 'First' }).expect(201);
      await listing.post('/api/outfits').send({ name: 'Second', itemIds: [itemId] }).expect(201);

      const res = await listing.get('/api/outfits').expect(200);

      expect(res.body.outfits.map((o: { name: string }) => o.name)).toEqual(['Second', 'First']);
      expect(res.body.outfits[0].items).toHaveLength(1);
      expect(res.body.outfits[0].items[0].imageUrl).toBeNull();
    });

    it('never exposes a Cloudinary asset handle through an outfit', async () => {
      await resetDatabase();
      await createUser('leak@khzenty.test');
      const leak = await signIn('leak@khzenty.test');

      const item = await leak.post('/api/items').send({ type: 'BOOTS' }).expect(201);
      await leak
        .post('/api/outfits')
        .send({ name: 'Check', itemIds: [item.body.item.id as string] })
        .expect(201);

      const res = await leak.get('/api/outfits').expect(200);

      // The wardrobe endpoint withholds `imagePublicId`; a second endpoint
      // reaching the same rows must not undo that.
      expect(res.body.outfits[0].items[0]).not.toHaveProperty('imagePublicId');
    });
  });
});
