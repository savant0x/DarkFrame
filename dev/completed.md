# DarkFrame - Completed Features

> Features that have been successfully implemented and tested

**Last Updated:** 2026-05-06
**Total Completed:** 100+ features + 19 FIDs (14 stabilization + 5 balance planning)
**Current Phase:** Economy Rebalance — FIDs Written, Ready for Implementation

---

## 2026-05-06 — Economy Rebalance Planning

### Research
- Two rounds of Gemini Deep Research conducted on game balance
- Analyzed: resource economy, XP curve, digger system, shrine loop, VIP balance, auto-farm, PvP sinks
- Key finding: Multiplicative stacking is the primary economy killer
- Developer confirmed: P2W fine, diminishing returns over hard caps, no forced resets

### FIDs Created
- FID-20260506-BALANCE-MASTER — Master economy rebalance document
- FID-20260506-BALANCE-P1 — Critical fixes (multipliers, diggers, harvest, XP)
- FID-20260506-BALANCE-P2 — New sinks (upkeep, durability, stamina, PvP burn)
- FID-20260506-BALANCE-P3 — Progression (tiers, tech tree, VIP, shrine)
- FID-20260506-BALANCE-P4 — Long-term health (achievements, decay, content cadence)

### Perfection Loop
- Iteration 1 completed on all 5 FIDs
- Fixed: digger persistence (DB not module-level), XP cumulative formula, upkeep DB fields, tech tree cost scaling, decay rate tuning, territory grace period, achievement reward scaling, VIP tool handling

### Project Cleanup
- Archived 2 active FIDs to `dev/fids/archived/`
- Archived 2 old research files to `dev/research/archived/`
- Updated roadmap.md, progress.md, planned.md, decisions.md
- 8 new balance decisions logged (DEC-022 through DEC-029)

---

## 2026-05-05 — Pre-Launch Stabilization Pass (14 FIDs)

### Factory System
- `lib/jobs/factorySlotRegeneration.ts` — Fixed regen filter (`used_slots < slots` → `used_slots > 0`) — full factories now regenerate
- `app/api/factory/status/route.ts` — Auto-correction re-fetches from DB after stale state fix
- `app/api/factory/list/route.ts` — Same DB re-fetch on auto-correction
- `lib/factoryService.ts` — Attack capture writes `slots` column; `produceUnit` uses `getMaxSlots()`
- `app/api/factory/release/route.ts` — Sets `used_slots: 0` on release
- `lib/factoryUpgradeService.ts` — Clarified `getUpgradeProgress` ternary
- `components/FactoryManagementPanel.tsx` — Next-upgrade stats: +500/+41.67
- `app/api/factory/abandon/route.ts` — Docstring corrected (units NOT deleted)

### WMD System
- `app/api/admin/wmd/route.ts` — Rewired GET to analytics services, POST to admin services, fixed response shapes
- `lib/wmd/admin/wmdAdminService.ts` — Wired to admin route (was dead code)
- `lib/wmd/admin/wmdAnalyticsService.ts` — Wired to admin route (was dead code)
- `app/api/wmd/missiles/route.ts` — Added `mapMissileRow` shape transformation
- `app/api/wmd/defense/route.ts` — Added `mapBatteryRow` shape transformation
- `app/api/wmd/intelligence/route.ts` — Added `mapSpyRow` + `mapMissionRow` shape transformation
- `app/api/wmd/voting/route.ts` — Added `mapVoteRow` shape transformation
- `app/api/wmd/notifications/route.ts` — Added `mapNotificationRow` shape transformation

### Clan System
- `app/api/clan/search/route.ts` — Rewritten with member counts, flat objects
- `app/api/clan/join/route.ts` — Added direct clanId-based join path
- `app/api/clan/create/route.ts` — Auto-generates tag, passes isPublic/minLevel
- `lib/clanService.ts` — `joinClanDirectly()` added, full rollback on create failure
- `components/clan/ClanPanel.tsx` — Costs → 1.5M/1.5M, tag input, removed RP check
- `components/clan/ClanManagementView.tsx` — Same fixes + JoinClanView shape fixes
- `lib/validation/schemas.ts` — tag made optional, isPublic/minLevel added

### Items & Diggers
- `lib/itemUtils.ts` — 70-entry tiered RARITY_NAME_POOLS, `getDiggerBonus()`, `pickRandomName()`
- `lib/caveItemService.ts` — DIGGER_TIERS diminishing returns, tiered names, tiered descriptions
- `app/api/inventory/route.ts` — `normalizeItemRow()`, `diggers` breakdown by rarity
- `app/api/player/inventory/route.ts` — Category/gatheringBonus fields + diggers breakdown
- `lib/harvestService.test.ts` — Replaced nonexistent formula tests with DIGGER_TIERS validation
- `lib/referralService.ts` — Random names for welcome/starter diggers

### Cross-System Auth Standardization
- 45 API routes converted from manual `searchParams.get('username')` to `requireAuth(request)`
- 8 client fetch calls updated to remove `?username=` query params
- All routes now authenticate via Supabase cookie

### Toast Service
- `lib/toastService.tsx` — `extractMessage()` handles objects from API error responses

### Harvest Calculator
- `components/StatsViewWrapper.tsx` — Balance ratio fixed (min/max), correct thresholds, flag bearer 2x

### Final Items
- `supabase/migrations/` — `player_sessions` table, `is_banned` column
- `app/api/admin/beer-bases/recalculate-predictions/route.ts` — Created
- `app/api/admin/bot-spawn/route.ts` — Added `requireAuth()` admin guard
- `app/api/admin/bot-regen/route.ts` — Added `requireAuth()` admin guard

### Key Metrics
- 0 TypeScript errors throughout
- 14 FIDs created, implemented, and archived
- ~55 files modified across all subsystems
- All pre-existing type errors eliminated (22 → 0)

---

## 2026-05-04 — Supabase Migration Fixes

### Auth Fixes
- `lib/authMiddleware.ts` — `getAuthenticatedUser()` changed from `createServiceClient()` → `createServerClient()`
- `lib/wmd/apiHelpers.ts` — both `verifyAuth()` and `getAuthenticatedPlayer()` changed to `createServerClient()`
- **Result:** Player stats, inventory, WMD status/research/missiles/defense all return 200

### API Response Fixes
- `app/api/move/route.ts` — added `base: { x, y }` field to player response mapping

### Autofarm Position Tracking
- `utils/autoFarmEngine.ts` — Uses server-confirmed position instead of speculative

---

## FID-20260503-SUPABASE: MongoDB → Supabase Migration

### Phase 1: Schema DDL ✅ — 52 tables, 35+ enums, 80+ indexes, RLS
### Phase 2: Auth Migration ✅ — Supabase SSR cookie-based auth
### Phase 3: Service Layer ✅ — 34 files rewritten
### Phase 4: API Routes ✅ — 55+ files rewritten
### Phase 5: Real-time ✅ — Socket.io verified Supabase-compatible
### Phase 6: Frontend ✅ — GameContext, 200+ `as any` eliminated

---

## Archive

All historical features (Oct-Nov 2025) available in:
- `dev/archives/2026-01-18/completed_pre_baseline_reset.md` (99 features)
- `dev/archives/2025-10-26/completed_archive_2025-10-25-and-earlier.md` (75 features)

