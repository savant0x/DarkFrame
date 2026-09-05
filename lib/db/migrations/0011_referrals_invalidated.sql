-- Migration 0011: referrals.invalidated marker (FID-20260904-005 Phase 4)
--
-- The admin referrals UI derives a record status of pending | validated | invalid,
-- but the referrals table had no column representing the "invalid" state (only
-- validated + flaggedForAbuse, which are distinct concepts). Added so
-- POST /api/admin/referrals/invalidate can persist a real, non-destructive state.

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS invalidated smallint NOT NULL DEFAULT 0;
