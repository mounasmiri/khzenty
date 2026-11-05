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
 * Reads a photo already stored on an item back into a `File`, so it can be fed
 * through the same removal flow as a freshly picked one.
 *
 * This is a cross-origin read: the image lives on Cloudinary, and the browser
 * only hands us the bytes if that host returns permissive CORS headers. The
 * failure is reported plainly rather than as a generic error, because the user
 * has a usable way around it — re-pick the file from disk — and no way at all
 * of guessing that from "something went wrong".
 *
 * `credentials: 'omit'` so no session cookie is sent to a third-party host.
 */
export async function fetchStoredImage(url: string): Promise<File> {
  let response: Response;

  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  } catch {
    // fetch only rejects on a network or CORS failure, never on a 4xx.
    throw new BackgroundRemovalError(
      'Could not read the stored photo — the image host did not allow this page to fetch it. Pick the file again to remove its background.',
    );
  }

  if (!response.ok) {
    throw new BackgroundRemovalError(
      `Could not read the stored photo (${String(response.status)}). Pick the file again to remove its background.`,
    );
  }

  const blob = await response.blob();

  if (!blob.type.startsWith('image/')) {
    throw new BackgroundRemovalError('The stored photo did not come back as an image.');
  }

  // Extensionless on purpose: compressImage renames by MIME type anyway, and
  // the stored name carries no information worth preserving here.
  return new File([blob], 'stored-photo', { type: blob.type });
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
