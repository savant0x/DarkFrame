/**
 * @file scripts/rebuildMap.ts
 * @overview Safely regenerate the game map from scratch (pg path).
 *
 * Replaces the legacy Mongo `scripts/regenerate-map.js`, which could never work
 * against the Postgres pivot. This tool:
 *   1. Warns and refuses to run without `--yes` (deleting 22,500 tiles is destructive).
 *   2. Deletes all tiles, regenerates via `lib/mapGeneration.initializeMap()`.
 *   3. Restores `occupied_by_base = 1` on every existing player's base tile
 *      (spawn flags live on tiles and would otherwise be lost by the wipe).
 *   4. Verifies totals and reports any base whose terrain changed type.
 *
 * Usage: npm run map:rebuild -- --yes
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const WARN_MSG = `⚠️  This DESTROYS and regenerates the entire 22,500-tile map.
   - Every tile is deleted and re-rolled (new random terrain everywhere).
   - Existing player/bot bases are re-flagged as occupied, but the terrain under
     a base may change type after the shuffle.
   Re-run with --yes to confirm:  npm run map:rebuild -- --yes`;

async function main(): Promise<void> {
  const flag = process.argv.slice(2).find((a) => a === '--yes' || a === '-y' || a === '--force');
  if (!flag) {
    console.log(WARN_MSG);
    process.exit(1);
  }

  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');
  const { players } = await import('../lib/db/schema');
  const { initializeMap } = await import('../lib/mapGeneration');

  const tileCount = await db.execute(sql`SELECT count(*)::int AS n FROM tiles`);
  console.log(`📊 Tiles before rebuild: ${tileCount.rows[0].n}`);

  const bases = await db
    .select({ username: players.username, x: players.baseX, y: players.baseY })
    .from(players)
    .where(sql`${players.baseX} IS NOT NULL AND ${players.baseY} IS NOT NULL`);
  console.log(`🏠 Player bases to re-flag as occupied: ${bases.length}`);

  console.log('🗑️  Deleting tiles...');
  await db.execute(sql`DELETE FROM tiles`);

  console.log('🔨 Regenerating map...');
  await initializeMap();

  // Restore occupancy on base tiles (spawn flags live on the tile rows)
  for (const base of bases) {
    if (base.x === null || base.y === null) continue;
    await db.execute(
      sql`UPDATE tiles SET occupied_by_base = 1 WHERE x = ${base.x} AND y = ${base.y}`,
    );
  }
  console.log(`✅ Re-flagged ${bases.length} occupied base tile(s)`);

  // Verify
  const after = await db.execute(sql`SELECT count(*)::int AS n FROM tiles`);
  const occupied = await db.execute(sql`SELECT count(*)::int AS n FROM tiles WHERE occupied_by_base = 1`);
  console.log(`📊 Tiles after rebuild: ${after.rows[0].n} | occupied: ${occupied.rows[0].n}`);

  for (const base of bases) {
    if (base.x === null || base.y === null) continue;
    const tile = await db.execute(
      sql`SELECT terrain FROM tiles WHERE x = ${base.x} AND y = ${base.y}`,
    );
    const terrain = tile.rows[0]?.terrain as string | undefined;
    const note = terrain !== 'Wasteland' ? ' ⚠️ terrain changed (no longer Wasteland)' : '';
    console.log(`   ${base.username} base (${base.x},${base.y}): ${terrain ?? 'MISSING'}${note}`);
  }

  console.log('\n✅ Map rebuild complete.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('❌ Map rebuild failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
