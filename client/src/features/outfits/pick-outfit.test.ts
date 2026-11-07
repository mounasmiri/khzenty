import { describe, expect, it } from 'vitest';

import { pickOutfitForToday } from './pick-outfit';

const outfit = (id: string, ...statuses: string[]) => ({
  id,
  items: statuses.map((laundryStatus) => ({ laundryStatus })),
});

describe('pickOutfitForToday', () => {
  it('picks only clean outfits', () => {
    const outfits = [outfit('a', 'IN_LAUNDRY'), outfit('b', 'CLEAN', 'CLEAN')];

    for (const r of [0, 0.5, 0.99]) {
      expect(pickOutfitForToday(outfits, () => r)?.id).toBe('b');
    }
  });

  it('returns null when none qualify', () => {
    expect(pickOutfitForToday([])).toBeNull();
    expect(pickOutfitForToday([outfit('a', 'IN_LAUNDRY')])).toBeNull();
    expect(pickOutfitForToday([outfit('empty')])).toBeNull();
  });

  it('skips an outfit with one garment in the laundry', () => {
    expect(pickOutfitForToday([outfit('a', 'CLEAN', 'IN_LAUNDRY', 'CLEAN')])).toBeNull();
  });

  it('avoids repeating the previous pick when another is ready', () => {
    const outfits = [outfit('a', 'CLEAN'), outfit('b', 'CLEAN')];

    expect(pickOutfitForToday(outfits, () => 0, 'a')?.id).toBe('b');
    expect(pickOutfitForToday(outfits, () => 0.99, 'b')?.id).toBe('a');
  });

  it('repeats the previous pick when it is the only one ready', () => {
    const outfits = [outfit('a', 'CLEAN'), outfit('b', 'IN_LAUNDRY')];

    expect(pickOutfitForToday(outfits, () => 0, 'a')?.id).toBe('a');
  });

  it('is deterministic with an injected random', () => {
    const outfits = [outfit('a', 'CLEAN'), outfit('b', 'CLEAN'), outfit('c', 'CLEAN')];

    expect(pickOutfitForToday(outfits, () => 0)?.id).toBe('a');
    expect(pickOutfitForToday(outfits, () => 0.5)?.id).toBe('b');
    expect(pickOutfitForToday(outfits, () => 0.99)?.id).toBe('c');
    expect(pickOutfitForToday(outfits, () => 1)?.id).toBe('c');
  });
});
