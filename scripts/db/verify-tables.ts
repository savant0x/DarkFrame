import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const tables = [
    'game_config', 'seeds', 'discoveries', 'achievements', 'player_bans',
    'admin_actions', 'cron_job_log', 'factory_production_queue', 'factory_slots',
    'factory_defense', 'unit_build_queue', 'flag_tracking', 'bounty_tracking',
    'player_stats', 'player_settings', 'discovery_log', 'notifications',
    'direct_messages', 'chat_typing', 'chat_online', 'auto_farm_sessions', 'flag_history'
  ];

  let ok = 0, missing = 0;
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    if (error) { console.log('MISSING:', t); missing++; }
    else { console.log('OK:', t); ok++; }
  }
  console.log(`\n${ok} tables exist, ${missing} missing`);

  const { data: admin } = await supabase.from('players')
    .select('username, is_vip, vip_tier, vip_expiration, is_admin')
    .eq('username', 'FAME').single();
  if (admin) console.log('Admin:', JSON.stringify(admin, null, 2));
  else console.log('Admin FAME not found');
}

main().catch(console.error);
