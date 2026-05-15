-- Create missing tables for DarkFrame game

CREATE TABLE IF NOT EXISTS game_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  type text NOT NULL DEFAULT 'number',
  category text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  effect jsonb NOT NULL DEFAULT '{}',
  rarity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  requirement jsonb NOT NULL DEFAULT '{}',
  reward jsonb NOT NULL DEFAULT '{}',
  prestige_value integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  reason text NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(player_username)
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username text NOT NULL,
  action text NOT NULL,
  target text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cron_job_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result jsonb,
  error text
);

CREATE TABLE IF NOT EXISTS factory_production_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL,
  unit_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  completes_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS factory_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL,
  slot_type text NOT NULL DEFAULT 'production',
  is_occupied boolean NOT NULL DEFAULT false,
  occupied_by text,
  UNIQUE(factory_id, slot_type)
);

CREATE TABLE IF NOT EXISTS factory_defense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL UNIQUE,
  defense_value numeric(15,2) NOT NULL DEFAULT 1000,
  last_upgraded timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unit_build_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  unit_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  factory_x integer,
  factory_y integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completes_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS flag_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  flag_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bounty_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_username text NOT NULL,
  issuer_username text,
  reward_metal numeric(15,2) NOT NULL DEFAULT 0,
  reward_energy numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  claimed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

CREATE TABLE IF NOT EXISTS player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
  extra_data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  discovery_id text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  tile_x integer,
  tile_y integer,
  UNIQUE(player_username, discovery_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  data jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username text NOT NULL,
  recipient_username text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_typing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'global',
  is_typing boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_username, channel)
);

CREATE TABLE IF NOT EXISTS chat_online (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE UNIQUE,
  is_online boolean NOT NULL DEFAULT true,
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auto_farm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username text NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'stopped',
  tiles_completed integer NOT NULL DEFAULT 0,
  metal_collected numeric(15,2) NOT NULL DEFAULT 0,
  energy_collected numeric(15,2) NOT NULL DEFAULT 0,
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flag_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL,
  bearer_username text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fix admin player: ensure VIP status
UPDATE players SET
  is_vip = true,
  vip_tier = 'YEARLY',
  vip_expiration = NOW() + INTERVAL '1 year',
  vip_last_updated = NOW()
WHERE username = 'FAME';

-- If FAME doesn't exist yet, insert with VIP
INSERT INTO players (
  username, email, password, is_admin, is_vip, vip_tier, vip_expiration, vip_last_updated,
  rank, level, xp, research_points, resources_metal, resources_energy,
  bank_metal, bank_energy, gathering_metal_bonus, gathering_energy_bonus,
  inventory_capacity, inventory_metal_digger_count, inventory_energy_digger_count,
  factory_count, base_x, base_y, current_x, current_y, unlocked_tiers
) VALUES (
  'FAME', 'spencerhowell84@gmail.com', '$2b$10$dummyhashplaceholder1234567890123456789012345678901234567890',
  true, true, 'YEARLY', NOW() + INTERVAL '1 year', NOW(),
  5, 1, 0, 0, 100000, 100000,
  0, 0, 0, 0,
  2000, 0, 0,
  0, 75, 75, 75, 75, '{1}'
)
ON CONFLICT (username) DO UPDATE SET
  is_vip = true,
  vip_tier = 'YEARLY',
  vip_expiration = NOW() + INTERVAL '1 year',
  vip_last_updated = NOW(),
  is_admin = true;
