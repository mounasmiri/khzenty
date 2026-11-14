import { ClothingCategory } from '../generated/prisma/enums.js';

/**
 * Every tunable number behind the packing guidance, in one place.
 *
 * These are rules of thumb, not requirements: the UI shows them as a target and
 * never stops the user packing more or fewer.
 */
export const PACKING_RULES = {
  /** Tops: about one per day, capped — long trips assume re-wear and laundry. */
  tops: { perDay: 1, max: 7 },
  /** Bottoms: one per `daysPerItem` days, at least one. */
  bottoms: { daysPerItem: 2.5, min: 1, max: 4 },
  /** Footwear: two pairs for a short trip, three beyond it. */
  footwear: { shortTripMaxDays: 5, shortTripCount: 2, longTripCount: 3 },
  outerwear: {
    /** Below this minimum temperature (°C) one warm layer is suggested. */
    coolBelowC: 15,
    /** Below this one, two layers. */
    coldBelowC: 5,
    /** Added on top when rain is likely. */
    rainLayer: 1,
    max: 3,
  },
  /** Underwear and socks: one per day plus spares, capped. */
  underwear: { perDay: 1, spare: 1, max: 8 },
  /** Warm accessories (scarf, gloves, hat) only when it is properly cold. */
  accessories: { coldBelowC: 5, count: 1 },
} as const;

/** The slice of a forecast the guidance needs. */
export interface WeatherForGuidance {
  minC: number;
  maxC: number;
  rainLikely: boolean;
}

export interface PackingGuidanceInput {
  /** Trip length in days, counting both the first and last. */
  days: number;
  /** Omit when there is no forecast — rules that need it are then skipped. */
  weather?: WeatherForGuidance | null;
}

/** Categories with no entry here have no recommendation. */
export type RecommendedCounts = Partial<Record<ClothingCategory, number>>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * How many of each category to pack for a trip.
 *
 * Pure: no I/O, no clock, no database — the same input always gives the same
 * output, which is what makes it cheap to unit test. Categories are the real
 * `ClothingCategory` members; ones with no rule (dresses, activewear, …) are
 * simply absent from the result.
 */
export function recommendPackingCounts(input: PackingGuidanceInput): RecommendedCounts {
  const days = Math.max(1, Math.floor(input.days));
  const weather = input.weather ?? null;
  const rules = PACKING_RULES;

  const counts: RecommendedCounts = {
    [ClothingCategory.TOP]: clamp(Math.ceil(days * rules.tops.perDay), 1, rules.tops.max),
    [ClothingCategory.BOTTOM]: clamp(
      Math.ceil(days / rules.bottoms.daysPerItem),
      rules.bottoms.min,
      rules.bottoms.max,
    ),
    [ClothingCategory.FOOTWEAR]:
      days <= rules.footwear.shortTripMaxDays
        ? rules.footwear.shortTripCount
        : rules.footwear.longTripCount,
    [ClothingCategory.UNDERWEAR]: Math.min(
      days * rules.underwear.perDay + rules.underwear.spare,
      rules.underwear.max,
    ),
  };

  if (weather) {
    let outerwear = 0;

    if (weather.minC < rules.outerwear.coldBelowC) outerwear = 2;
    else if (weather.minC < rules.outerwear.coolBelowC) outerwear = 1;

    if (weather.rainLikely) outerwear += rules.outerwear.rainLayer;

    if (outerwear > 0) {
      counts[ClothingCategory.OUTERWEAR] = Math.min(outerwear, rules.outerwear.max);
    }

    if (weather.minC < rules.accessories.coldBelowC) {
      counts[ClothingCategory.ACCESSORY] = rules.accessories.count;
    }
  }

  return counts;
}
