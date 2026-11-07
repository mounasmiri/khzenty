import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

describe('wear log', () => {
  let owner: Awaited<ReturnType<typeof signIn>>;
  let intruder: Awaited<ReturnType<typeof signIn>>;
  let top: string;
  let shoes: string;
  let outfit: string;

  const status = async (id: string) =>
    (await prisma.clothingItem.findUniqueOrThrow({ where: { id } })).laundryStatus;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('wearer@khzenty.test');
    await createUser('snoop@khzenty.test');
    owner = await signIn('wearer@khzenty.test');
    intruder = await signIn('snoop@khzenty.test');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setup() {
    top = (await owner.post('/api/items').send({ type: 'HOODIE' }).expect(201)).body.item.id;
    shoes = (await owner.post('/api/items').send({ type: 'SNEAKERS' }).expect(201)).body.item.id;
    outfit = (
      await owner.post('/api/outfits').send({ name: 'Day', itemIds: [top, shoes] }).expect(201)
    ).body.outfit.id;
  }

  it('returns 404 for another users outfit and changes nothing', async () => {
    await setup();

    await intruder.post(`/api/outfits/${outfit}/wear`).expect(404);

    expect(await status(top)).toBe('CLEAN');
    expect(await prisma.wearLog.count()).toBe(0);
  });

  it('sends clean pieces to the laundry and records what it changed', async () => {
    await setup();
    // The shoes are already in the wash, so wearing must not claim them.
    await owner.patch(`/api/items/${shoes}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);

    const res = await owner.post(`/api/outfits/${outfit}/wear`).expect(201);

    expect(res.body.wearLog.changedItemIds).toEqual([top]);
    expect(await status(top)).toBe('IN_LAUNDRY');
    const moved = await prisma.clothingItem.findUniqueOrThrow({ where: { id: top } });
    expect(moved.laundryAt).not.toBeNull();
  });

  it('undo restores only what the entry changed, and only for its owner', async () => {
    await setup();
    await owner.patch(`/api/items/${shoes}/laundry`).send({ status: 'IN_LAUNDRY' }).expect(200);
    const id = (await owner.post(`/api/outfits/${outfit}/wear`).expect(201)).body.wearLog.id;

    await intruder.post(`/api/wear-log/${id}/undo`).expect(404);
    expect(await status(top)).toBe('IN_LAUNDRY');

    await owner.post(`/api/wear-log/${id}/undo`).expect(204);

    expect(await status(top)).toBe('CLEAN');
    expect(await status(shoes)).toBe('IN_LAUNDRY');
    expect(await prisma.wearLog.count({ where: { id } })).toBe(0);
  });
});
