import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

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
export async function destroyAssetQuietly(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured) {
    // Nothing to talk to. Not an error: the asset cannot exist either.
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`[khzenty] Could not delete Cloudinary asset ${publicId}:`, error);
  }
}
