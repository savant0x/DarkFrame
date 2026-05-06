/**
 * Beer Base Cleanup Script
 * 
 * Purpose: Remove all existing Beer Bases from database to prevent duplicate key errors
 * Run this once before restarting server after the Beer Base username fix
 * 
 * Usage: npx ts-node -r dotenv/config scripts/cleanup-beer-bases.ts dotenv_config_path=.env.local
 */

import { createServiceClient } from '../../lib/supabase/server';

async function cleanupBeerBases() {
  console.log('🍺 [Beer Base Cleanup] Starting cleanup...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
  }
  
  const supabase = createServiceClient();
  
  try {
    // Find all Beer Bases
    const { data: beerBases, error: findError } = await supabase
      .from('players')
      .select('*')
      .eq('is_bot', true)
      .eq('is_special_base', true);
    
    if (findError) {
      console.error('❌ Error finding Beer Bases:', findError);
      process.exit(1);
    }
    
    console.log(`🍺 Found ${beerBases.length} Beer Base(s) to remove`);
    
    if (beerBases.length === 0) {
      console.log('✅ No Beer Bases found, database is clean');
      process.exit(0);
    }
    
    // List them
    beerBases.forEach((base: any, i: number) => {
      console.log(`   ${i + 1}. ${base.username} (Level ${base.level}, Position: ${base.current_x},${base.current_y})`);
    });
    
    // Delete all Beer Bases
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('is_bot', true)
      .eq('is_special_base', true);
    
    if (deleteError) {
      console.error('❌ Error deleting Beer Bases:', deleteError);
      process.exit(1);
    }
    
    console.log(`✅ Successfully removed Beer Base(s)`);
    console.log('🍺 Cleanup complete! New Beer Bases will be spawned with unique names on next respawn cycle.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupBeerBases();
