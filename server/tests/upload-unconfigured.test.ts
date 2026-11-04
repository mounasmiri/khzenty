import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { createUser, resetDatabase, signIn } from './helpers.js';

/**
 * Forces the credentials-absent path, which is the state of any clone without
 * a Cloudinary account — including CI. Mocked rather than inferred from the
 * environment, so the result does not depend on whether the developer happens
 * to have credentials in .env.
 */
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: false,
  ALLOWED_FORMATS: ['jpg'],
  userFolder: (userId: string) => `khzenty/users/${userId}`,
  cloudinary: {
    api: {
      resource: () => {
        throw new Error('Cloudinary must not be called while unconfigured');
      },
    },
    uploader: { destroy: () => undefined },
    utils: {
      api_sign_request: () => {
        throw new Error('A signature must never be issued without a secret');
      },
    },
  },
}));

describe('image upload with no Cloudinary credentials', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let itemId: string;

  beforeAll(async () => {
    await resetDatabase();
    await createUser('noconfig@khzenty.test');
    agent = await signIn('noconfig@khzenty.test');

    const created = await agent
      .post('/api/items')
      .send({ type: 'SHIRT', color: 'White' })
      .expect(201);

    itemId = created.body.item.id as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports 503 for a signature request rather than signing with nothing', async () => {
    const res = await agent.post('/api/uploads/signature').expect(503);
    expect(res.body.error.message).toMatch(/not configured/i);
  });

  it('reports 503 when confirming an image', async () => {
    await agent
      .put(`/api/items/${itemId}/image`)
      .send({ publicId: 'khzenty/users/someone/abc' })
      .expect(503);
  });

  it('leaves the rest of the API working', async () => {
    // The whole point of making the credentials optional: the wardrobe still
    // functions, images are simply unavailable.
    const res = await agent.get('/api/items').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].imageUrl).toBeNull();
  });
});
