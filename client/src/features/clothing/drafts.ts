import { ApiError } from '@/lib/api';
import { clothingApi } from './api';
import { removeGarmentBackground } from './background-removal';
import { compressImage } from './compress-image';
import type { ClothingItem } from './types';
import { UploadError, uploadItemImage } from './upload';
import type { UploadStage } from './upload';

/**
 * A photo-first garment starts as a draft: the escape-hatch type and no colour
 * at all, both meant to be filled in on the quick-sort screen.
 *
 * The colour is genuinely absent rather than a sentinel string — the column is
 * nullable, so there is no need to write a non-colour into it.
 */
export const DRAFT_TYPE = 'OTHER';

/** Stages worth reporting, including the client-side work before upload. */
export type DraftStage = 'removing-background' | 'compressing' | UploadStage;

export interface DraftResult {
  item: ClothingItem;
  /**
   * Set when the garment was created but its photo was not attached. The item
   * still exists, so this is a partial success and the caller should offer a
   * retry rather than report a failure.
   */
  imageError?: string;
}

function messageFor(error: unknown): string {
  if (error instanceof UploadError || error instanceof ApiError) {
    return error.message;
  }

  return 'The photo could not be uploaded.';
}

/**
 * Creates a draft garment from a single photo.
 *
 * The garment is created first because the confirm endpoint addresses it by id.
 * If the upload then fails the item is kept and the error returned alongside
 * it — the same "saved, but the photo failed" contract the full form uses.
 */
export async function createDraftFromPhoto(
  file: File,
  onStage?: (stage: DraftStage) => void,
  options: { removeBackground?: boolean } = {},
): Promise<DraftResult> {
  const prepared = await preparePhoto(file, options.removeBackground ?? false, onStage);

  // No colour: the quick-sort screen collects it, and null reads as unset.
  const item = await clothingApi.create({ type: DRAFT_TYPE });

  try {
    await uploadItemImage(item.id, prepared, (stage) => onStage?.(stage));
  } catch (error) {
    return { item, imageError: messageFor(error) };
  }

  return { item };
}

/**
 * Attaches a photo to a garment that already exists — the retry path, used when
 * the item was created but its upload failed.
 */
export async function retryDraftPhoto(
  itemId: string,
  file: File,
  onStage?: (stage: DraftStage) => void,
  options: { removeBackground?: boolean } = {},
): Promise<string | undefined> {
  try {
    const prepared = await preparePhoto(file, options.removeBackground ?? false, onStage);
    await uploadItemImage(itemId, prepared, (stage) => onStage?.(stage));
    return undefined;
  } catch (error) {
    return messageFor(error);
  }
}

/**
 * Produces the file to upload.
 *
 * With background removal on, the cutout is already a square WebP capped at
 * 1200px and must **not** then go through `compressImage` — that re-encodes as
 * JPEG, which has no alpha, and would flatten the garment onto black, baking in
 * exactly the background the cutout just removed.
 *
 * A removal failure falls back to the compressed original rather than
 * abandoning the photo: the garment still gets catalogued, just with its
 * background.
 */
async function preparePhoto(
  file: File,
  removeBackgroundFirst: boolean,
  onStage?: (stage: DraftStage) => void,
): Promise<File> {
  if (removeBackgroundFirst) {
    onStage?.('removing-background');

    try {
      // Runs on the app-wide sequential queue, so a batch processes one photo
      // at a time however many are in flight.
      const { file: cutout } = await removeGarmentBackground(file);
      return cutout;
    } catch {
      // Fall through to the ordinary path with the original photo.
    }
  }

  onStage?.('compressing');
  return compressImage(file);
}
