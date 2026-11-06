import { describe, expect, it } from 'vitest';

import {
  BOARD_ASPECT,
  BOARD_ASPECT_RATIO_CSS,
  BOARD_EXPORT_WIDTH,
  BOARD_INSET_CSS,
  BOARD_INSET_RATIO,
  boardExportSize,
  containWithin,
  placementPixels,
} from './board-geometry';
import { computeBoardLayout } from './board-layout';
import { exportFileName } from './export-board';

describe('the board’s shared dimensions', () => {
  it('derives the CSS aspect ratio from the numbers the export uses', () => {
    // One source, so an exported PNG cannot be a different shape from the
    // board that was on screen.
    expect(BOARD_ASPECT_RATIO_CSS).toBe('4 / 5');
  });

  it('derives the CSS inset from the same ratio the canvas applies', () => {
    expect(BOARD_INSET_CSS).toBe('4%');
    expect(BOARD_INSET_RATIO).toBeCloseTo(0.04, 6);
  });

  it('is taller than it is wide', () => {
    expect(BOARD_ASPECT.height).toBeGreaterThan(BOARD_ASPECT.width);
  });
});

describe('boardExportSize', () => {
  it('matches the board’s aspect ratio', () => {
    const size = boardExportSize();

    expect(size.width).toBe(BOARD_EXPORT_WIDTH);
    expect(size.width / size.height).toBeCloseTo(BOARD_ASPECT.width / BOARD_ASPECT.height, 3);
  });

  it('keeps the ratio at any width', () => {
    for (const width of [200, 640, 1200, 2400]) {
      const size = boardExportSize(width);

      expect(size.width / size.height).toBeCloseTo(BOARD_ASPECT.width / BOARD_ASPECT.height, 2);
    }
  });

  it('returns whole pixels', () => {
    const size = boardExportSize(777);

    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});

describe('placementPixels', () => {
  const size = { width: 1000, height: 1000 };
  const full = { itemId: 'a', x: 0, y: 0, width: 1, height: 1 };

  it('insets a full-board placement on all four sides', () => {
    const box = placementPixels(full, size, 0.04);

    expect(box).toEqual({ x: 40, y: 40, width: 920, height: 920 });
  });

  it('leaves the inset as margin, equally on both sides', () => {
    const box = placementPixels(full, size, 0.1);

    expect(box.x).toBe(100);
    expect(size.width - (box.x + box.width)).toBe(100);
  });

  it('places a half-width box at the right offset', () => {
    const box = placementPixels({ itemId: 'a', x: 0.5, y: 0, width: 0.5, height: 1 }, size, 0);

    expect(box).toEqual({ x: 500, y: 0, width: 500, height: 1000 });
  });

  it('scales x and y independently on a non-square board', () => {
    const box = placementPixels(full, { width: 400, height: 500 }, 0.1);

    // The inset is a fraction of each edge, so it is 40px across and 50px down.
    expect(box).toEqual({ x: 40, y: 50, width: 320, height: 400 });
  });

  it('keeps every box of a real layout inside the canvas', () => {
    const { placements } = computeBoardLayout([
      { id: 'top', zone: 'TOP' },
      { id: 'bottom', zone: 'BOTTOM' },
      { id: 'shoes', zone: 'FOOTWEAR' },
      { id: 'bag', zone: 'BAG' },
      { id: 'watch', zone: 'ACCESSORY' },
    ]);

    const canvas = boardExportSize();

    for (const placement of placements) {
      const box = placementPixels(placement, canvas);

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.width + 1e-6);
      expect(box.y + box.height).toBeLessThanOrEqual(canvas.height + 1e-6);
    }
  });
});

describe('containWithin', () => {
  const dest = { x: 100, y: 200, width: 400, height: 400 };

  it('fits a wide image by its width, centring it vertically', () => {
    const fitted = containWithin({ width: 800, height: 400 }, dest);

    expect(fitted.width).toBe(400);
    expect(fitted.height).toBe(200);
    expect(fitted.x).toBe(100);
    expect(fitted.y).toBe(300);
  });

  it('fits a tall image by its height, centring it horizontally', () => {
    const fitted = containWithin({ width: 400, height: 800 }, dest);

    expect(fitted.width).toBe(200);
    expect(fitted.height).toBe(400);
    expect(fitted.x).toBe(200);
    expect(fitted.y).toBe(200);
  });

  it('preserves the source aspect ratio', () => {
    for (const source of [
      { width: 1200, height: 300 },
      { width: 301, height: 1199 },
      { width: 640, height: 640 },
    ]) {
      const fitted = containWithin(source, dest);

      expect(fitted.width / fitted.height).toBeCloseTo(source.width / source.height, 6);
    }
  });

  it('never overflows the destination box', () => {
    for (const source of [
      { width: 5000, height: 10 },
      { width: 10, height: 5000 },
      { width: 4000, height: 4000 },
    ]) {
      const fitted = containWithin(source, dest);

      expect(fitted.width).toBeLessThanOrEqual(dest.width + 1e-9);
      expect(fitted.height).toBeLessThanOrEqual(dest.height + 1e-9);
      expect(fitted.x).toBeGreaterThanOrEqual(dest.x - 1e-9);
      expect(fitted.y).toBeGreaterThanOrEqual(dest.y - 1e-9);
    }
  });

  it('contains rather than covers — it does not crop', () => {
    // The whole point: `cover` would fill the box and cut the toes off shoes.
    const fitted = containWithin({ width: 1000, height: 100 }, dest);

    expect(fitted.height).toBeLessThan(dest.height);
    expect(fitted.width).toBe(dest.width);
  });

  it('upscales a small image to fill the box', () => {
    const fitted = containWithin({ width: 40, height: 40 }, dest);

    expect(fitted.width).toBe(400);
    expect(fitted.height).toBe(400);
  });

  it('stays centred', () => {
    const fitted = containWithin({ width: 300, height: 100 }, dest);

    const leftGap = fitted.x - dest.x;
    const rightGap = dest.x + dest.width - (fitted.x + fitted.width);
    const topGap = fitted.y - dest.y;
    const bottomGap = dest.y + dest.height - (fitted.y + fitted.height);

    expect(leftGap).toBeCloseTo(rightGap, 9);
    expect(topGap).toBeCloseTo(bottomGap, 9);
  });

  it('fills the box for an image with no measurable size', () => {
    // An image that failed to decode reports 0x0; there is no ratio to keep,
    // and dividing by it would give NaN coordinates the canvas silently drops.
    expect(containWithin({ width: 0, height: 0 }, dest)).toEqual(dest);
    expect(containWithin({ width: -5, height: 10 }, dest)).toEqual(dest);
  });
});

describe('exportFileName', () => {
  it('slugifies the outfit name', () => {
    expect(exportFileName('Friday dinner')).toBe('friday-dinner.png');
    expect(exportFileName('Work — Monday')).toBe('work-monday.png');
  });

  it('strips characters a filesystem would refuse', () => {
    // A slash or colon makes the OS refuse or silently rename the download.
    expect(exportFileName('summer/autumn: 2026')).toBe('summer-autumn-2026.png');
  });

  it('falls back rather than producing a bare extension', () => {
    expect(exportFileName('***')).toBe('outfit.png');
    expect(exportFileName('   ')).toBe('outfit.png');
    expect(exportFileName('')).toBe('outfit.png');
  });

  it('caps the length', () => {
    const name = exportFileName('a'.repeat(200));

    expect(name.length).toBeLessThanOrEqual(64);
    expect(name.endsWith('.png')).toBe(true);
  });

  it('leaves no leading or trailing dash', () => {
    expect(exportFileName('  spaced  ')).toBe('spaced.png');
    expect(exportFileName('-dashed-')).toBe('dashed.png');
  });
});
