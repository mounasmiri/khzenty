export interface SequentialQueue {
  /** Queues a task and resolves with its result once it has had its turn. */
  run: <T>(task: () => Promise<T>) => Promise<T>;
  /** How many tasks are queued or running. */
  readonly pending: number;
}

/**
 * Runs tasks strictly one at a time, in the order they were queued.
 *
 * Background removal needs this rather than the concurrency limiter used for
 * uploads: the model holds a large amount of memory and saturates the CPU, so
 * two runs at once are slower than two in sequence and risk exhausting memory
 * on a phone. A single shared queue also means a second "Remove background"
 * tap waits instead of starting a competing run.
 *
 * A rejected task must not block the ones behind it, so the internal chain is
 * kept deliberately non-rejecting — the failure still reaches that task's own
 * caller, and only that caller.
 */
export function createSequentialQueue(): SequentialQueue {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;

  function run<T>(task: () => Promise<T>): Promise<T> {
    pending += 1;

    const result = tail.then(() => task());

    // Swallowed here, not for the caller: `result` is returned unchanged, so
    // the rejection is still theirs to handle. This copy only keeps the chain
    // alive and decrements in completion order.
    tail = result.then(
      () => {
        pending -= 1;
      },
      () => {
        pending -= 1;
      },
    );

    return result;
  }

  return {
    run,
    get pending() {
      return pending;
    },
  };
}
