/** Longest edge, in pixels, after resizing. */
export const MAX_DIMENSION = 1200;

/** Encode quality. High enough that fabric texture survives. */
const QUALITY = 0.82;

/**
 * Formats that can carry an alpha channel.
 *
 * Membership is decided by the container, not by inspecting pixels: a PNG with
 * no transparent pixel is still treated as alpha-capable. Being cautious that
 * way costs a slightly larger file; being wrong the other way flattens a
 * garment onto black, which is unrecoverable.
 */
export const ALPHA_CAPABLE_TYPES = ['image/png', 'image/webp', 'image/avif'] as const;

export function carriesAlpha(mimeType: string): boolean {
  return (ALPHA_CAPABLE_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export interface EncodingPlan {
  /** Leave the file completely untouched. */
  skip: boolean;
  /** Output type when not skipping. */
  type: 'image/jpeg' | 'image/webp';
}

/**
 * Decides how a source should be re-encoded, if at all.
 *
 * Pure, and separated from the canvas work so the branching is testable. The
 * case that matters is an alpha-capable source: JPEG has no alpha, so
 * re-encoding a cutout as JPEG composites the garment onto black and
 * permanently bakes in exactly the background that was just removed.
 *
 * - No alpha: JPEG, which is markedly smaller for photographs.
 * - Alpha, already small enough: skip entirely. Nothing to gain, and every
 *   re-encode is a generation of loss.
 * - Alpha, too large: WebP, which resizes it while keeping transparency.
 */
export function planEncoding(mimeType: string, needsResize: boolean): EncodingPlan {
  if (!carriesAlpha(mimeType)) {
    return { skip: false, type: 'image/jpeg' };
  }

  return needsResize ? { skip: false, type: 'image/webp' } : { skip: true, type: 'image/webp' };
}

/**
 * Resizes and re-encodes a photo in the browser before upload.
 *
 * A phone camera produces 3–8 MB files several thousand pixels wide. Nothing in
 * this app displays a garment larger than a few hundred pixels, so uploading
 * the original wastes the user's data allowance and their time — which matters
 * most on the mobile capture path this exists for.
 *
 * Never throws: if anything about the decode or encode fails, the original file
 * is returned and the server's own size and format checks still apply. A failed
 * optimisation must not block an upload.
 */
export async function compressImage(file: File, maxDimension = MAX_DIMENSION): Promise<File> {
  // Leave anything that is not a bitmap image alone; the server rejects it.
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longestEdge);
    const needsResize = scale < 1;

    const plan = planEncoding(file.type, needsResize);

    if (plan.skip) {
      // An already-small cutout: hand it back exactly as it came in.
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      bitmap.close();
      return file;
    }

    // No background fill: an alpha source keeps its transparency, and for an
    // opaque one every pixel is overwritten anyway.
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, plan.type, QUALITY);
    });

    if (!blob) {
      return file;
    }

    // `toBlob` quietly falls back to PNG for a type the browser cannot encode,
    // so trust the blob's own type rather than what was asked for. PNG keeps
    // alpha, so it is a safe landing place.
    if (carriesAlpha(file.type) && !carriesAlpha(blob.type)) {
      return file;
    }

    // Re-encoding can enlarge an already-optimised file. Keep whichever is
    // smaller, unless we actually resized — then the smaller pixel count is
    // worth having regardless.
    if (!needsResize && blob.size >= file.size) {
      return file;
    }

    return new File([blob], renameFor(file.name, blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
};

/** The extension has to match the new encoding, or the format check trips. */
export function renameFor(name: string, mimeType: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  const extension = EXTENSIONS[mimeType.toLowerCase()] ?? 'jpg';

  return `${base}.${extension}`;
}
