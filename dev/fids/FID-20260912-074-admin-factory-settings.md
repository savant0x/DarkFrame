# FID-20260912-074 — Admin Factory Settings + Real-Level Inspector

**Date:** 2026-09-12 · **Follows:** FID-067 (bot economy), FID-072 (stat curves),
FID-073 (bot raids) · **Trigger:** user report — "/admin is completely missing
the new factory settings/display i asked for."

## Root cause

Three stacked problems, all confirmed against the served bundle:

1. **Stale build.** The running :3000 server predated FID-067's admin route and
   the jobs-status wiring — "Bot Factory Economy" existed only in source, not
   in any served chunk. Build ID timestamped during FID-072 gates.
2. **No settings surface.** Even on a fresh build, /admin had no place to see
   or drive the factory economy: the API existed, no UI mounted it.
3. **Inspector was level-blind by construction.** The admin factories route
   synthesized `tier: 'tier${level}'` — an L7 factory reported "tier7", which
   matched **none** of the tier1/2/3 filter options, styled gray via the
   default branch, and displayed no level anywhere. The real `level` never
   crossed the API boundary.

## Shipped

### FactorySettingsPanel (new, `components/admin/FactorySettingsPanel.tsx`)
One surface for the whole FID-067/072/073 stack, fed by the extended
`GET /api/admin/bot-factory-economy`:
- **Economy job controls** — start/stop (via jobs-status scheduler family) and
  RUN CYCLE NOW (POST route), with live run count, error count, lifetime
  factories upgraded + metal invested, seed status.
- **Level distribution** — per-level meter bars across the map (wild/owned split).
- **Ownership leaderboard** — top 8 factory owners, bot-owned count surfaced.
- **Bot raid config + stats** (FID-073) — chance/cycle, min STR, cap/bot,
  radius, eligible bots, on-cooldown count.
- **Canonical curve table** (FID-072) — L1-10 slots/regen/production/defense/
  upgrade cost, read-only, labeled with the single source
  (`lib/factoryUpgradeService.ts`).

### Factory Inspector — real levels
- Route now sends `level` (1-10); `tier` kept as a derived display band
  (L1-3→tier1, L4-6→tier2, L7-10→tier3) so existing band styling stays honest.
- Cards show **LV n/10**, color-coded by band (green/cyan/violet).
- New **Level filter** (All, L1…L10) alongside the band filter; dead tier-only
  helpers removed.

### AdminView wiring
- `Factory Settings` button (amber) in the tool row; lazy-loaded panel mount.
- Rebuilt and redeployed: :3000 serves the new bundle (verified HTTP 200),
  :3001 custom server rebooted with schedulers live — economy job's first
  pass upgraded 12 factories (97,029 metal / 48,510 energy) within a minute
  of boot.

## Verification
- tsc 0 · eslint 0 (unused-helper cleanup enforced) · vitest **574 passed** ·
  build exit 0.
- Live: `GET /api/admin/bot-factory-economy` payload carries curves/raids/
  ownership; panel renders each section; inspector filter round-trips.

## Landing
PR flow (branch protection requires the attribution `scan` check).
