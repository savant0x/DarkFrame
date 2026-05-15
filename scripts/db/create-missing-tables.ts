/**
 * Migration: Create missing tables and fix admin account
 * Run: npx tsx scripts/db/create-missing-tables.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_EMAIL = 'spencerhowell84@gmail.com';
const ADMIN_USERNAME = 'FAME';
const ADMIN_PASSWORD = 'Sthcnh4525!';

async function executeSQL(description: string, sql: string) {
  try {
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
      // Try direct query as fallback
      const { error: err2 } = await supabase.from('players').select('*').limit(0);
      console.log(`  ⚠️  ${description}: ${error.message}`);
    } else {
      console.log(`  ✅ ${description}`);
    }
  } catch (e) {
    console.log(`  ⚠️  ${description}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Creating Missing Tables             ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Use raw SQL via supabase REST API
  const sqlStatements = [
    // game_config
    `CREATE TABLE IF NOT EXISTS game_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text UNIQUE NOT NULL,
      value text NOT NULL,
      type text NOT NULL DEFAULT 'number',
      category text,
      description text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,

    // seeds
    `CREATE TABLE IF NOT EXISTS seeds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      value text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // discoveries
    `CREATE TABLE IF NOT EXISTS discoveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      discovery_id text UNIQUE NOT NULL,
      name text NOT NULL,
      description text,
      effect jsonb NOT NULL DEFAULT '{}',
      rarity integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // achievements
    `CREATE TABLE IF NOT EXISTS achievements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      achievement_id text UNIQUE NOT null,
      name text NOT NULL,
      description text,
      requirement jsonb NOT NULL DEFAULT '{}',
      reward jsonb NOT NULL DEFAULT '{}',
      prestige_value integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // player_bans
    `CREATE TABLE IF NOT EXISTS player_bans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      reason text NOT NULL,
      banned_at timestamptz NOT NULL DEFAULT now(),
      banned_by text,
      expires_at timestamptz,
      is_active boolean NOT NULL DEFAULT true,
      UNIQUE(player_username)
    );`,

    // admin_actions (renamed from admin_logs to avoid conflicts)
    `CREATE TABLE IF NOT EXISTS admin_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_username text NOT NULL,
      action text NOT NULL,
      target text,
      details jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // cron_job_log
    `CREATE TABLE IF NOT EXISTS cron_job_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_name text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      result jsonb,
      error text
    );`,

    // factory_production_queue
    `CREATE TABLE IF NOT EXISTS factory_production_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      factory_id uuid NOT NULL,
      unit_type text NOT NULL,
      quantity integer NOT NULL DEFAULT 1,
      started_at timestamptz NOT NULL DEFAULT now(),
      completes_at timestamptz NOT NULL
    );`,

    // factory_slots
    `CREATE TABLE IF NOT EXISTS factory_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      factory_id uuid NOT NULL,
      slot_type text NOT NULL DEFAULT 'production',
      is_occupied boolean NOT NULL DEFAULT false,
      occupied_by text,
      UNIQUE(factory_id, slot_type)
    );`,

    // factory_defense
    `CREATE TABLE IF NOT EXISTS factory_defense (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      factory_id uuid NOT NULL UNIQUE,
      defense_value numeric(15,2) NOT NULL DEFAULT 1000,
      last_upgraded timestamptz NOT NULL DEFAULT now()
    );`,

    // unit_build_queue
    `CREATE TABLE IF NOT EXISTS unit_build_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      unit_type text NOT NULL,
      quantity integer NOT NULL DEFAULT 1,
      factory_x integer,
      factory_y integer,
      started_at timestamptz NOT NULL DEFAULT now(),
      completes_at timestamptz NOT NULL
    );`,

    // flag_tracking
    `CREATE TABLE IF NOT EXISTS flag_tracking (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      flag_id uuid NOT NULL,
      action text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // bounty_tracking
    `CREATE TABLE IF NOT EXISTS bounty_tracking (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_username text NOT NULL,
      issuer_username text,
      reward_metal numeric(15,2) NOT NULL DEFAULT 0,
      reward_energy numeric(15,2) NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'active',
      claimed_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      claimed_at timestamptz
    );`,

    // player_stats
    `CREATE TABLE IF NOT EXISTS player_stats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
      extra_data jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,

    // player_settings
    `CREATE TABLE IF NOT EXISTS player_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
      settings jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,

    // discovery_log
    `CREATE TABLE IF NOT EXISTS discovery_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      discovery_id text NOT NULL,
      discovered_at timestamptz NOT NULL DEFAULT now(),
      tile_x integer,
      tile_y integer,
      UNIQUE(player_username, discovery_id)
    );`,

    // notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      type text NOT NULL,
      title text NOT NULL,
      message text,
      data jsonb NOT NULL DEFAULT '{}',
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // direct_messages
    `CREATE TABLE IF NOT EXISTS direct_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_username text NOT NULL,
      recipient_username text NOT NULL,
      content text NOT NULL CHECK (char_length(content) <= 2000),
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // chat_typing
    `CREATE TABLE IF NOT EXISTS chat_typing (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      channel text NOT NULL DEFAULT 'global',
      is_typing boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(player_username, channel)
    );`,

    // chat_online
    `CREATE TABLE IF NOT EXISTS chat_online (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
      is_online boolean NOT NULL DEFAULT true,
      last_seen timestamptz NOT NULL DEFAULT now()
    );`,

    // auto_farm_sessions
    `CREATE TABLE IF NOT EXISTS auto_farm_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'stopped',
      tiles_completed integer NOT NULL DEFAULT 0,
      metal_collected numeric(15,2) NOT NULL DEFAULT 0,
      energy_collected numeric(15,2) NOT NULL DEFAULT 0,
      started_at timestamptz,
      stopped_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );`,

    // flag_history
    `CREATE TABLE IF NOT EXISTS flag_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      flag_id uuid NOT NULL,
      bearer_username text,
      action text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    );`,
  ];

  for (const sql of sqlStatements) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
    try {
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error) {
        console.log(`  ⚠️  ${tableName}: ${error.message}`);
      } else {
        console.log(`  ✅ ${tableName}`);
      }
    } catch (e) {
      console.log(`  ⚠️  ${tableName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\nStep 2: Creating admin player with VIP...');

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { username: ADMIN_USERNAME },
  });
  if (authError && !authError.message.includes('already been registered')) {
    console.log(`  ⚠️  Auth: ${authError.message}`);
  } else {
    console.log(`  ✅ Auth user: ${ADMIN_EMAIL}`);
  }

  // Create player record with VIP - generate a bcrypt-like hash placeholder
  // Since Supabase Auth handles passwords, we store a dummy hash for the NOT NULL constraint
  const dummyHash = '$2b$10$dummyhashforadminaccountplaceholder123456789012345678901234567890';
  const vipExpiration = new Date();
  vipExpiration.setFullYear(vipExpiration.getFullYear() + 1);

  const { error: pErr } = await supabase.from('players').upsert({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    password: dummyHash,
    is_admin: true,
    is_vip: true,
    vip_tier: 'YEARLY',
    vip_expiration: vipExpiration.toISOString(),
    vip_last_updated: new Date().toISOString(),
    rank: 5,
    level: 1,
    xp: 0,
    research_points: 0,
    resources_metal: 100000,
    resources_energy: 100000,
    bank_metal: 0,
    bank_energy: 0,
    gathering_metal_bonus: 0,
    gathering_energy_bonus: 0,
    inventory_capacity: 2000,
    inventory_metal_digger_count: 0,
    inventory_energy_digger_count: 0,
    factory_count: 0,
    base_x: 75,
    base_y: 75,
    current_x: 75,
    current_y: 75,
    unlocked_tiers: [1],
  } as any);

  if (pErr) {
    console.log(`  ⚠️  Player: ${pErr.message}`);
  } else {
    console.log(`  ✅ Admin player: ${ADMIN_USERNAME} (VIP YEARLY)`);
  }

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  ✅ Setup Complete                   ║');
  console.log('╚══════════════════════════════════════╝');
}

main().catch(console.error);
