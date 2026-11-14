import { prisma } from '../config/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ClothingCategory } from '../generated/prisma/enums.js';
import {
  daysInclusive,
  formatCalendarDate,
  parseCalendarDate,
} from '../lib/calendar-date.js';
import { CATEGORY_ORDER } from '../lib/clothing-taxonomy.js';
import { HttpError } from '../lib/http-error.js';
import {
  checkDateRange,
  MAX_TRIP_ENTRIES,
  type AddTripEntryInput,
  type CreateTripInput,
  type UpdateTripInput,
} from '../schemas/trip.schema.js';
import { resolveDestination } from './geocoding.service.js';
import { recommendPackingCounts } from './packing-guidance.service.js';
import { getWeather, type TripWeather } from './weather.service.js';

/** Same garment projection the outfit endpoints use — never the asset handle. */
const GARMENT_SELECT = {
  id: true,
  name: true,
  category: true,
  type: true,
  color: true,
  imageUrl: true,
  laundryStatus: true,
} as const;

const TRIP_SELECT = {
  id: true,
  name: true,
  destinationName: true,
  latitude: true,
  longitude: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ENTRY_SELECT = {
  id: true,
  packed: true,
  clothingItem: { select: GARMENT_SELECT },
  outfit: {
    select: {
      id: true,
      name: true,
      occasions: true,
      items: {
        select: { clothingItem: { select: GARMENT_SELECT } },
        orderBy: { createdAt: 'asc' },
      },
    },
  },
} as const;

type TripRow = Prisma.TripGetPayload<{ select: typeof TRIP_SELECT }>;
type EntryRow = Prisma.TripEntryGetPayload<{ select: typeof ENTRY_SELECT }>;
type Garment = Prisma.ClothingItemGetPayload<{ select: typeof GARMENT_SELECT }>;

/** What the trip-level numbers need from an entry. */
export interface PackingEntry {
  packed: boolean;
  items: { id: string; category: ClothingCategory }[];
}

/**
 * How many distinct garments are planned per category.
 *
 * An outfit entry contributes its garments, and a garment that is both added on
 * its own and part of an outfit is counted once — hence counting distinct ids
 * rather than entries.
 */
export function countPlannedByCategory(
  entries: PackingEntry[],
): Partial<Record<ClothingCategory, number>> {
  const seen = new Set<string>();
  const counts: Partial<Record<ClothingCategory, number>> = {};

  for (const entry of entries) {
    for (const item of entry.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
  }

  return counts;
}

function summarise(row: TripRow, entries: { packed: boolean }[]) {
  return {
    id: row.id,
    name: row.name,
    destinationName: row.destinationName,
    latitude: row.latitude,
    longitude: row.longitude,
    startDate: formatCalendarDate(row.startDate),
    endDate: formatCalendarDate(row.endDate),
    days: daysInclusive(row.startDate, row.endDate),
    entryCount: entries.length,
    packedCount: entries.filter((entry) => entry.packed).length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntry(row: EntryRow) {
  return {
    id: row.id,
    packed: row.packed,
    item: row.clothingItem,
    outfit: row.outfit
      ? { ...row.outfit, items: row.outfit.items.map((member) => member.clothingItem) }
      : null,
  };
}

function entryGarments(entry: ReturnType<typeof toEntry>): Garment[] {
  return entry.item ? [entry.item] : (entry.outfit?.items ?? []);
}

async function findOwnedTrip(userId: string, id: string): Promise<TripRow> {
  // `userId` in the where: someone else's trip is simply not found (404, not
  // 403), the same convention every other resource follows.
  const row = await prisma.trip.findFirst({ where: { id, userId }, select: TRIP_SELECT });

  if (!row) {
    throw new HttpError(404, 'Trip not found');
  }

  return row;
}

export async function listTrips(userId: string) {
  const rows = await prisma.trip.findMany({
    where: { userId },
    select: { ...TRIP_SELECT, entries: { select: { packed: true } } },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
  });

  return rows.map(({ entries, ...row }) => summarise(row, entries));
}

export async function getTrip(userId: string, id: string) {
  const row = await findOwnedTrip(userId, id);
  const entryRows = await prisma.tripEntry.findMany({
    where: { tripId: id },
    select: ENTRY_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  const entries = entryRows.map(toEntry);
  const days = daysInclusive(row.startDate, row.endDate);

  // getWeather never throws and shares its cache with the weather endpoint, so
  // this adds no second upstream call when the client asks for both at once.
  const weather = await getWeather(row);
  const overall = weather.forecastAvailable ? weather.overall : null;

  const recommended = recommendPackingCounts({ days, weather: overall });
  const planned = countPlannedByCategory(
    entries.map((entry) => ({ packed: entry.packed, items: entryGarments(entry) })),
  );

  const manualRows = await prisma.tripCategoryCount.findMany({
    where: { tripId: id },
    select: { category: true, count: true },
  });
  const manual = new Map(manualRows.map((row) => [row.category, row.count]));

  const categories = CATEGORY_ORDER.flatMap((category) => {
    const recommendedCount = recommended[category] ?? null;
    const plannedCount = planned[category] ?? 0;
    const manualCount = manual.get(category) ?? 0;

    return recommendedCount === null && plannedCount === 0 && manualCount === 0
      ? []
      : [
          {
            category,
            recommended: recommendedCount,
            // From the wardrobe only; `manual` is added by the reader.
            planned: plannedCount,
            manual: manualCount,
          },
        ];
  });

  return {
    ...summarise(row, entries),
    entries,
    packing: {
      total: entries.length,
      packed: entries.filter((entry) => entry.packed).length,
      // Guidance only. Nothing server-side or client-side enforces it.
      categories,
    },
  };
}

export async function getTripWeather(userId: string, id: string): Promise<TripWeather> {
  return getWeather(await findOwnedTrip(userId, id));
}

/**
 * Coordinates come from a destination search when the client has one; otherwise
 * the free-text destination is geocoded here. Either way the server stores the
 * coordinates, so a weather lookup never geocodes again.
 */
async function locate(
  destination: string,
  latitude: number | undefined,
  longitude: number | undefined,
): Promise<{ destinationName: string; latitude: number; longitude: number }> {
  if (latitude !== undefined && longitude !== undefined) {
    return { destinationName: destination, latitude, longitude };
  }

  const found = await resolveDestination(destination);

  return { destinationName: found.label, latitude: found.latitude, longitude: found.longitude };
}

export async function createTrip(userId: string, input: CreateTripInput) {
  const place = await locate(input.destination, input.latitude, input.longitude);

  const row = await prisma.trip.create({
    data: {
      userId,
      name: input.name,
      ...place,
      startDate: parseCalendarDate(input.startDate),
      endDate: parseCalendarDate(input.endDate),
    },
    select: TRIP_SELECT,
  });

  return summarise(row, []);
}

export async function updateTrip(userId: string, id: string, input: UpdateTripInput) {
  const existing = await findOwnedTrip(userId, id);

  // A PATCH may carry only one date, so the range is checked on the merged
  // result — the schema alone cannot see the stored half.
  const startDate = input.startDate ?? formatCalendarDate(existing.startDate);
  const endDate = input.endDate ?? formatCalendarDate(existing.endDate);

  checkDateRange(startDate, endDate, (message) => {
    throw new HttpError(400, message);
  });

  const destinationChanged =
    input.destination !== undefined &&
    (input.destination !== existing.destinationName || input.latitude !== undefined);

  const place = destinationChanged
    ? await locate(input.destination ?? existing.destinationName, input.latitude, input.longitude)
    : {};

  const row = await prisma.trip.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...place,
      startDate: parseCalendarDate(startDate),
      endDate: parseCalendarDate(endDate),
    },
    select: { ...TRIP_SELECT, entries: { select: { packed: true } } },
  });

  const { entries, ...tripRow } = row;

  return summarise(tripRow, entries);
}

export async function deleteTrip(userId: string, id: string): Promise<void> {
  const { count } = await prisma.trip.deleteMany({ where: { id, userId } });

  if (count === 0) {
    throw new HttpError(404, 'Trip not found');
  }
}

export async function addTripEntry(userId: string, tripId: string, input: AddTripEntryInput) {
  await findOwnedTrip(userId, tripId);

  // Ownership of the target, checked the same way as everywhere else: scoped by
  // `userId`, so a foreign id is "not found". Adding a garment that is in the
  // laundry is deliberately allowed — the UI warns, the API never blocks.
  if (input.clothingItemId !== undefined) {
    const owned = await prisma.clothingItem.findFirst({
      where: { id: input.clothingItemId, userId },
      select: { id: true },
    });

    if (!owned) throw new HttpError(404, 'Garment not found');
  } else if (input.outfitId !== undefined) {
    const owned = await prisma.outfit.findFirst({
      where: { id: input.outfitId, userId },
      select: { id: true },
    });

    if (!owned) throw new HttpError(404, 'Outfit not found');
  }

  const count = await prisma.tripEntry.count({ where: { tripId } });

  if (count >= MAX_TRIP_ENTRIES) {
    throw new HttpError(400, `A trip can list at most ${String(MAX_TRIP_ENTRIES)} entries`);
  }

  try {
    await prisma.tripEntry.create({
      data: {
        tripId,
        ...(input.clothingItemId !== undefined ? { clothingItemId: input.clothingItemId } : {}),
        ...(input.outfitId !== undefined ? { outfitId: input.outfitId } : {}),
      },
    });
  } catch (error) {
    // The unique constraints are the source of truth for "already on the list".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'That is already on this trip');
    }

    throw error;
  }

  return getTrip(userId, tripId);
}

export async function removeTripEntry(
  userId: string,
  tripId: string,
  entryId: string,
): Promise<void> {
  const { count } = await prisma.tripEntry.deleteMany({
    where: { id: entryId, tripId, trip: { userId } },
  });

  if (count === 0) {
    throw new HttpError(404, 'Trip entry not found');
  }
}

export async function setEntryPacked(
  userId: string,
  tripId: string,
  entryId: string,
  packed: boolean,
) {
  const { count } = await prisma.tripEntry.updateMany({
    where: { id: entryId, tripId, trip: { userId } },
    data: { packed },
  });

  if (count === 0) {
    throw new HttpError(404, 'Trip entry not found');
  }

  return { id: entryId, packed };
}

/**
 * Sets how many items of a category are packed outside the app.
 *
 * Zero deletes the row, so "no row" and "0" mean the same thing.
 */
export async function setCategoryCount(
  userId: string,
  tripId: string,
  category: ClothingCategory,
  count: number,
) {
  await findOwnedTrip(userId, tripId);

  if (count === 0) {
    await prisma.tripCategoryCount.deleteMany({ where: { tripId, category } });
  } else {
    await prisma.tripCategoryCount.upsert({
      where: { tripId_category: { tripId, category } },
      create: { tripId, category, count },
      update: { count },
    });
  }

  return { category, count };
}
