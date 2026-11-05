/** Longest edge of the exported square, in pixels. */
export const MAX_CUTOUT_SIZE = 1200;

/**
 * Padding on each side, as a fraction of the canvas edge.
 *
 * Applied per side, so 0.06 leaves 12% of the edge as margin in total. Without
 * it a cutout touches the tile border and reads as cropped rather than framed.
 */
export const DEFAULT_PADDING_RATIO = 0.06;

/**
 * Alpha at or below this counts as background.
 *
 * Not zero: the model feathers edges, leaving a halo of barely-visible pixels
 * that would defeat trimming entirely if any non-zero alpha counted as content.
 */
export const DEFAULT_ALPHA_THRESHOLD = 10;

/** Inclusive pixel bounds of the opaque content. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SquareLayout {
  /** Edge of the square canvas to draw onto. */
  canvasSize: number;
  /** Source rectangle to copy — the trimmed content. */
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  /** Destination rectangle, centred within the square. */
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
}

/**
 * Finds the bounding box of pixels whose alpha exceeds the threshold.
 *
 * Takes raw RGBA so it can be unit-tested with a plain array — no canvas, no
 * DOM. Returns `null` when nothing is opaque enough, which the caller must
 * treat as "do not trim" rather than as an error: a fully transparent result
 * means the model found no subject.
 */
export function findOpaqueBounds(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
): Bounds | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Alpha is the 4th byte of each RGBA pixel.
      const alpha = rgba[(y * width + x) * 4 + 3] ?? 0;

      if (alpha > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  return right < 0 ? null : { left, top, right, bottom };
}

/**
 * Works out where to draw trimmed content so it sits centred on a square
 * canvas with even padding.
 *
 * The canvas is never larger than the content needs: a small cutout produces a
 * small square rather than being upscaled into a blurry one. `maxSize` only
 * caps the result.
 *
 * Scaling fits rather than fills, so the aspect ratio is preserved — the long
 * edge lands exactly on the padding, and the short edge gets the remainder,
 * split equally. That is what makes the padding even on all four sides.
 */
export function computeSquareLayout(
  bounds: Bounds,
  options: { maxSize?: number; paddingRatio?: number } = {},
): SquareLayout {
  const maxSize = options.maxSize ?? MAX_CUTOUT_SIZE;
  const paddingRatio = options.paddingRatio ?? DEFAULT_PADDING_RATIO;

  if (maxSize <= 0) {
    throw new RangeError(`maxSize must be positive, got ${String(maxSize)}`);
  }

  // Two sides' worth of padding must leave room for the garment.
  if (paddingRatio < 0 || paddingRatio >= 0.5) {
    throw new RangeError(`paddingRatio must be in [0, 0.5), got ${String(paddingRatio)}`);
  }

  const sourceWidth = bounds.right - bounds.left + 1;
  const sourceHeight = bounds.bottom - bounds.top + 1;
  const longestEdge = Math.max(sourceWidth, sourceHeight);

  const contentFraction = 1 - 2 * paddingRatio;

  // Grow the canvas just enough that the content plus its padding fits, then
  // cap it. Never bigger than that, so nothing is upscaled.
  const canvasSize = Math.max(1, Math.min(maxSize, Math.round(longestEdge / contentFraction)));

  const innerBox = canvasSize * contentFraction;
  const scale = Math.min(innerBox / sourceWidth, innerBox / sourceHeight);

  const destWidth = Math.max(1, Math.round(sourceWidth * scale));
  const destHeight = Math.max(1, Math.round(sourceHeight * scale));

  return {
    canvasSize,
    sourceX: bounds.left,
    sourceY: bounds.top,
    sourceWidth,
    sourceHeight,
    destX: Math.round((canvasSize - destWidth) / 2),
    destY: Math.round((canvasSize - destHeight) / 2),
    destWidth,
    destHeight,
  };
}
