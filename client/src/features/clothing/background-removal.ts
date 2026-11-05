import { compressImage } from './compress-image';
import { BlankCutoutError, finishCutout } from './process-cutout';
import type { CutoutResult } from './process-cutout';
import { createSequentialQueue } from './sequential-queue';

/**
 * The small quantised model, ~40 MB rather than ~80 MB.
 *
 * Halving the first-use download matters most on the mobile capture path this
 * feature exists for. Its occasional edge artifacts are acceptable because the
 * cutout is always optional and always previewed before being accepted.
 */
export const BACKGROUND_REMOVAL_MODEL = 'isnet_quint8' as const;

export interface RemovalProgress {
  /** Which asset is downloading, e.g. the model or the WASM runtime. */
  key: string;
  current: number;
  total: number;
}

/** Carries a message safe to show the user. */
export class BackgroundRemovalError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackgroundRemovalError';
  }
}

/**
 * One queue for the whole app, so only one run happens at a time no matter how
 * many components ask. Bulk add relies on this for its sequential processing
 * rather than implementing its own ordering.
 */
const queue = createSequentialQueue();

export function backgroundRemovalPending(): number {
  return queue.pending;
}

/**
 * Produces a cutout of the garment in a photo: transparent background, trimmed,
 * centred on a square, encoded with alpha.
 *
 * Model and WASM assets are fetched from IMG.LY's CDN on first use and cached
 * by the browser afterwards, so the first run is much slower than later ones.
 *
 * The photo is **compressed before** the model sees it. The model downscales
 * internally regardless, so handing it an 8 MP camera file only costs time, and
 * working at 1200px keeps the pixel read inside `finishCutout` a few megabytes
 * instead of tens.
 *
 * Every failure surfaces as `BackgroundRemovalError`, because the caller's
 * response is always the same: keep the original photo.
 */
export async function removeGarmentBackground(
  source: File,
  onProgress?: (progress: RemovalProgress) => void,
): Promise<CutoutResult> {
  return queue.run(async () => {
    let compressed: File;

    try {
      compressed = await compressImage(source);
    } catch {
      // compressImage already falls back to the original internally; this only
      // guards against it throwing outright.
      compressed = source;
    }

    let cutout: Blob;

    try {
      // Imported here, not at module scope. A static import pulled
      // @imgly/background-removal and the ONNX Runtime into the main bundle,
      // so every visitor paid for a feature most never use. Loading it on
      // first use keeps the initial bundle unchanged.
      const { removeBackground } = await import('@imgly/background-removal');

      cutout = await removeBackground(compressed, {
        model: BACKGROUND_REMOVAL_MODEL,
        // PNG keeps the alpha channel lossless for our own trim-and-centre
        // step; the final WebP encode happens there, once.
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          onProgress?.({ key, current, total });
        },
      });
    } catch (error) {
      throw new BackgroundRemovalError(
        'Background removal could not run. The original photo will be used.',
        { cause: error },
      );
    }

    try {
      return await finishCutout(cutout);
    } catch (error) {
      if (error instanceof BlankCutoutError) {
        throw new BackgroundRemovalError(
          'No garment was found in that photo, so the original will be used.',
          { cause: error },
        );
      }

      throw new BackgroundRemovalError('The cutout could not be processed.', { cause: error });
    }
  });
}
