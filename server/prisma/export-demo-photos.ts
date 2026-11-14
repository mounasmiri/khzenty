/**
 * Writes the demo template's photo links to a JSON file, so the first
 * production seed can attach the same photos.
 *
 * Read-only against the database. Run against the DEVELOPMENT database:
 *
 *   npm run db:export-demo-photos            # writes prisma/demo-photos.json
 *   npm run db:export-demo-photos -- some.json
 */
import { writeFile } from 'node:fs/promises';

import { prisma } from '../src/config/prisma.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { DEFAULT_PHOTOS_FILE, type PhotoFile } from './demo-photos.js';

try {
  const target = process.argv[2] ?? DEFAULT_PHOTOS_FILE;
  const rows = await prisma.clothingItem.findMany({
    where: { user: { email: DEMO_EMAIL }, imageUrl: { not: null }, imagePublicId: { not: null } },
    select: { id: true, imageUrl: true, imagePublicId: true },
    orderBy: { id: 'asc' },
  });

  const photos: PhotoFile = {};

  for (const row of rows) {
    photos[row.id] = { imageUrl: row.imageUrl as string, imagePublicId: row.imagePublicId as string };
  }

  await writeFile(target, `${JSON.stringify(photos, null, 2)}\n`, 'utf8');
  console.log(`[export] Wrote ${rows.length} photo link(s) to ${target}`);
} catch (error) {
  console.error('[export] Failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
