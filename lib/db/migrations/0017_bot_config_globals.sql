-- Migration 0017: bot_config globals (FID-20260906-003 S1).
--
-- The admin panel edits five global bot-system settings (totalBotCap,
-- dailySpawnCount, migrationPercent, regenRates). Pre-0017 those values had no
-- persistent home: the UI PATCHed a shape the per-bot route rejected (400 on
-- every save), and the equivalent values lived as divergent code constants
-- (botService 0.10 vs botGrowthEngine 0.12 for Balanced; MIGRATION_PERCENTAGE
-- hardcoded 0.3). bot_config existed since 0000 but was empty and unreferenced.
--
-- Reuses the existing spawn_rate/total_bots columns (spawn_rate ≡
-- dailySpawnCount, total_bots ≡ totalBotCap); adds the two missing dimensions.

ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS migration_percent real NOT NULL DEFAULT 0.3;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS regen_rates jsonb NOT NULL DEFAULT '{"hoarder":0.05,"fortress":0.10,"raider":0.15,"ghost":0.20,"balanced":0.10}'::jsonb;

INSERT INTO bot_config (id, spawn_rate, total_bots)
VALUES ('global', 75, 1000)
ON CONFLICT (id) DO NOTHING;

UPDATE bot_config SET spawn_rate = 75, total_bots = 1000 WHERE id = 'global';
