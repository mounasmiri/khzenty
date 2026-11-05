import { describe, expect, it } from 'vitest';

import { createSequentialQueue } from './sequential-queue';

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

describe('createSequentialQueue', () => {
  it('never runs two tasks at once', async () => {
    let inFlight = 0;
    let peak = 0;

    const queue = createSequentialQueue();

    await Promise.all(
      Array.from({ length: 6 }, () =>
        queue.run(async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await tick();
          inFlight -= 1;
        }),
      ),
    );

    expect(peak).toBe(1);
  });

  it('does not start the second task until the first settles', async () => {
    const first = deferred<string>();
    const started: number[] = [];
    const queue = createSequentialQueue();

    const a = queue.run(async () => {
      started.push(0);
      return first.promise;
    });
    const b = queue.run(async () => {
      started.push(1);
      return 'second';
    });

    await tick();
    // The model is busy; the second tap must wait rather than compete.
    expect(started).toEqual([0]);

    first.resolve('first');
    await Promise.all([a, b]);

    expect(started).toEqual([0, 1]);
  });

  it('preserves queue order', async () => {
    const order: number[] = [];
    const queue = createSequentialQueue();

    await Promise.all(
      [30, 10, 0, 20].map((delay, index) =>
        queue.run(async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          order.push(index);
        }),
      ),
    );

    // Completion order would be 2,1,3,0 if these ran concurrently.
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('propagates a rejection to that task only', async () => {
    const queue = createSequentialQueue();

    const failing = queue.run(async () => {
      throw new Error('model failed');
    });
    const following = queue.run(async () => 'still ran');

    await expect(failing).rejects.toThrow('model failed');
    await expect(following).resolves.toBe('still ran');
  });

  it('keeps draining after a rejection', async () => {
    const queue = createSequentialQueue();
    const results: string[] = [];

    const tasks = Array.from({ length: 5 }, (_unused, index) =>
      queue
        .run(async () => {
          if (index === 1) throw new Error(`fail ${String(index)}`);
          return `ok ${String(index)}`;
        })
        .then(
          (value) => results.push(value),
          () => results.push(`failed ${String(index)}`),
        ),
    );

    await Promise.all(tasks);

    // One bad photo must not abandon the rest of a bulk batch.
    expect(results).toEqual(['ok 0', 'failed 1', 'ok 2', 'ok 3', 'ok 4']);
  });

  it('survives several consecutive rejections', async () => {
    const queue = createSequentialQueue();

    const outcomes = await Promise.all(
      Array.from({ length: 4 }, (_unused, index) =>
        queue
          .run(async () => {
            if (index < 3) throw new Error('nope');
            return 'last one works';
          })
          .then(
            () => 'fulfilled',
            () => 'rejected',
          ),
      ),
    );

    expect(outcomes).toEqual(['rejected', 'rejected', 'rejected', 'fulfilled']);
  });

  it('tracks pending across the queue lifetime', async () => {
    const gate = deferred<void>();
    const queue = createSequentialQueue();

    expect(queue.pending).toBe(0);

    const a = queue.run(() => gate.promise);
    const b = queue.run(async () => undefined);

    expect(queue.pending).toBe(2);

    gate.resolve();
    await Promise.all([a, b]);
    await tick();

    expect(queue.pending).toBe(0);
  });

  it('decrements pending even when a task rejects', async () => {
    const queue = createSequentialQueue();

    await queue
      .run(async () => {
        throw new Error('boom');
      })
      .catch(() => undefined);
    await tick();

    expect(queue.pending).toBe(0);
  });

  it('accepts work queued after it has drained', async () => {
    const queue = createSequentialQueue();

    await expect(queue.run(async () => 'first batch')).resolves.toBe('first batch');
    // A queue that stalled after draining would hang here.
    await expect(queue.run(async () => 'second batch')).resolves.toBe('second batch');
  });
});
