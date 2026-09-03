/**
 * @file lib/movementService.ts
 * @created 2025-10-16
 * @overview Player movement logic with wrap-around and position updates
 * 
 * OVERVIEW:
 * Handles player movement across the map with edge wrapping.
 * Updates player position and returns current tile data.
 */

import { getCollection } from './mongodb';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPlayer } from './playerService';
import { calculateNewPosition } from '@/utils/coordinates';
import { Player, Tile, MovementDirection } from '@/types';

/**
 * Get tile at specific coordinates
 * 
 * @param x - X coordinate (1-150)
 * @param y - Y coordinate (1-150)
 * @returns Promise that resolves to tile data or null if not found
 */
export async function getTileAt(x: number, y: number): Promise<Tile | null> {
  try {
    const tilesCollection = await getCollection<Tile>('tiles');
    const tile = await tilesCollection.findOne({ x, y });
    
    // 🔍 DEBUG: Log tile data for base investigation
    if (tile && tile.occupiedByBase) {
      console.log(`🔍 BASE TILE (${x}, ${y}):`, {
        terrain: tile.terrain,
        occupiedByBase: tile.occupiedByBase
      });
    }
    
    return tile;
  } catch (error) {
    console.error('❌ Error getting tile:', error);
    throw error;
  }
}

/**
 * Move player in specified direction
 * 
 * Calculates new position with wrap-around, updates player location,
 * and returns updated player data with current tile.
 * 
 * @param username - Player username
 * @param direction - Direction to move
 * @returns Promise that resolves to player and current tile data
 * @throws Error if player not found or tile doesn't exist
 * 
 * @example
 * ```typescript
 * const { player, tile } = await movePlayer('Commander42', MovementDirection.North);
 * console.log(`Moved to (${player.currentPosition.x}, ${player.currentPosition.y})`);
 * console.log(`Terrain: ${tile.terrain}`);
 * ```
 */
export async function movePlayer(
  username: string,
  direction: MovementDirection
): Promise<{ player: Player; tile: Tile }> {
  try {
    // Get current player data
    const player = await getPlayer(username);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Calculate new position with wrap-around
    const newPosition = calculateNewPosition(player.currentPosition, direction);
    
    console.log(
      `🚶 Moving ${username} from (${player.currentPosition.x}, ${player.currentPosition.y}) ` +
      `to (${newPosition.x}, ${newPosition.y}) [${direction}]`
    );
    
    // Update player position (drizzle — updatePlayerPosition was never migrated off Mongo)
    const positionUpdate = await db.update(players)
      .set({ currentPositionX: newPosition.x, currentPositionY: newPosition.y })
      .where(eq(players.username, username))
      .returning({ x: players.currentPositionX, y: players.currentPositionY });
    if (positionUpdate.length === 0) {
      throw new Error('Failed to update player position');
    }
    const updatedPlayer = { ...player, currentPosition: positionUpdate[0] };
    
    // Get tile at new position
    const tile = await getTileAt(newPosition.x, newPosition.y);
    if (!tile) {
      throw new Error(`Tile not found at (${newPosition.x}, ${newPosition.y})`);
    }
    
    return {
      player: updatedPlayer,
      tile
    };
    
  } catch (error) {
    console.error('❌ Error moving player:', error);
    throw error;
  }
}

/**
 * Get current tile for player
 * 
 * @param username - Player username
 * @returns Promise that resolves to current tile data
 * @throws Error if player or tile not found
 */
export async function getCurrentTile(username: string): Promise<Tile> {
  try {
    const player = await getPlayer(username);
    if (!player) {
      throw new Error('Player not found');
    }
    
    const tile = await getTileAt(player.currentPosition.x, player.currentPosition.y);
    if (!tile) {
      throw new Error('Current tile not found');
    }
    
    return tile;
  } catch (error) {
    console.error('❌ Error getting current tile:', error);
    throw error;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Wrap-around handled by calculateNewPosition utility
// - Atomic position updates prevent race conditions
// - Returns both player and tile data for efficiency
// - Comprehensive error handling
// - Logging for debugging movement flow
// ============================================================
// END OF FILE
// ============================================================
