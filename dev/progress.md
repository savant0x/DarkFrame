# DarkFrame — Features In Progress

> Currently active development work

**Last Updated:** 2026-05-07
**Active FIDs:** 0 (All balance FIDs implemented and archived)
**Current Status:** ✅ Main Game UI Complete — Theme system, sidebar panels, chat, movement, harvest results all updated to synth palette. Remaining pages still use old design system.

---

## ✅ COMPLETE — May 7, 2026 Session

### Theme & UI Overhaul
- `globals.css` rewritten — clean CSS custom properties, removed glass/blur utilities
- `tailwind.config.ts` updated — 9-color synth palette, glow shadows, proper font stacks
- `components/ui/design.tsx` created — shared design tokens
- All sidebar panels rewritten with synth palette (StatsPanel, ControlsPanel, FlagTrackerPanel, AutoFarmPanel, ShrineStatusPanel, WMDMiniStatus)
- ChatPanel rewritten with full polling logic and synth palette
- GameLayout rewritten — foldable sidebars, proper h-screen layout
- TopNavBar rewritten — removed backdrop-blur, proper synth colors

### Bug Fixes
- Harvest results consolidated into single display (removed duplication)
- Military Power section — penalties/bonuses as proper tables with label + effect columns
- Flag Bearer Release button — removed harsh white stroke, uses subtle bg fade
- XP Progress — always shows with loading state instead of disappearing
- BountyBoardPanel — null-safety on bountyData.stats
- AchievementPanel — null-safety on achievement.requirement.value
- BeerBasePanel — null-safety on base.resources.metal/energy
- BalanceIndicator — proper STR/DEF bar colors, muted text
- ControlsPanel — terrain tag color-coded, proper spacing
- MovementControls — proper button sizes, glow on hover
- Tier unlock costs — hybrid RP + metal costs
- Base harvest amounts — reduced from 800-1500 to 400-750
- Digger drop rate — reduced from 30% to 2.5%
- XP curve — polynomial `250 × L^2.5`

### New Services Created
- `lib/multiplierService.ts` — additive diminishing returns
- `lib/upkeepService.ts` — hourly unit upkeep
- `lib/toolDurabilityService.ts` — auto-farm tool durability
- `lib/staminaService.ts` — soft diminishing daily actions
- `lib/resourceDecayService.ts` — resource rot above 1M threshold
- `lib/territoryDecayService.ts` — territory reversion after 14-day grace
- `lib/diggerService.ts` — digger bonus calculation
- `lib/pvpBurnService.ts` — PvP resource destruction

### Archived FIDs (Completed)
- FID-20260506-BALANCE-MASTER through P4
- FID-20260506-SHRINE
- FID-20260506-STARTUP
- FID-20260507-CHAT
- FID-20260507-SIDEBAR-RESTORE

All archived to `dev/fids/archived/`.

---

## 📋 Remaining Work (Not Yet Started)
- Other pages (leaderboard, stats, tech, WMD, clans, admin) still use old design system
- TileRenderer center view styling
- Modal panels (HarvestModal, BattleResultModal, etc.)
- DB wipe and re-seed needed for balance changes to take effect

---

## 📁 No Stale FIDs

All completed/archived FIDs moved to `dev/fids/archived/`.
