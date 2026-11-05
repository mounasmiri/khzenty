/**
 * Pixels of alpha eroded inward from the cutout edge.
 *
 * The model feathers its mask, so the outermost ring of a cutout is
 * semi-transparent — and its RGB came from whatever the garment was
 * photographed against. Against a dark background that ring is dark, and once
 * the cutout sits on a light surface it reads as a grubby outline tracing the
 * garment.
 *
 * One pixel removes the fringe on a 1200px capture without visibly thinning
 * the garment. Two is available for stubborn cases; beyond that, thin straps
 * and shoelaces start disappearing.
 */
export const ALPHA_EROSION_RADIUS = 1;

/**
 * A neighbour at or below this alpha counts as background when eroding.
 *
 * Deliberately high — roughly half — rather than near-zero. The contaminated
 * ring is partially transparent, not fully: a cutoff of 10 would treat it as
 * solid garment and erode nothing useful.
 */
export const EROSION_NEIGHBOUR_CUTOFF = 128;

export interface ErosionOptions {
  radius?: number;
  cutoff?: number;
}

/** Pulls the alpha channel out of RGBA data. */
export function extractAlphaChannel(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(width * height);

  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = rgba[i * 4 + 3] ?? 0;
  }

  return alpha;
}

/**
 * Erodes an alpha mask: any pixel within `radius` of background loses its
 * alpha entirely.
 *
 * Pure — returns a new channel and never touches the input, so the whole
 * neighbourhood test reads the *original* mask. Eroding in place would let
 * earlier writes feed later reads and eat inward far past the requested
 * radius.
 *
 * Outside the frame counts as background, so a garment running off the edge of
 * the photo erodes there too. That is the honest reading: nothing is known
 * beyond the frame, and a cutout cropped at the edge has no reliable edge
 * there to keep.
 */
export function erodeAlphaChannel(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  options: ErosionOptions = {},
): Uint8ClampedArray {
  const radius = options.radius ?? ALPHA_EROSION_RADIUS;
  const cutoff = options.cutoff ?? EROSION_NEIGHBOUR_CUTOFF;

  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`Erosion radius must be a non-negative integer, got ${String(radius)}`);
  }

  const output = new Uint8ClampedArray(width * height);

  // Radius 0 is a no-op, and worth short-circuiting: it is how a caller turns
  // erosion off without a separate code path.
  if (radius === 0) {
    for (let i = 0; i < output.length; i += 1) {
      output[i] = alpha[i] ?? 0;
    }

    return output;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const own = alpha[index] ?? 0;

      // Already background; nothing to erode.
      if (own === 0) {
        output[index] = 0;
        continue;
      }

      output[index] = touchesBackground(alpha, width, height, x, y, radius, cutoff) ? 0 : own;
    }
  }

  return output;
}

function touchesBackground(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
  cutoff: number,
): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;

      // Off-frame counts as background.
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        return true;
      }

      if ((alpha[ny * width + nx] ?? 0) <= cutoff) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Applies erosion to RGBA data in place, for use on a canvas `ImageData`.
 *
 * Only the alpha bytes are rewritten. The contaminated RGB is left as it is:
 * it is now fully transparent, and overwriting it would be busywork at best —
 * the pixels that still show are the ones erosion kept.
 */
export function erodeRgbaAlpha(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: ErosionOptions = {},
): void {
  const eroded = erodeAlphaChannel(extractAlphaChannel(rgba, width, height), width, height, options);

  for (let i = 0; i < eroded.length; i += 1) {
    rgba[i * 4 + 3] = eroded[i] ?? 0;
  }
}
