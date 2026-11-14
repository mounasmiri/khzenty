/**
 * Development seed data.
 *
 * Idempotent and scoped: it deletes only the seeded users, and the `onDelete:
 * Cascade` on their relations clears their garments and outfits. Re-running
 * produces identical state without touching rows you added by hand.
 *
 * Run with `npm run db:seed`.
 *
 * The demo account is a full showcase: 29 garments, 10 outfits, two trips and
 * a short wear history, so every screen has something realistic to show.
 *
 * Photos are NOT invented. The five garments that have a real photo keep it:
 * their Cloudinary links are read before the demo user is deleted and put back
 * afterwards, because deleting the user would otherwise orphan them. Garments
 * without a photo stay without one; the run prints which.
 */
import { prisma } from '../src/config/prisma.js';
import { DEMO_EMAIL, UNUSABLE_PASSWORD_HASH } from '../src/lib/demo.js';
import {
  ClothingCategory,
  ClothingType,
  LaundryStatus,
  Occasion,
  Season,
} from '../src/generated/prisma/enums.js';
import { DEFAULT_PHOTOS_FILE, readPhotosFile } from './demo-photos.js';
import { decideSeedMode } from './seed-target.js';
import {
  ALL_SEASONS,
  DEMO_ITEMS,
  DEV_PASSWORD,
  seedDemoTemplate,
  seedUser,
  type KeptPhoto,
  type SeedItem,
  type SeedOutfit,
} from './demo-template.js';

/// `.test` is reserved by RFC 2606, so these can never collide with real
/// addresses.
const SECOND_EMAIL = 'second@khzenty.test';


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

