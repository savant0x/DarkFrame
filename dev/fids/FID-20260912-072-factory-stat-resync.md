# FID-20260912-072 — Factory Stat Resync: UI, Write-Path, and Curve Redesign

**Trigger:** user report — factory tiles show no level; Factory Status deck reads like
every factory is Level 1. Audit confirmed all three symptoms are real, plus the
original design's income loop was never wired at all.

## Audit findings (measured, not remembered)

| # | Finding | Severity |
|---|---|---|
| A1 | **No level is rendered anywhere.** The tile image changes per level (art exists `level1..10`), but no text/badge shows the level — not on the viewport, not in the deck. | UI |
| A2 | **`productionRate` is written once (1/hr) and never updated** — not by the player upgrade route, not by the bot economy. Every factory shows "1/hr" forever. Missile strikes "damage" a stat that never mattered. | Broken |
| A3 | **`slots` column goes stale on upgrade** (written only at creation = 5,000). `/api/factory/status` and `/list` derive capacity from level, but `build-unit` enforces the **raw stale column** — after any upgrade, the panel says one capacity while building enforces another. | Broken |
| A4 | **Passive factory income is dead code.** `calculateFactoryIncome` / `collectAllFactoryIncome` have zero callers; the activity logger maps `/api/factory/collect`, a route that **does not exist**. FID-20260906-006 §"factory income 1000/500 per level" audited a number nothing pays. Phase 5 income never shipped its loop. | Broken |
| A5 | **Slots curve is fake depth:** 5,000 base (+500/level → 9,500) against a live max garrison of 1,901 units. Capacity never binds; the regen rates are decorative. The docstring still carries the ORIGINAL design ("Level 10 = 10 + 9×2 = **28 slots**") — someone inflated it 350× without updating anything downstream. | Design |
| A6 | **Defense curve has a 50× cliff at L2:** 1,000 → 50,000. With bot STR ~23k, no bot can ever raid an L2+ factory; only fame-class players (1M+ STR) operate above L1. Mid-game factory war is dead. (Also: comment says L10 = 3.65M; formula gives 4.05M.) | Design |
| A7 | **Upgrade costs are pocket change** (L1→2 ≈ 2,250 metal ≈ 2 harvests) while creating a 50× defense wall — cheap to build, impossible to fight. Inverted economy. | Design |

## Decisions (dormant stats redesigned, not preserved)

**Production (A2):** `getProductionRate(level) = 5L² + 5` — matches the admin panel's
existing table (L1=10, L2=25, L3=50) exactly, extends it coherently (L10=505/hr).
Becomes the single derived source; the stored column is maintained at write time
same as slots (FID-032 §7 pattern).

**Slots (A5):** honest scarcity — BASE 400, +150/level (L10 = 1,750). Binds sometimes
(max garrison seen: 1,901), never strangles (T3 units cost 7 slots → 250 T3 at L10).
Regen rescaled: 30/hr +10/level (full drain L10 ≈ 15h). Migration clamps
`used_slots` to new capacity (counter only — units live on players, nothing deletes).

**Defense (A6):** smooth the cliff — L1 stays 1,000 (first-capture accessibility);
L2+ = (L−1)² × 12,500 → L2=12.5k (bots can raid), L5=200k, L7=450k, L10=1.01M
(fame-class still rules the top). Preserves the wall, restores the ladder under it.

**Costs (A7):** base 2,500 metal / 1,250 energy, keep ×1.5^target — L1→2 ≈ 5.6k
(a real purchase), L9→10 ≈ 144k (a project). Bot economy pays these from
stockpiles, so the district gradient stays organic.

**Income (A4):** revive Phase 5 — `/api/factory/status` accrues
`calculateFactoryIncome` (1,000 metal + 500 energy per level-hour) to the owner on
fetch (same write-on-GET precedent as slot regen), and the deck displays the rate.
Retroactive income capped by the 1-minute-minimum guard already in the helper.

## Execution order

1. Curves in `factoryUpgradeService` (single source) + docstring truth
2. Write-path: upgrade route writes full stat block; build-unit uses derived capacity; admin route uses `getProductionRate`; bot economy writes full block
3. Migration 0028 resyncs all 965 factories + clamps used_slots
4. UI: level badge + deck LEVEL/income fields; status route accrual
5. Curve-table tests pinning every level 1–10
6. Gates: tsc / eslint / vitest / build → PR
