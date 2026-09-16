/**
 * @file scripts/fix-base-tiles.ts
 * @created 2025-10-18
 * @overview Migration script to convert all base tiles to Wasteland
 * 
 * OVERVIEW:
 * Fixes existing player bases by converting their base coordinates to Wasteland terrain.
 * Run once to fix the issue where bases spawned on non-Wasteland tiles.
 */

import { getCollection } from '../lib/mongodb';
import { Player, Tile, TerrainType } from '../types';

async function fixBaseTiles() {
  try {
    console.log('🔧 Starting base tile migration...');
    
    const playersCollection = await getCollection<Player>('players');
    const tilesCollection = await getCollection<Tile>('tiles');
    
    // Get all players
    const players = await playersCollection.find({}).toArray();
    console.log(`📊 Found ${players.length} players`);
    
    let fixedCount = 0;
    
    for (const player of players) {
      const { x, y } = player.base;
      
      // Check current tile terrain
      const tile = await tilesCollection.findOne({ x, y });
      
      if (!tile) {
        console.log(`⚠️  No tile found at (${x}, ${y}) for player ${player.username}`);
        continue;
      }
      
      // If tile is not Wasteland, convert it
      if (tile.terrain !== TerrainType.Wasteland) {
        console.log(`🔄 Converting ${player.username}'s base tile (${x}, ${y}) from ${tile.terrain} to Wasteland`);
        
        await tilesCollection.updateOne(
          { x, y },
          { 
            $set: { 
              terrain: TerrainType.Wasteland,
              occupiedByBase: true
            } 
          }
        );
        
        fixedCount++;
      } else if (!tile.occupiedByBase) {
        // Ensure occupiedByBase flag is set
        console.log(`🔄 Setting occupiedByBase flag for ${player.username}'s base at (${x}, ${y})`);
        
        await tilesCollection.updateOne(
          { x, y },
          { $set: { occupiedByBase: true } }
        );
        
        fixedCount++;
      } else {
        console.log(`✅ ${player.username}'s base at (${x}, ${y}) is already correct`);
      }
    }
    
    console.log(`\n✅ Migration complete! Fixed ${fixedCount} base tiles.`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixBaseTiles();

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Converts all player base tiles to Wasteland terrain
// - Ensures occupiedByBase flag is set correctly
// - Safe to run multiple times (idempotent)
// - Run with: npx tsx scripts/fix-base-tiles.ts
// ============================================================
