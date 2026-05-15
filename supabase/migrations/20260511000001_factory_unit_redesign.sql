-- ============================================================================
-- FID-20260511-FACTORY-UNIT-REDESIGN: Factory & Unit System Migration
-- Implements: polynomial slots, constrained defense, upgrade costs, archetypes,
-- terrain modifiers, digger weight, sacrificed bonus columns, entropy tracking
-- ============================================================================

-- Add sacrificed digger bonus columns to players
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS sacrificed_metal_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sacrificed_energy_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sacrificed_digger_count INTEGER NOT NULL DEFAULT 0;

-- Add digger_weight to player_inventory
ALTER TABLE player_inventory
  ADD COLUMN IF NOT EXISTS digger_weight INTEGER NOT NULL DEFAULT 1;

-- Add factory archetype and terrain modifier
ALTER TABLE factories
  ADD COLUMN IF NOT EXISTS factory_archetype TEXT NOT NULL DEFAULT 'MUNITIONS'
    CHECK (factory_archetype IN ('MUNITIONS', 'HEAVY_ASSEMBLY', 'AEGIS')),
  ADD COLUMN IF NOT EXISTS terrain_modifier TEXT NOT NULL DEFAULT 'WASTELAND'
    CHECK (terrain_modifier IN ('WASTELAND', 'METAL', 'ENERGY', 'CAVE', 'FOREST'));

-- Add entropy tracking
ALTER TABLE factories
  ADD COLUMN IF NOT EXISTS last_interacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS times_captured INTEGER NOT NULL DEFAULT 0;

-- Create digger_sacrifice_log table
CREATE TABLE IF NOT EXISTS digger_sacrifice_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_rarity TEXT NOT NULL,
  item_type TEXT NOT NULL,
  metal_bonus_added NUMERIC(10,2) NOT NULL DEFAULT 0,
  energy_bonus_added NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digger_sacrifice_log_player ON digger_sacrifice_log(player_username);
CREATE INDEX IF NOT EXISTS idx_digger_sacrifice_log_created ON digger_sacrifice_log(created_at);

ALTER TABLE digger_sacrifice_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read own sacrifice log" ON digger_sacrifice_log FOR SELECT USING (true);
CREATE POLICY "Service role can manage sacrifice log" ON digger_sacrifice_log FOR ALL USING (auth.role() = 'service_role');

-- Drop unused tables from previous design
DROP TABLE IF EXISTS factory_production_queue;
DROP TABLE IF EXISTS factory_slots;
DROP TABLE IF EXISTS factory_defense;
DROP TABLE IF EXISTS unit_build_queue;

-- Update game_config with new values
DELETE FROM game_config WHERE key IN (
  'DIGGER_DROP_CHANCE', 'DIGGER_BONUS_CAP', 'DIGGER_SACRIFICE_CAP',
  'DIGGER_GUARANTEED_INTERVAL', 'FACTORY_BASE_DEFENSE',
  'FACTORY_SLOT_REGEN_PER_HOUR', 'SHRINE_BOOST_DURATION_HOURS',
  'SHRINE_MAX_BOOST_PERCENT'
);

INSERT INTO game_config (key, value, type, category, description) VALUES
  ('DIGGER_DROP_CHANCE', '0.015', 'number', 'diggers', 'Base digger drop chance per cave harvest'),
  ('DIGGER_BONUS_CAP', '100', 'number', 'diggers', 'Max gathering bonus percentage from diggers'),
  ('DIGGER_SACRIFICE_CAP', '100', 'number', 'diggers', 'Max gathering bonus from sacrifice system'),
  ('DIGGER_GUARANTEED_INTERVAL', '500', 'number', 'diggers', 'Guaranteed digger every N caves'),
  ('FACTORY_BASE_DEFENSE', '5000', 'number', 'factory', 'Base defense at level 1'),
  ('FACTORY_SLOT_BASE', '5000', 'number', 'factory', 'Base slots at level 1'),
  ('FACTORY_SLOT_SCALING', '1.15', 'number', 'factory', 'Slot growth multiplier per level'),
  ('FACTORY_REGEN_HOURS', '12', 'number', 'factory', 'Hours for full slot regeneration'),
  ('FACTORY_ENTROPY_HOURS', '72', 'number', 'factory', 'Hours before unoccupied factory degrades'),
  ('FACTORY_ARCHETYPES_ENABLED', 'true', 'boolean', 'factory', 'Enable factory archetype system'),
  ('TERRAIN_MODIFIERS_ENABLED', 'true', 'boolean', 'factory', 'Enable terrain-based factory modifiers'),
  ('SHRINE_BOOST_DURATION_HOURS', '12', 'number', 'shrine', 'Duration of shrine boost in hours'),
  ('SHRINE_MAX_BOOST_PERCENT', '70', 'number', 'shrine', 'Max shrine boost percentage');
