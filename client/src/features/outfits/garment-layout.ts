import { type BoardItem, type BoardLayout, computeBoardLayout } from './board-layout';
import type { BoardZoneMap } from './types';

/** Just enough of a garment to place it. */
export interface PlaceableGarment {
  id: string;
  type: string;
}

/**
 * Resolves each garment's zone from the taxonomy, then lays the board out.
 *
 * Shared by the board component and the save path deliberately: whatever is on
 * screen is exactly what gets stored, because both go through this. Computing
 * the saved layout separately would let the two drift, and the drift would
 * only show up the next time the outfit was opened.
 *
 * A garment whose type has no zone is left out rather than placed at a default
 * position on top of something else. That happens when the server knows a type
 * this client's build does not.
 */
export function layoutForGarments(
  garments: readonly PlaceableGarment[],
  zones: BoardZoneMap,
): BoardLayout {
  const items: BoardItem[] = garments.flatMap((garment) => {
    const zone = zones[garment.type];

    return zone ? [{ id: garment.id, zone }] : [];
  });

  return computeBoardLayout(items);
}

/**
 * Whether a stored layout still describes exactly this set of garments.
 *
 * A saved layout is only trustworthy while membership matches. One garment
 * added since and the board would have a hole; one removed and a placement
 * would point at nothing. In either case recomputing is the honest answer, so
 * this is the check that decides.
 */
export function layoutMatchesGarments(
  layout: BoardLayout | null | undefined,
  garments: readonly PlaceableGarment[],
): boolean {
  if (!layout) {
    return false;
  }

  const placed = new Set(layout.placements.map((placement) => placement.itemId));

  // Sizes equal and every garment placed — which together rule out both a
  // stray placement and a duplicate one.
  return placed.size === garments.length && garments.every((garment) => placed.has(garment.id));
}
