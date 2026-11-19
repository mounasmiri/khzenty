/**
 * The demo template as a file: read it out of a database, validate it, put it
 * back into a database.
 *
 * Why a file: the demo account is curated in the *development* database (real
 * photos, real outfit layouts) and the production template has to look the same.
 * `npm run db:export-demo` writes this file; `SEED_DEMO_FILE=default npm run
 * db:seed` builds the template from it.
 *
 * Design decisions worth knowing:
 *
 * - **Relative dates.** Nothing absolute is stored. Wear times and laundry times
 *   are "days ago", trips are "days from today". The importer resolves them
 *   against the moment of seeding, which is what `createDemoSession` expects
 *   (it shifts by the template's own `createdAt`).
 * - **Garment ids are kept**, because an outfit's `layout` JSON names garments by
 *   id. Outfits are referred to by an export-local `ref` instead, so no database
 *   id of an outfit leaks into the file.
 * - **Order is data.** Lists are ordered by `createdAt`, and several screens sort
 *   by it, so the importer stamps rows 1 ms apart in file order.
 * - **No user data beyond the wardrobe.** No email, name, password hash or
 *   timestamps. The file holds Cloudinary links but no credentials.
 */
import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { prisma } from '../src/config/prisma.js';
import { addDays, daysInclusive, todayUtc } from '../src/lib/calendar-date.js';
import { CATEGORY_BY_TYPE } from '../src/lib/clothing-taxonomy.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { hashPassword } from '../src/lib/password.js';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  ClothingCategory,
  ClothingType,
  LaundryStatus,
  Occasion,
  Season,
} from '../src/generated/prisma/enums.js';
import { DEV_PASSWORD, type KeptPhoto } from './demo-template.js';

export const DEFAULT_DEMO_FILE = 'prisma/demo-export.json';

const FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

const photoSchema = z.object({
  imageUrl: z
    .string()
    .refine((url) => url.startsWith('https://res.cloudinary.com/'), 'must be a Cloudinary https URL'),
  imagePublicId: z.string().min(1),
});

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  type: z.enum(ClothingType),
  category: z.enum(ClothingCategory),
  color: z.string().nullable(),
  seasons: z.array(z.enum(Season)),
  favorite: z.boolean(),
  laundryStatus: z.enum(LaundryStatus),
  /** Days before seeding that the status last changed; null if never set. */
  laundryDaysAgo: z.number().int().nonnegative().nullable(),
  photo: photoSchema.nullable(),
});

const outfitSchema = z.object({
  /** Export-local handle; wear entries and trips point at it. */
  ref: z.string().min(1),
  name: z.string().min(1),
  occasions: z.array(z.enum(Occasion)),
  /** Garment ids, in the order the outfit lists them. */
  itemIds: z.array(z.string().min(1)),
  layout: z.json().nullable(),
});

const wearSchema = z.object({
  outfitRef: z.string().min(1),
  daysAgo: z.number().int().nonnegative(),
  changedItemIds: z.array(z.string()),
});

const tripEntrySchema = z
  .object({
    itemId: z.string().min(1).optional(),
    outfitRef: z.string().min(1).optional(),
    packed: z.boolean(),
  })
  .refine((entry) => (entry.itemId === undefined) !== (entry.outfitRef === undefined), {
    message: 'exactly one of itemId / outfitRef is required',
  });

const tripSchema = z.object({
  name: z.string().min(1),
  destinationName: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  /** Calendar days from the day of seeding to the first day (may be negative). */
  startsInDays: z.number().int(),
  /** Calendar days from the day of seeding to the last day. */
  endsInDays: z.number().int(),
  entries: z.array(tripEntrySchema),
  manualCounts: z.array(z.object({ category: z.enum(ClothingCategory), count: z.number().int().positive() })),
});

