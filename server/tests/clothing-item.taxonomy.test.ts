import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

/**
 * Guards the contract that `category` is derived from `type` and never taken
 * from the client. The database stores both as independent enum columns and
 * cannot enforce the dependency, so this suite is the only thing standing
 * between a refactor and a wardrobe full of mislabelled garments.
 */
describe('category derivation', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('taxonomy@khzenty.test');
    agent = await signIn('taxonomy@khzenty.test');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('derives TOP from HOODIE on create', async () => {
    const res = await agent.post('/api/items').send({ type: 'HOODIE', color: 'Grey' }).expect(201);

    expect(res.body.item.type).toBe('HOODIE');
    expect(res.body.item.category).toBe('TOP');
  });

  it('re-derives the category when the type changes', async () => {
    const created = await agent
      .post('/api/items')
      .send({ type: 'HOODIE', color: 'Grey' })
      .expect(201);

    const updated = await agent
      .patch(`/api/items/${created.body.item.id as string}`)
      .send({ type: 'BOOTS' })
      .expect(200);

    // Without re-derivation the row would read FOOTWEAR/TOP — the exact
    // inconsistency the database cannot prevent.
    expect(updated.body.item.type).toBe('BOOTS');
    expect(updated.body.item.category).toBe('FOOTWEAR');
  });

  it('maps the OTHER escape-hatch type to the OTHER category', async () => {
    // OTHER had no category until a migration added one; without it the
    // taxonomy map could not be total.
    const res = await agent.post('/api/items').send({ type: 'OTHER', color: 'Beige' }).expect(201);

    expect(res.body.item.category).toBe('OTHER');
  });

  it('ignores a category sent by the client', async () => {
    const res = await agent
      .post('/api/items')
      .send({ type: 'JEANS', category: 'FOOTWEAR', color: 'Indigo' })
      .expect(201);

    // JEANS is a BOTTOM. The client's FOOTWEAR must not survive.
    expect(res.body.item.category).toBe('BOTTOM');
  });

  it('ignores a category sent by the client on update too', async () => {
    const created = await agent
      .post('/api/items')
      .send({ type: 'JEANS', color: 'Indigo' })
      .expect(201);

    const updated = await agent
      .patch(`/api/items/${created.body.item.id as string}`)
      .send({ category: 'SWIMWEAR', color: 'Navy' })
      .expect(200);

    expect(updated.body.item.color).toBe('Navy');
    expect(updated.body.item.category).toBe('BOTTOM');
  });

  it('rejects a type outside the enum', async () => {
    await agent.post('/api/items').send({ type: 'BANANA', color: 'Yellow' }).expect(400);
  });

  it('exposes every category through the taxonomy endpoint', async () => {
    const res = await agent.get('/api/taxonomy').expect(200);

    expect(res.body.taxonomy).toHaveLength(11);
    const types = res.body.taxonomy.flatMap((g: { types: string[] }) => g.types);
    expect(types).toHaveLength(39);
  });
});
