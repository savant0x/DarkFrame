-- Migration 0014: widen mod_log.target_id varchar(20) -> varchar(24) (FID-20260904-005 Phase 4)
--
-- mod_log rows written by clanWarfareService.declareWar store a CLAN id (varchar(24))
-- in target_id; the column was sized for usernames (max 20) so every war declaration
-- failed with "value too long". Widening is non-destructive and backward compatible.

ALTER TABLE mod_log ALTER COLUMN target_id TYPE varchar(24);
