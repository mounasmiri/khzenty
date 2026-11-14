import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { prisma } from '../config/prisma.js';

/**
 * Deletes a Cloudinary asset on a best-effort basis.
 *
 * Removing a stray asset is cleanup, not part of any request's contract: if
 * Cloudinary is down, misconfigured, or the asset is already gone, the caller's
 * operation must still succeed. Failures are logged and swallowed.
 *
 * Shared by the upload flow (replacing or rejecting an image) and by item
 * deletion, so both behave identically.
 */
export async function destroyAssetQuietly(
  publicId: string,
  /**
   * Required, so no call site can forget to say who is asking. A demo copy
   * borrows the template's images; if it could destroy one, a single visitor
   * deleting a garment would blank that photo for everyone and for the seed.
   */
  actor: { isDemo: boolean },
): Promise<void> {
  if (actor.isDemo) {
    return;
  }

  if (!isCloudinaryConfigured) {
    // Nothing to talk to. Not an error: the asset cannot exist either.
    return;
  }

  try {
    // Second line of defence, independent of who is asking: callers update or
    // delete their own row before calling this, so any row still naming the
    // asset belongs to someone else and still needs it.
    if ((await prisma.clothingItem.count({ where: { imagePublicId: publicId } })) > 0) {
      return;
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`[khzenty] Could not delete Cloudinary asset ${publicId}:`, error);
  }
}
