import { prisma } from '../config/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';
import type { CreateOutfitInput, OutfitLayout, UpdateOutfitInput } from '../schemas/outfit.schema.js';

/**
 * Garment fields the board and the outfit list need. A subset of the wardrobe's
 * own projection: an outfit never needs `imagePublicId`, and leaking an asset
 * handle through a second endpoint would undo the care taken in the first.
 */
const OUTFIT_ITEM_SELECT = {
  id: true,
  name: true,
  category: true,
  type: true,
  color: true,
  imageUrl: true,
  laundryStatus: true,
} as const;

const OUTFIT_SELECT = {
  id: true,
  name: true,
  occasions: true,
  layout: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: { clothingItem: { select: OUTFIT_ITEM_SELECT } },
    // Stable order, so a board without a stored layout lays out the same way
    // every time it is opened.
    orderBy: { createdAt: 'asc' },
  },
} as const;

type OutfitRow = Prisma.OutfitGetPayload<{ select: typeof OUTFIT_SELECT }>;

/**
 * Flattens the join rows away. `OutfitItem` exists so membership can later
 * carry its own data, but that is a storage concern — a client asking for an
 * outfit wants garments, not membership records.
 */
function toOutfit(row: OutfitRow) {
  const { items, ...outfit } = row;

  return { ...outfit, items: items.map((item) => item.clothingItem) };
}

/** A transaction client, or the top-level one — both satisfy these queries. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * THE ownership check for attaching garments.
 *
 * Every id is looked up with `userId` in the `where`, so a garment belonging to
 * someone else is simply not found. The count comparison is what makes that
 * strict: finding fewer rows than were asked for means at least one id was
 * missing or foreign, and the whole request is refused rather than quietly
 * saving the subset the caller does own.
 *
 * 404, not 403: a 403 would confirm that the id exists in someone else's
 * wardrobe. This matches the single-item endpoints, which report a foreign id
 * as not found for the same reason.
 *
 * Runs inside the caller's transaction, so a garment cannot be deleted between
 * the check and the insert.
 */
async function assertItemsOwned(db: Db, userId: string, itemIds: string[]): Promise<string[]> {
  // The unique constraint on (outfitId, clothingItemId) would reject a repeat
  // anyway; de-duplicating first means a client sending the same id twice gets
  // its outfit rather than a 500 from the constraint.
  const unique = [...new Set(itemIds)];

  if (unique.length === 0) {
    return unique;
  }

  const owned = await db.clothingItem.findMany({
    where: { id: { in: unique }, userId },
    select: { id: true },
  });

  if (owned.length !== unique.length) {
    throw new HttpError(404, 'One or more garments were not found');
  }

  return unique;
}

/**
 * A layout may only position garments the outfit actually contains.
 *
 * Without this the layout column becomes a second, unchecked way to store
 * arbitrary ids — including ids read off another user's board. Nothing would
 * render them, but storing them at all is a leak waiting for a future feature
 * to find.
 */
function assertLayoutMatchesItems(layout: OutfitLayout, itemIds: string[]): void {
  const allowed = new Set(itemIds);
  const stray = layout.placements.find((placement) => !allowed.has(placement.itemId));

  if (stray) {
    throw new HttpError(400, 'The layout positions a garment that is not in this outfit');
  }
}

/**
 * Prisma distinguishes SQL NULL from JSON `null` for a nullable Json column, so
 * clearing one needs `DbNull` rather than a plain `null`. SQL NULL is what
 * "no layout" means here — the row simply has none.
 */
function layoutValue(layout: OutfitLayout | null | undefined) {
  if (layout === undefined) return undefined;

  return layout === null ? Prisma.DbNull : layout;
}

export async function listOutfits(userId: string) {
  const rows = await prisma.outfit.findMany({
    where: { userId },
    select: OUTFIT_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toOutfit);
}

export async function getOutfit(userId: string, id: string) {
  const row = await prisma.outfit.findFirst({ where: { id, userId }, select: OUTFIT_SELECT });

  if (!row) {
    throw new HttpError(404, 'Outfit not found');
  }

  return toOutfit(row);
}

export async function createOutfit(userId: string, input: CreateOutfitInput) {
  const row = await prisma.$transaction(async (tx) => {
    const itemIds = await assertItemsOwned(tx, userId, input.itemIds ?? []);

    if (input.layout) {
      assertLayoutMatchesItems(input.layout, itemIds);
    }

    return tx.outfit.create({
      data: {
        userId,
        name: input.name,
        occasions: input.occasions ?? [],
        layout: layoutValue(input.layout) ?? Prisma.DbNull,
        items: { create: itemIds.map((clothingItemId) => ({ clothingItemId })) },
      },
      select: OUTFIT_SELECT,
    });
  });

  return toOutfit(row);
}

export async function updateOutfit(userId: string, id: string, input: UpdateOutfitInput) {
  const row = await prisma.$transaction(async (tx) => {
    // Scoped like every other update in this codebase: `updateMany` filtered on
    // `{ id, userId }`, with a count of zero reported as 404. Reading first and
    // comparing would be a second code path that could forget the filter.
    const { count } = await tx.outfit.updateMany({
      where: { id, userId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.occasions === undefined ? {} : { occasions: input.occasions }),
      },
    });

    if (count === 0) {
      throw new HttpError(404, 'Outfit not found');
    }

    // Past this point ownership is proven by that count, so the remaining
    // writes can address the outfit by id alone.
    let itemIds: string[];

    if (input.itemIds === undefined) {
      // Membership unchanged, but a new layout still has to be checked against
      // it, so the current set is needed either way.
      const existing = await tx.outfitItem.findMany({
        where: { outfitId: id },
        select: { clothingItemId: true },
      });

      itemIds = existing.map((item) => item.clothingItemId);
    } else {
      itemIds = await assertItemsOwned(tx, userId, input.itemIds);

      // Replace the whole set. The board saves what it shows, so a delta
      // protocol would have no caller — and the ownership check above already
      // covers every id that survives.
      await tx.outfitItem.deleteMany({ where: { outfitId: id } });
      await tx.outfitItem.createMany({
        data: itemIds.map((clothingItemId) => ({ outfitId: id, clothingItemId })),
      });
    }

    if (input.layout !== undefined) {
      // Validated against the final membership, and written only after it
      // passes. The transaction would roll back an invalid write anyway, but
      // ordering it this way means correctness does not depend on that.
      if (input.layout) {
        assertLayoutMatchesItems(input.layout, itemIds);
      }

      await tx.outfit.update({ where: { id }, data: { layout: layoutValue(input.layout) } });
    }

    // By id alone, deliberately. Ownership was settled by the `updateMany`
    // count above, and re-filtering on `userId` here would make this read a
    // second gate — one that silently covers for the first if the first ever
    // loses its filter. A mutation test proved that: with `userId` dropped from
    // the `updateMany`, this read still 404'd and the write was undone only by
    // the transaction rolling back, so every ownership test kept passing over a
    // broken gate. One gate, and the tests can see it.
    const updated = await tx.outfit.findUnique({ where: { id }, select: OUTFIT_SELECT });

    if (!updated) {
      throw new HttpError(404, 'Outfit not found');
    }

    return updated;
  });

  return toOutfit(row);
}

export async function deleteOutfit(userId: string, id: string): Promise<void> {
  // `OutfitItem` cascades from `Outfit`, so the membership rows go with it. The
  // garments themselves are untouched — deleting an outfit is not a wardrobe
  // operation.
  const { count } = await prisma.outfit.deleteMany({ where: { id, userId } });

  if (count === 0) {
    throw new HttpError(404, 'Outfit not found');
  }
}
