import { v2 as cloudinary } from 'cloudinary';

import { env } from './env.js';

/**
 * Whether image upload is available. The three credentials are optional, so
 * the server boots without them and the upload endpoints report 503 instead.
 */
export const isCloudinaryConfigured =
  env.CLOUDINARY_CLOUD_NAME !== undefined &&
  env.CLOUDINARY_API_KEY !== undefined &&
  env.CLOUDINARY_API_SECRET !== undefined;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Formats the client is allowed to upload, normalised from the env string. */
export const ALLOWED_FORMATS: string[] = env.CLOUDINARY_ALLOWED_FORMATS.split(',')
  .map((format) => format.trim().toLowerCase())
  .filter((format) => format.length > 0);

/**
 * Every user's uploads are confined to their own folder. The confirm step
 * checks the returned `public_id` sits inside this prefix, which is what stops
 * one user claiming another's asset.
 */
export function userFolder(userId: string): string {
  return `${env.CLOUDINARY_FOLDER}/users/${userId}`;
}

export { cloudinary };
