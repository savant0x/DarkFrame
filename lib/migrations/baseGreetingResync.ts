/**
 * @file lib/migrations/baseGreetingResync.ts
 * @created 2026-09-13
 * @overview FID-20260912-093 — boot self-heal giving every occupied base tile
 * a randomized greeting.
 *
 * tiles.base_greeting was never written by either spawn path, so every bot /
 * Beer Base on the map rendered the tile panel's "Base message" well empty.
 * This migration backfills all occupied tiles lacking a greeting (beer voice
 * for is_special_base owners, specialist warband chatter for the rest) and is
 * drift-guarded after: free when every occupied tile already has one.
 *
 * Same shape as the other resync migrations (0031_base_position_resync):
 * migrations marker + scan; never blocks startup.
 */
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { players, tiles, migrations } from '../db/schema';
import { generateBaseGreeting } from '../baseGreetings';

const MIGRATION_ID = '0032_base_greeting_resync';

export async function runBaseGreetingResyncMigration(): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  alreadyApplied?: boolean;
}> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" varchar(100) PRIMARY KEY,
      "applied_at" timestamp NOT NULL,
      "details" jsonb
    )
  `);

  const existing = await db.select().from(migrations).where(eq(migrations.id, MIGRATION_ID));
  const markerExists = existing.length > 0;

  // Occupied tiles still missing a greeting (drift-guard: none after heal).
  const occupied = await db
    .select({
      x: tiles.x,
      y: tiles.y,
      owner: tiles.baseOwner,
    })
    .from(tiles)
    .where(
      and(
        eq(tiles.occupiedByBase, 1),
        isNotNull(tiles.baseOwner),
        isNull(tiles.baseGreeting)
      )
    );

  const baseFlags = new Map<string, { isBeerBase: boolean; specialization: string | null }>();
  if (occupied.length > 0) {
    const owners = occupied.map((t) => t.owner as string);
    const rows = await db
      .select({
        username: players.username,
        isSpecialBase: players.isSpecialBase,
        botConfig: players.botConfig,
      })
      .from(players);
    for (const row of rows) {
      if (!owners.includes(row.username)) continue;
      const cfg = (row.botConfig ?? {}) as { specialization?: string };
      baseFlags.set(row.username, {
        isBeerBase: row.isSpecialBase === 1,
        specialization: cfg.specialization ?? null,
      });
    }
  }

  let modified = 0;
  for (const tile of occupied) {
    const flags = baseFlags.get(tile.owner as string) ?? { isBeerBase: false, specialization: null };
    const greeting = generateBaseGreeting(flags);
    const result = await db
      .update(tiles)
      .set({ baseGreeting: greeting })
      .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
    modified += result.rowCount ?? 0;
  }

  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: { modified, scanned: occupied.length },
    });
  }

  return {
    success: true,
    message: `Base greeting resync: ${modified} tile(s) greeted (${occupied.length} occupied scanned)`,
    modified,
    alreadyApplied: markerExists,
  };
}
