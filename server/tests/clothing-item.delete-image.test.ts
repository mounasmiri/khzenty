import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

/**
 * Cloudinary is mocked, so these run with no credentials and spend no quota.
 */
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

describe('deleting an item removes its Cloudinary asset', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let intruderAgent: Awaited<ReturnType<typeof signIn>>;
  let userId: string;

  beforeAll(async () => {
    await resetDatabase();
    const user = await createUser('deleter@khzenty.test');
    await createUser('intruder@khzenty.test');
    userId = user.id;

    agent = await signIn('deleter@khzenty.test');
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
      .send({ type: 'SHIRT', color: 'White' })
      .expect(201);

    const id = created.body.item.id as string;

    if (publicId) {
      // Set directly rather than through the confirm endpoint: this suite is
      // about deletion, not about the upload flow.
      await prisma.clothingItem.update({
        where: { id },
        data: { imagePublicId: publicId, imageUrl: `https://res.cloudinary.com/x/${publicId}.jpg` },
      });
    }

    return id;
  }

  it('destroys the asset recorded on the item', async () => {
    const publicId = `khzenty/users/${userId}/shirt`;
    const id = await createItem(publicId);

    await agent.delete(`/api/items/${id}`).expect(204);

    expect(destroyMock).toHaveBeenCalledWith(publicId, { resource_type: 'image' });
  });

  it('does not call Cloudinary for an item with no image', async () => {
    const id = await createItem();

    await agent.delete(`/api/items/${id}`).expect(204);

    expect(destroyMock).not.toHaveBeenCalled();
  });

  it('still deletes the item when Cloudinary fails', async () => {
    // The whole point: an outage must not leave the user unable to remove a
    // garment. Orphaning the image is the lesser problem.
    destroyMock.mockRejectedValue(new Error('Cloudinary is down'));

    const publicId = `khzenty/users/${userId}/doomed`;
    const id = await createItem(publicId);

    await agent.delete(`/api/items/${id}`).expect(204);

    expect(destroyMock).toHaveBeenCalledWith(publicId, { resource_type: 'image' });
    await expect(
      prisma.clothingItem.findUnique({ where: { id }, select: { id: true } }),
    ).resolves.toBeNull();
  });

  it('is still gone from the API after a Cloudinary failure', async () => {
    destroyMock.mockRejectedValue(new Error('Cloudinary is down'));

    const id = await createItem(`khzenty/users/${userId}/gone`);
    await agent.delete(`/api/items/${id}`).expect(204);
    await agent.get(`/api/items/${id}`).expect(404);
  });

  it("destroys nothing when another user attempts the delete", async () => {
    const publicId = `khzenty/users/${userId}/safe`;
    const id = await createItem(publicId);

    await intruderAgent.delete(`/api/items/${id}`).expect(404);

    // A rejected delete must not touch the owner's asset.
    expect(destroyMock).not.toHaveBeenCalled();
    await agent.get(`/api/items/${id}`).expect(200);
  });
});
