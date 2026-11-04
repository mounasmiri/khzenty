import { prisma } from '../config/prisma.js';
import {
  ALLOWED_FORMATS,
  cloudinary,
  isCloudinaryConfigured,
  userFolder,
} from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string[];
  signature: string;
  /** Advisory: the client should reject oversized files before uploading. */
  maxBytes: number;
  uploadUrl: string;
}

function assertConfigured(): void {
  if (!isCloudinaryConfigured) {
    // Exposed deliberately: a 5xx is normally opaque, but the client needs to
    // know the feature is switched off rather than broken.
    throw new HttpError(503, 'Image upload is not configured on this server', {
      expose: true,
    });
  }
}

/**
 * Issues a short-lived signature for a direct browser-to-Cloudinary upload, so
 * image bytes never pass through this server.
 *
 * `folder` and `allowed_formats` are part of the signed payload: changing
 * either client-side invalidates the signature, which is what confines a user
 * to their own folder and to image formats we accept.
 *
 * Size cannot be signed — the upload API has no max-bytes parameter — so it is
 * enforced after the fact in `confirmItemImage`, which reads the asset's real
 * byte count and deletes anything over the limit.
 */
export function createUploadSignature(userId: string): UploadSignature {
  assertConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = userFolder(userId);
  const allowedFormats = ALLOWED_FORMATS.join(',');

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, allowed_formats: allowedFormats },
    // Non-null: assertConfigured above guarantees all three are present.
    env.CLOUDINARY_API_SECRET as string,
  );

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: env.CLOUDINARY_API_KEY as string,
    timestamp,
    folder,
    allowedFormats: ALLOWED_FORMATS,
    signature,
    maxBytes: env.CLOUDINARY_MAX_BYTES,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME as string}/image/upload`,
  };
}

/**
 * Records an uploaded image against an item after verifying it with
 * Cloudinary. Nothing the client sends is trusted beyond the identifier.
 */
export async function confirmItemImage(userId: string, itemId: string, publicId: string) {
  assertConfigured();

  // Ownership of the item first: no point describing an asset for an item the
  // caller cannot see.
  const item = await prisma.clothingItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true, imagePublicId: true },
  });

  if (!item) {
    throw new HttpError(404, 'Clothing item not found');
  }

  const prefix = `${userFolder(userId)}/`;

  // Checked before calling Cloudinary, so another user's identifier is refused
  // without even being looked up.
  if (!publicId.startsWith(prefix)) {
    throw new HttpError(400, 'That image does not belong to your account');
  }

  let resource: { public_id: string; secure_url: string; format: string; bytes: number };

  try {
    resource = (await cloudinary.api.resource(publicId, {
      resource_type: 'image',
    })) as typeof resource;
  } catch {
    throw new HttpError(404, 'That image was not found on Cloudinary');
  }

  const format = resource.format?.toLowerCase() ?? '';

  // Re-checked here rather than trusted from the signature: this is the only
  // point where the asset's real format and size are known.
  if (!ALLOWED_FORMATS.includes(format)) {
    await destroyQuietly(publicId);
    throw new HttpError(400, `Unsupported image format: ${format || 'unknown'}`);
  }

  if (resource.bytes > env.CLOUDINARY_MAX_BYTES) {
    await destroyQuietly(publicId);
    throw new HttpError(400, `Image exceeds the ${env.CLOUDINARY_MAX_BYTES} byte limit`);
  }

  const updated = await prisma.clothingItem.update({
    where: { id: item.id },
    data: { imageUrl: resource.secure_url, imagePublicId: resource.public_id },
    select: { id: true, imageUrl: true },
  });

  // Replacing an image leaves the previous asset orphaned, so remove it.
  if (item.imagePublicId && item.imagePublicId !== resource.public_id) {
    await destroyQuietly(item.imagePublicId);
  }

  return updated;
}

/**
 * Deleting a stray asset is cleanup, not part of the request's contract — a
 * failure here must not turn a successful upload into an error.
 */
async function destroyQuietly(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`[khzenty] Could not delete Cloudinary asset ${publicId}:`, error);
  }
}
