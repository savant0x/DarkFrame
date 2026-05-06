-- Supplemental tables for bot magnet system and warfare config
CREATE TABLE IF NOT EXISTS bot_magnet_beacons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  deployed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  cooldown_until TIMESTAMPTZ,
  attraction_radius INTEGER DEFAULT 100,
  attraction_chance NUMERIC DEFAULT 0.30,
  bots_attracted INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

ALTER TABLE bot_magnet_beacons ENABLE ROW LEVEL SECURITY;
