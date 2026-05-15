# DarkFrame — Completed Features

> Features that have been successfully implemented and verified.

**Last Updated:** 2026-05-11
**Total Completed:** 100+ features across 30+ phases
**Current Phase:** Factory & Unit Redesign — Complete

---

## 2026-05-11 — Factory & Unit System Overhaul

### FID-20260511-FACTORY-UNIT-REDESIGN
- Complete redesign of factory cycling, unit production, and combat systems
- 65 unit types → 20 focused units (4 archetypes × 5 tiers)
- Linear slot regen → Burst+Decay model (80% capture, 20% asymptotic)
- Simple STR vs DEF combat → Multi-phase algorithm
- Added Operational Data currency, terrain modifiers, factory archetypes
- All FIDs archived, TSC 0 errors, Next.js build passes
- 20+ files modified across types, services, API routes, components, scripts

---

## 2026-05-07 — Day Session Summary

### Components Created/Modified (54 files)
- `components/FlagBearerPanel.tsx` — New flag bearer status panel
- `components/ui/design.tsx` — Shared design token constants
- `lib/multiplierService.ts` — Additive diminishing returns
- `lib/upkeepService.ts` — Hourly unit upkeep
- `lib/toolDurabilityService.ts` — Auto-farm tool durability
- `lib/staminaService.ts` — Daily action efficiency
- `lib/resourceDecayService.ts` — Resource rot above 1M
- `lib/territoryDecayService.ts` — Territory reversion after 14-day grace
- `lib/diggerService.ts` — Digger bonus calculation
- `lib/pvpBurnService.ts` — PvP resource destruction (20% burned)

### Visual/Theme Fixes
- Removed all `bg-[--shadow]` → `bg-[--card]` across all panels
- Removed all `border-white/10` → `border border-white/[0.06]`
- Standardized card chrome: `bg-[--card] border border-white/[0.06] rounded-lg overflow-hidden`
- Removed all `backdrop-blur-*`, `text-shadow`, `drop-shadow-*`
- Standardized text hierarchy: white/white:60/white:40/white:25 only
- Standardized font sizes: xs(12)/sm(14)/base(16)/lg(18)/xl(20) only
- Fix: FlagTrackerPanel — remove border-2, use proper table design
- Fix: AutoFarmPanel — use table layout instead of divs
- Fix: ShrineStatusPanel — use table layout
- Fix: WMDMiniStatus — consistent card design

### Bug Fixes
- BountyBoardPanel — null-safety on `bountyData.stats`
- AchievementPanel — null-safety on `achievement.requirement.value`
- BeerBasePanel — null-safety on `base.resources.metal/energy`
- StatsPanel XP — always shows with loading state instead of disappearing
- Harvest results — consolidated into single display, removed duplication
- Military Power penalties/bonuses — proper table layout with label + effect columns
- BalanceIndicator — proper STR/DEF bar colors, muted text
- ControlsPanel — terrain tag color-coded, gap/padding fixed
- MovementControls — proper button sizes (w-14 h-14), glow on hover
- Foldable sidebars — working toggle buttons with proper positioning

### Design System
- `app/globals.css` — cleaned up, proper CSS custom properties
- `tailwind.config.ts` — updated synth palette, glow shadows
- `components/ui/design.tsx` — shared tokens (CARD, CARD_HEADER, TABLE, BTN_*)

### Remaining Known Issues
- Other pages (leaderboard, stats, tech, WMD, clans, admin) still use old design system
- TileRenderer center view styling
- Modal panels use old palette colors
- DB data is stale from pre-balance era — needs wipe and re-seed before launch
- ChatPanel uses old cyan/slate palette (out of scope for this session)
- `app/game/page.tsx` loading screen uses `bg-[--void]` (correct)
