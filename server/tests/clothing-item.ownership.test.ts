import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { app, createUser, resetDatabase, signIn } from './helpers.js';

/**
 * Guards the rule that every item query is scoped by `userId`.
 *
 * A missed scope is the highest-consequence bug this API can have, and it is
 * invisible in single-user manual testing — hence a second account here.
 *
 * The probes run in declaration order (vitest is sequential within a file),
 * because the "survived" and "unchanged" assertions read the state left by the
 * intrusion attempts above them.
 */
describe('clothing item ownership', () => {
  let ownerAgent: Awaited<ReturnType<typeof signIn>>;
  let intruderAgent: Awaited<ReturnType<typeof signIn>>;
  let itemId: string;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('owner@khzenty.test');
    await createUser('intruder@khzenty.test');

    ownerAgent = await signIn('owner@khzenty.test');
    intruderAgent = await signIn('intruder@khzenty.test');

    const created = await ownerAgent
      .post('/api/items')
      .send({ type: 'SHIRT', color: 'White', name: 'Owner Shirt' })
      .expect(201);

    itemId = created.body.item.id as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. lets the owner read their own item', async () => {
    const res = await ownerAgent.get(`/api/items/${itemId}`).expect(200);
    expect(res.body.item.name).toBe('Owner Shirt');
  });

  it('2. hides it from another user behind a 404, not a 403', async () => {
    // 404 rather than 403: a 403 would confirm the id exists.
    const res = await intruderAgent.get(`/api/items/${itemId}`).expect(404);
    expect(res.body.error.message).toBe('Clothing item not found');
  });

  it('3. refuses another user updating it', async () => {
    await intruderAgent.patch(`/api/items/${itemId}`).send({ color: 'Hacked' }).expect(404);
  });

  it('4. refuses another user deleting it', async () => {
    await intruderAgent.delete(`/api/items/${itemId}`).expect(404);
  });

  it('5. leaves the item intact after those attempts', async () => {
    await ownerAgent.get(`/api/items/${itemId}`).expect(200);
  });

  it('6. did not apply the rejected colour change', async () => {
    const res = await ownerAgent.get(`/api/items/${itemId}`).expect(200);
    expect(res.body.item.color).toBe('White');
  });

  it('7. returns the same 404 for an id that does not exist', async () => {
    // Identical to probe 2, so a real id and a fake one are indistinguishable.
    const res = await ownerAgent.get('/api/items/does-not-exist').expect(404);
    expect(res.body.error.message).toBe('Clothing item not found');
  });

  it('requires authentication at all', async () => {
    await request(app).get('/api/items').expect(401);
  });

  it('scopes the list so each user sees only their own items', async () => {
    const owner = await ownerAgent.get('/api/items').expect(200);
    const intruder = await intruderAgent.get('/api/items').expect(200);

    expect(owner.body.items).toHaveLength(1);
    expect(intruder.body.items).toHaveLength(0);
  });
});
