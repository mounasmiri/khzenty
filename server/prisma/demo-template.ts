/**
 * The demo account, as data plus the code that builds it.
 *
 * One builder, three users: `npm run db:seed` creates the template account with
 * it, the per-visitor demo sandbox clones that template's rows, and the tests
 * build a template with it rather than hand-writing fixtures that could drift
 * from what the seed really makes.
 *
 * Lives under `prisma/`, not `src/`, because it is seed data — the running
 * server never imports it. (It reads like application code only because it
 * speaks to the same Prisma client.)
 */
import { prisma } from '../src/config/prisma.js';
import { addDays, todayUtc } from '../src/lib/calendar-date.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { hashPassword } from '../src/lib/password.js';
import {
  ClothingCategory,
  ClothingType,
  LaundryStatus,
  Occasion,
  Season,
} from '../src/generated/prisma/enums.js';
import type { ClothingItemCreateWithoutUserInput } from '../src/generated/prisma/models.js';

/// Shared by both seeded accounts so there is something to log in with during
/// development. Seed data only — these accounts never exist in production.
export const DEV_PASSWORD = 'khzenty-dev-password';

export const ALL_SEASONS = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER];

/**
 * Prisma's own generated input type rather than one inferred from the literals
 * below. Inferring produced a union of each literal's exact shape, which made
 * the two item lists mutually incompatible, and it would silently drift from
 * the schema.
 */
export type SeedItem = ClothingItemCreateWithoutUserInput;

export interface SeedOutfit {
  name: string;
  occasions: Occasion[];
  itemIds: string[];
}

/**
 * Explicit ids rather than generated cuids, so the outfit wiring below reads
 * clearly and re-seeding yields the same ids every time.
 *
 * Note that `category` and `type` are paired by hand here. The database cannot
 * enforce that pairing — the service layer will need a validation map when item
 * creation is built.
 */
