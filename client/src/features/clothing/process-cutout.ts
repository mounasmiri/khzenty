import {
  MAX_CUTOUT_SIZE,
  computeSquareLayout,
  findOpaqueBounds,
} from './image-geometry';

/** Quality for the WebP encode. High enough to keep fabric texture. */
const WEBP_QUALITY = 0.85;

export class BlankCutoutError extends Error {
  constructor() {
    super('Background removal produced an empty image.');
    this.name = 'BlankCutoutError';
  }
}

export interface CutoutResult {
  file: File;
  /** The encoding actually used — WebP is not universal. */
  format: 'webp' | 'png';
  /** Edge of the square produced, for reporting. */
  canvasSize: number;
}

/**
 * Trims the transparent border off a cutout, centres it on a square canvas with
 * even padding, and encodes it with its alpha channel intact.
 *
 * The background is never filled in. The file keeps real transparency and the
 * surface behind it comes from the `--garment-surface` token at render time, so
 * one token change restyles every garment rather than requiring re-uploads.
 *
 * **WebP, with a PNG fallback — never JPEG.** JPEG has no alpha, so falling
 * back to it would composite the garment onto black and permanently bake a
 * background into the file. PNG is larger but preserves transparency, which is
 * the property that matters here.
 *
 * Expects a cutout already at display scale. Removal runs on the compressed
 * 1200px image rather than the original camera file, so the `ImageData` read
 * below stays a few megabytes instead of tens.
 */
export async function finishCutout(
  cutout: Blob,
  options: { maxSize?: number; paddingRatio?: number } = {},
): Promise<CutoutResult> {
  const maxSize = options.maxSize ?? MAX_CUTOUT_SIZE;
  const bitmap = await createImageBitmap(cutout);

  try {
    const bounds = measureBounds(bitmap);

    if (!bounds) {
      // Nothing opaque: the model found no subject. Signalled rather than
      // returning a blank square, so the caller can keep the original photo.
      throw new BlankCutoutError();
    }

    const layout = computeSquareLayout(bounds, {
      maxSize,
      ...(options.paddingRatio === undefined ? {} : { paddingRatio: options.paddingRatio }),
    });

    const canvas = document.createElement('canvas');
    canvas.width = layout.canvasSize;
    canvas.height = layout.canvasSize;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get a 2D canvas context');
    }

    // No fillRect: the canvas starts fully transparent and stays that way
    // outside the garment.
    context.drawImage(
      bitmap,
      layout.sourceX,
      layout.sourceY,
      layout.sourceWidth,
      layout.sourceHeight,
      layout.destX,
      layout.destY,
      layout.destWidth,
      layout.destHeight,
    );

    const encoded = await encodeWithAlpha(canvas);

    return {
      file: new File([encoded.blob], `cutout.${encoded.format}`, {
        type: encoded.blob.type,
        lastModified: Date.now(),
      }),
      format: encoded.format,
      canvasSize: layout.canvasSize,
    };
  } finally {
    // Bitmaps hold decoded pixels; release them even when we bail out.
    bitmap.close();
  }
}

/** Reads the alpha channel at natural size to locate the garment. */
function measureBounds(bitmap: ImageBitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Could not get a 2D canvas context');
  }

  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);

  return findOpaqueBounds(data, bitmap.width, bitmap.height);
}

/**
 * Encodes as WebP, falling back to PNG.
 *
 * `toBlob` with an unsupported type silently yields PNG in some browsers rather
 * than null, so the returned blob's own MIME type decides the extension — not
 * what we asked for.
 */
async function encodeWithAlpha(
  canvas: HTMLCanvasElement,
): Promise<{ blob: Blob; format: 'webp' | 'png' }> {
  const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY);

  if (webp && webp.type === 'image/webp') {
    return { blob: webp, format: 'webp' };
  }

  const png = await toBlob(canvas, 'image/png');

  if (!png) {
    throw new Error('Could not encode the cutout');
  }

  return { blob: png, format: 'png' };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
