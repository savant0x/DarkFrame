/**
 * @file scripts/fix-base-tiles.ts
 * @created 2025-10-18
 * @overview Migration script to convert all base tiles to Wasteland
 * 
 * OVERVIEW:
 * Fixes existing player bases by converting their base coordinates to Wasteland terrain.
 * Run once to fix the issue where bases spawned on non-Wasteland tiles.
 */

import { createServiceClient } from '../../lib/supabase/server';
import { Player, Tile, TerrainType } from '../../types';

async function fixBaseTiles() {
  try {
    console.log('🔧 Starting base tile migration...');
    
    const supabase = createServiceClient();

    // Get all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');

    if (playersError) throw playersError;
    console.log(`📊 Found ${players.length} players`);
    
    let fixedCount = 0;
    
    for (const player of players) {
      const x = player.base_x;
      const y = player.base_y;
      
      // Check current tile terrain
      const { data: tile, error: tileError } = await supabase
        .from('tiles')
        .select('*')
        .eq('x', x)
        .eq('y', y)
        .single();

      if (tileError || !tile) {
        console.log(`⚠️  No tile found at (${x}, ${y}) for player ${player.username}`);
        continue;
      }
      
      // If tile is not Wasteland, convert it
      if (tile.terrain !== TerrainType.Wasteland) {
        console.log(`🔄 Converting ${player.username}'s base tile (${x}, ${y}) from ${tile.terrain} to Wasteland`);
        
        await supabase
          .from('tiles')
          .update({ 
            terrain: TerrainType.Wasteland,
            occupied_by_base: true
          })
          .eq('x', x)
          .eq('y', y);
        
        fixedCount++;
      } else if (!tile.occupied_by_base) {
        // Ensure occupied_by_base flag is set
        console.log(`🔄 Setting occupied_by_base flag for ${player.username}'s base at (${x}, ${y})`);
        
        await supabase
          .from('tiles')
          .update({ occupied_by_base: true })
          .eq('x', x)
          .eq('y', y);
        
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
// - Ensures occupied_by_base flag is set correctly
// - Safe to run multiple times (idempotent)
// - Run with: npx tsx scripts/fix-base-tiles.ts
// ============================================================
