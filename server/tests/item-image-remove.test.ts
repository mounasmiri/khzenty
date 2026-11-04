import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

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

describe('removing an item photo', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let intruderAgent: Awaited<ReturnType<typeof signIn>>;
  let userId: string;

  beforeAll(async () => {
    await resetDatabase();
    const owner = await createUser('remover@khzenty.test');
    await createUser('intruder@khzenty.test');
    userId = owner.id;

    agent = await signIn('remover@khzenty.test');
    intruderAgent = await signIn('intruder@khzenty.test');
  });

  beforeEach(() => {
    destroyMock.mockReset();
    destroyMock.mockResolvedValue({ result: 'ok' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Creates an item, optionally with an image already attached. */
  async function createItem(publicId?: string): Promise<string> {
    const created = await agent
      .post('/api/items')
      .send({ type: 'SNEAKERS', color: 'White' })
      .expect(201);

    const id = created.body.item.id as string;

    if (publicId) {
      await prisma.clothingItem.update({
        where: { id },
        data: {
          imagePublicId: publicId,
          imageUrl: `https://res.cloudinary.com/x/${publicId}.jpg`,
        },
      });
    }

    return id;
  }

  function columns(id: string) {
    return prisma.clothingItem.findUniqueOrThrow({
      where: { id },
      select: { imageUrl: true, imagePublicId: true },
    });
  }

  it('clears both columns and destroys the asset', async () => {
    const publicId = `khzenty/users/${userId}/shoe`;
    const id = await createItem(publicId);

    const res = await agent.delete(`/api/items/${id}/image`).expect(200);
    expect(res.body.item.imageUrl).toBeNull();

    expect(destroyMock).toHaveBeenCalledWith(publicId, { resource_type: 'image' });
    await expect(columns(id)).resolves.toEqual({ imageUrl: null, imagePublicId: null });
  });

  it("returns 404 for another user's item and changes nothing", async () => {
    const publicId = `khzenty/users/${userId}/private`;
    const id = await createItem(publicId);

    await intruderAgent.delete(`/api/items/${id}/image`).expect(404);

    expect(destroyMock).not.toHaveBeenCalled();
    await expect(columns(id)).resolves.toEqual({
      imageUrl: `https://res.cloudinary.com/x/${publicId}.jpg`,
      imagePublicId: publicId,
    });
  });

  it('is harmless when removing twice', async () => {
    const publicId = `khzenty/users/${userId}/twice`;
    const id = await createItem(publicId);

    await agent.delete(`/api/items/${id}/image`).expect(200);
    expect(destroyMock).toHaveBeenCalledTimes(1);

    destroyMock.mockReset();

    // The end state the caller wants is already true, so this succeeds and
    // has nothing left to destroy.
    await agent.delete(`/api/items/${id}/image`).expect(200);
    expect(destroyMock).not.toHaveBeenCalled();
    await expect(columns(id)).resolves.toEqual({ imageUrl: null, imagePublicId: null });
  });

  it('is harmless on an item that never had a photo', async () => {
    const id = await createItem();

    await agent.delete(`/api/items/${id}/image`).expect(200);
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it('still clears the columns when Cloudinary fails', async () => {
    // The point of ordering the destroy after the update: an outage must not
    // leave the photo stuck on the garment.
    destroyMock.mockRejectedValue(new Error('Cloudinary is down'));

    const publicId = `khzenty/users/${userId}/doomed`;
    const id = await createItem(publicId);

    await agent.delete(`/api/items/${id}/image`).expect(200);

    expect(destroyMock).toHaveBeenCalledWith(publicId, { resource_type: 'image' });
    await expect(columns(id)).resolves.toEqual({ imageUrl: null, imagePublicId: null });
  });

  it('requires authentication', async () => {
    const id = await createItem();
    const { default: request } = await import('supertest');
    const { app } = await import('./helpers.js');

    await request(app).delete(`/api/items/${id}/image`).expect(401);
  });
});
