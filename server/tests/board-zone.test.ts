import { describe, expect, it } from 'vitest';

import { ClothingCategory, ClothingType } from '../src/generated/prisma/enums.js';
import {
  BOARD_ZONE_BY_TYPE,
  BoardZone,
  CATEGORY_BY_TYPE,
  boardZoneForType,
  categoryForType,
} from '../src/lib/clothing-taxonomy.js';

/**
 * Pure map tests — no database, no HTTP.
 *
 * The outfit board reads a zone for every garment it is asked to display. A
 * type with no zone would not raise an error; it would quietly fall out of the
 * layout, and the user would see an item they picked simply missing from the
 * board. The totality check below is the thing that prevents that, and the
 * compiler only enforces it while `BOARD_ZONE_BY_TYPE` stays a total `Record`.
 */
describe('board zones', () => {
  const allTypes = Object.values(ClothingType);
  const allZones = Object.values(BoardZone);

  it('gives every clothing type a zone', () => {
    for (const type of allTypes) {
      expect(allZones, `${type} has no board zone`).toContain(boardZoneForType(type));
    }
  });

  it('maps exactly the types in the enum — no stale keys', () => {
    // A type removed from the schema but left in the map would keep passing the
    // check above while silently claiming a zone that can never be reached.
    expect(Object.keys(BOARD_ZONE_BY_TYPE).sort()).toEqual([...allTypes].sort());
  });

  it('leaves no zone unreachable', () => {
    // Every zone the layout function handles must be producible from some type,
    // or the board has code for a slot nothing can ever fill.
    for (const zone of allZones) {
      const types = allTypes.filter((type) => boardZoneForType(type) === zone);
      expect(types.length, `no clothing type maps to ${zone}`).toBeGreaterThan(0);
    }
  });

  describe('the accessories the board has to place', () => {
    it('gives a bag its own zone', () => {
      expect(boardZoneForType(ClothingType.BAG)).toBe(BoardZone.BAG);
    });

    it('puts sunglasses, watches and jewellery in the accessory cluster', () => {
      expect(boardZoneForType(ClothingType.SUNGLASSES)).toBe(BoardZone.ACCESSORY);
      expect(boardZoneForType(ClothingType.WATCH)).toBe(BoardZone.ACCESSORY);
      expect(boardZoneForType(ClothingType.JEWELRY)).toBe(BoardZone.ACCESSORY);
    });

    it('zones all four, so none can be dropped from a board', () => {
      // The explicit requirement, stated as one assertion.
      for (const type of [
        ClothingType.BAG,
        ClothingType.SUNGLASSES,
        ClothingType.WATCH,
        ClothingType.JEWELRY,
      ]) {
        expect(allZones, `${type} has no board zone`).toContain(boardZoneForType(type));
      }
    });
  });

  describe('zone is not a rename of category', () => {
    it('splits activewear across the top and bottom halves', () => {
      // Same category, opposite ends of the board.
      expect(categoryForType(ClothingType.SPORTS_TOP)).toBe(ClothingCategory.ACTIVEWEAR);
      expect(categoryForType(ClothingType.SPORTS_BOTTOM)).toBe(ClothingCategory.ACTIVEWEAR);
      expect(boardZoneForType(ClothingType.SPORTS_TOP)).toBe(BoardZone.TOP);
      expect(boardZoneForType(ClothingType.SPORTS_BOTTOM)).toBe(BoardZone.BOTTOM);
    });

    it('sends socks down to the shoes despite their category', () => {
      expect(categoryForType(ClothingType.SOCKS)).toBe(ClothingCategory.UNDERWEAR);
      expect(boardZoneForType(ClothingType.SOCKS)).toBe(BoardZone.FOOTWEAR);
    });

    it('separates a bag from the small accessories it shares a category with', () => {
      expect(categoryForType(ClothingType.BAG)).toBe(ClothingCategory.ACCESSORY);
      expect(categoryForType(ClothingType.SUNGLASSES)).toBe(ClothingCategory.ACCESSORY);
      expect(boardZoneForType(ClothingType.BAG)).not.toBe(
        boardZoneForType(ClothingType.SUNGLASSES),
      );
    });

    it('hangs a robe like outerwear, not like sleepwear', () => {
      expect(categoryForType(ClothingType.ROBE)).toBe(ClothingCategory.SLEEPWEAR);
      expect(boardZoneForType(ClothingType.ROBE)).toBe(BoardZone.OUTERWEAR);
    });

    it('treats dresses, jumpsuits, swimsuits and pyjamas as one pieces', () => {
      // These replace the top/bottom pair rather than stacking with it.
      for (const type of [
        ClothingType.DRESS,
        ClothingType.JUMPSUIT,
        ClothingType.SWIMSUIT,
        ClothingType.PAJAMAS,
      ]) {
        expect(boardZoneForType(type)).toBe(BoardZone.ONE_PIECE);
      }
    });
  });

  describe('WATCH', () => {
    it('derives the ACCESSORY category', () => {
      expect(categoryForType(ClothingType.WATCH)).toBe(ClothingCategory.ACCESSORY);
      expect(CATEGORY_BY_TYPE[ClothingType.WATCH]).toBe(ClothingCategory.ACCESSORY);
    });

    it('exists in the enum the generated client was built from', () => {
      // Catches a schema edit that was never migrated and generated.
      expect(allTypes).toContain('WATCH');
    });
  });
});
