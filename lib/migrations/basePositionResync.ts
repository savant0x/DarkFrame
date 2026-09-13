/**
 * @file lib/migrations/basePositionResync.ts
 * @created 2026-09-13
 * @overview FID-20260912-090 — boot self-heal pinning base rows to their tiles.
 *
 * The world's truth for a base's location is tiles.base_owner. Bot-agent
 * position columns (currentPositionX/Y, baseX/Y) drifted on 3 of 6 live beer
 * bases, so the tile UI showed the base at (114,105) while the attack route
 * verified presence at (109,105) — standing on the base and attacking 403'd.
 *
 * Rule: for every isBot row that OWNS a tile, currentPosition and baseX/baseY
 * are pinned to that tile's coordinates. Regular bots move as agents, but their
 * tile claim is also their authoritative location (movement updates both — any
 * divergence is drift, and drift breaks every presence check). Same self-heal
 * shape as botTierResync.ts: migrations marker + drift scan; free when healthy.
 */
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { players, tiles, migrations } from '../db/schema';

const MIGRATION_ID = '0031_base_position_resync';

export async function runBasePositionResyncMigration(): Promise<{
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

  // Every bot-owned tile: the authoritative location per base row.
  const ownedTiles = await db
    .select({
      owner: tiles.baseOwner,
      x: tiles.x,
      y: tiles.y,
    })
    .from(tiles);

  const tileByOwner = new Map<string, { x: number; y: number }>();
  for (const t of ownedTiles) {
    if (t.owner) tileByOwner.set(t.owner, { x: t.x, y: t.y });
  }
  if (tileByOwner.size === 0) {
    return { success: true, message: 'No bot-owned tiles; nothing to resync', modified: 0, alreadyApplied: markerExists };
  }

  const bases = await db
    .select({
      username: players.username,
      isBot: players.isBot,
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
      baseX: players.baseX,
      baseY: players.baseY,
    })
    .from(players)
    .where(eq(players.isBot, 1));

  const needingUpdate = bases.filter((b) => {
    const tile = tileByOwner.get(b.username);
    if (!tile) return false;
    return (
      Number(b.currentPositionX) !== tile.x ||
      Number(b.currentPositionY) !== tile.y ||
      Number(b.baseX) !== tile.x ||
      Number(b.baseY) !== tile.y
    );
  });

  if (needingUpdate.length === 0 && markerExists) {
    return {
      success: true,
      message: 'Base position resync already applied (no drift)',
      modified: 0,
      alreadyApplied: true,
    };
  }

  for (const b of needingUpdate) {
    const tile = tileByOwner.get(b.username)!;
    await db
      .update(players)
      .set({ currentPositionX: tile.x, currentPositionY: tile.y, baseX: tile.x, baseY: tile.y })
      .where(eq(players.username, b.username));
  }

  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: { modified: needingUpdate.length, healed: needingUpdate.map((b) => b.username) },
    });
  } else {
    await db
      .update(migrations)
      .set({ appliedAt: new Date(), details: { modified: needingUpdate.length, healed: needingUpdate.map((b) => b.username) } })
      .where(eq(migrations.id, MIGRATION_ID));
  }

  return {
    success: true,
    message: `Base position resync complete: ${needingUpdate.length} of ${bases.length} bot rows pinned to their tiles`,
    modified: needingUpdate.length,
    alreadyApplied: false,
  };
}
