/**
 * Test active player detection
 */

import { createServiceClient } from '../../lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found');
}

async function testActivePlayerDetection() {
  console.log('🔍 Testing active player detection...\n');
  
  const supabase = createServiceClient();
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  console.log('📅 Checking for players active since:', sevenDaysAgo.toISOString());
  
  // Count all real players (using updated logic)
  const { count: totalRealPlayers, error: countError } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .neq('is_bot', true);
  
  if (countError) {
    console.error('Error counting players:', countError);
    return;
  }
  
  console.log(`📊 Total real players: ${totalRealPlayers ?? 0}`);
  
  // Get all real players with their data
  const { data: allPlayers, error: findError } = await supabase
    .from('players')
    .select('username, level, last_login_date')
    .neq('is_bot', true);
  
  if (findError) {
    console.error('Error fetching players:', findError);
    return;
  }
  
  console.log('\n👥 All real players:');
  for (const player of allPlayers) {
    const lastLogin = player.last_login_date ? new Date(player.last_login_date) : null;
    const isActive = !lastLogin || lastLogin >= sevenDaysAgo;
    console.log(`  - ${player.username} (Level ${player.level || 1})`);
    console.log(`    Last login: ${lastLogin ? lastLogin.toISOString() : 'Never (no tracking)'}`);
    console.log(`    Active: ${isActive ? '✅ YES' : '❌ NO (older than 7 days)'}`);
  }
  
  // Count active players
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();
  const { count: activeCount, error: activeError } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .neq('is_bot', true)
    .or(`last_login_date.gte.${sevenDaysAgoStr},last_login_date.is.null`);
  
  if (activeError) {
    console.error('Error counting active players:', activeError);
    return;
  }
  
  console.log(`\n✅ Active players (last 7 days): ${activeCount ?? 0}`);
}

testActivePlayerDetection().catch(console.error);
