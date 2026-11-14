import { readFile } from 'node:fs/promises';

import type { KeptPhoto } from './demo-template.js';

/**
 * Photo links for the demo template, as a file.
 *
 * The photos live in Cloudinary and are recorded per garment in the database.
 * A fresh production database has none, so the first production seed reads them
 * from a file exported from the development database
 * (`npm run db:export-demo-photos`). The file holds only Cloudinary URLs and
 * public ids — links, not files, and no credentials.
 */
export const DEFAULT_PHOTOS_FILE = 'prisma/demo-photos.json';

/** Garment id -> its photo link. */
export type PhotoFile = Record<string, { imageUrl: string; imagePublicId: string }>;

/**
 * Reads and checks a photos file. Anything that is not a Cloudinary `https` URL
 * with a public id is rejected, so a typo or a pasted file cannot point the
 * demo garments at somewhere else.
 */
export async function readPhotosFile(path: string): Promise<Map<string, KeptPhoto>> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the photos file "${path}": ${(error as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`The photos file "${path}" must be a JSON object of garment id -> photo.`);
  }

  const photos = new Map<string, KeptPhoto>();

  for (const [id, value] of Object.entries(parsed)) {
    const { imageUrl, imagePublicId } = (value ?? {}) as Record<string, unknown>;

    if (
      typeof imageUrl !== 'string' ||
      typeof imagePublicId !== 'string' ||
      !imageUrl.startsWith('https://res.cloudinary.com/') ||
      imagePublicId.length === 0
    ) {
      throw new Error(`The photos file has an invalid entry for "${id}".`);
    }

    photos.set(id, { imageUrl, imagePublicId });
  }

  return photos;
}
