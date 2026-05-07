# FID-20260507-SIDEBAR-RESTORE: Restore Missing Sidebar Modules

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260507-SIDEBAR-RESTORE |
| **Date Created** | 2026-05-07 |
| **Status** | COMPLETED |
| **Priority** | CRITICAL |
| **Phase** | Implementation Complete |

## Context

The Harvest Calculator module was removed from StatsPanel during theme rewrite. Math was wrong (hardcoded values, wrong multiplier formula, single value instead of range, wrong cooldown text).

## Changes Applied

1. Restored Harvest Calculator module — all DB-driven values
2. Fixed XP Progress conditional rendering — always shows with loading state
3. Fixed expected amount to show min-max range
4. Fixed cooldown text — "Once per tile per map reset (AM/PM cycle)"
5. Fixed flag bearer bonus to +50% additive (matching harvestService.js)
6. Removed duplicate code block from failed edit
7. Added GAME_CONSTANTS and TrendingUp imports

## Verification
- [x] Harvest Calculator visible with DB-driven values
- [x] Expected amount shows min-max range
- [x] Cooldown text matches game behavior
- [x] XP Progress persists after movement
- [x] npx tsc --noEmit → 0 errors
- [x] npm run build → succeeds