export const DEMO_ITEMS: SeedItem[] = [
  {
    id: 'seed_white_shirt',
    name: 'White Oxford Shirt',
    category: ClothingCategory.TOP,
    type: ClothingType.SHIRT,
    color: 'White',
    seasons: ALL_SEASONS,
    favorite: true,
  },
  {
    id: 'seed_grey_tshirt',
    name: 'Grey T-Shirt',
    category: ClothingCategory.TOP,
    type: ClothingType.TSHIRT,
    color: 'Grey',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    // Name deliberately omitted: `name` is optional, and the UI must fall back
    // to the type. Seeding one nameless garment keeps that path exercised.
    id: 'seed_black_tshirt',
    category: ClothingCategory.TOP,
    type: ClothingType.TSHIRT,
    color: 'Black',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_cream_sweater',
    name: 'Cream Knit Sweater',
    category: ClothingCategory.TOP,
    type: ClothingType.SWEATER,
    color: 'Cream',
    seasons: [Season.AUTUMN, Season.WINTER],
  },
  {
    id: 'seed_blue_jeans',
    name: 'Indigo Jeans',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.JEANS,
    color: 'Indigo',
    seasons: ALL_SEASONS,
    favorite: true,
  },
  {
    id: 'seed_beige_chinos',
    name: 'Beige Chinos',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.TROUSERS,
    color: 'Beige',
    seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
  },
  {
    id: 'seed_navy_blazer',
    name: 'Navy Blazer',
    category: ClothingCategory.OUTERWEAR,
    type: ClothingType.BLAZER,
    color: 'Navy',
    seasons: [Season.SPRING, Season.AUTUMN, Season.WINTER],
  },
  {
    id: 'seed_wool_coat',
    name: 'Charcoal Wool Coat',
    category: ClothingCategory.OUTERWEAR,
    type: ClothingType.COAT,
    color: 'Charcoal',
    seasons: [Season.WINTER],
  },
  {
    id: 'seed_white_sneakers',
    name: 'White Sneakers',
    category: ClothingCategory.FOOTWEAR,
    type: ClothingType.SNEAKERS,
    color: 'White',
    seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    favorite: true,
  },
  {
    id: 'seed_brown_boots',
    name: 'Brown Chelsea Boots',
    category: ClothingCategory.FOOTWEAR,
    type: ClothingType.BOOTS,
    color: 'Brown',
    seasons: [Season.AUTUMN, Season.WINTER],
  },
  {
    id: 'seed_leather_belt',
    name: 'Brown Leather Belt',
    category: ClothingCategory.ACCESSORY,
    type: ClothingType.BELT,
    color: 'Brown',
    seasons: ALL_SEASONS,
  },
  {
    id: 'seed_wool_scarf',
    name: 'Grey Wool Scarf',
    category: ClothingCategory.ACCESSORY,
    type: ClothingType.SCARF,
    color: 'Grey',
    seasons: [Season.WINTER],
  },
  {
    id: 'seed_running_top',
    name: 'Running Top',
    category: ClothingCategory.ACTIVEWEAR,
    type: ClothingType.SPORTS_TOP,
    color: 'Navy',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_running_shorts',
    name: 'Running Shorts',
    category: ClothingCategory.ACTIVEWEAR,
    type: ClothingType.SPORTS_BOTTOM,
    color: 'Black',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_summer_dress',
    name: 'Floral Summer Dress',
    category: ClothingCategory.DRESS,
    type: ClothingType.DRESS,
    color: 'Green',
    seasons: [Season.SUMMER],
  },

  // --- Added for the showcase wardrobe (no photos yet) ---------------------
  {
    id: 'seed_denim_jacket',
    name: 'Light Denim Jacket',
    category: ClothingCategory.OUTERWEAR,
    type: ClothingType.JACKET,
    color: 'Light Blue',
    seasons: [Season.SPRING, Season.AUTUMN],
    favorite: true,
  },
  {
    id: 'seed_linen_shirt',
    name: 'Sand Linen Shirt',
    category: ClothingCategory.TOP,
    type: ClothingType.SHIRT,
    color: 'Sand',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_striped_tee',
    name: 'Breton Striped Tee',
    category: ClothingCategory.TOP,
    type: ClothingType.TSHIRT,
    color: 'Navy',
    seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
  },
  {
    id: 'seed_black_hoodie',
    name: 'Black Zip Hoodie',
    category: ClothingCategory.TOP,
    type: ClothingType.HOODIE,
    color: 'Black',
    seasons: [Season.AUTUMN, Season.WINTER],
  },
  {
    id: 'seed_olive_trousers',
    name: 'Olive Cargo Trousers',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.TROUSERS,
    color: 'Olive',
    seasons: [Season.SPRING, Season.AUTUMN],
  },
  {
    id: 'seed_black_trousers',
    name: 'Black Tailored Trousers',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.TROUSERS,
    color: 'Black',
    seasons: ALL_SEASONS,
  },
  {
    id: 'seed_khaki_shorts',
    name: 'Khaki Shorts',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.SHORTS,
    color: 'Khaki',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_midi_skirt',
    name: 'Burgundy Pleated Skirt',
    category: ClothingCategory.BOTTOM,
    type: ClothingType.SKIRT,
    color: 'Burgundy',
    seasons: [Season.AUTUMN, Season.WINTER],
  },
  {
    id: 'seed_emerald_dress',
    name: 'Emerald Satin Dress',
    category: ClothingCategory.DRESS,
    type: ClothingType.DRESS,
    color: 'Emerald',
    seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    favorite: true,
  },
  {
    id: 'seed_block_heels',
    name: 'Black Block Heels',
    category: ClothingCategory.FOOTWEAR,
    type: ClothingType.HEELS,
    color: 'Black',
    seasons: ALL_SEASONS,
  },
  {
    id: 'seed_tan_sandals',
    name: 'Tan Leather Sandals',
    category: ClothingCategory.FOOTWEAR,
    type: ClothingType.SANDALS,
    color: 'Tan',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_sunglasses',
    name: 'Tortoiseshell Sunglasses',
    category: ClothingCategory.ACCESSORY,
    type: ClothingType.SUNGLASSES,
    color: 'Tortoise',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_straw_tote',
    name: 'Straw Tote Bag',
    category: ClothingCategory.ACCESSORY,
    type: ClothingType.BAG,
    color: 'Natural',
    seasons: [Season.SPRING, Season.SUMMER],
  },
  {
    id: 'seed_silver_watch',
    name: 'Silver Watch',
    category: ClothingCategory.ACCESSORY,
    type: ClothingType.WATCH,
    color: 'Silver',
    seasons: ALL_SEASONS,
  },
];

/**
 * `seed_white_sneakers` and `seed_beige_chinos` each appear in two outfits,
 * which is the whole point of the join table — and what the
 * `OutfitItem.clothingItemId` index is for.
 */
