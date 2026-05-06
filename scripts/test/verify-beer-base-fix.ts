/**
 * Verify Beer Base Fix
 * 
 * Purpose: Check if Beer Base usernames are using new format (timestamp-based)
 * Run after server restart to confirm fix is active
 * 
 * Usage: npx ts-node -r dotenv/config scripts/verify-beer-base-fix.ts dotenv_config_path=.env.local
 */

import { createServiceClient } from '../../lib/supabase/server';

async function verifyBeerBaseFix() {
  console.log('🔍 [Verification] Checking Beer Base username format...\n');
  
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
    
    if (beerBases.length === 0) {
      console.log('ℹ️  No Beer Bases found in database');
      console.log('   This is normal if cleanup script was just run.');
      console.log('   Beer Bases will respawn on next cycle (~30-60 seconds).\n');
      process.exit(0);
    }
    
    console.log(`📊 Found ${beerBases.length} Beer Base(s):\n`);
    
    let oldFormatCount = 0;
    let newFormatCount = 0;
    
    beerBases.forEach((base: any, i: number) => {
      const username = base.username;
      const level = base.level;
      const pos = `${base.current_x},${base.current_y}`;
      
      // Check if username has timestamp (long number in middle)
      const hasTimestamp = /BeerBase-\w+-\d{13}-\d+/.test(username);
      
      if (hasTimestamp) {
        console.log(`   ✅ ${i + 1}. ${username}`);
        console.log(`      Level ${level} | Position: (${pos}) | Format: NEW (timestamp-based)`);
        newFormatCount++;
      } else {
        console.log(`   ❌ ${i + 1}. ${username}`);
        console.log(`      Level ${level} | Position: (${pos}) | Format: OLD (sequential numbering)`);
        oldFormatCount++;
      }
      console.log('');
    });
    
    // Summary
    console.log('═'.repeat(70));
    console.log('\n📋 SUMMARY:\n');
    console.log(`   New Format (Fixed):  ${newFormatCount} bases`);
    console.log(`   Old Format (Broken): ${oldFormatCount} bases`);
    console.log('');
    
    if (oldFormatCount > 0) {
      console.log('⚠️  WARNING: Old format Beer Bases detected!');
      console.log('   This means either:');
      console.log('   1. Server was not restarted after code fix, OR');
      console.log('   2. Cleanup script was not run before restart\n');
      console.log('📝 RECOMMENDED ACTIONS:');
      console.log('   1. Stop server (Ctrl+C)');
      console.log('   2. Run: npx tsx scripts/cleanup-beer-bases.ts');
      console.log('   3. Restart: npm run dev');
      console.log('');
    } else if (newFormatCount > 0) {
      console.log('✅ SUCCESS! All Beer Bases using new timestamp-based format.');
      console.log('   The duplicate key error fix is active and working.\n');
    }
    
    process.exit(oldFormatCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifyBeerBaseFix();