async function printDemoSummary(userId: string): Promise<void> {
  const [items, outfits, wears, trips] = await Promise.all([
    prisma.clothingItem.findMany({
      where: { userId },
      select: { id: true, name: true, category: true, favorite: true, laundryStatus: true, imageUrl: true },
      orderBy: { category: 'asc' },
    }),
    prisma.outfit.findMany({
      where: { userId },
      select: { name: true, occasions: true, _count: { select: { items: true } } },
    }),
    prisma.wearLog.count({ where: { userId } }),
    prisma.trip.findMany({
      where: { userId },
      select: {
        name: true,
        startDate: true,
        endDate: true,
        entries: { select: { packed: true, clothingItemId: true, outfitId: true } },
        categoryCounts: { select: { category: true, count: true } },
      },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const byCategory = new Map<string, number>();
  for (const item of items) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);

  const withPhoto = items.filter((item) => item.imageUrl);
  const withoutPhoto = items.filter((item) => !item.imageUrl);

  console.log(`[seed] Demo wardrobe: ${items.length} garments`);
  console.log(`[seed]   by category: ${[...byCategory].map(([c, n]) => `${c} ${n}`).join(', ')}`);
  console.log(`[seed]   favourites: ${items.filter((i) => i.favorite).length}, in laundry: ${items.filter((i) => i.laundryStatus === LaundryStatus.IN_LAUNDRY).length}`);
  console.log(`[seed]   with photo: ${withPhoto.length} (${withPhoto.map((i) => i.name).join(', ')})`);
  console.log(`[seed]   WITHOUT photo (${withoutPhoto.length}) - none invented:`);
  for (const item of withoutPhoto) console.log(`[seed]     - ${item.name ?? item.id} (${item.id})`);
  console.log(`[seed] Outfits: ${outfits.length}`);
  for (const outfit of outfits) {
    console.log(`[seed]   - ${outfit.name} [${outfit.occasions.join(', ')}] ${outfit._count.items} garments`);
  }
  console.log(`[seed] Wear log: ${wears} entries`);
  for (const trip of trips) {
    const packed = trip.entries.filter((e) => e.packed).length;
    const manual = trip.categoryCounts.map((c) => `${c.category} ${c.count}`).join(', ') || 'none';
    console.log(
      `[seed] Trip "${trip.name}" ${trip.startDate.toISOString().slice(0, 10)} to ${trip.endDate.toISOString().slice(0, 10)}: ` +
        `${trip.entries.length} entries (${packed} packed), manual counts: ${manual}`,
    );
  }
}

async function main(): Promise<void> {
  // Refuses anything that is not a local database unless explicitly opted in.
  // `production` mode touches ONLY the demo template: no dev accounts, no
  // usable password, no other user's rows.
  const mode = decideSeedMode({
    nodeEnv: process.env['NODE_ENV'],
    databaseUrl: process.env['DATABASE_URL'] ?? '',
    allowProduction: process.env['SEED_ALLOW_PRODUCTION'],
  });
  const production = mode === 'production';

  console.log(`[seed] Mode: ${mode}${production ? ' (demo template only)' : ''}`);

  // Read before the delete below, which cascades to the garments and would
  // otherwise drop the only record of where each photo lives in Cloudinary.
  const kept = await prisma.clothingItem.findMany({
    where: { user: { email: DEMO_EMAIL }, imageUrl: { not: null } },
    select: { id: true, imageUrl: true, imagePublicId: true },
  });
  const photos = new Map<string, KeptPhoto>(
    kept.map((row) => [row.id, { imageUrl: row.imageUrl, imagePublicId: row.imagePublicId }]),
  );

  // A brand-new database has no photo links yet. Optionally take them from a
  // file exported from the dev database (`npm run db:export-demo-photos`);
  // anything already on the account wins, so a refresh never replaces a link.
  const photosFile = process.env['SEED_PHOTOS_FILE'];

  if (photosFile) {
    const fromFile = await readPhotosFile(photosFile === 'default' ? DEFAULT_PHOTOS_FILE : photosFile);
    let added = 0;

    for (const [id, photo] of fromFile) {
      if (!photos.has(id)) {
        photos.set(id, photo);
        added += 1;
      }
    }

    console.log(`[seed] Photo links from file: ${fromFile.size} (${added} new, ${fromFile.size - added} already present)`);
  }

  const seededIds = new Set(DEMO_ITEMS.map((item) => item.id));
  const orphaned = kept.filter((row) => !seededIds.has(row.id));

  if (orphaned.length > 0) {
    // Not part of the seed (added by hand), so it cannot be restored.
    console.warn(
      `[seed] WARNING: ${orphaned.length} photographed garment(s) on the demo account are not ` +
        `part of the seed and will be removed: ${orphaned.map((row) => row.id).join(', ')}`,
    );
  }

  // Cascade clears each user's garments, outfits, trips, wear log and membership rows.
  const { count } = await prisma.user.deleteMany({
    // Production: the template and nothing else.
    where: { email: { in: production ? [DEMO_EMAIL] : [DEMO_EMAIL, SECOND_EMAIL] } },
  });

  if (count > 0) {
    console.log(`[seed] Removed ${count} previously seeded user(s).`);
  }

  const demoId = await seedDemoTemplate(photos, production ? UNUSABLE_PASSWORD_HASH : undefined);

  if (!production) {
    await seedUser(SECOND_EMAIL, 'Second User', SECOND_ITEMS, SECOND_OUTFITS);
  }

  await printDemoSummary(demoId);

  const [users, clothingItems, outfits, outfitItems] = await Promise.all([
    prisma.user.count(),
    prisma.clothingItem.count(),
    prisma.outfit.count(),
    prisma.outfitItem.count(),
  ]);

  console.log(
    `[seed] Done. users=${users} clothingItems=${clothingItems} outfits=${outfits} outfitItems=${outfitItems}`,
  );
  if (production) {
    console.log('[seed] The template has no usable password; visitors reach it only through demo copies.');
  } else {
    console.log(`[seed] Dev login: ${DEMO_EMAIL} / ${DEV_PASSWORD}`);
  }
}

try {
  await main();
} catch (error) {
  console.error('[seed] Failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
