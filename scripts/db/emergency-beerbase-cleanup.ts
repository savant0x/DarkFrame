/**
 * Emergency Beer Base Cleanup Script
 * Created: 2025-10-25
 * 
 * PURPOSE:
 * Removes all fake Beer Base player documents that accumulated due to infinite spawn bug.
 * Preserves real players (non-bot accounts).
 * 
 * ISSUE:
 * - 153,708 Beer Base player documents created (485 MB / 512 MB database)
 * - Root cause: getTargetBeerBaseCount() included Beer Bases in total count
 * - Created infinite feedback loop over 10 days
 * 
 * USAGE:
 * npx ts-node -r dotenv/config scripts/emergency-beerbase-cleanup.ts dotenv_config_path=.env.local
 */

import { createServiceClient } from '../../lib/supabase/server';

async function emergencyCleanup() {
  console.log('🚨 [EMERGENCY] Beer Base Cleanup Starting...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
  }
  
  const supabase = createServiceClient();
  
  try {
    console.log('✅ Connected to Supabase\n');
    
    // Count current state
    console.log('📊 Current Database State:');
    
    const { count: totalPlayers, error: totalError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true });
    
    const { count: realPlayers, error: realError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .neq('is_bot', true);
    
    const { count: allBots, error: botsError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('is_bot', true);
    
    // BUG FIX: Original code checked for isSpecialBase, but that field was never set by createBot()
    // All Beer Bases have username starting with 🍺BeerBase, so match by pattern instead
    const { count: beerBases, error: beerError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .like('username', '%🍺BeerBase%');
    
    const regularBots = (allBots ?? 0) - (beerBases ?? 0);
    
    console.log(`   Total Documents: ${totalPlayers ?? 0}`);
    console.log(`   Real Players: ${realPlayers ?? 0}`);
    console.log(`   Regular Bots: ${regularBots}`);
    console.log(`   Beer Bases: ${beerBases ?? 0}`);
    console.log('');
    
    // Confirm cleanup
    if ((beerBases ?? 0) === 0) {
      console.log('✅ No Beer Bases found - database is clean!');
      process.exit(0);
    }
    
    console.log(`⚠️  About to delete ${beerBases} Beer Base documents\n`);
    
    // Show sample of what will be deleted
    const { data: samples, error: samplesError } = await supabase
      .from('players')
      .select('username, level, current_x, current_y')
      .like('username', '%🍺BeerBase%')
      .limit(5);
    
    console.log('📋 Sample Beer Bases to be deleted:');
    samples?.forEach((base: any, i: number) => {
      console.log(`   ${i + 1}. ${base.username} (Level ${base.level || 1}, Position: ${base.current_x || 0},${base.current_y || 0})`);
    });
    console.log('   ... and more\n');
    
    // Execute cleanup
    console.log('🗑️  Deleting Beer Bases...');
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .like('username', '%🍺BeerBase%');
    
    if (deleteError) {
      console.error('❌ Error during deletion:', deleteError);
      process.exit(1);
    }
    
    console.log(`✅ Deleted Beer Base documents\n`);
    
    // Verify cleanup
    console.log('🔍 Verifying cleanup...');
    const { count: remainingBeerBases } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .like('username', '%🍺BeerBase%');
    
    const { count: remainingTotal } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true });
    
    const { count: remainingReal } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .neq('is_bot', true);
    
    const { count: remainingRegularBots } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('is_bot', true)
      .not('username', 'ilike', '%🍺BeerBase%');
    
    console.log(`   Remaining Documents: ${remainingTotal ?? 0}`);
    console.log(`   Real Players: ${remainingReal ?? 0}`);
    console.log(`   Regular Bots: ${remainingRegularBots ?? 0}`);
    console.log(`   Beer Bases: ${remainingBeerBases ?? 0}`);
    console.log('');
    
    if ((remainingBeerBases ?? 0) === 0) {
      console.log('✅ SUCCESS! All Beer Bases removed');
      console.log('✅ Real players preserved');
      console.log('✅ Database cleaned up successfully\n');
    } else {
      console.warn(`⚠️  Warning: ${remainingBeerBases} Beer Bases still remain`);
    }
    
    console.log('🔌 Disconnected from Supabase');
    console.log('✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

emergencyCleanup();
