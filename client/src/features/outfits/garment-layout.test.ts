import { describe, expect, it } from 'vitest';

import { LAYOUT_VERSION } from './board-layout';
import { layoutForGarments, layoutMatchesGarments } from './garment-layout';
import type { BoardZoneMap } from './types';

const zones: BoardZoneMap = {
  HOODIE: 'TOP',
  JEANS: 'BOTTOM',
  SNEAKERS: 'FOOTWEAR',
  BAG: 'BAG',
  WATCH: 'ACCESSORY',
};

const hoodie = { id: 'a', type: 'HOODIE' };
const jeans = { id: 'b', type: 'JEANS' };
const sneakers = { id: 'c', type: 'SNEAKERS' };

describe('layoutForGarments', () => {
  it('resolves each garment’s zone and places it', () => {
    const layout = layoutForGarments([hoodie, jeans, sneakers], zones);

    expect(layout.version).toBe(LAYOUT_VERSION);
    expect(layout.placements.map((p) => p.itemId).sort()).toEqual(['a', 'b', 'c']);
  });

  it('orders by zone, not by the order garments were picked', () => {
    const picked = layoutForGarments([sneakers, hoodie], zones);
    const hoodiePlacement = picked.placements.find((p) => p.itemId === 'a');
    const shoePlacement = picked.placements.find((p) => p.itemId === 'c');

    expect(hoodiePlacement!.y).toBeLessThan(shoePlacement!.y);
  });

  it('leaves out a garment whose type has no zone', () => {
    // Happens when the server knows a type this client's build does not; the
    // alternative is placing it at a default position over something else.
    const layout = layoutForGarments([hoodie, { id: 'x', type: 'JETPACK' }], zones);

    expect(layout.placements.map((p) => p.itemId)).toEqual(['a']);
  });

  it('places nothing when the zone map failed to load', () => {
    expect(layoutForGarments([hoodie, jeans], {}).placements).toEqual([]);
  });

  it('produces a layout the API will accept', () => {
    // The server requires width and height greater than 0 and at most 1.
    for (const placement of layoutForGarments([hoodie, jeans, sneakers], zones).placements) {
      expect(placement.width).toBeGreaterThan(0);
      expect(placement.height).toBeGreaterThan(0);
      expect(placement.width).toBeLessThanOrEqual(1);
      expect(placement.height).toBeLessThanOrEqual(1);
    }
  });
});

describe('layoutMatchesGarments', () => {
  const layout = layoutForGarments([hoodie, jeans], zones);

  it('matches the garments it was built from', () => {
    expect(layoutMatchesGarments(layout, [hoodie, jeans])).toBe(true);
  });

  it('ignores the order of the garments', () => {
    expect(layoutMatchesGarments(layout, [jeans, hoodie])).toBe(true);
  });

  it('rejects a layout missing a garment added since', () => {
    // Otherwise the board would have a hole where the new garment belongs.
    expect(layoutMatchesGarments(layout, [hoodie, jeans, sneakers])).toBe(false);
  });

  it('rejects a layout holding a garment that has been removed', () => {
    // Otherwise a placement would point at nothing.
    expect(layoutMatchesGarments(layout, [hoodie])).toBe(false);
  });

  it('rejects a layout for an entirely different garment', () => {
    expect(layoutMatchesGarments(layout, [sneakers, hoodie])).toBe(false);
  });

  it('treats no layout as no match, so the board computes one', () => {
    expect(layoutMatchesGarments(null, [hoodie])).toBe(false);
    expect(layoutMatchesGarments(undefined, [hoodie])).toBe(false);
  });

  it('matches an empty layout against an empty board', () => {
    expect(layoutMatchesGarments({ version: LAYOUT_VERSION, placements: [] }, [])).toBe(true);
  });

  it('does not let a duplicate placement stand in for a missing garment', () => {
    // Two placements, one garment id: a size comparison alone would pass this.
    const duplicated = {
      version: LAYOUT_VERSION as typeof LAYOUT_VERSION,
      placements: [
        { itemId: 'a', x: 0, y: 0, width: 0.5, height: 0.5 },
        { itemId: 'a', x: 0.5, y: 0, width: 0.5, height: 0.5 },
      ],
    };

    expect(layoutMatchesGarments(duplicated, [hoodie, jeans])).toBe(false);
  });
});
