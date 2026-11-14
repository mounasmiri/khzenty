import { randomBytes, randomUUID } from 'node:crypto';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { daysInclusive, formatCalendarDate, parseCalendarDate, todayUtc } from '../lib/calendar-date.js';
import {
  DEMO_EMAIL,
  DEMO_TTL_MS,
  randomDemoEmail,
  UNUSABLE_PASSWORD_HASH,
} from '../lib/demo.js';
import { HttpError } from '../lib/http-error.js';
import type { PublicUser } from '../types/auth.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes demo copies older than the TTL.
 *
 * Only `isDemo` users are ever matched, so the template account and every real
 * account are out of reach of this query by construction. The cascade removes
 * everything a copy owns. It deliberately does **not** touch Cloudinary: the
 * copies share the template's images, and destroying them here would break
 * every other visitor and the template itself.
 */
export async function purgeExpiredDemoUsers(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: { isDemo: true, createdAt: { lt: new Date(now.getTime() - DEMO_TTL_MS) } },
  });

  return count;
}

/**
 * Re-points a stored outfit layout at the cloned garments' new ids.
 *
 * The layout is a JSON column that names garments by id, so copying it as-is
 * would leave it positioning ids that belong to the template.
 */
function remapLayout(layout: Prisma.JsonValue, itemIds: ReadonlyMap<string, string>) {
  if (layout === null) return Prisma.DbNull;

  if (typeof layout === 'object' && !Array.isArray(layout) && Array.isArray(layout['placements'])) {
    return {
      ...layout,
      placements: layout['placements'].map((placement) =>
        typeof placement === 'object' && placement !== null && !Array.isArray(placement)
          ? { ...placement, itemId: itemIds.get(String(placement['itemId'])) ?? placement['itemId'] }
          : placement,
      ),
    } as Prisma.InputJsonValue;
  }

  return layout as Prisma.InputJsonValue;
}

/**
 * Creates a private, temporary copy of the template demo account and returns
 * it, ready to be signed in.
 *
 * Everything is copied from the template's rows — garments, outfits and their
 * membership, trips with entries and manual counts, the wear log — under fresh
 * ids, in one transaction, so a visitor never sees a half-built wardrobe.
 * Dates that are relative to "now" (trips, wear times, laundry times) are
 * shifted by however long ago the template was seeded, so the Dubai trip is
 * still inside the forecast window however old the seed is.
 */
export async function createDemoSession(): Promise<PublicUser> {
  // Cheap, bounded by the cap below, and keeps the table from growing without
  // anyone having to run a job.
  await purgeExpiredDemoUsers();

  const live = await prisma.user.count({ where: { isDemo: true } });

  if (live >= env.DEMO_MAX_USERS) {
    throw new HttpError(503, 'The demo is busy right now. Please try again in a little while.', {
      expose: true,
    });
  }

  const template = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL, isDemo: false },
    select: { id: true, createdAt: true },
  });

  if (!template) {
    throw new HttpError(404, 'The demo account is not available');
  }

  const shiftDays = daysInclusive(
    parseCalendarDate(formatCalendarDate(template.createdAt)),
    todayUtc(),
  ) - 1;
  const shift = (date: Date): Date => new Date(date.getTime() + shiftDays * MS_PER_DAY);

  return prisma.$transaction(
    async (tx) => {
      const [items, outfits, trips, wearLogs] = await Promise.all([
        tx.clothingItem.findMany({ where: { userId: template.id } }),
        tx.outfit.findMany({ where: { userId: template.id }, include: { items: true } }),
        tx.trip.findMany({
          where: { userId: template.id },
          include: { entries: true, categoryCounts: true },
        }),
        tx.wearLog.findMany({ where: { userId: template.id } }),
      ]);

      const user = await tx.user.create({
        data: {
          email: randomDemoEmail(randomBytes(12).toString('hex')),
          name: 'Demo User',
          passwordHash: UNUSABLE_PASSWORD_HASH,
          isDemo: true,
        },
        select: { id: true, email: true, name: true, isDemo: true, createdAt: true },
      });

      const itemIds = new Map(items.map((item) => [item.id, randomUUID()]));
      const outfitIds = new Map(outfits.map((outfit) => [outfit.id, randomUUID()]));
      const mapItem = (id: string): string => itemIds.get(id) ?? id;

      await tx.clothingItem.createMany({
        data: items.map((item) => ({
          id: itemIds.get(item.id) as string,
          userId: user.id,
          name: item.name,
          category: item.category,
          type: item.type,
          color: item.color,
          seasons: item.seasons,
          favorite: item.favorite,
          laundryStatus: item.laundryStatus,
          laundryAt: item.laundryAt ? shift(item.laundryAt) : null,
          // The template's image, by reference. Nothing here uploads or copies
          // a file, and deleting these rows never destroys the asset.
          imageUrl: item.imageUrl,
          imagePublicId: item.imagePublicId,
          createdAt: item.createdAt,
        })),
      });

      await tx.outfit.createMany({
        data: outfits.map((outfit) => ({
          id: outfitIds.get(outfit.id) as string,
          userId: user.id,
          name: outfit.name,
          occasions: outfit.occasions,
          layout: remapLayout(outfit.layout, itemIds),
          createdAt: outfit.createdAt,
        })),
      });

      // `createdAt` is copied, not defaulted: garments are shown in membership
      // order, and one createMany would give every row the same timestamp.
      await tx.outfitItem.createMany({
        data: outfits.flatMap((outfit) =>
          outfit.items.map((member) => ({
            outfitId: outfitIds.get(outfit.id) as string,
            clothingItemId: mapItem(member.clothingItemId),
            createdAt: member.createdAt,
          })),
        ),
      });

      for (const trip of trips) {
        const tripId = randomUUID();

        await tx.trip.create({
          data: {
            id: tripId,
            userId: user.id,
            name: trip.name,
            destinationName: trip.destinationName,
            latitude: trip.latitude,
            longitude: trip.longitude,
            startDate: shift(trip.startDate),
            endDate: shift(trip.endDate),
            createdAt: trip.createdAt,
          },
        });

        await tx.tripEntry.createMany({
          data: trip.entries.map((entry) => ({
            tripId,
            clothingItemId: entry.clothingItemId ? mapItem(entry.clothingItemId) : null,
            outfitId: entry.outfitId ? (outfitIds.get(entry.outfitId) ?? null) : null,
            packed: entry.packed,
            createdAt: entry.createdAt,
          })),
        });

        await tx.tripCategoryCount.createMany({
          data: trip.categoryCounts.map((row) => ({
            tripId,
            category: row.category,
            count: row.count,
          })),
        });
      }

      await tx.wearLog.createMany({
        data: wearLogs.map((log) => ({
          userId: user.id,
          outfitId: outfitIds.get(log.outfitId) as string,
          wornAt: shift(log.wornAt),
          changedItemIds: log.changedItemIds.map(mapItem),
        })),
      });

      return user;
    },
    // Roughly a hundred rows in a handful of statements; generous so a busy
    // pool does not turn a slow moment into a failed demo.
    { timeout: 20_000 },
  );
}

