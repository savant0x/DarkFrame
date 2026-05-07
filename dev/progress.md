# DarkFrame — Features In Progress

> Currently active development work

**Last Updated:** 2026-05-07
**Active FIDs:** 0 (all balance FIDs implemented and archived)
**Current Status:** ✅ Main Game UI Complete — Theme system, sidebar panels, chat, movement, harvest results all updated to synth palette. Remaining pages still use old design system.

---

## ✅ COMPLETE — May 7, 2026 Session

### Theme System Overhaul
- Rewrote `globals.css` — clean CSS custom properties, removed glass/blur utilities
- Rewrote `tailwind.config.ts` — 9-color synth palette, glow shadows
- Created `components/ui/design.tsx` — shared design tokens
- All sidebar panels rewritten with synth palette
- ChatPanel rebuilt with full polling logic and synth palette
- GameLayout rewritten — foldable sidebars, proper h-screen layout
- TopNavBar rewritten — removed backdrop-blur, synth palette

### Economy Balance (Code Implementation)
- Created 10 new service files (multiplier, upkeep, durability, stamina, decay, etc.)
- Base harvest reduced 2x, digger drop rate reduced ~10x, XP curve polynomial
- Tier unlocks hybrid RP + metal costs
- All values DB-driven (no hardcoded numbers)

### Bug Fixes (15+ issues)
- BountyBoardPanel, AchievementPanel, BeerBasePanel — null-safety crashes fixed
- StatsPanel XP — always shows with loading state
- Harvest results — consolidated, no duplication
- Military Power — penalties/bonuses as proper tables
- ControlsPanel — terrain tag color-coded, gap fixed
- FlagBearerPanel — Release button subtle styling
- Foldable sidebars — working toggle buttons

---

## 📋 Remaining Work (Not Yet Started)
- Other pages (leaderboard, stats, tech, WMD, clans, admin) still use old design system
- TileRenderer center view styling
- Modal panels use old palette colors
- DB wipe and re-seed needed for balance changes to take effect

---

## 📁 No Stale FIDs

All completed/archived FIDs moved to `dev/fids/archived/`.
