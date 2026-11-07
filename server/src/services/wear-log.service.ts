import { prisma } from '../config/prisma.js';
import { LaundryStatus } from '../generated/prisma/enums.js';
import { HttpError } from '../lib/http-error.js';

const WEAR_LOG_SELECT = { id: true, outfitId: true, wornAt: true, changedItemIds: true } as const;

/**
 * Marks an outfit as worn: records the entry and sends every piece that is
 * currently CLEAN to the laundry, in one transaction.
 *
 * Only pieces that actually change are recorded in `changedItemIds`. A piece
 * already in the wash was not this wearing's doing, so undo must not touch it.
 * Scoped by `userId`, so another user's outfit is a 404.
 */
export async function wearOutfit(userId: string, outfitId: string) {
  return prisma.$transaction(async (tx) => {
    const outfit = await tx.outfit.findFirst({
      where: { id: outfitId, userId },
      select: { items: { select: { clothingItemId: true } } },
    });

    if (!outfit) {
      throw new HttpError(404, 'Outfit not found');
    }

    const clean = await tx.clothingItem.findMany({
      where: {
        id: { in: outfit.items.map((item) => item.clothingItemId) },
        userId,
        laundryStatus: LaundryStatus.CLEAN,
      },
      select: { id: true },
    });
    const changedItemIds = clean.map((item) => item.id);

    await tx.clothingItem.updateMany({
      where: { id: { in: changedItemIds }, userId },
      data: { laundryStatus: LaundryStatus.IN_LAUNDRY, laundryAt: new Date() },
    });

    return tx.wearLog.create({
      data: { userId, outfitId, changedItemIds },
      select: WEAR_LOG_SELECT,
    });
  });
}

/**
 * Undoes one wearing: deletes the entry and restores only the pieces it moved.
 * Scoped by `userId`; a foreign or unknown id is a 404 and changes nothing.
 */
export async function undoWear(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.wearLog.findFirst({
      where: { id, userId },
      select: { changedItemIds: true },
    });

    if (!entry) {
      throw new HttpError(404, 'Wear log entry not found');
    }

    await tx.wearLog.delete({ where: { id } });
    await tx.clothingItem.updateMany({
      where: { id: { in: entry.changedItemIds }, userId },
      data: { laundryStatus: LaundryStatus.CLEAN, laundryAt: new Date() },
    });
  });
}
