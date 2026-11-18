import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/config/prisma.js';
import { addDays, daysInclusive, formatCalendarDate, todayUtc } from '../src/lib/calendar-date.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { createDemoSession } from '../src/services/demo-session.service.js';
import {
  buildDemoExport,
  importDemoExport,
  parseDemoExport,
  photosOf,
  readDemoExport,
  type DemoExport,
} from '../prisma/demo-export.js';
import { DEMO_ITEMS, DEMO_OUTFITS, seedDemoTemplate } from '../prisma/demo-template.js';
import { createUser, resetDatabase } from './helpers.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PHOTO = {
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/khzenty/a.webp',
  imagePublicId: 'khzenty/a',
};

const daysBefore = (date: Date, now: Date): number => daysInclusive(todayUtc(date), todayUtc(now)) - 1;

/**
 * Everything the app shows for the demo account, with every date expressed
 * relative to `now`. Equal snapshots mean the same demo, whenever it was seeded.
 */
async function snapshot(userId: string, now: Date) {
  const [items, outfits, wears, trips] = await Promise.all([
    prisma.clothingItem.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.outfit.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    }),
    prisma.wearLog.findMany({
      where: { userId },
      orderBy: [{ wornAt: 'desc' }, { id: 'desc' }],
      include: { outfit: { select: { name: true } } },
    }),
    prisma.trip.findMany({
      where: { userId },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        entries: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { outfit: { select: { name: true } } },
        },
        categoryCounts: { orderBy: { category: 'asc' } },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      type: item.type,
      color: item.color,
      seasons: item.seasons,
      favorite: item.favorite,
      laundryStatus: item.laundryStatus,
      laundryDaysAgo: item.laundryAt ? daysBefore(item.laundryAt, now) : null,
      imageUrl: item.imageUrl,
      imagePublicId: item.imagePublicId,
    })),
    outfits: outfits.map((outfit) => ({
      name: outfit.name,
      occasions: outfit.occasions,
      layout: outfit.layout,
      itemIds: outfit.items.map((member) => member.clothingItemId),
    })),
    wears: wears.map((log) => ({
      outfit: log.outfit.name,
      daysAgo: daysBefore(log.wornAt, now),
      changedItemIds: log.changedItemIds,
    })),
    trips: trips.map((trip) => ({
      name: trip.name,
      destinationName: trip.destinationName,
      latitude: trip.latitude,
      longitude: trip.longitude,
      startsInDays: -daysBefore(trip.startDate, now),
      endsInDays: -daysBefore(trip.endDate, now),
      entries: trip.entries.map((entry) => ({
        itemId: entry.clothingItemId,
        outfit: entry.outfit?.name ?? null,
        packed: entry.packed,
      })),
      manualCounts: trip.categoryCounts.map((row) => ({ category: row.category, count: row.count })),
    })),
  };
}

async function demoId(): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ where: { email: DEMO_EMAIL }, select: { id: true } });

  return user.id;
}

/** What the importer would have to leave alone. */
async function bystanderRows(userId: string) {
  return {
    items: await prisma.clothingItem.count({ where: { userId } }),
    outfits: await prisma.outfit.count({ where: { userId } }),
  };
}