const demoExportSchema = z
  .object({
    version: z.literal(FORMAT_VERSION),
    items: z.array(itemSchema),
    outfits: z.array(outfitSchema),
    wears: z.array(wearSchema),
    trips: z.array(tripSchema),
  })
  .superRefine((data, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const itemIds = new Set<string>();
    const outfitRefs = new Set<string>();

    for (const item of data.items) {
      if (itemIds.has(item.id)) fail(`duplicate garment id "${item.id}"`);
      itemIds.add(item.id);

      if (CATEGORY_BY_TYPE[item.type] !== item.category) {
        fail(`garment "${item.id}": category ${item.category} does not match type ${item.type}`);
      }
    }

    for (const outfit of data.outfits) {
      if (outfitRefs.has(outfit.ref)) fail(`duplicate outfit ref "${outfit.ref}"`);
      outfitRefs.add(outfit.ref);

      for (const id of outfit.itemIds) {
        if (!itemIds.has(id)) fail(`outfit "${outfit.name}" uses unknown garment "${id}"`);
      }
    }

    for (const wear of data.wears) {
      if (!outfitRefs.has(wear.outfitRef)) fail(`wear entry uses unknown outfit "${wear.outfitRef}"`);
    }

    for (const trip of data.trips) {
      if (trip.endsInDays < trip.startsInDays) fail(`trip "${trip.name}" ends before it starts`);

      const seen = new Set<string>();

      for (const entry of trip.entries) {
        const target = entry.itemId ?? entry.outfitRef ?? '';

        if (entry.itemId !== undefined && !itemIds.has(entry.itemId)) {
          fail(`trip "${trip.name}" uses unknown garment "${entry.itemId}"`);
        }
        if (entry.outfitRef !== undefined && !outfitRefs.has(entry.outfitRef)) {
          fail(`trip "${trip.name}" uses unknown outfit "${entry.outfitRef}"`);
        }
        if (seen.has(target)) fail(`trip "${trip.name}" lists "${target}" twice`);
        seen.add(target);
      }
    }
  });

export type DemoExport = z.infer<typeof demoExportSchema>;

/** Checks an already-parsed value. The message lists every problem found. */
export function parseDemoExport(value: unknown): DemoExport {
  const result = demoExportSchema.safeParse(value);

  if (!result.success) {
    const problems = result.error.issues
      .slice(0, 10)
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`The demo export is invalid:\n${problems}`);
  }

  return result.data;
}

