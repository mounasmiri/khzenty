import { describe, expect, it } from 'vitest';

import {
  BAG_HEIGHT_WITH_ACCESSORIES,
  BOARD_ZONES,
  type BoardItem,
  type BoardPlacement,
  COLUMN_GAP,
  GAP,
  LAYOUT_VERSION,
  LONE_BAG_MAX_HEIGHT,
  MAIN_COLUMN_WIDTH,
  computeBoardLayout,
} from './board-layout';

const item = (id: string, zone: BoardItem['zone']): BoardItem => ({ id, zone });

const top = item('top', 'TOP');
const bottom = item('bottom', 'BOTTOM');
const shoes = item('shoes', 'FOOTWEAR');
const dress = item('dress', 'ONE_PIECE');
const jacket = item('jacket', 'OUTERWEAR');
const bag = item('bag', 'BAG');
const watch = item('watch', 'ACCESSORY');
const shades = item('shades', 'ACCESSORY');

function place(items: BoardItem[]): Record<string, BoardPlacement> {
  const { placements } = computeBoardLayout(items);

  return Object.fromEntries(placements.map((placement) => [placement.itemId, placement]));
}

/** The bottom edge of a box. */
const bottomOf = (placement: BoardPlacement) => placement.y + placement.height;
/** The right edge of a box. */
const rightOf = (placement: BoardPlacement) => placement.x + placement.width;

