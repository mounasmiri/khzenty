/**
 * Mirrors the server's `BoardZone`. The *mapping* from garment type to zone is
 * never duplicated here — it arrives with `/api/taxonomy` as `boardZones`, so
 * only the set of zone names is stated twice, and a mismatch is a type error at
 * every call site rather than a silent gap.
 */
export const BOARD_ZONES = [
  'TOP',
  'BOTTOM',
  'ONE_PIECE',
  'OUTERWEAR',
  'FOOTWEAR',
  'BAG',
  'ACCESSORY',
] as const;

export type BoardZone = (typeof BOARD_ZONES)[number];

export interface BoardItem {
  id: string;
  zone: BoardZone;
}

/** One garment's box, as a fraction of the board. Matches the server's schema. */
export interface BoardPlacement {
  itemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Must match `LAYOUT_VERSION` in the server's outfit schema. */
export const LAYOUT_VERSION = 1;

export interface BoardLayout {
  version: typeof LAYOUT_VERSION;
  placements: BoardPlacement[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Composition constants -------------------------------------------------
//
// Named rather than inlined because they are the board's whole visual design,
// and the tests assert relationships between them rather than their values.

/** Breathing room between boxes, as a fraction of the board. */
export const GAP = 0.02;

/** Wider gutter between the two columns than between stacked boxes. */
export const COLUMN_GAP = 0.04;

/** The main column's share of the width when the side column is also in use. */
export const MAIN_COLUMN_WIDTH = 0.62;

/**
 * Row weights in the main column. Shoes get less height than a garment because
 * they are wide and shallow, so a tall box would letterbox to mostly empty
 * surface.
 */
export const ROW_WEIGHT = {
  upper: 1.1,
  lower: 1.1,
  footwear: 0.8,
} as const;

/** A bag's height when it shares the side column with accessories. */
export const BAG_HEIGHT_WITH_ACCESSORIES = 0.3;

/**
 * A lone bag's height. Capped, rather than stretched down the whole column: a
 * bag scaled to a full-height box reads as a mistake, not as emphasis.
 */
export const LONE_BAG_MAX_HEIGHT = 0.4;

/** Columns in the accessory cluster. Two from the second item onward. */
export const ACCESSORY_COLUMNS = 2;

const MAIN_ZONES: readonly BoardZone[] = ['TOP', 'OUTERWEAR', 'ONE_PIECE', 'BOTTOM', 'FOOTWEAR'];
const SIDE_ZONES: readonly BoardZone[] = ['BAG', 'ACCESSORY'];

/** Rounded so stored layouts and test expectations are free of float noise. */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/**
 * Groups items by zone, preserving input order within each.
 *
 * Returns an entry for every zone, so callers index without checking — a
 * missing zone is an empty array, never undefined.
 */
function groupByZone(items: readonly BoardItem[]): Record<BoardZone, BoardItem[]> {
  const grouped = Object.fromEntries(BOARD_ZONES.map((zone) => [zone, [] as BoardItem[]])) as Record<
    BoardZone,
    BoardItem[]
  >;

  for (const item of items) {
    // An unknown zone would otherwise push onto undefined. Skipping is the
    // right failure here: the board renders what it understands rather than
    // throwing on a garment type added to the server but not yet to this list.
    grouped[item.zone]?.push(item);
  }

  return grouped;
}

/**
 * Splits a row into equal side-by-side boxes.
 *
 * A zone normally holds one garment, but nothing stops a caller passing two
 * tops, and the function has to stay total. Sharing the row is the answer that
 * needs no special case: one item fills it, two take half each.
 */
function splitRow(rect: Rect, count: number): Rect[] {
  if (count <= 0) {
    return [];
  }

  const gaps = GAP * (count - 1);
  // Enough boxes and the gaps alone would exceed the row. Dropping them keeps
  // every width positive, which the layout schema requires.
  const width = gaps < rect.width ? (rect.width - gaps) / count : rect.width / count;
  const step = gaps < rect.width ? width + GAP : width;

  return Array.from({ length: count }, (_, index) => ({
    x: rect.x + index * step,
    y: rect.y,
    width,
    height: rect.height,
  }));
}

/**
 * Stacks rows down a column, dividing the leftover height by weight.
 *
 * Only rows with content are ever passed in, so an outfit with no bottom gives
 * its height to the top and the shoes instead of leaving a hole where the
 * bottom would have been.
 */
function stackRows(rect: Rect, weights: readonly number[]): Rect[] {
  const gaps = GAP * (weights.length - 1);
  const available = Math.max(0, rect.height - gaps);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let y = rect.y;

  return weights.map((weight) => {
    const height = totalWeight > 0 ? (available * weight) / totalWeight : 0;
    const row = { x: rect.x, y, width: rect.width, height };
    y += height + GAP;

    return row;
  });
}

/**
 * Lays the accessory cluster out as a grid: one column for a single item, two
 * from then on. A single row of five watches would scale each one to nothing.
 */
function clusterCells(rect: Rect, count: number): Rect[] {
  if (count <= 0) {
    return [];
  }

  const columns = Math.min(count, ACCESSORY_COLUMNS);
  const rows = Math.ceil(count / columns);

  const cellWidth = (rect.width - GAP * (columns - 1)) / columns;
  const cellHeight = (rect.height - GAP * (rows - 1)) / rows;

  return Array.from({ length: count }, (_, index) => ({
    x: rect.x + (index % columns) * (cellWidth + GAP),
    y: rect.y + Math.floor(index / columns) * (cellHeight + GAP),
    width: cellWidth,
    height: cellHeight,
  }));
}

/**
 * Turns a set of garments into board positions.
 *
 * Pure: same items in, same positions out, no DOM and no measurement. That is
 * what makes the composition testable, and it is possible only because
 * `object-contain` handles the other half of the job — this function decides
 * each garment's *box*, and the browser fits the cutout inside it with its own
 * aspect ratio intact. Nothing here needs to know how tall a given photo is.
 *
 * The composition:
 *
 *   - **Main column**, the larger one: top above bottom, or a one-piece
 *     spanning both, with shoes beneath. Outerwear shares the upper row with
 *     the top rather than replacing it, since a jacket is worn over a shirt.
 *   - **Side column**: the bag, then a cluster of small accessories below it.
 *
 * A column with nothing in it is not reserved — a board of only accessories
 * uses the full width rather than hugging one edge.
 */
export function computeBoardLayout(items: readonly BoardItem[]): BoardLayout {
  const byZone = groupByZone(items);

  const hasMain = MAIN_ZONES.some((zone) => byZone[zone].length > 0);
  const hasSide = SIDE_ZONES.some((zone) => byZone[zone].length > 0);

  const bothColumns = hasMain && hasSide;
  const mainRect: Rect = {
    x: 0,
    y: 0,
    width: bothColumns ? MAIN_COLUMN_WIDTH : 1,
    height: 1,
  };
  const sideRect: Rect = bothColumns
    ? {
        x: MAIN_COLUMN_WIDTH + COLUMN_GAP,
        y: 0,
        width: 1 - MAIN_COLUMN_WIDTH - COLUMN_GAP,
        height: 1,
      }
    : { x: 0, y: 0, width: 1, height: 1 };

  const placements: BoardPlacement[] = [];

  // --- Main column ---------------------------------------------------------

  // A one-piece covers the torso and the legs, so it claims BOTH canonical
  // slots. Allocating the slots first and merging afterwards — rather than
  // giving a one-piece its own weight — is what makes swapping a top and a
  // bottom for a dress leave the shoes exactly where they were. A single
  // merged weight cannot do that: with one row fewer there is also one gap
  // fewer, and that reclaimed gap would be shared out with the shoes instead
  // of going to the garment that absorbed it.
  const onePiece = byZone.ONE_PIECE;
  const isOnePiece = onePiece.length > 0;

  // The picker offers a one-piece or a top/bottom pair, never both, but a
  // client can send both and every item still has to land somewhere. They
  // share the merged slot — total beats tidy for client-supplied input.
  const upperItems = isOnePiece
    ? [...onePiece, ...byZone.OUTERWEAR, ...byZone.TOP, ...byZone.BOTTOM]
    : [...byZone.TOP, ...byZone.OUTERWEAR];

  const hasUpper = isOnePiece || upperItems.length > 0;
  const hasLower = isOnePiece || byZone.BOTTOM.length > 0;

  const slots: { key: 'upper' | 'lower' | 'footwear'; weight: number }[] = [];

  if (hasUpper) slots.push({ key: 'upper', weight: ROW_WEIGHT.upper });
  if (hasLower) slots.push({ key: 'lower', weight: ROW_WEIGHT.lower });
  if (byZone.FOOTWEAR.length > 0) slots.push({ key: 'footwear', weight: ROW_WEIGHT.footwear });

  const slotRects = stackRows(
    mainRect,
    slots.map((slot) => slot.weight),
  );

  const rectFor = (key: 'upper' | 'lower' | 'footwear'): Rect | undefined => {
    const index = slots.findIndex((slot) => slot.key === key);

    return index === -1 ? undefined : slotRects[index];
  };

  const fill = (rect: Rect | undefined, rowItems: readonly BoardItem[]): void => {
    if (!rect || rowItems.length === 0) return;

    splitRow(rect, rowItems.length).forEach((cell, index) => {
      const rowItem = rowItems[index];

      if (rowItem) {
        placements.push({ itemId: rowItem.id, ...roundRect(cell) });
      }
    });
  };

  if (isOnePiece) {
    const upperRect = rectFor('upper');
    const lowerRect = rectFor('lower');

    if (upperRect && lowerRect) {
      // Spans both slots and the gap between them, so the row below is
      // untouched by the swap.
      fill(
        {
          x: upperRect.x,
          y: upperRect.y,
          width: upperRect.width,
          height: lowerRect.y + lowerRect.height - upperRect.y,
        },
        upperItems,
      );
    } else {
      fill(upperRect ?? lowerRect, upperItems);
    }
  } else {
    fill(rectFor('upper'), upperItems);
    fill(rectFor('lower'), byZone.BOTTOM);
  }

  fill(rectFor('footwear'), byZone.FOOTWEAR);

  // --- Side column ---------------------------------------------------------

  const bags = byZone.BAG;
  const accessories = byZone.ACCESSORY;

  if (bags.length > 0 && accessories.length > 0) {
    const bagHeight = sideRect.height * BAG_HEIGHT_WITH_ACCESSORIES;

    splitRow({ ...sideRect, height: bagHeight }, bags.length).forEach((cell, index) => {
      const bag = bags[index];
      if (bag) placements.push({ itemId: bag.id, ...roundRect(cell) });
    });

    const clusterRect: Rect = {
      x: sideRect.x,
      y: sideRect.y + bagHeight + GAP,
      width: sideRect.width,
      height: sideRect.height - bagHeight - GAP,
    };

    clusterCells(clusterRect, accessories.length).forEach((cell, index) => {
      const accessory = accessories[index];
      if (accessory) placements.push({ itemId: accessory.id, ...roundRect(cell) });
    });
  } else if (bags.length > 0) {
    const height = Math.min(sideRect.height, LONE_BAG_MAX_HEIGHT);

    splitRow({ ...sideRect, height }, bags.length).forEach((cell, index) => {
      const bag = bags[index];
      if (bag) placements.push({ itemId: bag.id, ...roundRect(cell) });
    });
  } else if (accessories.length > 0) {
    clusterCells(sideRect, accessories.length).forEach((cell, index) => {
      const accessory = accessories[index];
      if (accessory) placements.push({ itemId: accessory.id, ...roundRect(cell) });
    });
  }

  return { version: LAYOUT_VERSION, placements };
}

function roundRect(rect: Rect): Rect {
  return {
    x: round(rect.x),
    y: round(rect.y),
    width: round(rect.width),
    height: round(rect.height),
  };
}
