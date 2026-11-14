import { describe, expect, it } from 'vitest';

import { ClothingCategory } from '../src/generated/prisma/enums.js';
import { recommendPackingCounts } from '../src/services/packing-guidance.service.js';
import { countPlannedByCategory } from '../src/services/trip.service.js';

describe('recommendPackingCounts', () => {
  it('packs about one top a day, capped at seven', () => {
    expect(recommendPackingCounts({ days: 3 })[ClothingCategory.TOP]).toBe(3);
    expect(recommendPackingCounts({ days: 21 })[ClothingCategory.TOP]).toBe(7);
  });

  it('packs one bottom per 2.5 days, between one and four', () => {
    const bottoms = (days: number) => recommendPackingCounts({ days })[ClothingCategory.BOTTOM];

    expect(bottoms(1)).toBe(1);
    expect(bottoms(5)).toBe(2);
    expect(bottoms(30)).toBe(4);
  });

  it('suggests two pairs of shoes up to five days and three beyond', () => {
    const shoes = (days: number) => recommendPackingCounts({ days })[ClothingCategory.FOOTWEAR];

    expect(shoes(5)).toBe(2);
    expect(shoes(6)).toBe(3);
  });

  it('packs a day of underwear plus a spare, capped', () => {
    const underwear = (days: number) =>
      recommendPackingCounts({ days })[ClothingCategory.UNDERWEAR];

    expect(underwear(3)).toBe(4);
    expect(underwear(40)).toBe(8);
  });

  it('gives no outerwear recommendation without a forecast', () => {
    expect(recommendPackingCounts({ days: 4 })[ClothingCategory.OUTERWEAR]).toBeUndefined();
  });

  it('scales outerwear with the minimum temperature', () => {
    const outerwear = (minC: number, rainLikely = false) =>
      recommendPackingCounts({ days: 4, weather: { minC, maxC: minC + 6, rainLikely } })[
        ClothingCategory.OUTERWEAR
      ];

    expect(outerwear(20)).toBeUndefined();
    expect(outerwear(12)).toBe(1);
    expect(outerwear(2)).toBe(2);
  });

  it('adds a rain layer on top, within the cap', () => {
    const weather = (minC: number) => ({ minC, maxC: minC + 5, rainLikely: true });

    expect(recommendPackingCounts({ days: 4, weather: weather(20) })[ClothingCategory.OUTERWEAR]).toBe(1);
    expect(recommendPackingCounts({ days: 4, weather: weather(12) })[ClothingCategory.OUTERWEAR]).toBe(2);
    expect(recommendPackingCounts({ days: 4, weather: weather(0) })[ClothingCategory.OUTERWEAR]).toBe(3);
  });

  it('suggests a warm accessory only when it is cold', () => {
    const accessory = (minC: number) =>
      recommendPackingCounts({ days: 4, weather: { minC, maxC: minC + 5, rainLikely: false } })[
        ClothingCategory.ACCESSORY
      ];

    expect(accessory(3)).toBe(1);
    expect(accessory(10)).toBeUndefined();
  });

  it('never recommends categories it has no rule for', () => {
    const counts = recommendPackingCounts({ days: 10 });

    expect(counts[ClothingCategory.DRESS]).toBeUndefined();
    expect(counts[ClothingCategory.ACTIVEWEAR]).toBeUndefined();
  });
});

describe('countPlannedByCategory', () => {
  it('counts a garment once even when it is also inside an outfit', () => {
    const shirt = { id: 'shirt', category: ClothingCategory.TOP };
    const jeans = { id: 'jeans', category: ClothingCategory.BOTTOM };

    const counts = countPlannedByCategory([
      { packed: false, items: [shirt] },
      { packed: false, items: [shirt, jeans] },
    ]);

    expect(counts[ClothingCategory.TOP]).toBe(1);
    expect(counts[ClothingCategory.BOTTOM]).toBe(1);
  });
});
