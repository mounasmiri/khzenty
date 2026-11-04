import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { app, createUser, resetDatabase, signIn } from './helpers.js';

/**
 * The Cloudinary module is mocked rather than reached over the network, for
 * three reasons: the suite must not depend on whether the developer happens to
 * have credentials in .env, it must not spend upload quota, and it must pass in
 * CI where no account is configured.
 */
const { resourceMock, destroyMock } = vi.hoisted(() => ({
  resourceMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: true,
  ALLOWED_FORMATS: ['jpg', 'png', 'webp'],
  userFolder: (userId: string) => `khzenty/users/${userId}`,
  cloudinary: {
    api: { resource: resourceMock },
    uploader: { destroy: destroyMock },
    utils: { api_sign_request: () => 'fake-signature' },
  },
}));

describe('signed Cloudinary upload', () => {
  let agent: Awaited<ReturnType<typeof signIn>>;
  let otherAgent: Awaited<ReturnType<typeof signIn>>;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    await resetDatabase();
    const user = await createUser('upload@khzenty.test');
    await createUser('other@khzenty.test');
    userId = user.id;

    agent = await signIn('upload@khzenty.test');
    otherAgent = await signIn('other@khzenty.test');

    const created = await agent
      .post('/api/items')
      .send({ type: 'SHIRT', color: 'White' })
      .expect(201);

    itemId = created.body.item.id as string;
  });

  beforeEach(() => {
    resourceMock.mockReset();
    destroyMock.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('signature', () => {
    it('scopes the folder to the calling user', async () => {
      const res = await agent.post('/api/uploads/signature').expect(200);

      // The folder is derived server-side from the session, never from input.
      expect(res.body.upload.folder).toBe(`khzenty/users/${userId}`);
      expect(res.body.upload.signature).toBe('fake-signature');
      expect(res.body.upload.allowedFormats).toEqual(['jpg', 'png', 'webp']);
    });

    it('never returns the API secret', async () => {
      const res = await agent.post('/api/uploads/signature').expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/secret/i);
    });

    it('requires authentication', async () => {
      await request(app).post('/api/uploads/signature').expect(401);
    });
  });

  describe('confirming an upload', () => {
    it('refuses a publicId outside the caller folder without calling Cloudinary', async () => {
      // The security-critical case: one user claiming another's asset.
      await agent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: 'khzenty/users/somebody-else/photo' })
        .expect(400);

      expect(resourceMock).not.toHaveBeenCalled();
    });

    it("refuses to touch another user's item", async () => {
      await otherAgent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: 'khzenty/users/whoever/photo' })
        .expect(404);
    });

    it('rejects and deletes a disallowed format', async () => {
      resourceMock.mockResolvedValue({
        public_id: `khzenty/users/${userId}/sketch`,
        secure_url: 'https://res.cloudinary.com/x/sketch.svg',
        format: 'svg',
        bytes: 1000,
      });

      await agent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: `khzenty/users/${userId}/sketch` })
        .expect(400);

      // The rejected asset must not be left behind on Cloudinary.
      expect(destroyMock).toHaveBeenCalledWith(`khzenty/users/${userId}/sketch`, {
        resource_type: 'image',
      });
    });

    it('rejects and deletes an oversized image', async () => {
      resourceMock.mockResolvedValue({
        public_id: `khzenty/users/${userId}/huge`,
        secure_url: 'https://res.cloudinary.com/x/huge.jpg',
        format: 'jpg',
        bytes: 999_999_999,
      });

      await agent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: `khzenty/users/${userId}/huge` })
        .expect(400);

      expect(destroyMock).toHaveBeenCalled();
    });

    it('stores the URL and publicId that Cloudinary reports', async () => {
      resourceMock.mockResolvedValue({
        public_id: `khzenty/users/${userId}/shirt`,
        secure_url: 'https://res.cloudinary.com/x/shirt.jpg',
        format: 'jpg',
        bytes: 2048,
      });

      const res = await agent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: `khzenty/users/${userId}/shirt` })
        .expect(200);

      expect(res.body.item.imageUrl).toBe('https://res.cloudinary.com/x/shirt.jpg');

      const stored = await prisma.clothingItem.findUniqueOrThrow({
        where: { id: itemId },
        select: { imageUrl: true, imagePublicId: true },
      });
      expect(stored.imagePublicId).toBe(`khzenty/users/${userId}/shirt`);
    });

    it('deletes the previous asset when an image is replaced', async () => {
      resourceMock.mockResolvedValue({
        public_id: `khzenty/users/${userId}/replacement`,
        secure_url: 'https://res.cloudinary.com/x/replacement.png',
        format: 'png',
        bytes: 4096,
      });

      await agent
        .put(`/api/items/${itemId}/image`)
        .send({ publicId: `khzenty/users/${userId}/replacement` })
        .expect(200);

      // The old shirt.jpg from the previous test would otherwise be orphaned.
      expect(destroyMock).toHaveBeenCalledWith(`khzenty/users/${userId}/shirt`, {
        resource_type: 'image',
      });
    });

    it('validates the body', async () => {
      await agent.put(`/api/items/${itemId}/image`).send({}).expect(400);
      expect(resourceMock).not.toHaveBeenCalled();
    });
  });
});
