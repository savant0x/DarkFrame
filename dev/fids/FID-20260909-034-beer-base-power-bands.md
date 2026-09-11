# FID-20260909-034 — Beer Base Power-Band Calibration

**Status:** ✅ CONVERGED · **Type:** Calibration + defect fix · **Risk:** Medium (combat-facing numbers)

## Trigger

User asked to confirm Beer Base difficulty bands target the right player
brackets after FID-033 unified unit stats (Silent_Citadel spawned at 8.67M STR).

## Audit findings

### 1. The band system is structurally sound — and was not the cause
- Bands (WEAK 15K–50K, MID 50K–500K, STRONG 500K–2M, ELITE 2M–10M,
  ULTRA 10M–50M, LEGENDARY 50M–100M **total** power) are code-comment spec;
  no design doc supersedes them.
- Bracket mapping: `analyzePlayerLevelDistribution` maps player levels
  1–10/11–20/21–30/31–40/41–50/50+ to tiers; `generateSmartPowerTierDistribution`
  spreads 40% primary / 30% upper / 20% upper-2 / 10% lower around each
  bracket, with variety floors (15/20/15/10/5%) and predictive mode optional.
- Silent_Citadel's tier draw was P ≈ 9.65M — legitimately inside ELITE. The
  band system did its job.

### 2. Defect A (fixed): cross-stat spillover
`generateBeerBaseUnits` budgeted only the picked axis (`quantity = budget /
unit.str`) and ignored the other stat. Dual-stat `SPEC_TAC_*`/`PRESTIGE_*`
units picked on the DEF side delivered unbudgeted STR: Silent_Citadel carried
**1.91M of leaked STR**, actual total 11.56M vs the 10M ELITE ceiling (+16%).

### 3. Defect B (fixed): hollow armies
Post-unification unit costs (T1 = 100) exceed the old 1K WEAK floor and its
per-tier slices; `floor(budget / cost)` = 0 skipped every tier slot →
zero-STR empty bases (matches the STR-0 bot rows seen in the live census).

### 4. Defect C (fixed): stale WEAK floor
1K was a pre-unification relic (old catalog's T1 cost ≈ 5). The minimum
viable 10-slot army at unified costs weighs ~14K. Floor raised to **15K**.

## Fixes

- **Total-power budgeting:** budgets split by specialization ratio, allocated
  T1 10% / T2 20% / T3 30% / T4 60%-of-remaining / T5 rest; quantity now uses
  the unit's full `str + def` as its power cost.
- **Pure-unit pools:** generation filters each tier pool to one-nonzero-stat
  units (8 per mainstream side per tier); dual-only fallback counts full
  power into the quantity math. SPEC_TAC/PRESTIGE units no longer field.
- **≥1-unit guarantee:** every tier slot delivers at least one unit.
- **Floor top-up:** floor-granularity undershoots are topped up with the
  cheapest pure T1 STR unit (bounded < band min → can never breach ceiling).
- **POWER_BANDS exported** as the single source of band truth + `__testing`
  seam for the sweep.

## Live remediation

`Silent_Citadel` regenerated in place (identity/position/level/resources
preserved, Raider 70/30): **STR 6,423,600 / DEF 2,751,880 = 9,175,480 —
in-band**, zero dual-stat entries. Old leaked army replaced.

## Verification

- Regression sweep `__tests__/lib/beerBasePowerBands.test.ts` (6 tests):
  band draws in-band; **Monte-Carlo 6 bands × 5 specs × 40 draws all
  in-band**; no hollow armies (10/10 slots populated at WEAK); pure units
  only; spec STR-share ratio honored; UNIT_POOLS ≡ UNIT_CONFIGS drift guard.
- Gates: `tsc` 0 · `eslint` 0 · vitest **444 passed / 1 skipped** ·
  `next build` exit 0 · live row verified in-band.

## Residuals / notes

- Bot population is nearly extinct in the live DB (1 × L65 STR-0 bot + 1
  Beer Base). Bands assume a healthy ecosystem; **bot repopulation is the
  next priority** so `analyzePlayerLevelDistribution` has signal and the
  map has targets.
- Bracket mapping is level-based; army strength is uncorrelated with level
  for real players (fame L16 = 1.07M STR). Consider strength-aware tier
  selection later if brackets drift from reality.
- Actual-vs-target spread inside a band is now ±one unit cost; if tighter
  precision is ever needed, switch to residual-carry across tiers.
