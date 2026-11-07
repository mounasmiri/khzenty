import { describe, expect, it } from 'vitest';

import { wearDateLabel } from './wear-date';

const now = new Date(2026, 10, 7, 9, 0);

describe('wearDateLabel', () => {
  it('says Today for any time on the same day', () => {
    expect(wearDateLabel(new Date(2026, 10, 7, 0, 5), now)).toBe('Today');
    expect(wearDateLabel(new Date(2026, 10, 7, 23, 59), now)).toBe('Today');
  });

  it('says Yesterday across midnight, even a few minutes apart', () => {
    expect(wearDateLabel(new Date(2026, 10, 6, 23, 59), now)).toBe('Yesterday');
  });

  it('uses the date for anything older', () => {
    expect(wearDateLabel(new Date(2026, 10, 5, 12, 0), now)).toBe('5 Nov 2026');
  });

  it('accepts an ISO string', () => {
    expect(wearDateLabel(new Date(2026, 10, 7, 8, 0).toISOString(), now)).toBe('Today');
  });
});
