import type { OutfitGarment } from '@/features/outfits/types';
import type { CategoryGuidance, TripEntry } from './types';

/**
 * `YYYY-MM-DD` as a local `Date`.
 *
 * Built from the parts rather than `new Date('2026-06-10')`, which parses as
 * UTC midnight and shows as the 9th in any timezone west of Greenwich.
 */
export function parseCalendarDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

/** "10 Jun – 14 Jun 2026", or "10 Jun 2026" for a single day. */
export function formatDateRange(start: string, end: string, locale = 'en-GB'): string {
  const from = parseCalendarDate(start);
  const to = parseCalendarDate(end);
  const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const full = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return start === end ? full.format(to) : `${short.format(from)} – ${full.format(to)}`;
}

/** "Wed 10 Jun" for the weather strip. */
export function formatWeatherDay(date: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parseCalendarDate(date));
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${String(days)} days`;
}

/** Whole-number percentage, never past 100 so a bar cannot overflow. */
export function percent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.min(100, Math.round((part / whole) * 100));
}

export interface ChecklistGroup {
  /** A category, or `OUTFITS` for the separate outfit group. */
  key: string;
  entries: TripEntry[];
}

export const OUTFITS_GROUP = 'OUTFITS';

/**
 * Splits entries into checklist groups: one per category (in the given order,
 * with unknown categories appended) and a separate group for outfits, last.
 * Empty groups are dropped.
 */
export function groupEntries(entries: TripEntry[], categoryOrder: readonly string[]): ChecklistGroup[] {
  const byCategory = new Map<string, TripEntry[]>();
  const outfits: TripEntry[] = [];

  for (const entry of entries) {
    if (entry.outfit) {
      outfits.push(entry);
    } else if (entry.item) {
      const list = byCategory.get(entry.item.category) ?? [];
      list.push(entry);
      byCategory.set(entry.item.category, list);
    }
  }

  const known = categoryOrder.filter((category) => byCategory.has(category));
  const unknown = [...byCategory.keys()].filter((category) => !categoryOrder.includes(category));

  const groups: ChecklistGroup[] = [...known, ...unknown].map((key) => ({
    key,
    entries: byCategory.get(key) ?? [],
  }));

  return outfits.length > 0 ? [...groups, { key: OUTFITS_GROUP, entries: outfits }] : groups;
}

export function isInLaundry(garment: OutfitGarment): boolean {
  return garment.laundryStatus === 'IN_LAUNDRY';
}

/** Garments on the list (directly or inside an outfit) that are in the wash. */
export function countLaundryGarments(entries: TripEntry[]): number {
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const garment of entry.item ? [entry.item] : (entry.outfit?.items ?? [])) {
      if (isInLaundry(garment)) seen.add(garment.id);
    }
  }

  return seen.size;
}

/** A target met or exceeded is a neutral state, never a problem. */
export function isTargetMet(row: CategoryGuidance): boolean {
  return row.recommended !== null && row.planned >= row.recommended;
}
