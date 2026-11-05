import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ALPHA_THRESHOLD,
  computeSquareLayout,
  findOpaqueBounds,
} from './image-geometry';
import type { Bounds } from './image-geometry';

/**
 * Builds RGBA data from an ASCII map, so each case reads as a picture.
 * `#` is fully opaque, `.` fully transparent, `~` a faint edge halo.
 */
function rgbaFrom(rows: string[]): { rgba: number[]; width: number; height: number } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const rgba: number[] = [];

  for (const row of rows) {
    for (let x = 0; x < width; x += 1) {
      const cell = row[x];
      const alpha = cell === '#' ? 255 : cell === '~' ? DEFAULT_ALPHA_THRESHOLD : 0;
      rgba.push(0, 0, 0, alpha);
    }
  }

  return { rgba, width, height };
}

describe('findOpaqueBounds', () => {
  it('returns null when nothing is opaque', () => {
    const { rgba, width, height } = rgbaFrom(['....', '....']);
    expect(findOpaqueBounds(rgba, width, height)).toBeNull();
  });

  it('finds a single pixel', () => {
    const { rgba, width, height } = rgbaFrom(['....', '.#..', '....']);
    expect(findOpaqueBounds(rgba, width, height)).toEqual({
      left: 1,
      top: 1,
      right: 1,
      bottom: 1,
    });
  });

  it('bounds are inclusive on all sides', () => {
    const { rgba, width, height } = rgbaFrom(['.....', '.###.', '.###.', '.....']);

    // A 3x3 block at x=1..3, y=1..2.
    expect(findOpaqueBounds(rgba, width, height)).toEqual({
      left: 1,
      top: 1,
      right: 3,
      bottom: 2,
    });
  });

  it('handles content touching every edge', () => {
    const { rgba, width, height } = rgbaFrom(['###', '###']);
    expect(findOpaqueBounds(rgba, width, height)).toEqual({
      left: 0,
      top: 0,
      right: 2,
      bottom: 1,
    });
  });

  it('ignores the feathered halo at the alpha threshold', () => {
    // `~` sits exactly at the threshold, which is background, not content.
    const { rgba, width, height } = rgbaFrom(['~~~~~', '~.#.~', '~~~~~']);

    expect(findOpaqueBounds(rgba, width, height)).toEqual({
      left: 2,
      top: 1,
      right: 2,
      bottom: 1,
    });
  });

  it('respects a custom threshold', () => {
    const { rgba, width, height } = rgbaFrom(['~~', '~~']);

    // Nothing exceeds the default threshold...
    expect(findOpaqueBounds(rgba, width, height)).toBeNull();
    // ...but everything exceeds a lower one.
    expect(findOpaqueBounds(rgba, width, height, 0)).toEqual({
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
    });
  });

  it('finds disjoint content, not just the first blob', () => {
    const { rgba, width, height } = rgbaFrom(['#...', '....', '...#']);

    // A belt photographed in two pieces still has one bounding box.
    expect(findOpaqueBounds(rgba, width, height)).toEqual({
      left: 0,
      top: 0,
      right: 3,
      bottom: 2,
    });
  });

  it('returns null for a zero-sized image', () => {
    expect(findOpaqueBounds([], 0, 0)).toBeNull();
  });
});