describe('computeBoardLayout', () => {
  it('places nothing for an empty board', () => {
    expect(computeBoardLayout([])).toEqual({ version: LAYOUT_VERSION, placements: [] });
  });

  it('stamps the layout version, so a stored layout can be recognised later', () => {
    expect(computeBoardLayout([top]).version).toBe(LAYOUT_VERSION);
  });

  it('places every item exactly once', () => {
    const items = [top, bottom, shoes, jacket, bag, watch, shades];
    const { placements } = computeBoardLayout(items);

    expect(placements).toHaveLength(items.length);
    expect(placements.map((p) => p.itemId).sort()).toEqual(items.map((i) => i.id).sort());
  });

  it('is pure — the same items give the same positions', () => {
    const items = [top, bottom, shoes, bag, watch];

    expect(computeBoardLayout(items)).toEqual(computeBoardLayout(items));
  });

  it('does not depend on the order items are picked in', () => {
    const forwards = place([top, bottom, shoes, bag]);
    const backwards = place([bag, shoes, bottom, top]);

    // Zone decides position, not pick order — so re-opening a saved outfit
    // cannot shuffle the board.
    expect(forwards).toEqual(backwards);
  });

  describe('the main column', () => {
    it('puts the top above the bottom, and the shoes below both', () => {
      const board = place([top, bottom, shoes]);

      expect(bottomOf(board.top!)).toBeLessThanOrEqual(board.bottom!.y);
      expect(bottomOf(board.bottom!)).toBeLessThanOrEqual(board.shoes!.y);
    });

    it('starts at the very top and reaches the very bottom', () => {
      const board = place([top, bottom, shoes]);

      expect(board.top!.y).toBe(0);
      expect(bottomOf(board.shoes!)).toBeCloseTo(1, 4);
    });

    it('gives the shoes a shallower box than the garments', () => {
      // Shoes are wide and shallow; a tall box would letterbox to empty space.
      const board = place([top, bottom, shoes]);

      expect(board.shoes!.height).toBeLessThan(board.top!.height);
    });

    it('leaves a gap between stacked rows rather than butting them together', () => {
      const board = place([top, bottom]);

      expect(board.bottom!.y - bottomOf(board.top!)).toBeCloseTo(GAP, 4);
    });

    it('hands a missing row’s height to the rows that remain', () => {
      const withBottom = place([top, bottom, shoes]);
      const withoutBottom = place([top, shoes]);

      // No hole where the bottom would have been.
      expect(withoutBottom.top!.height).toBeGreaterThan(withBottom.top!.height);
      expect(bottomOf(withoutBottom.shoes!)).toBeCloseTo(1, 4);
    });

    it('fills the column with a single garment', () => {
      const board = place([top]);

      expect(board.top!).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
    });
  });

  describe('one-piece garments', () => {
    it('spans the space a top and a bottom would have shared', () => {
      const paired = place([top, bottom, shoes]);
      const onePiece = place([dress, shoes]);

      expect(onePiece.dress!.y).toBe(0);
      // The dress covers both rows and the gap between them.
      expect(bottomOf(onePiece.dress!)).toBeCloseTo(bottomOf(paired.bottom!), 3);
    });

    it('leaves the shoes exactly where a top-and-bottom board put them', () => {
      // The property the slot-then-merge allocation exists for. Giving a
      // one-piece its own row weight instead moved the shoes, because the
      // reclaimed gap got shared out rather than absorbed by the garment.
      const paired = place([top, bottom, shoes]);
      const onePiece = place([dress, shoes]);

      expect(onePiece.shoes!.y).toBeCloseTo(paired.shoes!.y, 4);
      expect(onePiece.shoes!.height).toBeCloseTo(paired.shoes!.height, 4);
    });

    it('still keeps the shoes underneath', () => {
      const board = place([dress, shoes]);

      expect(bottomOf(board.dress!)).toBeLessThanOrEqual(board.shoes!.y);
      expect(bottomOf(board.shoes!)).toBeCloseTo(1, 4);
    });

    it('shares the row rather than dropping a stray top', () => {
      // The picker offers one or the other, but a client can send both and
      // every item still has to land somewhere.
      const board = place([dress, top]);

      expect(Object.keys(board).sort()).toEqual(['dress', 'top']);
      expect(board.dress!.y).toBe(board.top!.y);
      expect(board.dress!.width).toBeCloseTo(board.top!.width, 4);
    });
  });

  describe('outerwear', () => {
    it('sits beside the top rather than replacing it', () => {
      const board = place([top, jacket, bottom]);

      // A jacket is worn over a shirt, so both are shown.
      expect(board.top!.y).toBe(board.jacket!.y);
      expect(board.top!.height).toBeCloseTo(board.jacket!.height, 4);
      expect(rightOf(board.top!)).toBeLessThanOrEqual(board.jacket!.x);
    });

    it('splits the upper row evenly and leaves a gap', () => {
      const board = place([top, jacket]);

      expect(board.top!.width).toBeCloseTo(board.jacket!.width, 4);
      expect(board.jacket!.x - rightOf(board.top!)).toBeCloseTo(GAP, 4);
    });

    it('takes the whole upper row when there is no top', () => {
      const board = place([jacket, bottom]);

      expect(board.jacket!.x).toBe(0);
      expect(board.jacket!.width).toBeCloseTo(board.bottom!.width, 4);
    });
  });

  describe('the side column', () => {
    it('sits to the right of the main column, clear of it', () => {
      const board = place([top, bag]);

      expect(board.bag!.x).toBeCloseTo(MAIN_COLUMN_WIDTH + COLUMN_GAP, 4);
      expect(board.bag!.x).toBeGreaterThanOrEqual(rightOf(board.top!));
      expect(rightOf(board.bag!)).toBeCloseTo(1, 4);
    });

    it('uses a wider gutter between columns than between stacked rows', () => {
      const board = place([top, bag]);

      expect(board.bag!.x - rightOf(board.top!)).toBeCloseTo(COLUMN_GAP, 4);
      expect(COLUMN_GAP).toBeGreaterThan(GAP);
    });

    it('narrows the main column to make room', () => {
      const alone = place([top]);
      const beside = place([top, bag]);

      expect(alone.top!.width).toBe(1);
      expect(beside.top!.width).toBeCloseTo(MAIN_COLUMN_WIDTH, 4);
    });

    it('puts the bag above the accessory cluster', () => {
      const board = place([bag, watch]);

      expect(board.bag!.y).toBe(0);
      expect(bottomOf(board.bag!)).toBeLessThanOrEqual(board.watch!.y);
      expect(board.bag!.height).toBeCloseTo(BAG_HEIGHT_WITH_ACCESSORIES, 4);
    });

    it('caps a lone bag instead of stretching it down the column', () => {
      const board = place([top, bag]);

      // A bag scaled to a full-height box reads as a mistake, not emphasis.
      expect(board.bag!.height).toBeCloseTo(LONE_BAG_MAX_HEIGHT, 4);
      expect(board.bag!.height).toBeLessThan(1);
    });
  });

  describe('the accessory cluster', () => {
    it('gives a single accessory the whole cluster area', () => {
      const board = place([top, watch]);

      expect(board.watch!.x).toBeCloseTo(MAIN_COLUMN_WIDTH + COLUMN_GAP, 4);
      expect(board.watch!.height).toBeCloseTo(1, 4);
    });

    it('puts two accessories side by side', () => {
      const board = place([top, watch, shades]);

      expect(board.watch!.y).toBeCloseTo(board.shades!.y, 4);
      expect(board.watch!.width).toBeCloseTo(board.shades!.width, 4);
      expect(board.shades!.x).toBeGreaterThan(board.watch!.x);
    });

    it('wraps onto a second row at three, rather than shrinking a single row', () => {
      const belt = item('belt', 'ACCESSORY');
      const board = place([top, watch, shades, belt]);

      expect(board.belt!.y).toBeGreaterThan(board.watch!.y);
      expect(board.belt!.x).toBeCloseTo(board.watch!.x, 4);
    });

    it('keeps the cluster inside the side column', () => {
      const belt = item('belt', 'ACCESSORY');
      const board = place([top, bag, watch, shades, belt]);

      for (const id of ['watch', 'shades', 'belt']) {
        expect(board[id]!.x).toBeGreaterThanOrEqual(MAIN_COLUMN_WIDTH + COLUMN_GAP - 1e-6);
        expect(rightOf(board[id]!)).toBeLessThanOrEqual(1 + 1e-6);
        expect(bottomOf(board[id]!)).toBeLessThanOrEqual(1 + 1e-6);
      }
    });
  });

  describe('an empty column is not reserved', () => {
    it('spreads accessories across the full width when nothing else is picked', () => {
      const board = place([watch, shades]);

      expect(board.watch!.x).toBe(0);
      expect(rightOf(board.shades!)).toBeCloseTo(1, 4);
    });

    it('spreads a lone bag from the left edge', () => {
      const board = place([bag]);

      expect(board.bag!.x).toBe(0);
      expect(board.bag!.width).toBe(1);
    });
  });

  describe('every box is renderable and storable', () => {
    const everyZone = BOARD_ZONES.map((zone, index) => item(`i${String(index)}`, zone));

    it('keeps every box inside the board', () => {
      const { placements } = computeBoardLayout(everyZone);

      for (const placement of placements) {
        expect(placement.x).toBeGreaterThanOrEqual(0);
        expect(placement.y).toBeGreaterThanOrEqual(0);
        expect(rightOf(placement)).toBeLessThanOrEqual(1 + 1e-6);
        expect(bottomOf(placement)).toBeLessThanOrEqual(1 + 1e-6);
      }
    });

    it('never produces a zero or negative size, which the API would reject', () => {
      // The server's layout schema requires width and height greater than 0.
      const crowded = Array.from({ length: 12 }, (_, index) => item(`a${String(index)}`, 'ACCESSORY'));

      for (const items of [everyZone, crowded, [top], [bag]]) {
        for (const placement of computeBoardLayout(items).placements) {
          expect(placement.width).toBeGreaterThan(0);
          expect(placement.height).toBeGreaterThan(0);
          expect(placement.width).toBeLessThanOrEqual(1);
          expect(placement.height).toBeLessThanOrEqual(1);
        }
      }
    });

    it('stays positive even with far more items in one zone than gaps allow', () => {
      // Enough boxes that the gaps alone would exceed the row width.
      const many = Array.from({ length: 80 }, (_, index) => item(`t${String(index)}`, 'TOP'));

      for (const placement of computeBoardLayout(many).placements) {
        expect(placement.width).toBeGreaterThan(0);
      }
    });

    it('rounds to four decimals, so a stored layout carries no float noise', () => {
      for (const placement of computeBoardLayout([top, bottom, shoes, bag, watch]).placements) {
        for (const value of [placement.x, placement.y, placement.width, placement.height]) {
          expect(value).toBe(Math.round(value * 1e4) / 1e4);
        }
      }
    });

    it('does not overlap the two columns', () => {
      const board = place([top, bottom, shoes, bag, watch]);

      const mainRight = Math.max(rightOf(board.top!), rightOf(board.bottom!), rightOf(board.shoes!));
      const sideLeft = Math.min(board.bag!.x, board.watch!.x);

      expect(mainRight).toBeLessThanOrEqual(sideLeft + 1e-6);
    });
  });

  it('skips a zone it does not recognise instead of throwing', () => {
    // A garment type added to the server but not yet to BOARD_ZONES would
    // otherwise take the whole board down with it.
    const unknown = { id: 'mystery', zone: 'TELEPORTER' } as unknown as BoardItem;
    const { placements } = computeBoardLayout([top, unknown]);

    expect(placements.map((p) => p.itemId)).toEqual(['top']);
  });
});
