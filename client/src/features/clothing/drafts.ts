import { ApiError } from '@/lib/api';
import { clothingApi } from './api';
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
export type DraftStage = 'compressing' | UploadStage;

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
): Promise<DraftResult> {
  onStage?.('compressing');
  const compressed = await compressImage(file);

  // No colour: the quick-sort screen collects it, and null reads as unset.
  const item = await clothingApi.create({ type: DRAFT_TYPE });

  try {
    await uploadItemImage(item.id, compressed, (stage) => onStage?.(stage));
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
): Promise<string | undefined> {
  try {
    onStage?.('compressing');
    const compressed = await compressImage(file);
    await uploadItemImage(itemId, compressed, (stage) => onStage?.(stage));
    return undefined;
  } catch (error) {
    return messageFor(error);
  }
}
