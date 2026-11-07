/** Calendar days from `then` to `now`, ignoring the time of day. */
function dayDifference(then: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return Math.round((start(now) - start(then)) / 86_400_000);
}

/** "Today", "Yesterday", or a readable date such as "3 Jan 2026". */
export function wearDateLabel(wornAt: string | Date, now: Date = new Date()): string {
  const then = new Date(wornAt);
  const days = dayDifference(then, now);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
