import { prisma } from '../config/prisma.js';
import { LaundryStatus } from '../generated/prisma/enums.js';
import { HttpError } from '../lib/http-error.js';
import { getItem } from './clothing-item.service.js';

/**
 * Sets one garment's laundry status.
 *
 * Reads before writing rather than using a conditional `updateMany`, because a
 * zero count would then mean either "not yours" or "already in that state" —
 * and only the first is a 404. Scoped by `userId`, so another user's id is
 * indistinguishable from one that does not exist.
 *
 * `laundryAt` only moves when the status actually changes: it records when the
 * status was last set, so re-sending the same status must not reset the clock
 * on how long something has been in the basket.
 */
export async function setLaundryStatus(userId: string, id: string, status: LaundryStatus) {
  const existing = await prisma.clothingItem.findFirst({
    where: { id, userId },
    select: { laundryStatus: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Clothing item not found');
  }

  if (existing.laundryStatus !== status) {
    await prisma.clothingItem.update({
      where: { id },
      data: { laundryStatus: status, laundryAt: new Date() },
    });
  }

  return getItem(userId, id);
}

/**
 * Marks a batch of garments as washed.
 *
 * Ownership is enforced by the `userId` in the filter rather than by rejecting
 * the request: a bulk action should wash what it legitimately can, so ids
 * belonging to someone else are silently skipped instead of failing the whole
 * batch. The returned count tells the caller how many actually moved.
 *
 * Filtering on `IN_LAUNDRY` makes this idempotent in effect — a second call
 * matches nothing, so already-clean garments do not have `laundryAt` bumped
 * for a change that did not happen.
 */
export async function markWashed(userId: string, ids: readonly string[]) {
  const { count } = await prisma.clothingItem.updateMany({
    where: { id: { in: [...ids] }, userId, laundryStatus: LaundryStatus.IN_LAUNDRY },
    data: { laundryStatus: LaundryStatus.CLEAN, laundryAt: new Date() },
  });

  return { updated: count };
}
