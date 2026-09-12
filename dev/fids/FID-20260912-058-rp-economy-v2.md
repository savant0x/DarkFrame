# FID-20260912-058 — RP Economy v2: Milestones v2 + W1 + T1/T2 + C1, End-to-End Sim

**Date:** 2026-09-12 · **Follows:** FID-056 (milestone design audit), FID-057 (WMD/tech-tree audit) · **Stance:** docs are inputs, not law — every number is judged against measured income and live data, and several doc-era numbers failed.

This FID implements the full bundle you approved: **Milestones v2 + W1 + T1/T2 + C1** as one coherent rebalance, proven by an end-to-end simulation (`scripts/rp-economy-sim.ts`).

## The measured income model (the ruler for everything else)

| Player | RP/day |
|---|---|
| Casual (1,000 harvests/period, no stack) | 200 |
| Dedicated human (full sweep both periods) | 4,300 |
| Dedicated VIP (×1.5) | 6,450 |
| VIP flag-bearer (×1.5 ×2, best case) | **12,900** |

(Milestone-only; battle/login/achievement RP add on top. Best case matches FID-057's measured 13.5k within rounding.)

## T1+T2 — personal tech tree: one catalog, all-functional (`lib/research/techCatalog.ts`)

The route sold **6 effectless techs** (nothing anywhere consumed `troop-transport`, `advanced-mining`, `fortification`, `tactical-warfare`, `factory-automation`, `reconnaissance`) while the Tech Tree UI's mock advertised **6 functional bot techs the route refused to sell** (`bot-hunter`, `advanced-tracking`, `bot-magnet`, `bot-concentration-zones`, `bot-summoning-circle`, `fast-travel-network` — all six verified with live server consumers). Fixed structurally:

- **One shared catalog** consumed by `GET/POST /api/research` and hydrated by `TechTreeView` (the 192-line client mock is deleted; the UI renders exactly what the server sells at the server's prices — a new tech cannot desync again).
- **T2 repricing:** full line 3,000→30,000 RP = **127,500 RP total** (~9.9 best-case days; first unlock 7.5 days for a milestone-only casual). Bot chain strictly escalating: 5k → 8k → 12k → 18k → 25k → 30k.
- Effects: `advanced-mining`/`fortification` ride real balanceService bonuses; the six bot techs gate scanner, magnet, concentration zones, summoning, and fast travel.
- The old `GET` response key `unlockedTechnologies` is preserved; `catalog` + `catalogTotalRp` added.

## W1 — WMD research: ONE 10-tier track (`types/wmd/research.types.ts`)

The audit found the ladder was 3× the documented size (three parallel 900k tracks, 2.7M total; 0 rows ever in `player_research`). Replaced with a single track:

- **752,000 RP total** (52k→108k, monotonic, smooth steps) — full arc ≈ **58 best-case days** (was 1,111). Tier 1 lands in ~4 best-case days.
- **Gates tighten with depth:** every tier requires **L40 + 2×(tier−1)** (old catalog gated only tier 1); tier 10 additionally requires **Clan Level 5** — and a clanless player can no longer bypass that check (it was silently skipped when `clanId` was null).
- **All old unlock content survives** via domain rotation: warheads t1/t4/t6/t8/t10, batteries+radar t2/t5/t7/t10 (BASIC+ADVANCED ride t2), missions + spy ranks fold into t3/t5/t9/t10. No warhead, battery, radar, mission type, or spy rank was lost.
- **Ids are `wmd_tier_*`** — legacy track names remain as filtered-view aliases for back-compat.

### Three live defects fixed en route (beyond the price curve)

1. **`applyTechEffects` was a console.log stub** — completions never touched `missileTier`/`defenseTier`/`intelligenceTier`; the panel's tier readouts would stay 0 forever. Now domain tiers are derived from the completed set and persisted.
2. **`spyService` gated on `intel_tier_*` ids the catalog never sold** (it sold `spy_tier_*`) — every spy gate was dead. Gates remapped to the W1 intel milestones (`wmd_tier_3/5/7/9/10`).
3. **Level/clan gates were theater** — `getPlayerLevel()` returned hardcoded 50, `getClanLevel()` hardcoded 5, and `recalculateAvailableTechs` ignored level gates entirely (the panel offered buttons the POST must refuse). All three now read real columns.

## Milestones v2 — census-anchored daily curve (`lib/researchPointService.ts`)

The old 6-rung curve (1k/2.5k/5k/10k/15k/22.5k → 500-2,500 RP) had three rungs **physically unreachable by any human** (the map yields ~5,300 harvests/period). Replaced with five rungs anchored to the live tile census:

| Rung | Threshold | Reward |
|---|---|---|
| 1 | 1,000 (20% of tiles) | 200 |
| 2 | 2,000 (40%) | 300 |
| 3 | 3,000 (60%) | 400 |
| 4 | 4,000 (80%) | 500 |
| 5 | 5,000 (100%) | 750 |

Every rung reachable by a dedicated human; AutoFarm rewarded linearly; base envelope **4,300 RP/day** (2,150/period × 2), 12,900 stacked best case. The admin `milestone-stats` route now reads thresholds/amounts from the service table instead of its own stale copy (which still showed the pre-P4 amounts).

## C1 — clan research: cut the dead branches (`lib/clanResearchService.ts`)

`getClanBonuses` has exactly one consumer (combat power) reading only `attack`/`defense`. The INDUSTRIAL/ECONOMIC/SOCIAL branches (13 nodes, ~320k RP of clan sinks) sold bonuses nothing ever applied. Tree is now **military-only** (4 nodes, 160k RP); node ids/values unchanged so existing unlocked-techs data stays valid. If you later want harvest/bank clan perks, implement the consumers first, then re-add priced nodes.

## End-to-end sim (`scripts/rp-economy-sim.ts` — committed, re-runnable)

```
Income: casual 200/day · dedicated 4,300 · VIP 6,450 · best case 12,900

Tech tree (127.5k):  9.9d best case · 19.8d VIP · 29.7d human
WMD track (752k):    T1 in 4.0d best case (12.1d human) · full arc 58d best case · 175d human
Clan research (160k): ~62d at a 20%-of-output clan pool

Verdicts: 6/6 PASS
  ✓ Tech tree full line ≤ 12 best-case days (9.9d)
  ✓ Tech tree first unlock ≤ 10 days casual (7.5d)
  ✓ WMD tier-1 ≤ 5 days best case (4.0d)
  ✓ WMD full arc 30–90 days best case (58d)
  ✓ Milestone rungs all ≤ 5,300 ceiling
  ✓ Milestone base envelope = 4,300/day
```

Honest caveat the sim surfaces: the full WMD arc is still 175 days for a dedicated non-VIP human — that is a *choice* (the endgame should outlast months), while the old design made even tier 1 a 24-day wait. First unlocks now land in days; the tail stays aspirational.

## Contract tests (`__tests__/lib/rpEconomyV2.test.ts` — 15 tests)

Pin: catalog/pricing (127,500; no dead ids return; no dangling prerequisites; escalating bot chain), W1 shape (10 tiers / 752k / monotonic costs / L40+2t gates / ≤60-day arc / all unlock content types reachable / `wmd_tier_*` namespace / legacy aliases), and Milestones v2 (5 rungs / ≤5,300 ceiling / monotonic / 750 crown / 4,300-per-day envelope).

## Migration notes

- No DB migration needed: `player_research` has **0 rows** (nobody ever started WMD research), `clans.research_unlocked_techs` is empty in live data, and players' `unlocked_techs` are all empty — no old ids exist anywhere to migrate.
- `scripts/verify-rp-sources.ts` updated to the v2 first-rung stack (200 base × multipliers) and the 5-rung cap-seed array.
- Deliberately **not** changed here: flag research ladder, WMD clan-vote costs, and the tech-tree research-time queue (unlocks remain instant RP spends; `researchTime` is display metadata).

**Gates:** tsc 0 · eslint 0 · vitest **533 passed / 1 skipped** (15 economy + 9 catalog-contract) · build 0 · sim 6/6 PASS.

## Addendum (same day) — T1 contract tests

The T1 substance (shared catalog, 6 functional bot techs sellable, 6 dead techs deleted, UI hydrating from the route) landed with this FID; the follow-up added the missing enforcement layer, `__tests__/api/research/catalog-contract.test.ts` (9 tests):

- **Sellable == shown:** POST accepts *every* id GET advertises, at the exact catalog price, persisting the full unlock set (prereqs + tech) — with prerequisite enforcement proven both ways (chained tech refused without parents).
- **No dead content returns:** non-catalog ids (e.g. `factory-automation`) are refused at zero spend; ids unique; every prerequisite itself sellable.
- **UI tripwire:** the view file must not re-grow a local catalog (regex block on `const TECHNOLOGIES: Technology[] = [`), must hydrate from `data.catalog`, and must render the syncing state rather than a mock default.

Note: FID-057's "4 bot techs" was an undercount — there are **6** functional bot techs (`bot-summoning-circle` and `fast-travel-network` also have live consumers); all 6 are in the catalog.