export const DEMO_OUTFITS: SeedOutfit[] = [
  {
    name: 'Monday Meeting',
    occasions: [Occasion.WORK, Occasion.FORMAL],
    itemIds: [
      'seed_white_shirt',
      'seed_navy_blazer',
      'seed_beige_chinos',
      'seed_brown_boots',
      'seed_leather_belt',
    ],
  },
  {
    name: 'Weekend Coffee',
    occasions: [Occasion.CASUAL],
    itemIds: ['seed_grey_tshirt', 'seed_blue_jeans', 'seed_white_sneakers'],
  },
  {
    name: 'Winter Commute',
    occasions: [Occasion.WORK, Occasion.TRAVEL],
    itemIds: [
      'seed_cream_sweater',
      'seed_beige_chinos',
      'seed_wool_coat',
      'seed_wool_scarf',
      'seed_brown_boots',
    ],
  },
  {
    name: 'Morning Run',
    occasions: [Occasion.SPORT],
    itemIds: ['seed_running_top', 'seed_running_shorts', 'seed_white_sneakers'],
  },
  {
    name: 'Casual Friday',
    occasions: [Occasion.WORK, Occasion.CASUAL],
    itemIds: [
      'seed_striped_tee',
      'seed_denim_jacket',
      'seed_olive_trousers',
      'seed_white_sneakers',
    ],
  },
  {
    name: 'Wedding Guest',
    occasions: [Occasion.FORMAL, Occasion.PARTY],
    itemIds: ['seed_emerald_dress', 'seed_block_heels', 'seed_silver_watch'],
  },
  {
    name: 'Beach Day',
    occasions: [Occasion.TRAVEL, Occasion.CASUAL],
    itemIds: [
      'seed_linen_shirt',
      'seed_khaki_shorts',
      'seed_tan_sandals',
      'seed_sunglasses',
      'seed_straw_tote',
    ],
  },
  {
    name: 'Smart Dinner',
    occasions: [Occasion.FORMAL, Occasion.PARTY],
    itemIds: [
      'seed_white_shirt',
      'seed_black_trousers',
      'seed_brown_boots',
      'seed_silver_watch',
    ],
  },
  {
    name: 'Lazy Sunday',
    occasions: [Occasion.HOME, Occasion.CASUAL],
    itemIds: ['seed_black_hoodie', 'seed_blue_jeans', 'seed_white_sneakers'],
  },
  {
    name: 'Summer Brunch',
    occasions: [Occasion.CASUAL, Occasion.PARTY],
    itemIds: [
      'seed_summer_dress',
      'seed_tan_sandals',
      'seed_straw_tote',
      'seed_sunglasses',
    ],
  },
];

/**
 * Garments in the wash. Two are left over from yesterday's run (see
 * `DEMO_WEARS`); the other two give the laundry basket and the trip's laundry
 * warning something to show. `seed_linen_shirt` is also on the Dubai trip.
 */
export const DEMO_LAUNDRY = [
  'seed_running_top',
  'seed_running_shorts',
  'seed_black_hoodie',
  'seed_linen_shirt',
];

/**
 * Recent wearings, newest first. `changedItemIds` is what wearing the outfit
 * moved into the wash, so Undo restores exactly that: only yesterday's run is
 * still unwashed; the older entries changed nothing that is still in the basket.
 */
export const DEMO_WEARS: { outfit: string; daysAgo: number; changedItemIds: string[] }[] = [
  { outfit: 'Morning Run', daysAgo: 1, changedItemIds: ['seed_running_top', 'seed_running_shorts'] },
  { outfit: 'Casual Friday', daysAgo: 3, changedItemIds: [] },
  { outfit: 'Monday Meeting', daysAgo: 5, changedItemIds: [] },
  { outfit: 'Weekend Coffee', daysAgo: 6, changedItemIds: [] },
  { outfit: 'Smart Dinner', daysAgo: 9, changedItemIds: [] },
];

export interface DemoTrip {
  name: string;
  destinationName: string;
  latitude: number;
  longitude: number;
  /** Days from today to the first day, so the forecast window is predictable. */
  startsInDays: number;
  days: number;
}

/**
 * Coordinates are fixed rather than geocoded, so seeding works offline and
 * gives the same result every time.
 *
 * Dubai starts within the forecast window (the weather strip shows real
 * numbers); Lisbon is far enough out to show "forecast not available".
 */
export const DEMO_TRIPS: Record<'dubai' | 'lisbon', DemoTrip> = {
  dubai: {
    name: 'Dubai, 7 days',
    destinationName: 'Dubai, United Arab Emirates',
    latitude: 25.2048,
    longitude: 55.2708,
    startsInDays: 5,
    days: 7,
  },
  lisbon: {
    name: 'Lisbon city break',
    destinationName: 'Lisbon, Lisbon District, Portugal',
    latitude: 38.7223,
    longitude: -9.1393,
    startsInDays: 38,
    days: 4,
  },
};

