# DarkFrame Session Summary — 2026-05-07

## What Was Accomplished

### Theme System Overhaul
- Rewrote `globals.css` — clean CSS custom properties, removed all glass/blur utilities
- Rewrote `tailwind.config.ts` — 9-color synth palette, glow shadows, proper font stacks
- Created `components/ui/design.tsx` — shared design tokens (CARD, TABLE, BTN, etc.)

### Component Rewrites (Synth Palette)
- `StatsPanel.tsx` — table-based layout for Player Info, Resources, Military Power, Clan, Shrine Buffs, Actions
- `BalanceIndicator.tsx` — muted bar colors, proper text hierarchy
- `XPProgressBar.tsx` — compact mode, proper progress display
- `ControlsPanel.tsx` — terrain tag color-coded, proper spacing
- `MovementControls.tsx` — w-14 h-14 buttons, proper glow on hover
- `FlagTrackerPanel.tsx` — table layout, accent border colors
- `FlagBearerPanel.tsx` — new component, subtle button styling
- `AutoFarmPanel.tsx` — table layout, muted colors
- `ShrineStatusPanel.tsx` — table with alternating rows
- `WMDMiniStatus.tsx` — consistent card design
- `GameLayout.tsx` — foldable sidebars with toggle buttons, h-screen full-height
- `TopNavBar.tsx` — removed backdrop-blur, proper synth colors
- `ChatPanel.tsx` — full rebuild with polling, synth palette, table layout

### Economy Balance (New Services)
- `lib/multiplierService.ts` — additive diminishing returns formula
- `lib/upkeepService.ts` — hourly unit upkeep with exponential scaling
- `lib/toolDurabilityService.ts` — auto-farm tool durability
- `lib/staminaService.ts` — soft diminishing daily action efficiency
- `lib/resourceDecayService.ts` — 0.25% daily decay on stored resources above 1M
- `lib/territoryDecayService.ts` — uncontested territory reverts after 14-day grace
- `lib/diggerService.ts` — digger bonus calculation
- `lib/pvpBurnService.ts` — PvP resource destruction (20% burned)

### Bug Fixes
- BountyBoardPanel — null-safety on `bountyData.stats`
- AchievementPanel — null-safety on `achievement.requirement.value`
- BeerBasePanel — null-safety on `base.resources.metal/energy`
- StatsPanel XP — always shows with loading state instead of disappearing
- Harvest results — consolidated into single display, removed duplication
- Military Power penalties/bonuses — proper table layout with label + effect columns
- Tier unlock costs — hybrid RP + metal costs
- Base harvest amounts — reduced from 800-1500 to 400-750
- Digger drop rate — reduced from 30% to 2.5%
- XP curve — polynomial `250 × L^2.5`

### Files Archived
- All completed FIDs moved to `dev/fids/archived/`

### Build Status
- TypeScript: 0 errors
- Next.js build: succeeds
- Pushed to GitHub: commit d5c9a40

### Remaining Known Issues
- Other pages (leaderboard, stats, tech, WMD, clans, admin) still use old design system
- TileRenderer center view still has old styling
- Some modal panels use old palette colors
- DB data is stale from pre-balance era — needs wipe and re-seed before launch
