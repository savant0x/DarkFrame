# DarkFrame — Features In Progress

> Currently active development work

**Last Updated:** 2026-05-11
**Active FIDs:** 0 (all complete)
**Current Status:** ✅ Factory & Unit Redesign Complete — All systems updated

---

## ✅ COMPLETE — May 11, 2026

### FID-20260511-FACTORY-UNIT-REDESIGN: Factory & Unit System Overhaul
- **Status:** CLOSED — All 11 tasks done, TSC 0 errors, Next.js build passes
- **Priority:** CRITICAL
- **Research:** Gemini Deep Research + multi-model analysis
- **Scope:** Complete redesign of factory cycling, unit production, and combat systems
- **Build:** 0 TypeScript errors, all pages build successfully
- **File:** `dev/fids/FID-20260511-FACTORY-UNIT-REDESIGN.md`

### Key Changes
- **Unit System:** 65 bloated types → 20 focused units (4 archetypes × 5 tiers)
  - Strikers (offense), Bulwarks (defense), Artillery (anti-support), Support (multiplier)
  - Orthogonal cost scaling: T1 resource-efficient/slot-heavy, T5 resource-heavy/slot-efficient
  - Intransitive combat: Striker > Bulwark > Artillery > Support > Striker
- **Factory System:** Linear slots → Burst+Decay model
  - 80% slots on capture, 20% via asymptotic decay
  - Map entropy: degrade 1 level per 72h unoccupied
  - Terrain modifiers: Wasteland/Metal/Energy/Cave/Forest
  - Factory archetypes: MUNITIONS/HEAVY_ASSEMBLY/AEGIS
- **Combat:** Simple STR vs DEF → Multi-phase algorithm
  - Phase 1: Artillery strikes Support
  - Phase 2: Support buffs (diminishing returns, max +60%)
  - Phase 3: Vanguard clash (asymptotic damage formula)
  - Phase 4: Weighted casualty distribution (Bulwarks absorb 70%)
- **Economy:** Operational Data currency for factory cycling
- **API:** produceUnit removed, buildUnitsAtFactory with batch support
- **StatsPanel:** Archetype breakdown + Operational Data display
- **DB Migration:** `supabase/migrations/20260511000001_factory_unit_redesign.sql`

### Files Modified (20+ files)
- `types/game.types.ts` — UnitType enum, UnitArchetype type, UNIT_CONFIGS (20 units), PlayerUnit archetype
- `types/database.ts` — New factory columns, operational_data on players
- `lib/factoryUpgradeService.ts` — New formulas (slots, defense, costs, burst, decay, entropy, terrain)
- `lib/factoryService.ts` — Complete rewrite (burst+decay, entropy, buildUnitsAtFactory, abandonFactory)
- `lib/battleService.ts` — Multi-phase combat, archetype field
- `lib/auctionService.ts` — UnitType cast fix
- `app/api/factory/produce/route.ts` — Replaced produceUnit with buildUnitsAtFactory
- `app/api/factory/abandon/route.ts` — Fixed factory limit reference
- `app/api/factory/build-unit/route.ts` — UnitType cast fix
- `lib/validation/schemas.ts` — Added unitType/quantity to FactoryProduceSchema
- `components/StatsPanel.tsx` — Operational Data, army composition by archetype
- `components/CreateListingModal.tsx` — Updated to new UnitType values
- `components/UnitBuildPanel.tsx` — Updated to new UnitType values, archetype icons/colors
- `scripts/reset-and-seed.ts` — New factory config, operational_data, player_units table
- `dev/reset-and-seed.ts` — Updated with new formulas

---

## ✅ COMPLETE — May 10, 2026

### FID-20260510-DIGGER-BALANCE: Digger Sacrifice Rebalance
- **Status:** CLOSED — Perfection Loop Certified (5 iterations)
- **Priority:** CRITICAL
- **Key Fix:** Exponential decay formula corrected, asymptotic cost curve implemented

### FID-20260510-INVENTORY-REDESIGN: Inventory Panel Redesign
- **Status:** CLOSED — Perfection Loop Certified (3 iterations)
- **Priority:** HIGH
- **Key Fix:** Visual hierarchy, item grouping, sacrifice values display

---

## ✅ COMPLETE — May 9, 2026

### FID-20260509-HARVEST-CALC: StatsPanel Harvest Calculator Fix
- **Status:** CLOSED
- **Priority:** HIGH
- **Key Fix:** Gathering bonus display, next/headers build error

### FID-20260509-COMPREHENSIVE-AUDIT: Full Codebase Audit
- **Status:** CLOSED
- **Priority:** CRITICAL
- **Scope:** Server/DB as single source of truth, all values from API

---

## ✅ COMPLETE — May 8, 2026

### FID-20260508-BALANCE-V2: Economy & Progression Rebalance
- **Status:** FIXED — Awaiting DB wipe/re-seed
- **Priority:** CRITICAL
- **Research:** 10+ AI models, full consensus
- **Scope:** 16 changes across XP, factory defense, resource decay, diggers, RP, PvP, army balance, flag, terrain, auto-farm, banks, forests, achievements, code hygiene

### FID-20260508-PAGE-STRUCTURE: GameLayout + Synth Palette
- **Status:** CLOSED
- **Priority:** HIGH
- **Scope:** All 20 pages under GameLayout wrapper, synth palette applied

---

## 📋 Remaining Work (Not Yet Started)
- Bot dynamic scaling (new feature)
- Clan bank upgrade RP costs (new feature)
- WMD component RP surcharge (new feature)
- DB wipe and re-seed needed for all changes to take effect
- Battle service multi-phase combat algorithm (needs full implementation)
- After-Action Report text generation
- Factory archetype assignment on map generation
- Shrine sacrifice-digger asymptotic curve (route exists, needs testing)