export const DUBAI_ITEM_IDS = [
  'seed_linen_shirt',
  'seed_striped_tee',
  'seed_grey_tshirt',
  'seed_khaki_shorts',
  'seed_tan_sandals',
  'seed_white_sneakers',
  'seed_sunglasses',
  'seed_straw_tote',
  'seed_silver_watch',
];
export const DUBAI_OUTFIT_NAMES = ['Beach Day', 'Smart Dinner'];
/** Ticked off already. */
export const DUBAI_PACKED_ITEM_IDS = ['seed_sunglasses', 'seed_striped_tee', 'seed_white_sneakers'];
/** Underwear and socks share one category, so one count covers both. */
export const DUBAI_MANUAL_COUNTS = { [ClothingCategory.UNDERWEAR]: 6 };


export interface KeptPhoto {
  imageUrl: string | null;
  imagePublicId: string | null;
}

export async function seedUser(
  email: string,
  name: string,
  items: readonly SeedItem[],
  outfits: readonly SeedOutfit[],
  photos: ReadonlyMap<string, KeptPhoto> = new Map(),
  /**
   * Defaults to a hash of the published dev password, which is fine locally.
   * A production template must pass an unusable hash instead: its password
   * would otherwise be public, and anyone could sign in and edit the account
   * every demo copy is cloned from.
   */
  passwordHash?: string,
): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: passwordHash ?? (await hashPassword(DEV_PASSWORD)),
      // Spread: Prisma's input type is mutable, the parameter is readonly.
      clothingItems: {
        create: items.map((item) => ({ ...item, ...(photos.get(item.id as string) ?? {}) })),
      },
    },
  });

  for (const outfit of outfits) {
    await prisma.outfit.create({
      data: {
        userId: user.id,
        name: outfit.name,
        occasions: outfit.occasions,
        items: {
          create: outfit.itemIds.map((clothingItemId) => ({ clothingItemId })),
        },
      },
    });
  }

  return user.id;
}

/**
 * Everything on the demo account beyond the plain wardrobe and outfits:
 * laundry, wear history and the two trips. Scoped to `userId` throughout.
 */
export async function seedDemoExtras(userId: string): Promise<void> {
  await prisma.clothingItem.updateMany({
    where: { userId, id: { in: DEMO_LAUNDRY } },
    data: { laundryStatus: LaundryStatus.IN_LAUNDRY, laundryAt: addDays(new Date(), -1) },
  });

  const outfits = await prisma.outfit.findMany({ where: { userId }, select: { id: true, name: true } });
  const outfitId = (name: string): string => {
    const found = outfits.find((outfit) => outfit.name === name);

    if (!found) throw new Error(`Seed outfit not found: ${name}`);

    return found.id;
  };

  for (const wear of DEMO_WEARS) {
    await prisma.wearLog.create({
      data: {
        userId,
        outfitId: outfitId(wear.outfit),
        wornAt: addDays(new Date(), -wear.daysAgo),
        changedItemIds: wear.changedItemIds,
      },
    });
  }

  const today = todayUtc();
  const createTrip = (trip: DemoTrip) =>
    prisma.trip.create({
      data: {
        userId,
        name: trip.name,
        destinationName: trip.destinationName,
        latitude: trip.latitude,
        longitude: trip.longitude,
        startDate: addDays(today, trip.startsInDays),
        endDate: addDays(today, trip.startsInDays + trip.days - 1),
      },
    });

  const dubai = await createTrip(DEMO_TRIPS.dubai);
  await createTrip(DEMO_TRIPS.lisbon);

  for (const clothingItemId of DUBAI_ITEM_IDS) {
    await prisma.tripEntry.create({
      data: {
        tripId: dubai.id,
        clothingItemId,
        packed: DUBAI_PACKED_ITEM_IDS.includes(clothingItemId),
      },
    });
  }

  for (const name of DUBAI_OUTFIT_NAMES) {
    await prisma.tripEntry.create({ data: { tripId: dubai.id, outfitId: outfitId(name) } });
  }

  for (const [category, count] of Object.entries(DUBAI_MANUAL_COUNTS)) {
    await prisma.tripCategoryCount.create({
      data: { tripId: dubai.id, category: category as ClothingCategory, count },
    });
  }
}


/**
 * Creates the template demo account exactly as the seed script does, minus the
 * deletion of a previous one and the photo restore. Returns its id.
 */
export async function seedDemoTemplate(
  photos: ReadonlyMap<string, KeptPhoto> = new Map(),
  passwordHash?: string,
): Promise<string> {
  const id = await seedUser(DEMO_EMAIL, 'Demo User', DEMO_ITEMS, DEMO_OUTFITS, photos, passwordHash);
  await seedDemoExtras(id);

  return id;
}
