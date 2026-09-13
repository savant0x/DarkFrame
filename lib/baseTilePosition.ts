/**
 * @file lib/baseTilePosition.ts
 * @created 2026-09-13
 * @overview FID-20260912-090 — the single seam for "where is this base?".
 *
 * The world's truth for a base's location is the TILES TABLE (tiles.base_owner
 * — written at spawn and by fix-base tooling). The players row's
 * currentPosition/baseX/baseY are bot-agent state that can drift (three live
 * beer bases had currentPosition ≠ their tile when this FID was written).
 *
 * Every surface that answers "can I attack/scan this base from where I stand?"
 * must resolve the base's coordinates HERE — presence checks compare against
 * the tile the player actually sees on the map, not a drifted agent column.
 *
 * Batch helper (`resolveBaseTilePositions`) serves list endpoints (one query,
 * not N). Resolution failure is non-fatal: callers fall back to the players
 * row so an unpaired row degrades to old behavior instead of 500ing.
 */
import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export interface BaseTilePosition {
  /** Tile coords of the base (from tiles.base_owner). */
  x: number;
  y: number;
  /** True when a tiles row owns this base; false = fell back to players row. */
  fromTile: boolean;
}

/**
 * Resolve one base's tile position. `fallback` is the players-row position
 * used only when no tile claims the base (should not happen; keeps reads safe).
 */
export async function resolveBaseTilePosition(
  owner: string,
  fallback: { x: number; y: number }
): Promise<BaseTilePosition> {
  const rows = await db
    .select({ x: tiles.x, y: tiles.y })
    .from(tiles)
    .where(inArray(tiles.baseOwner, [owner]))
    .limit(1);
  const tile = rows[0];
  if (!tile) return { ...fallback, fromTile: false };
  return { x: tile.x, y: tile.y, fromTile: true };
}

/**
 * Resolve tile positions for many bases in one query.
 * Returns a map owner → position (fallback applied for unpaired owners).
 */
export async function resolveBaseTilePositions(
  owners: string[],
  fallbacks: Record<string, { x: number; y: number }>
): Promise<Record<string, BaseTilePosition>> {
  const out: Record<string, BaseTilePosition> = {};
  for (const owner of owners) {
    const fb = fallbacks[owner] ?? { x: 0, y: 0 };
    out[owner] = { ...fb, fromTile: false };
  }
  if (owners.length === 0) return out;

  const rows = await db
    .select({ x: tiles.x, y: tiles.y, owner: tiles.baseOwner })
    .from(tiles)
    .where(inArray(tiles.baseOwner, owners));
  for (const row of rows) {
    if (row.owner) out[row.owner] = { x: row.x, y: row.y, fromTile: true };
  }
  return out;
}