describe('computeSquareLayout', () => {
  /** Padding on each axis, as [before, after]. */
  function padding(layout: ReturnType<typeof computeSquareLayout>) {
    return {
      x: [layout.destX, layout.canvasSize - layout.destX - layout.destWidth],
      y: [layout.destY, layout.canvasSize - layout.destY - layout.destHeight],
    };
  }

  const square: Bounds = { left: 0, top: 0, right: 99, bottom: 99 };
  const wide: Bounds = { left: 0, top: 0, right: 199, bottom: 99 };
  const tall: Bounds = { left: 0, top: 0, right: 99, bottom: 199 };

  it('produces a square canvas', () => {
    const layout = computeSquareLayout(wide);
    // canvasSize is a single number used for both edges by construction.
    expect(layout.canvasSize).toBeGreaterThan(0);
  });

  it('copies exactly the trimmed region', () => {
    const layout = computeSquareLayout({ left: 10, top: 20, right: 29, bottom: 59 });

    expect(layout.sourceX).toBe(10);
    expect(layout.sourceY).toBe(20);
    // Inclusive bounds, so 10..29 is 20 pixels wide.
    expect(layout.sourceWidth).toBe(20);
    expect(layout.sourceHeight).toBe(40);
  });

  it('centres a wide garment, with the slack going vertically', () => {
    const layout = computeSquareLayout(wide);
    const pad = padding(layout);

    // Opposite sides match: that is what "even padding" means.
    expect(Math.abs(pad.x[0]! - pad.x[1]!)).toBeLessThanOrEqual(1);
    expect(Math.abs(pad.y[0]! - pad.y[1]!)).toBeLessThanOrEqual(1);
    // A landscape garment leaves more room above and below than beside.
    expect(pad.y[0]!).toBeGreaterThan(pad.x[0]!);
  });

  it('centres a tall garment, with the slack going horizontally', () => {
    const layout = computeSquareLayout(tall);
    const pad = padding(layout);

    expect(Math.abs(pad.x[0]! - pad.x[1]!)).toBeLessThanOrEqual(1);
    expect(Math.abs(pad.y[0]! - pad.y[1]!)).toBeLessThanOrEqual(1);
    expect(pad.x[0]!).toBeGreaterThan(pad.y[0]!);
  });

  it('keeps the aspect ratio', () => {
    const layout = computeSquareLayout(wide);

    // 200x100 in, so twice as wide as tall out.
    expect(layout.destWidth / layout.destHeight).toBeCloseTo(2, 1);
  });

  it('leaves the requested padding on the long edge', () => {
    const layout = computeSquareLayout(square, { paddingRatio: 0.1 });

    // A square garment fills the inner box on both axes.
    expect(layout.destWidth / layout.canvasSize).toBeCloseTo(0.8, 2);
  });

  it('never upscales: a small cutout gets a small canvas', () => {
    const layout = computeSquareLayout({ left: 0, top: 0, right: 49, bottom: 49 });

    // 50px content must not be blown up to 1200.
    expect(layout.canvasSize).toBeLessThan(100);
    expect(layout.destWidth).toBeLessThanOrEqual(50);
  });

  it('caps the canvas at maxSize and scales down to fit', () => {
    const layout = computeSquareLayout({ left: 0, top: 0, right: 3999, bottom: 2999 }, {
      maxSize: 1200,
    });

    expect(layout.canvasSize).toBe(1200);
    // Scaled down, and still inside the padded box.
    expect(layout.destWidth).toBeLessThanOrEqual(1200);
    expect(layout.destX).toBeGreaterThan(0);
  });

  it('honours a custom maxSize', () => {
    const layout = computeSquareLayout({ left: 0, top: 0, right: 3999, bottom: 3999 }, {
      maxSize: 512,
    });

    expect(layout.canvasSize).toBe(512);
  });

  it('keeps the drawn content inside the canvas', () => {
    for (const bounds of [square, wide, tall, { left: 5, top: 7, right: 5, bottom: 7 }]) {
      const layout = computeSquareLayout(bounds);

      expect(layout.destX).toBeGreaterThanOrEqual(0);
      expect(layout.destY).toBeGreaterThanOrEqual(0);
      expect(layout.destX + layout.destWidth).toBeLessThanOrEqual(layout.canvasSize);
      expect(layout.destY + layout.destHeight).toBeLessThanOrEqual(layout.canvasSize);
    }
  });

  it('survives a 1x1 cutout without collapsing to zero', () => {
    const layout = computeSquareLayout({ left: 3, top: 3, right: 3, bottom: 3 });

    expect(layout.canvasSize).toBeGreaterThanOrEqual(1);
    expect(layout.destWidth).toBeGreaterThanOrEqual(1);
    expect(layout.destHeight).toBeGreaterThanOrEqual(1);
  });

  it('works with zero padding', () => {
    const layout = computeSquareLayout(square, { paddingRatio: 0 });

    expect(layout.destWidth).toBe(layout.canvasSize);
  });

  it('rejects nonsensical options', () => {
    expect(() => computeSquareLayout(square, { maxSize: 0 })).toThrow(RangeError);
    expect(() => computeSquareLayout(square, { paddingRatio: 0.5 })).toThrow(RangeError);
    expect(() => computeSquareLayout(square, { paddingRatio: -0.1 })).toThrow(RangeError);
  });
});
