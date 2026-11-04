/**
 * Runs tasks with a cap on how many are in flight at once.
 *
 * Bulk upload needs this: firing twenty uploads simultaneously starves the
 * connection, makes per-file progress meaningless, and risks tripping
 * Cloudinary's rate limit. A handful at a time finishes sooner in practice.
 *
 * Every task is settled rather than raced, so one failure never cancels the
 * rest — a single bad photo must not abandon the other nineteen. Results come
 * back in input order regardless of completion order.
 */
export async function runWithConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`Concurrency limit must be a positive integer, got ${String(limit)}`);
  }

  const results = new Array<PromiseSettledResult<T>>(tasks.length);
  let cursor = 0;

  /**
   * Workers pull from a shared cursor rather than being handed fixed slices,
   * so a worker stuck on a large photo does not hold back the queue.
   */
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;

      if (index >= tasks.length) {
        return;
      }

      const task = tasks[index];

      if (!task) {
        return;
      }

      try {
        results[index] = { status: 'fulfilled', value: await task() };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
