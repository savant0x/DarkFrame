/**
 * @file lib/movementService.ts
 * @created 2025-10-16
 * @updated 2026-05-03 (FID-20260503-SUPABASE: Supabase backend)
 * @overview Player movement logic with wrap-around and position updates
 */

import { createServiceClient } from '@/lib/supabase/server';
import { updatePlayerPosition, getPlayer } from './playerService';
import { calculateNewPosition } from '@/utils/coordinates';
import { MovementDirection } from '@/types';
import type { Tables } from '@/types/database';

type PlayerRow = Tables<'players'>;
type TileRow = Tables<'tiles'>;

/**
 * Get tile at specific coordinates.
 */
export async function getTileAt(x: number, y: number): Promise<TileRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('tiles')
    .select('*')
    .eq('x', x)
    .eq('y', y)
    .single();

  if (error) return null;
  return data;
}

/**
 * Move player in specified direction with wrap-around.
 */
export async function movePlayer(
  username: string,
  direction: MovementDirection
): Promise<{ player: PlayerRow; tile: TileRow }> {
  const player = await getPlayer(username);
  if (!player) throw new Error('Player not found');

  const newPosition = calculateNewPosition(
    { x: player.current_x, y: player.current_y },
    direction
  );

  const updatedPlayer = await updatePlayerPosition(username, newPosition);
  if (!updatedPlayer) throw new Error('Failed to update player position');

  const tile = await getTileAt(newPosition.x, newPosition.y);
  if (!tile) throw new Error(`Tile not found at (${newPosition.x}, ${newPosition.y})`);

  // Preserve computed fields from getPlayer that aren't real DB columns
  return { player: { ...updatedPlayer, factory_count: player.factory_count }, tile };
}

/**
 * Get current tile for player.
 */
export async function getCurrentTile(username: string): Promise<TileRow> {
  const player = await getPlayer(username);
  if (!player) throw new Error('Player not found');

  const tile = await getTileAt(player.current_x, player.current_y);
  if (!tile) throw new Error('Current tile not found');

  return tile;
}
