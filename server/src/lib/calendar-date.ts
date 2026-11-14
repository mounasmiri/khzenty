/**
 * Calendar dates (no time of day) as `YYYY-MM-DD` strings and UTC-midnight
 * `Date`s.
 *
 * Trips are stored in `@db.Date` columns, which Prisma exchanges as UTC
 * midnight. Doing every conversion here, in UTC, is what keeps "10 June" from
 * becoming "9 June" on a server in another timezone.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date — rejects shapes like `2026-02-31`. */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive: a trip from the 10th to the 10th is one day. */
export function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Today's date in UTC. */
export function todayUtc(now: Date = new Date()): Date {
  return parseCalendarDate(formatCalendarDate(now));
}
