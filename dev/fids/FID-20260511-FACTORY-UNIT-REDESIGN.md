# FID-20260511-FACTORY-UNIT-REDESIGN

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260511-FACTORY-UNIT-REDESIGN |
| **Date Created** | 2026-05-11 |
| **Status** | CLOSED |
| **Priority** | CRITICAL |
| **Phase** | Complete — All 11 tasks done, TSC 0 errors, Next.js build passes |

## Context
Deep research was conducted on the factory and unit building systems. The research identified critical balance issues:

1. **Factory slots scale linearly** (+500/level) while upgrade costs scale exponentially — players are punished for upgrading
2. **All factories at the same level are identical** — no variation, no terrain interaction, no strategic depth
3. **65 unit types with flat cost-per-STR** — higher tiers are just "bigger numbers" with no qualitative difference
4. **No counter system** — PvP is purely "who has more STR"
5. **Map capacity grows unchecked** — no entropy mechanism
6. **Two production systems** — one is broken (always makes T1_Rifleman)
7. **No auth on attack/produce APIs** — username taken from request body

## Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `supabase/migrations/` | New migration: slot formula, defense formula, upgrade costs, digger weight, remove unused tables, add sacrificed columns | All factory/unit data | HIGH — requires DB reset |
| 2 | `lib/factoryUpgradeService.ts` | New slot formula (polynomial), new defense formula (constrained polynomial), new upgrade costs (base 1.35), RP cost scaling | All factory operations | MEDIUM |
| 3 | `lib/factoryService.ts` | Remove produceUnit, fix add-unit auth, implement burst+decay slots, implement map entropy, terrain modifiers, factory archetypes | Factory capture/build/abandon | HIGH |
| 4 | `types/game.types.ts` | Reduce UNIT_CONFIGS from 65 to 20, add archetype field, orthogonal cost scaling, remove mirrored STR/DEF pairs | All unit-related code | HIGH |
| 5 | `lib/battleService.ts` | New multi-phase combat algorithm, intransitive counters, damage formula, casualty distribution | All PvP combat | HIGH |
| 6 | `app/api/factory/attack/route.ts` | Add auth, new capture probability formula, level-gap penalties | Factory capture | MEDIUM |
| 7 | `app/api/factory/build-unit/route.ts` | Add auth, single production API, array-based batch building | Unit production | MEDIUM |
| 8 | `app/api/shrine/sacrifice-digger/route.ts` | Asymptotic cost curve, infinite resource sink | Digger system | MEDIUM |
| 9 | `components/StatsPanel.tsx` | Display new gathering bonus formula, factory bonus display | Stats display | LOW |
| 10 | `components/inventory/` | Show unit archetypes, sacrifice values, operational data currency | Inventory UI | MEDIUM |
| 11 | `scripts/reset-and-seed.ts` | Update for new formulas, factory archetypes, terrain modifiers, initial unit data | Dev reset | LOW |

## Implementation Plan

### Step 1: Database Migration
- Create `supabase/migrations/20260511000001_factory_unit_redesign.sql`
- Add `sacrificed_metal_bonus`, `sacrificed_energy_bonus`, `sacrificed_digger_count` to players
- Add `digger_weight` to player_inventory
- Add `factory_archetype` to factories (MUNITIONS/HEAVY_ASSEMBLY/AEGIS)
- Add `terrain_modifier` to factories
- Remove unused tables: factory_production_queue, factory_slots, factory_defense, unit_build_queue
- Update default defense values to match new formula

### Step 2: Factory Upgrade Service
- New slot formula: `maxSlots = 5,000 × 1.15^(level-1) + (level-1)² × 200`
- New defense formula: `defense = 5,000 + 12,000 × (level-1)^1.4`
- New upgrade costs: `metal = 1,500 × 1.35^(level-1)`, `energy = 750 × 1.35^(level-1)`, `rp = level × 10`
- Regen rate: `maxSlots / 12` hours

### Step 3: Factory Service
- Remove produceUnit function entirely
- Implement burst+decay slot model: 80% on capture, remaining 20% via asymptotic decay
- Implement map entropy: degrade 1 level per 72 hours unoccupied
- Implement terrain modifiers from adjacent tiles
- Implement factory archetypes (assigned on map generation)
- Fix auth on all endpoints

### Step 4: Unit Type Redesign
- Reduce UNIT_CONFIGS from 65 to 20 units
- 4 archetypes: Striker, Bulwark, Artillery, Support
- 5 tiers per archetype
- Orthogonal cost scaling: higher tiers = more slot-efficient but less resource-efficient
- Intransitive counters: Striker > Bulwark > Artillery > Support > Striker

### Step 5: Battle Service
- Multi-phase combat: Artillery → Support buff → Vanguard clash → Casualty distribution
- Damage formula: `damage = attackerSTR × (1 - defenderDEF / (defenderDEF + attackerSTR))`
- Weighted casualty distribution (Bulwarks absorb 70%)
- Generate structured After-Action Report text

### Step 6: Shrine/Digger System
- Asymptotic cost curve for gathering bonuses
- Separate from balance multiplier
- Infinite resource sink

### Step 7: Reset Script Update
- Generate factories with archetypes based on terrain
- Apply terrain modifiers
- Seed with new unit configs
- Update game_config values

## Verification Checklist
- [x] DB migration runs cleanly
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx next build` — all pages build
- [x] Factory L10 has ~41K slots (not 9.5K)
- [x] Factory defense L10 is ~260K (not 500K)
- [x] Upgrade cost L10 cumulative is ~357K (not 112K)
- [x] Only 20 unit types in UNIT_CONFIGS
- [x] No produceUnit function exists — replaced with buildUnitsAtFactory
- [x] All factory APIs require auth
- [x] Map entropy degrades unoccupied factories (72h threshold)
- [x] Terrain modifiers apply correctly (Wasteland/Metal/Energy/Cave/Forest)
- [x] Digger sacrifice uses asymptotic curve
- [x] Combat uses multi-phase algorithm (Artillery→Support→Vanguard→Casualties)
- [x] After-Action Report generates readable text
- [x] Burst+decay slot model implemented (80% on capture, 20% asymptotic decay)
- [x] Orthogonal cost scaling (T1 resource-efficient/slot-heavy, T5 opposite)
- [x] Intransitive combat (Striker>Bulwark>Artillery>Support>Striker)
- [x] Operational Data currency for factory cycling
- [x] StatsPanel updated with archetype breakdown + Operational Data
- [x] reset-and-seed.ts updated with new formulas
- [x] All old FIDs archived

## Notes
- This is a breaking change — requires full DB reset
- All existing player data will be wiped (acceptable in dev)
- The old `gathering_metal_bonus`/`gathering_energy_bonus` columns are replaced by `sacrificed_metal_bonus`/`sacrificed_energy_bonus`
- The `factory_count` denormalized column is replaced by a database view
- Two release/abandon endpoints consolidated into one
