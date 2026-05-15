-- ============================================================================
-- FID-20260510-DIGGER-BALANCE: Digger Sacrifice System Migration
-- Replaces auto-stacking digger bonuses with a sacrifice-based progression system
-- ============================================================================

-- Add sacrificed bonus tracking columns
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS sacrificed_metal_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sacrificed_energy_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sacrificed_digger_count INTEGER NOT NULL DEFAULT 0;

-- Add digger_weight to player_inventory for sacrifice value
ALTER TABLE player_inventory
  ADD COLUMN IF NOT EXISTS digger_weight INTEGER NOT NULL DEFAULT 1;

-- Create digger_sacrifice_log for analytics
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

-- Drop old unused columns
ALTER TABLE players
  DROP COLUMN IF EXISTS gathering_metal_bonus,
  DROP COLUMN IF EXISTS gathering_energy_bonus;
