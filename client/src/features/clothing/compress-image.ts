/** Longest edge, in pixels, after resizing. */
export const MAX_DIMENSION = 1200;

/** JPEG quality. High enough that fabric texture survives. */
const QUALITY = 0.82;

/**
 * Resizes and re-encodes a photo in the browser before upload.
 *
 * A phone camera produces 3–8 MB files several thousand pixels wide. Nothing in
 * this app displays a garment larger than a few hundred pixels, so uploading
 * the original wastes the user's data allowance and their time — which matters
 * most on the mobile capture path this exists for.
 *
 * Re-encodes as JPEG, so transparency is lost. Garment photos are photographs,
 * not logos, and JPEG is markedly smaller than PNG for them.
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

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY);
    });

    if (!blob) {
      return file;
    }

    // Re-encoding can enlarge an already-optimised file. Keep whichever is
    // smaller, unless we actually resized — then the smaller pixel count is
    // worth having regardless.
    if (scale === 1 && blob.size >= file.size) {
      return file;
    }

    return new File([blob], toJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** The extension has to match the new encoding, or the format check trips. */
function toJpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}
