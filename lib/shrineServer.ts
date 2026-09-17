/**
 * @file lib/shrineServer.ts
 * @created 2026-09-17
 * @overview Shared server-side shrine presence enforcement (FID-20260917-002)
 *
 * OVERVIEW:
 * The deleted legacy routes (sacrifice/extend) inlined a tiles lookup to refuse
 * off-shrine boost actions; the live pair (activate/boost-all) had lost that
 * check entirely — presence was enforced only by the client's keyboard handler.
 * This helper restores one server-side truth for every shrine write surface
 * (Law 13: the pattern appears in two live routes → one function).
 */

import { getCollection } from '@/lib/mongodb';
import { TerrainType } from '@/types';
import type { Player, Tile } from '@/types';

/**
 * Verify the player's current position is the Shrine of Remembrance tile.
 *
 * Reads the tile at the player's currentPosition and compares terrain. Returns
 * false when the tile cannot be read or is not a Shrine (fail-closed: the
 * caller refuses the action).
 *
 * @param player - The shim-read player row (the shim's nested domain alias view
 *                 exposes currentPosition.x/y, the same shape the legacy
 *                 sacrifice/extend routes read).
 */
export async function assertAtShrine(player: Pick<Player, 'currentPosition'>): Promise<boolean> {
  const tilesCollection = await getCollection<Tile>('tiles');
  const currentTile = await tilesCollection.findOne({
    x: player.currentPosition.x,
    y: player.currentPosition.y
  });
  return currentTile?.terrain === TerrainType.Shrine;
}
