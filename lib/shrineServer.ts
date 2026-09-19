/**
 * @file lib/shrineServer.ts
 * @created 2026-09-17
 * @updated 2026-09-19 (FID-20260917-017 batch 4: shim → direct drizzle)
 * @overview Shared server-side shrine presence enforcement (FID-20260917-002)
 *
 * OVERVIEW:
 * The deleted legacy routes (sacrifice/extend) inlined a tiles lookup to refuse
 * off-shrine boost actions; the live pair (activate/boost-all) had lost that
 * check entirely — presence was enforced only by the client's keyboard handler.
 * This helper restores one server-side truth for every shrine write surface
 * (Law 13: the pattern appears in two live routes → one function).
 */

import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { TerrainType } from '@/types';
import type { Player } from '@/types';

/**
 * Verify the player's current position is the Shrine of Remembrance tile.
 *
 * Reads the tile at the player's currentPosition and compares terrain. Returns
 * false when the tile cannot be read or is not a Shrine (fail-closed: the
 * caller refuses the action).
 *
 * @param player - The domain player row (currentPosition.x/y — the same shape
 *                 every caller reads from the pg domain loaders).
 */
export async function assertAtShrine(player: Pick<Player, 'currentPosition'>): Promise<boolean> {
  const currentTile = await db
    .select({ terrain: tiles.terrain })
    .from(tiles)
    .where(and(eq(tiles.x, player.currentPosition.x), eq(tiles.y, player.currentPosition.y)))
    .limit(1);
  return currentTile[0]?.terrain === TerrainType.Shrine;
}
