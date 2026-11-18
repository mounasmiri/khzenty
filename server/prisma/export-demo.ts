/**
 * Writes the local demo account (demo@khzenty.test) to a JSON file, so the demo
 * template in another database can be built from it.
 *
 * Read-only against the database. Run against the DEVELOPMENT database:
 *
 *   npm run db:export-demo                # writes prisma/demo-export.json
 *   npm run db:export-demo -- some.json
 *
 * Then seed with `SEED_DEMO_FILE=default` (see the README).
 */
import { writeFile } from 'node:fs/promises';

import { prisma } from '../src/config/prisma.js';
import { DEMO_EMAIL } from '../src/lib/demo.js';
import { buildDemoExport, DEFAULT_DEMO_FILE } from './demo-export.js';

try {
  const target = process.argv[2] ?? DEFAULT_DEMO_FILE;
  const data = await buildDemoExport();

  if (!data) {
    throw new Error(`No ${DEMO_EMAIL} account in this database. Run \`npm run db:seed\` first.`);
  }

  await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const photos = data.items.filter((item) => item.photo).length;

  console.log(
    `[export] Wrote ${target}: ${data.items.length} garments (${photos} with photo), ` +
      `${data.outfits.length} outfits, ${data.wears.length} wear entries, ${data.trips.length} trips.`,
  );
} catch (error) {
  console.error('[export] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
