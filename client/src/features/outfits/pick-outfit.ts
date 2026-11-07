import type { Outfit } from './types';

/** The part of an outfit the picker needs. */
type Pickable = Pick<Outfit, 'id'> & { items: readonly { laundryStatus: string }[] };

/**
 * Picks a random outfit that is ready to wear: it has garments, and every one
 * of them is CLEAN. Returns null when nothing qualifies.
 *
 * `previousId` is the last outfit suggested. It is skipped when another ready
 * outfit exists, so asking twice does not repeat itself, but it is still
 * returned if it is the only one left.
 *
 * `random` is injectable so the choice is deterministic in tests.
 */
export function pickOutfitForToday<T extends Pickable>(
  outfits: readonly T[],
  random: () => number = Math.random,
  previousId?: string | null,
): T | null {
  const ready = outfits.filter(
    (outfit) =>
      outfit.items.length > 0 && outfit.items.every((item) => item.laundryStatus === 'CLEAN'),
  );

  const fresh = ready.filter((outfit) => outfit.id !== previousId);
  const pool = fresh.length > 0 ? fresh : ready;

  if (pool.length === 0) {
    return null;
  }

  // Clamped so a `random()` of exactly 1 cannot index past the end.
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));

  return pool[index] ?? null;
}
