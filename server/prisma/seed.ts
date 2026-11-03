/**
 * Development seed data.
 *
 * Idempotent and scoped: it deletes only the seeded users, and the `onDelete:
 * Cascade` on their relations clears their garments and outfits. Re-running
 * produces identical state without touching rows you added by hand.
 *
 * Run with `npm run db:seed`.
 */
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import {
  ClothingCategory,
  ClothingType,
  Occasion,
  Season,
} from '../src/generated/prisma/enums.js';
import type { ClothingItemCreateWithoutUserInput } from '../src/generated/prisma/models.js';

/// `.test` is reserved by RFC 2606, so these can never collide with real
/// addresses.
const DEMO_EMAIL = 'demo@khzenty.test';
const SECOND_EMAIL = 'second@khzenty.test';

/// Shared by both seeded accounts so there is something to log in with during
/// development. Seed data only — these accounts never exist in production.
const DEV_PASSWORD = 'khzenty-dev-password';

const ALL_SEASONS = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER];

/**
 * Prisma's own generated input type rather than one inferred from the literals
 * below. Inferring produced a union of each literal's exact shape, which made
 * the two item lists mutually incompatible, and it would silently drift from
 * the schema.
 */
type SeedItem = ClothingItemCreateWithoutUserInput;

interface SeedOutfit {
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
const DEMO_ITEMS: SeedItem[] = [
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
];

/**
 * `seed_white_sneakers` and `seed_beige_chinos` each appear in two outfits,
 * which is the whole point of the join table — and what the
 * `OutfitItem.clothingItemId` index is for.
 */
const DEMO_OUTFITS: SeedOutfit[] = [
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
];

/// A second account exists so queries that forget to filter by `userId` show up
/// in development instead of in production.
const SECOND_ITEMS: SeedItem[] = [
  {
    id: 'seed2_black_dress',
    name: 'Black Cocktail Dress',
    category: ClothingCategory.DRESS,
    type: ClothingType.DRESS,
    color: 'Black',
    seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    favorite: true,
  },
  {
    id: 'seed2_black_heels',
    name: 'Black Heels',
    category: ClothingCategory.FOOTWEAR,
    type: ClothingType.HEELS,
    color: 'Black',
    seasons: ALL_SEASONS,
  },
];

const SECOND_OUTFITS: SeedOutfit[] = [
  {
    name: 'Dinner Party',
    occasions: [Occasion.PARTY, Occasion.FORMAL],
    itemIds: ['seed2_black_dress', 'seed2_black_heels'],
  },
];

async function seedUser(
  email: string,
  name: string,
  items: readonly SeedItem[],
  outfits: readonly SeedOutfit[],
): Promise<void> {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(DEV_PASSWORD),
      // Spread: Prisma's input type is mutable, the parameter is readonly.
      clothingItems: { create: [...items] },
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
}

async function main(): Promise<void> {
  // Cascade clears each user's garments, outfits, and membership rows.
  const { count } = await prisma.user.deleteMany({
    where: { email: { in: [DEMO_EMAIL, SECOND_EMAIL] } },
  });

  if (count > 0) {
    console.log(`[seed] Removed ${count} previously seeded user(s).`);
  }

  await seedUser(DEMO_EMAIL, 'Demo User', DEMO_ITEMS, DEMO_OUTFITS);
  await seedUser(SECOND_EMAIL, 'Second User', SECOND_ITEMS, SECOND_OUTFITS);

  const [users, clothingItems, outfits, outfitItems] = await Promise.all([
    prisma.user.count(),
    prisma.clothingItem.count(),
    prisma.outfit.count(),
    prisma.outfitItem.count(),
  ]);

  console.log(
    `[seed] Done. users=${users} clothingItems=${clothingItems} outfits=${outfits} outfitItems=${outfitItems}`,
  );
  console.log(`[seed] Dev login: ${DEMO_EMAIL} / ${DEV_PASSWORD}`);
}

try {
  await main();
} catch (error) {
  console.error('[seed] Failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
