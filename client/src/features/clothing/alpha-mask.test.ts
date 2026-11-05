import { describe, expect, it } from 'vitest';

import {
  ALPHA_EROSION_RADIUS,
  EROSION_NEIGHBOUR_CUTOFF,
  erodeAlphaChannel,
  erodeRgbaAlpha,
  extractAlphaChannel,
} from './alpha-mask';

/**
 * Builds an alpha channel from an ASCII map.
 * `#` solid, `~` a feathered edge (below the cutoff), `.` background.
 */
function alphaFrom(rows: string[]): { alpha: number[]; width: number; height: number } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const alpha: number[] = [];

  for (const row of rows) {
    for (let x = 0; x < width; x += 1) {
      const cell = row[x];
      alpha.push(cell === '#' ? 255 : cell === '~' ? 100 : 0);
    }
  }

  return { alpha, width, height };
}

/** Renders a channel back to an ASCII map, for readable assertions. */
function render(alpha: ArrayLike<number>, width: number, height: number): string[] {
  const rows: string[] = [];

  for (let y = 0; y < height; y += 1) {
    let row = '';
    for (let x = 0; x < width; x += 1) {
      const value = alpha[y * width + x] ?? 0;
      row += value === 0 ? '.' : value === 255 ? '#' : '~';
    }
    rows.push(row);
  }

  return rows;
}

describe('extractAlphaChannel', () => {
  it('reads every fourth byte', () => {
    // Two pixels: opaque then transparent.
    const rgba = [10, 20, 30, 255, 40, 50, 60, 0];
    expect(Array.from(extractAlphaChannel(rgba, 2, 1))).toEqual([255, 0]);
  });
});

describe('erodeAlphaChannel', () => {
  it('removes a one-pixel border from a solid block', () => {
    const { alpha, width, height } = alphaFrom(['####', '####', '####', '####']);

    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 1 });

    // Off-frame counts as background, so the whole outer ring goes.
    expect(render(eroded, width, height)).toEqual(['....', '.##.', '.##.', '....']);
  });

  it('leaves a fully transparent mask alone', () => {
    const { alpha, width, height } = alphaFrom(['....', '....']);
    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 1 });

    expect(Array.from(eroded).every((v) => v === 0)).toBe(true);
  });

  it('erases an isolated pixel entirely', () => {
    const { alpha, width, height } = alphaFrom(['.....', '..#..', '.....']);
    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 1 });

    expect(Array.from(eroded).every((v) => v === 0)).toBe(true);
  });

  it('radius 0 changes nothing', () => {
    const { alpha, width, height } = alphaFrom(['####', '#~#.', '####']);
    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 0 });

    expect(Array.from(eroded)).toEqual(alpha);
  });

  it('radius 2 eats twice as far in', () => {
    const { alpha, width, height } = alphaFrom([
      '######',
      '######',
      '######',
      '######',
      '######',
      '######',
    ]);

    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 2 });

    expect(render(eroded, width, height)).toEqual([
      '......',
      '......',
      '..##..',
      '..##..',
      '......',
      '......',
    ]);
  });

  it('treats a feathered neighbour as background', () => {
    // The middle column is feathered, so both solid columns touch it.
    const { alpha, width, height } = alphaFrom(['###', '#~#', '###']);
    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 1 });

    expect(Array.from(eroded).every((v) => v === 0)).toBe(true);
  });

  it('respects a custom cutoff', () => {
    const { alpha, width, height } = alphaFrom(['#####', '#~~~#', '#~~~#', '#~~~#', '#####']);

    // A cutoff below the feather value treats it as solid, so the interior
    // survives rather than being eroded away.
    const lenient = erodeAlphaChannel(alpha, width, height, { radius: 1, cutoff: 50 });
    expect(Array.from(lenient).some((v) => v > 0)).toBe(true);

    // At the default cutoff the feather counts as background and everything
    // within a pixel of it goes.
    const strict = erodeAlphaChannel(alpha, width, height, { radius: 1 });
    expect(Array.from(strict).every((v) => v === 0)).toBe(true);
  });

  it('does not mutate the input', () => {
    const { alpha, width, height } = alphaFrom(['####', '####']);
    const before = [...alpha];

    erodeAlphaChannel(alpha, width, height, { radius: 1 });

    expect(alpha).toEqual(before);
  });

  it('reads the original mask, so erosion never cascades inward', () => {
    // Eroding in place would let the first cleared pixel make its neighbour
    // look like background, eating far past one pixel.
    const { alpha, width, height } = alphaFrom([
      '#######',
      '#######',
      '#######',
      '#######',
      '#######',
    ]);

    const eroded = erodeAlphaChannel(alpha, width, height, { radius: 1 });

    expect(render(eroded, width, height)).toEqual([
      '.......',
      '.#####.',
      '.#####.',
      '.#####.',
      '.......',
    ]);
  });

  it('preserves the surviving pixels’ original alpha rather than flattening it', () => {
    const alpha = [200, 200, 200, 200, 200, 200, 200, 200, 200];
    const eroded = erodeAlphaChannel(alpha, 3, 3, { radius: 1, cutoff: 10 });

    // The centre survives, and keeps 200 — not 255.
    expect(eroded[4]).toBe(200);
  });

  it('rejects a nonsensical radius', () => {
    const { alpha, width, height } = alphaFrom(['##', '##']);

    expect(() => erodeAlphaChannel(alpha, width, height, { radius: -1 })).toThrow(RangeError);
    expect(() => erodeAlphaChannel(alpha, width, height, { radius: 1.5 })).toThrow(RangeError);
  });

  it('uses the exported constants by default', () => {
    const { alpha, width, height } = alphaFrom(['###', '###', '###']);

    expect(Array.from(erodeAlphaChannel(alpha, width, height))).toEqual(
      Array.from(
        erodeAlphaChannel(alpha, width, height, {
          radius: ALPHA_EROSION_RADIUS,
          cutoff: EROSION_NEIGHBOUR_CUTOFF,
        }),
      ),
    );
  });
});