describe('demo export / import round trip', () => {
  const layout = {
    version: 1,
    placements: [{ itemId: 'seed_white_shirt', x: 0.1, y: 0.2, width: 0.3, height: 0.4 }],
  };

  let exported: DemoExport;
  let original: Awaited<ReturnType<typeof snapshot>>;
  const exportedAt = new Date();

  beforeAll(async () => {
    await resetDatabase();
    const id = await seedDemoTemplate();

    // Give the account what a curated dev account has and the seed does not:
    // photo links, an outfit layout, and an item whose link was left half-written.
    await prisma.clothingItem.updateMany({
      where: { userId: id, id: { in: ['seed_white_shirt', 'seed_blue_jeans'] } },
      data: PHOTO,
    });
    await prisma.outfit.updateMany({ where: { userId: id, name: 'Weekend Coffee' }, data: { layout } });

    // Taken before the half-written link below, which the export drops on purpose.
    original = await snapshot(id, exportedAt);
    await prisma.clothingItem.update({ where: { id: 'seed_grey_tshirt' }, data: { imageUrl: PHOTO.imageUrl } });
    const built = await buildDemoExport(exportedAt);

    if (!built) throw new Error('expected a demo account to export');

    exported = built;
  });

  beforeEach(async () => {
    // Back to "template exists" for every test.
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('exports every part of the demo account', () => {
    expect(exported.items).toHaveLength(DEMO_ITEMS.length);
    expect(exported.outfits).toHaveLength(DEMO_OUTFITS.length);
    expect(exported.wears).toHaveLength(5);
    expect(exported.trips.map((trip) => trip.name)).toEqual(['Dubai, 7 days', 'Lisbon city break']);

    const dubai = exported.trips[0];

    expect(dubai?.entries.filter((entry) => entry.outfitRef)).toHaveLength(2);
    expect(dubai?.entries.filter((entry) => entry.packed)).toHaveLength(3);
    expect(dubai?.manualCounts).toEqual([{ category: 'UNDERWEAR', count: 6 }]);
    expect(exported.items.filter((item) => item.laundryStatus === 'IN_LAUNDRY')).toHaveLength(4);
  });

  it('keeps photo links, and drops a half-written one', () => {
    const photos = photosOf(exported);

    expect([...photos.keys()].sort()).toEqual(['seed_blue_jeans', 'seed_white_shirt']);
    expect(photos.get('seed_white_shirt')).toEqual(PHOTO);
    expect(exported.items.find((item) => item.id === 'seed_grey_tshirt')?.photo).toBeNull();
  });

  it('holds only relative dates and no account data', () => {
    const text = JSON.stringify(exported);

    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain(DEMO_EMAIL);
    expect(text).not.toMatch(/passwordHash|createdAt|"userId"/);

    // Dubai begins five days out and runs seven days; Lisbon is far out.
    expect(exported.trips[0]).toMatchObject({ startsInDays: 5, endsInDays: 11 });
    expect(exported.wears.map((wear) => wear.daysAgo)).toEqual([1, 3, 5, 6, 9]);
  });

  it('rebuilds an identical demo account after going through a JSON file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'khzenty-demo-'));

    try {
      const path = join(dir, 'demo.json');
      await writeFile(path, JSON.stringify(exported, null, 2), 'utf8');

      await importDemoExport(await readDemoExport(path), { now: exportedAt });

      expect(await snapshot(await demoId(), exportedAt)).toEqual(original);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps dates relative to the time of seeding', async () => {
    const later = new Date(exportedAt.getTime() + 10 * MS_PER_DAY);

    await importDemoExport(exported, { now: later });

    // Same demo as before, viewed from ten days later: nothing is stale.
    expect(await snapshot(await demoId(), later)).toEqual(original);

    const dubai = await prisma.trip.findFirstOrThrow({ where: { user: { email: DEMO_EMAIL }, name: 'Dubai, 7 days' } });

    expect(formatCalendarDate(dubai.startDate)).toBe(formatCalendarDate(addDays(todayUtc(later), 5)));
  });

  it('lets a link already on the account win over the file, without losing the rest', async () => {
    const mine = { imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/mine.webp', imagePublicId: 'mine' };
    const photos = new Map([...photosOf(exported), ['seed_white_shirt', mine]]);

    await importDemoExport(exported, { photos, now: exportedAt });

    const shirt = await prisma.clothingItem.findUniqueOrThrow({ where: { id: 'seed_white_shirt' } });
    const jeans = await prisma.clothingItem.findUniqueOrThrow({ where: { id: 'seed_blue_jeans' } });

    expect(shirt).toMatchObject(mine);
    expect(jeans).toMatchObject(PHOTO);
  });

  it('is idempotent: re-importing after deleting the template gives the same account', async () => {
    await importDemoExport(exported, { now: exportedAt });
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
    await importDemoExport(exported, { now: exportedAt });

    expect(await prisma.user.count({ where: { email: DEMO_EMAIL } })).toBe(1);
    expect(await snapshot(await demoId(), exportedAt)).toEqual(original);
  });

  it('never touches another account', async () => {
    const bystander = await createUser('bystander-export@khzenty.test');
    await prisma.clothingItem.create({
      data: { userId: bystander.id, category: 'TOP', type: 'TSHIRT', name: 'Mine' },
    });
    const before = await bystanderRows(bystander.id);

    await importDemoExport(exported, { now: exportedAt });

    expect(await bystanderRows(bystander.id)).toEqual(before);
    expect(await prisma.user.count({ where: { email: 'bystander-export@khzenty.test' } })).toBe(1);
    await prisma.user.delete({ where: { id: bystander.id } });
  });

  it('writes the template with an unusable password when asked, and the dev one otherwise', async () => {
    await importDemoExport(exported, { passwordHash: '!', now: exportedAt });
    expect((await prisma.user.findFirstOrThrow({ where: { email: DEMO_EMAIL } })).passwordHash).toBe('!');
    expect((await prisma.user.findFirstOrThrow({ where: { email: DEMO_EMAIL } })).isDemo).toBe(false);

    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
    await importDemoExport(exported, { now: exportedAt });
    expect((await prisma.user.findFirstOrThrow({ where: { email: DEMO_EMAIL } })).passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('produces a template the per-visitor clone can copy, layout and photos included', async () => {
    await importDemoExport(exported, { now: new Date() });

    const visitor = await createDemoSession();
    const copy = await snapshot(visitor.id, new Date());
    const clonedLayout = copy.outfits.find((outfit) => outfit.name === 'Weekend Coffee')?.layout as {
      placements: { itemId: string }[];
    };

    expect(copy.items).toHaveLength(exported.items.length);
    expect(copy.items.filter((item) => item.imageUrl)).toHaveLength(2);
    expect(copy.trips).toHaveLength(2);
    expect(copy.wears).toHaveLength(5);
    // The layout names the copy's garments, not the template's.
    const placement = clonedLayout.placements[0];

    expect(placement?.itemId).not.toBe('seed_white_shirt');
    expect(copy.items.map((item) => item.id)).toContain(placement?.itemId);
    expect(copy.trips[0]).toMatchObject({ startsInDays: 5, endsInDays: 11 });
  });

  it('exporting an imported template reproduces the same export', async () => {
    await importDemoExport(exported, { now: exportedAt });

    expect(await buildDemoExport(exportedAt)).toEqual(exported);
  });

  describe('validation', () => {
    const clone = (): DemoExport => structuredClone(exported);
    const rejects = (mutate: (data: DemoExport) => void, message: RegExp) => {
      const data = clone();
      mutate(data);
      expect(() => parseDemoExport(data)).toThrow(message);
    };

    it('accepts what the exporter wrote', () => {
      expect(() => parseDemoExport(clone())).not.toThrow();
    });

    it('rejects an unknown version, a missing section or a non-object', () => {
      expect(() => parseDemoExport({ ...clone(), version: 2 })).toThrow(/invalid/);
      expect(() => parseDemoExport({ version: 1 })).toThrow(/invalid/);
      expect(() => parseDemoExport([])).toThrow(/invalid/);
      expect(() => parseDemoExport(null)).toThrow(/invalid/);
    });

    it('rejects a photo that is not a Cloudinary https link', () => {
      rejects((d) => {
        d.items[0]!.photo = { imageUrl: 'https://evil.example/x.webp', imagePublicId: 'x' };
      }, /Cloudinary/);
      rejects((d) => {
        d.items[0]!.photo = { imageUrl: PHOTO.imageUrl, imagePublicId: '' };
      }, /invalid/);
    });

    it('rejects a category that does not match the type, and duplicate ids', () => {
      rejects((d) => {
        d.items[0]!.category = 'FOOTWEAR';
      }, /does not match/);
      rejects((d) => {
        d.items[1]!.id = d.items[0]!.id;
      }, /duplicate garment/);
    });

    it('rejects references to garments or outfits that are not in the file', () => {
      rejects((d) => {
        d.outfits[0]!.itemIds.push('ghost');
      }, /unknown garment "ghost"/);
      rejects((d) => {
        d.wears[0]!.outfitRef = 'ghost';
      }, /unknown outfit "ghost"/);
      rejects((d) => {
        d.trips[0]!.entries.push({ itemId: 'ghost', packed: false });
      }, /unknown garment "ghost"/);
    });

    it('rejects a trip entry with both or neither target, a repeat, or reversed dates', () => {
      rejects((d) => {
        d.trips[0]!.entries.push({ itemId: 'seed_white_shirt', outfitRef: 'outfit_1', packed: false });
      }, /exactly one/);
      rejects((d) => {
        d.trips[0]!.entries.push({ packed: false });
      }, /exactly one/);
      rejects((d) => {
        d.trips[0]!.entries.push({ ...d.trips[0]!.entries[0]! });
      }, /twice/);
      rejects((d) => {
        d.trips[0]!.endsInDays = d.trips[0]!.startsInDays - 1;
      }, /ends before/);
    });

    it('explains a missing or malformed file', async () => {
      await expect(readDemoExport(join(tmpdir(), 'no-such-demo-export.json'))).rejects.toThrow(/Could not read/);

      const dir = await mkdtemp(join(tmpdir(), 'khzenty-demo-'));

      try {
        const path = join(dir, 'bad.json');
        await writeFile(path, '{ not json', 'utf8');
        await expect(readDemoExport(path)).rejects.toThrow(/Could not read/);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});
