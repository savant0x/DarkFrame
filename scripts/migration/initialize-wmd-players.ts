/**
 * @file scripts/initialize-wmd-players.ts
 * @created 2025-10-22
 * @overview Initialize WMD system for existing players
 * 
 * OVERVIEW:
 * Creates basic WMD research records for all existing players who don't have them.
 * This fixes 401 errors on WMD endpoints for players created before WMD system.
 * 
 * Usage:
 *   npx tsx scripts/initialize-wmd-players.ts
 */

import { createServiceClient } from '../../lib/supabase/server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found');
}

async function initializeWMDForPlayers() {
  console.log('🔄 Connecting to Supabase...');
  const supabase = createServiceClient();

  try {
    // Get all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('username');
    
    if (playersError) {
      console.error('❌ Error fetching players:', playersError);
      throw playersError;
    }
    
    console.log(`📊 Found ${players.length} total players`);

    // Get existing WMD research records
    const { data: existingResearch, error: researchError } = await supabase
      .from('wmd_player_research')
      .select('player_id');
    
    if (researchError) {
      console.error('❌ Error fetching research:', researchError);
      throw researchError;
    }
    
    const existingPlayerIds = new Set(existingResearch.map(r => r.player_id));
    console.log(`📊 ${existingResearch.length} players already have WMD research`);

    // Find players without WMD research
    const playersNeedingInit = players.filter(p => !existingPlayerIds.has(p.username));
    console.log(`🎯 ${playersNeedingInit.length} players need WMD initialization`);

    if (playersNeedingInit.length === 0) {
      console.log('✅ All players already have WMD research initialized');
      return;
    }

    // Initialize WMD research for each player
    const records = playersNeedingInit.map(player => ({
      player_id: player.username,
      player_username: player.username,
      available_techs: [],
      completed_techs: [],
      locked_techs: [],
      total_rp_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('wmd_player_research')
      .insert(records);
    
    if (insertError) {
      console.error('❌ Error inserting WMD records:', insertError);
      throw insertError;
    }
    
    console.log(`✅ Initialized WMD research for ${records.length} players`);

    // List initialized players
    playersNeedingInit.forEach(player => {
      console.log(`  ✓ ${player.username}`);
    });

  } catch (error) {
    console.error('❌ Error initializing WMD:', error);
    throw error;
  } finally {
    console.log('🔌 Supabase connection closed');
  }
}

// Run initialization
initializeWMDForPlayers()
  .then(() => {
    console.log('✅ WMD initialization complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  });

// ============================================================
// END OF FILE
// ============================================================
