import { describe, expect, it } from 'vitest';

import { runWithConcurrency } from './concurrency';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runWithConcurrency', () => {
  it('never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;

    const tasks = Array.from({ length: 12 }, () => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return 'ok';
    });

    await runWithConcurrency(tasks, 3);

    expect(peak).toBe(3);
  });

  it('starts exactly `limit` tasks before any finishes', async () => {
    const gates = Array.from({ length: 5 }, () => deferred<string>());
    let started = 0;

    const tasks = gates.map((gate) => async () => {
      started += 1;
      return gate.promise;
    });

    const run = runWithConcurrency(tasks, 3);
    await tick();

    // The 4th must wait for a slot, not queue up alongside.
    expect(started).toBe(3);

    gates.forEach((gate) => gate.resolve('done'));
    await run;

    expect(started).toBe(5);
  });

  it('returns results in input order, not completion order', async () => {
    // Deliberately inverted delays: the last task finishes first.
    const tasks = [40, 20, 0].map((delay, index) => async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return index;
    });

    const results = await runWithConcurrency(tasks, 3);

    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([0, 1, 2]);
  });

  it('settles every task even when some reject', async () => {
    // One bad photo must not abandon the rest of the batch.
    const tasks = [
      async () => 'first',
      async () => {
        throw new Error('boom');
      },
      async () => 'third',
    ];

    const results = await runWithConcurrency(tasks, 2);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(results[1]?.status === 'rejected' && (results[1].reason as Error).message).toBe('boom');
  });

  it('keeps working after a rejection rather than stalling a worker', async () => {
    const tasks = Array.from({ length: 9 }, (_unused, index) => async () => {
      await tick();
      if (index % 2 === 0) {
        throw new Error(`fail ${String(index)}`);
      }
      return index;
    });

    const results = await runWithConcurrency(tasks, 2);

    expect(results).toHaveLength(9);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(4);
  });

  it('handles an empty list without spawning workers', async () => {
    await expect(runWithConcurrency([], 3)).resolves.toEqual([]);
  });

  it('does not spawn more workers than tasks', async () => {
    let peak = 0;
    let inFlight = 0;

    const tasks = Array.from({ length: 2 }, () => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return 1;
    });

    await runWithConcurrency(tasks, 10);

    expect(peak).toBe(2);
  });

  it('rejects a nonsensical limit', async () => {
    await expect(runWithConcurrency([async () => 1], 0)).rejects.toThrow(RangeError);
    await expect(runWithConcurrency([async () => 1], 1.5)).rejects.toThrow(RangeError);
  });
});
