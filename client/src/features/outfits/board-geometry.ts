import type { BoardPlacement } from './board-layout';

/**
 * The board's proportions. Taller than wide, like a person — and what a phone
 * screen has room for.
 *
 * Stated as numbers rather than a CSS string so the canvas export and the DOM
 * read the same source. A separate `aspectRatio: '4 / 5'` in the component
 * would let an exported PNG quietly differ in shape from what was on screen.
 */
export const BOARD_ASPECT = { width: 4, height: 5 } as const;

export const BOARD_ASPECT_RATIO_CSS = `${String(BOARD_ASPECT.width)} / ${String(BOARD_ASPECT.height)}`;

/**
 * Inset of the garments from the board's edge, as a fraction per side.
 *
 * In the DOM it is applied to an inner wrapper rather than as padding on the
 * board, because an absolutely positioned child's percentages resolve against
 * the padding box — padding would not actually move anything in.
 */
export const BOARD_INSET_RATIO = 0.04;

export const BOARD_INSET_CSS = `${String(BOARD_INSET_RATIO * 100)}%`;

/** Width of an exported PNG. Height follows from the aspect ratio. */
export const BOARD_EXPORT_WIDTH = 1200;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

/** Export canvas size, derived so it can never disagree with the on-screen shape. */
export function boardExportSize(width = BOARD_EXPORT_WIDTH): PixelSize {
  return {
    width,
    height: Math.round((width * BOARD_ASPECT.height) / BOARD_ASPECT.width),
  };
}

/**
 * Turns a unit-space placement into pixels on a canvas of a given size.
 *
 * The inset is applied as a border all round, and the placement's 0..1
 * coordinates then span what is left — exactly what the inner wrapper does in
 * the DOM. Keeping this as a pure function is what lets the export be checked
 * against the rendered board without a browser.
 */
export function placementPixels(
  placement: BoardPlacement,
  size: PixelSize,
  insetRatio = BOARD_INSET_RATIO,
): PixelRect {
  const insetX = size.width * insetRatio;
  const insetY = size.height * insetRatio;
  const innerWidth = size.width - insetX * 2;
  const innerHeight = size.height - insetY * 2;

  return {
    x: insetX + placement.x * innerWidth,
    y: insetY + placement.y * innerHeight,
    width: placement.width * innerWidth,
    height: placement.height * innerHeight,
  };
}

/**
 * Fits a source image inside a destination box, centred, with its aspect ratio
 * intact — `object-contain`, in arithmetic.
 *
 * This is the half of the layout the browser normally does for us. The export
 * draws onto a canvas, which has no such thing, so the same rule has to be
 * stated explicitly here. Getting it wrong is how an exported PNG ends up
 * stretched while the screen looks fine, which is precisely why it is pure and
 * tested rather than inlined into the draw loop.
 */
export function containWithin(source: PixelSize, dest: PixelRect): PixelRect {
  // A zero or unknown intrinsic size has no ratio to preserve; filling the box
  // is the only sensible answer and beats dividing by zero.
  if (source.width <= 0 || source.height <= 0) {
    return dest;
  }

  const scale = Math.min(dest.width / source.width, dest.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: dest.x + (dest.width - width) / 2,
    y: dest.y + (dest.height - height) / 2,
    width,
    height,
  };
}
