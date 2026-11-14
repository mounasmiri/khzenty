import { describe, expect, it } from 'vitest';

import type { OutfitGarment } from '@/features/outfits/types';
import {
  countLaundryGarments,
  categoryProgress,
  daysLabel,
  formatDateRange,
  groupEntries,
  isTargetMet,
  OUTFITS_GROUP,
  parseCalendarDate,
  percent,
} from './trip-format';
import type { TripEntry } from './types';

function garment(id: string, category: string, laundry = false): OutfitGarment {
  return {
    id,
    name: id,
    category,
    type: 'OTHER',
    color: null,
    imageUrl: null,
    laundryStatus: laundry ? 'IN_LAUNDRY' : 'CLEAN',
  };
}

const itemEntry = (g: OutfitGarment): TripEntry => ({ id: `e-${g.id}`, packed: false, item: g, outfit: null });
const outfitEntry = (id: string, items: OutfitGarment[]): TripEntry => ({
  id: `e-${id}`,
  packed: false,
  item: null,
  outfit: { id, name: id, occasions: [], items },
});

describe('parseCalendarDate', () => {
  it('keeps the calendar day in the local timezone', () => {
    const date = parseCalendarDate('2026-06-10');

    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 5, 10]);
  });
});

describe('formatDateRange', () => {
  it('shows a range, and a single date for a one-day trip', () => {
    expect(formatDateRange('2026-06-10', '2026-06-14')).toBe('10 Jun – 14 Jun 2026');
    expect(formatDateRange('2026-06-10', '2026-06-10')).toBe('10 Jun 2026');
  });
});

describe('daysLabel and percent', () => {
  it('pluralises', () => {
    expect(daysLabel(1)).toBe('1 day');
    expect(daysLabel(4)).toBe('4 days');
  });

  it('caps at 100 and survives an empty whole', () => {
    expect(percent(3, 6)).toBe(50);
    expect(percent(9, 6)).toBe(100);
    expect(percent(0, 0)).toBe(0);
  });
});

describe('groupEntries', () => {
  it('orders categories as given and puts outfits in their own last group', () => {
    const groups = groupEntries(
      [
        outfitEntry('o1', []),
        itemEntry(garment('boots', 'FOOTWEAR')),
        itemEntry(garment('tee', 'TOP')),
        itemEntry(garment('odd', 'NEW_CATEGORY')),
      ],
      ['TOP', 'BOTTOM', 'FOOTWEAR'],
    );

    expect(groups.map((g) => g.key)).toEqual(['TOP', 'FOOTWEAR', 'NEW_CATEGORY', OUTFITS_GROUP]);
  });

  it('drops empty groups', () => {
    expect(groupEntries([], ['TOP'])).toEqual([]);
  });
});

describe('countLaundryGarments', () => {
  it('counts a washing garment once, whether listed directly or inside an outfit', () => {
    const shirt = garment('shirt', 'TOP', true);

    expect(
      countLaundryGarments([
        itemEntry(shirt),
        outfitEntry('o', [shirt, garment('jeans', 'BOTTOM', true), garment('hat', 'ACCESSORY')]),
      ]),
    ).toBe(2);
  });
});

describe('isTargetMet', () => {
  it('treats meeting or exceeding as met, and no target as not met', () => {
    expect(isTargetMet({ category: 'TOP', recommended: 3, planned: 3, manual: 0 })).toBe(true);
    expect(isTargetMet({ category: 'TOP', recommended: 3, planned: 5, manual: 0 })).toBe(true);
    expect(isTargetMet({ category: 'TOP', recommended: 3, planned: 1, manual: 0 })).toBe(false);
    expect(isTargetMet({ category: 'DRESS', recommended: null, planned: 2, manual: 0 })).toBe(false);
  });
});

describe('categoryProgress', () => {
  it('adds the manual count to the wardrobe count', () => {
    // Tops 3/7: two from the app, one counted by hand.
    expect(categoryProgress({ category: 'TOP', recommended: 7, planned: 2, manual: 1 })).toBe(3);
    // Underwear 5/8 with nothing in the app.
    expect(categoryProgress({ category: 'UNDERWEAR', recommended: 8, planned: 0, manual: 5 })).toBe(5);
  });

  it('lets manual counts complete a target the wardrobe alone would not', () => {
    expect(isTargetMet({ category: 'UNDERWEAR', recommended: 5, planned: 0, manual: 2 })).toBe(false);
    expect(isTargetMet({ category: 'UNDERWEAR', recommended: 5, planned: 1, manual: 4 })).toBe(true);
  });
});