describe('the dark-background fringe', () => {
  /**
   * The case this exists for: a light garment shot against something dark.
   *
   * The model leaves a feathered ring around the garment whose RGB is the dark
   * background, not the garment. Composited onto a light surface, that ring is
   * the dark outline. Erosion has to remove every pixel carrying that RGB.
   */
  const WIDTH = 7;
  const HEIGHT = 7;
  const GARMENT = [240, 240, 240] as const; // a white shirt
  const BACKGROUND = [18, 18, 18] as const; // a dark studio backdrop

  function buildContaminatedCutout(): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);

    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const i = (y * WIDTH + x) * 4;
        const insideCore = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        const insideRing = x >= 1 && x <= 5 && y >= 1 && y <= 5;

        if (insideCore) {
          // Solid garment.
          rgba[i] = GARMENT[0];
          rgba[i + 1] = GARMENT[1];
          rgba[i + 2] = GARMENT[2];
          rgba[i + 3] = 255;
        } else if (insideRing) {
          // Feathered edge, carrying the backdrop's colour.
          rgba[i] = BACKGROUND[0];
          rgba[i + 1] = BACKGROUND[1];
          rgba[i + 2] = BACKGROUND[2];
          rgba[i + 3] = 100;
        }
        // Everything else stays fully transparent.
      }
    }

    return rgba;
  }

  it('leaves no visible pixel carrying the dark backdrop', () => {
    const rgba = buildContaminatedCutout();

    // Before: the dark ring is visible.
    const alphaBefore = extractAlphaChannel(rgba, WIDTH, HEIGHT);
    const darkVisibleBefore = countVisibleDark(rgba, alphaBefore);
    expect(darkVisibleBefore).toBeGreaterThan(0);

    erodeRgbaAlpha(rgba, WIDTH, HEIGHT);

    const alphaAfter = extractAlphaChannel(rgba, WIDTH, HEIGHT);
    expect(countVisibleDark(rgba, alphaAfter)).toBe(0);
  });

  it('keeps the garment itself', () => {
    const rgba = buildContaminatedCutout();
    erodeRgbaAlpha(rgba, WIDTH, HEIGHT);

    const alpha = extractAlphaChannel(rgba, WIDTH, HEIGHT);
    const visible = Array.from(alpha).filter((a) => a > 0);

    // The 3x3 core loses its own outer ring too, since it borders the
    // contaminated one — a pixel of genuine garment is the price of removing
    // the fringe.
    expect(visible).toHaveLength(1);
    expect(visible[0]).toBe(255);
  });

  it('removes the fringe but not the whole garment on a larger core', () => {
    // A realistic ratio: a big garment with a one-pixel halo keeps almost all
    // of itself.
    const size = 40;
    const rgba = new Uint8ClampedArray(size * size * 4);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4;
        const inset = Math.min(x, y, size - 1 - x, size - 1 - y);

        if (inset >= 2) {
          rgba[i] = 240;
          rgba[i + 1] = 240;
          rgba[i + 2] = 240;
          rgba[i + 3] = 255;
        } else if (inset >= 1) {
          rgba[i] = 18;
          rgba[i + 1] = 18;
          rgba[i + 2] = 18;
          rgba[i + 3] = 100;
        }
      }
    }

    erodeRgbaAlpha(rgba, size, size);
    const alpha = extractAlphaChannel(rgba, size, size);
    const visible = Array.from(alpha).filter((a) => a > 0).length;

    // Core was 36x36 = 1296; it loses its border ring, leaving 34x34 = 1156.
    expect(visible).toBe(34 * 34);
    expect(countVisibleDark(rgba, alpha)).toBe(0);
  });

  function countVisibleDark(rgba: ArrayLike<number>, alpha: ArrayLike<number>): number {
    let count = 0;

    for (let i = 0; i < alpha.length; i += 1) {
      const visible = (alpha[i] ?? 0) > 0;
      const isDark = (rgba[i * 4] ?? 0) < 64;

      if (visible && isDark) count += 1;
    }

    return count;
  }
});

describe('erodeRgbaAlpha', () => {
  it('rewrites only the alpha bytes', () => {
    const rgba = new Uint8ClampedArray([
      // 2x1: both opaque, distinctive RGB.
      11, 22, 33, 255, 44, 55, 66, 255,
    ]);

    erodeRgbaAlpha(rgba, 2, 1);

    // Both erode (off-frame neighbours), but the colour bytes are untouched.
    expect(Array.from(rgba)).toEqual([11, 22, 33, 0, 44, 55, 66, 0]);
  });
});