export async function readDemoExport(path: string): Promise<DemoExport> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the demo export "${path}": ${(error as Error).message}`);
  }

  return parseDemoExport(parsed);
}

// ---------------------------------------------------------------------------
// Export: database -> data
// ---------------------------------------------------------------------------

/** Whole calendar days from `date` up to `now` (negative when `date` is later). */
function calendarDaysBefore(date: Date, now: Date): number {
  return daysInclusive(todayUtc(date), todayUtc(now)) - 1;
}

/**
 * Reads the demo template account. Read-only. Returns `null` when the account
 * does not exist, so the caller can say so instead of writing an empty file.
 */
export async function buildDemoExport(now: Date = new Date()): Promise<DemoExport | null> {
  const user = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL, isDemo: false },
    select: { id: true },
  });

  if (!user) return null;

  const [items, outfits, wearLogs, trips] = await Promise.all([
    prisma.clothingItem.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.outfit.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    }),
    // Newest first, as the app lists them; the importer keeps that order.
    prisma.wearLog.findMany({ where: { userId: user.id }, orderBy: [{ wornAt: 'desc' }, { id: 'desc' }] }),
    prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        entries: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        categoryCounts: { orderBy: { category: 'asc' } },
      },
    }),
  ]);

  const itemIds = new Set(items.map((item) => item.id));
  const outfitRefs = new Map(outfits.map((outfit, index) => [outfit.id, `outfit_${index + 1}`]));
  const refFor = (outfitId: string): string => outfitRefs.get(outfitId) as string;

  return parseDemoExport({
    version: FORMAT_VERSION,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      category: item.category,
      color: item.color,
      seasons: item.seasons,
      favorite: item.favorite,
      laundryStatus: item.laundryStatus,
      laundryDaysAgo: item.laundryAt ? Math.max(0, calendarDaysBefore(item.laundryAt, now)) : null,
      // Both or neither: a half-written link is not a photo.
      photo:
        item.imageUrl && item.imagePublicId
          ? { imageUrl: item.imageUrl, imagePublicId: item.imagePublicId }
          : null,
    })),
    outfits: outfits.map((outfit) => ({
      ref: refFor(outfit.id),
      name: outfit.name,
      occasions: outfit.occasions,
      itemIds: outfit.items.map((member) => member.clothingItemId),
      layout: outfit.layout,
    })),
    wears: wearLogs.map((log) => ({
      outfitRef: refFor(log.outfitId),
      daysAgo: Math.max(0, calendarDaysBefore(log.wornAt, now)),
      // A snapshot may name a garment that has since been deleted.
      changedItemIds: log.changedItemIds.filter((id) => itemIds.has(id)),
    })),
    trips: trips.map((trip) => ({
      name: trip.name,
      destinationName: trip.destinationName,
      latitude: trip.latitude,
      longitude: trip.longitude,
      startsInDays: -calendarDaysBefore(trip.startDate, now),
      endsInDays: -calendarDaysBefore(trip.endDate, now),
      entries: trip.entries.map((entry) => ({
        ...(entry.clothingItemId ? { itemId: entry.clothingItemId } : {}),
        ...(entry.outfitId ? { outfitRef: refFor(entry.outfitId) } : {}),
        packed: entry.packed,
      })),
      manualCounts: trip.categoryCounts.map((row) => ({ category: row.category, count: row.count })),
    })),
  });
}

// ---------------------------------------------------------------------------
// Import: data -> database
// ---------------------------------------------------------------------------

/** The photo links of an export, in the shape the seed already merges. */
export function photosOf(data: DemoExport): Map<string, KeptPhoto> {
  return new Map(
    data.items.flatMap((item) => (item.photo ? [[item.id, item.photo] as const] : [])),
  );
}

/**
 * Creates the template account from an export and returns its id.
 *
 * Does NOT delete a previous template; the caller (the seed) owns that, along
 * with the production safeguards. Everything is written to the one new user, in
 * one transaction, so a failure leaves no half-built wardrobe behind.
 *
 * `photos` overrides the file's own links per garment id (the seed uses it so a
 * link already on the account is never replaced).
 */
export async function importDemoExport(
  data: DemoExport,
  options: { photos?: ReadonlyMap<string, KeptPhoto>; passwordHash?: string; now?: Date } = {},
): Promise<string> {
  const now = options.now ?? new Date();
  const today = todayUtc(now);
  const passwordHash = options.passwordHash ?? (await hashPassword(DEV_PASSWORD));
  // Rows are stamped one millisecond apart so `createdAt` ordering is file order.
  const stamp = (index: number): Date => new Date(now.getTime() + index);

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: { email: DEMO_EMAIL, name: 'Demo User', passwordHash },
        select: { id: true },
      });

      await tx.clothingItem.createMany({
        data: data.items.map((item, index) => {
          const photo = options.photos?.get(item.id) ?? item.photo;

          return {
            id: item.id,
            userId: user.id,
            name: item.name,
            category: item.category,
            type: item.type,
            color: item.color,
            seasons: item.seasons,
            favorite: item.favorite,
            laundryStatus: item.laundryStatus,
            laundryAt: item.laundryDaysAgo === null ? null : addDays(now, -item.laundryDaysAgo),
            imageUrl: photo?.imageUrl ?? null,
            imagePublicId: photo?.imagePublicId ?? null,
            createdAt: stamp(index),
          };
        }),
      });

      const outfitIds = new Map<string, string>();

      for (const [index, outfit] of data.outfits.entries()) {
        const created = await tx.outfit.create({
          data: {
            userId: user.id,
            name: outfit.name,
            occasions: outfit.occasions,
            layout: outfit.layout === null ? Prisma.DbNull : (outfit.layout as Prisma.InputJsonValue),
            createdAt: stamp(index),
            items: {
              create: outfit.itemIds.map((clothingItemId, position) => ({
                clothingItemId,
                createdAt: stamp(position),
              })),
            },
          },
          select: { id: true },
        });

        outfitIds.set(outfit.ref, created.id);
      }

      const outfitId = (ref: string): string => outfitIds.get(ref) as string;

      // Newest first in the file, so the offset grows with the index: that keeps
      // two wearings on the same day in the same order.
      await tx.wearLog.createMany({
        data: data.wears.map((wear, index) => ({
          userId: user.id,
          outfitId: outfitId(wear.outfitRef),
          wornAt: new Date(addDays(now, -wear.daysAgo).getTime() - index),
          changedItemIds: wear.changedItemIds,
        })),
      });

      for (const trip of data.trips) {
        const created = await tx.trip.create({
          data: {
            userId: user.id,
            name: trip.name,
            destinationName: trip.destinationName,
            latitude: trip.latitude,
            longitude: trip.longitude,
            startDate: addDays(today, trip.startsInDays),
            endDate: addDays(today, trip.endsInDays),
          },
          select: { id: true },
        });

        await tx.tripEntry.createMany({
          data: trip.entries.map((entry, index) => ({
            tripId: created.id,
            clothingItemId: entry.itemId ?? null,
            outfitId: entry.outfitRef === undefined ? null : outfitId(entry.outfitRef),
            packed: entry.packed,
            createdAt: stamp(index),
          })),
        });

        await tx.tripCategoryCount.createMany({
          data: trip.manualCounts.map((row) => ({ tripId: created.id, ...row })),
        });
      }

      return user.id;
    },
    { timeout: 20_000 },
  );
}
