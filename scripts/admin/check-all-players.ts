/**
 * Check all players (including database info)
 */

import { createServiceClient } from '../../lib/supabase/server';

async function checkAllPlayers() {
  console.log('🔍 Checking database for all players...\n');
  console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set)');

  const supabase = createServiceClient();

  // Count all players
  const { count: totalPlayers, error: totalError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });

  if (totalError) throw totalError;
  console.log(`📊 Total players (including bots): ${totalPlayers || 0}`);

  const { count: realPlayers, error: realError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', false);

  if (realError) throw realError;
  console.log(`👥 Real players (is_bot: false): ${realPlayers || 0}`);

  const { count: botPlayers, error: botError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', true);

  if (botError) throw botError;
  console.log(`🤖 Bot players (is_bot: true): ${botPlayers || 0}`);

  const { count: beerBases, error: beerError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', true)
    .eq('is_special_base', true);

  if (beerError) throw beerError;
  console.log(`🍺 Beer Bases: ${beerBases || 0}`);

  // Show all players
  const { data: allPlayers, error: allError } = await supabase
    .from('players')
    .select('*');

  if (allError) throw allError;

  console.log('\n📋 All players in database:');
  for (const player of allPlayers || []) {
    const p = player as any;
    console.log(`  - ${p.username}`);
    console.log(`    Type: ${p.is_bot ? (p.is_special_base ? '🍺 Beer Base' : '🤖 Bot') : '👤 Real Player'}`);
    console.log(`    Level: ${p.level || 1}`);
    console.log(`    Last Login: ${p.last_login_date ? new Date(p.last_login_date).toISOString() : 'Never'}`);
  }
}

checkAllPlayers().catch(console.error);
