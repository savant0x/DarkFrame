/**
 * @file lib/migrations/shipTerrainHeal.ts
 * @created 2026-09-13
 * @overview FID-20260912-089 (found-in-flight) — boot self-heal that removes
 * orphaned `SHIP` terrain rows.
 *
 * Why this exists: two tiles at (25,110)/(26,110) hold terrain 'SHIP' —
 * remnants of a removed water/naval feature. `SHIP` has no wire character in
 * lib/terrainCodec.ts (by design — Law 14: fail loudly, never fabricate
 * terrain), so ONE unknown row made GET /api/map/terrain throw → 500 → the
 * map page silently fell back to generateMockMapData(). Real terrain has been
 * invisible behind the fallback until this was caught live.
 *
 * Healing rule: any terrain value not expressible in the wire codec is
 * demoted to Wasteland (the map's neutral fill), guarded by a migrations
 * marker (same shape as botTierResync.ts). Re-runs are free: the drift scan
 * counts non-codec terrain values and no-ops when zero.
 */
import { sql, eq, notInArray, and } from 'drizzle-orm';
import { db } from '../db';
import { tiles, migrations } from '../db/schema';
import { TerrainType } from '../../types/game.types';

const MIGRATION_ID = '0030_ship_terrain_heal';

/** Every terrain value the wire codec can express (single source: TERRAIN_TO_CHAR). */
export function codecTerrainValues(): string[] {
  return Object.values(TerrainType).filter((t) =>
    ['Metal', 'Energy', 'Cave', 'Forest', 'Factory', 'Wasteland', 'Bank', 'Shrine', 'AuctionHouse'].includes(t)
  );
}

export async function runShipTerrainHealMigration(): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  alreadyApplied?: boolean;
}> {
  // Self-heal the bookkeeping table (same as botTierResync.ts).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" varchar(100) PRIMARY KEY,
      "applied_at" timestamp NOT NULL,
      "details" jsonb
    )
  `);

  const existing = await db.select().from(migrations).where(eq(migrations.id, MIGRATION_ID));
  const markerExists = existing.length > 0;

  // Count every tile whose terrain cannot be encoded to the wire format.
  const valid = codecTerrainValues();
  const unknown = await db
    .select({ terrain: tiles.terrain })
    .from(tiles)
    .where(and(notInArray(tiles.terrain, valid)));

  if (unknown.length === 0 && markerExists) {
    return {
      success: true,
      message: 'Ship terrain heal already applied (no unknown terrain)',
      modified: 0,
      alreadyApplied: true,
    };
  }

  const result = await db
    .update(tiles)
    .set({ terrain: TerrainType.Wasteland })
    .where(and(notInArray(tiles.terrain, valid)))
    .returning({ x: tiles.x, y: tiles.y });

  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: { modified: result.length, healed: result.map((r) => `${r.x},${r.y}`) },
    });
  } else {
    await db
      .update(migrations)
      .set({ appliedAt: new Date(), details: { modified: result.length, healed: result.map((r) => `${r.x},${r.y}`) } })
      .where(eq(migrations.id, MIGRATION_ID));
  }

  return {
    success: true,
    message: `Ship terrain heal complete: ${result.length} unknown-terrain tile(s) demoted to Wasteland`,
    modified: result.length,
    alreadyApplied: false,
  };
}
