# FID-20260909-033: Unit catalog unification — one roster, real stats

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-033-unit-catalog-unification.md`
**ID:** FID-20260909-033
**Severity:** CRITICAL (two live build UIs sell different armies 20× apart in power; tutorial steps can never complete; bot armies use a third naming scheme)
**Status:** complete
**Created:** 2026-09-10
**Related:** FID-20260909-032 §G (units `$each` blob — same corruption class found in a second writer), FID-20260909-031 (invested columns depend on unit pricing)

---

## 1. Summary

Operator confirmed from the live Unit Factory UI: **the STR tier-1 unit is
"Infantry" at 100 STR (200M/200E) — not "Rifleman" at 5 STR.** Investigation
found the codebase carries **four parallel unit catalogs** with divergent
names, stats, and scales, all writing/reading the same `players.units` jsonb.

## 2. Verified catalog census

| # | Catalog | Location | Roster | Consumers | Verdict |
|---|---------|----------|--------|-----------|---------|
| A | `UNIT_BLUEPRINTS` + `TECH_TREE` | `types/units.types.ts` | 40 units, Infantry **100 STR**, real names, RP/level unlocks | `/game/unit-factory` page → `/api/player/build-unit` (operator's screenshots) | ✅ **canonical — matches UI and live data** |
| B | `UNIT_CONFIGS` + `UnitType` enum + `getUnitsForTier` | `types/game.types.ts` | 40 units, Rifleman **5 STR** (~1/20th scale), tier-parallel structure | `factory/build-unit`, `UnitBuildPanelEnhanced` (mounted on /game), `CombatAttackModal`, `UnitBuildPanel`, `beerBaseService` pools, `factoryService` | ❌ stale scale; every STR/DEF number wrong vs. UI |
| C | `UNIT_POOLS` | `lib/beerBaseService.ts` | hand-copied from B **with drift** (Sniper 15/5 vs B's 15/0) | Beer Base + bot army generation | ❌ drifted clone |
| D | `UNIT_TYPES` | `lib/botGrowthEngine.ts` | warrior/berserker/champion — third naming scheme | bot growth cycles | ❌ orphan scheme |

**Live-data census** (players.units jsonb): `Infantry` ×10,725 @ STR 100 (fame,
matches the 1,072,500 combat rating in the UI), plus tier-catalog-B strings on
bot `Silent_Tower` (T1_SCOUT … T5_MONOLITH) and a legacy `T1_Rifleman` row on
test account `pamtpkziq5`. No catalog-D strings exist in the DB.

## 3. Defects caused by the split

1. **Two live build UIs sell different armies** — /game/unit-factory (A:
   Infantry@100) vs in-game UnitBuildPanelEnhanced (B: Rifleman@5). Same
   player, two economies 20× apart.
2. **Tutorial `resource_build_infantry` validates `unitType: 'infantry'`** —
   a unit built via the in-game panel (B: `T1_RIFLEMAN`) can NEVER complete
   the step. Root cause of the operator's "Step validation failed".
3. **`CombatAttackModal` reads stats from B** — battles against A-units render
   wrong names/strengths.
4. **FID-032 invested-columns backfill priced A-units through B** — unknown
   keys price to 0 (honest but wrong once unification lands).
5. **`/api/player/build-unit` carried the FID-032 §G `$each` cast bug** (fixed
   en route) AND wrote entries without `quantity` — entry shape contract
   violated on every fleet build.
6. **Bot growth engine (D) fabricates units no other system recognizes.**

## 4. Remediation contract — catalog B becomes a view of catalog A

Single source of truth: **`UNIT_BLUEPRINTS`**. All unit identity, stats, and
costs flow from it; nothing else defines a roster.

1. **`types/game.types.ts`:** keep the `UnitType` enum KEYS as the stable
   integration vocabulary (combat, saves, UI all key on it), but rebuild
   `UNIT_CONFIGS` **from** `UNIT_BLUEPRINTS` via an explicit id→blueprint
   mapping table (real names, real stats, real costs). `getUnitsForTier`
   derives from the same table. The 5-STR scale dies.
2. **`lib/beerBaseService.ts`:** `UNIT_POOLS` derives from the unified config
   (no hand-copied stats — drift becomes impossible).
3. **`lib/botGrowthEngine.ts`:** catalog D deleted; growth builds from the
   unified config.
4. **Tutorial validator:** `build_unit` matching accepts blueprint ids
   (`infantry`) and the unified config keys case-insensitively — step completes
   for units from EITHER build path.
5. **`/api/player/build-unit`:** entries carry `quantity` (done), `$each` cast
   removed (done), provenance stamped (aligns with FID-032 §H).
6. **Data migration (`scripts/migrate-unit-catalog.ts`, idempotent):**
   - legacy `T1_Rifleman`-style entries → unified keys, stats corrected to
     blueprint values,
   - `Infantry` → `T1_INFANTRY` key with blueprint stats (blueprints gain the
     Infantry entry as the T1 STR unit),
   - bot tier-army rows re-priced from the unified config.
7. **Combat balance note:** totalStrength values on live players were computed
   under the OLD scale for B-units. Migration recomputes per-entry stats from
   the blueprint and recalculates players.totalStrength/totalDefense to keep
   the power readout truthful.

All fixes hand-edited. Gates: tsc 0 · eslint 0 · vitest green · build 0.

## 5. Implementation log

1. **`types/game.types.ts`** — `UnitType` enum T-tier values renamed to the
   canonical blueprint ids (`T1_Infantry = 'INFANTRY'`, `T1_Scout = 'T1_SCOUT'`,
   …, keys kept as the stable integration vocabulary); `UNIT_CONFIGS`
   regenerated from `UNIT_BLUEPRINTS` — real names, real stats, real costs
   (40 T-tier entries; the 25 SPEC/PRESTIGE entries have no blueprint
   counterpart and were preserved verbatim from git HEAD after the generation
   pass initially overwrote them).
2. **`lib/beerBaseService.ts`** — hand-copied `UNIT_POOLS` (with drift)
   deleted; pools now derive per-`UnitTier` from `UNIT_CONFIGS`. A bot Sniper
   is the player Sniper, byte-for-byte.
3. **`lib/botGrowthEngine.ts`** — catalog D (`warrior`/`berserker`/`champion`)
   deleted; `UNIT_TYPES` derives from `UNIT_CONFIGS` (tiers 1–3, STR/DEF),
   so bot armies use canonical identities and stats.
4. **`app/api/player/build-unit`** — pushed entries now carry `id`,
   `unitType`, and `producedAt` provenance (previously missing → unitCounts
   keyed them 'Unknown' and per-factory investment was unattributable);
   `$each` cast bug was fixed earlier in this turn.
5. **`lib/tutorialService.ts` §4.4** — `build_unit` validator builds an alias
   set (enum value, display name, and any config spelling matching the
   step's declared unit) and matches case-insensitively; the step now
   completes for units from either build path.
6. **`components/CreateListingModal`** — unit dropdown options derive from
   `UNIT_CONFIGS` (top 6 by tier/power) instead of hardcoded stale ids;
   default listing unit `T1_Infantry`.
7. **`components/UnitBuildPanel`** (legacy, unmounted) — dead keys
   `T1_Bunker`/`T1_Barrier` → canonical `T1_Infantry`/`T1_Barricade`.
8. **`scripts/migrate-unit-catalog.ts`** (idempotent) — re-keys entries by
   config value or display name; legacy bot-pool identities with no direct
   match (T2_RANGER, T1_SHIELD, …) map to the nearest same-tier, same-category
   canonical unit; re-prices stats; recomputes `total_strength`/`total_defense`.
   Live run: fame `Infantry`→`INFANTRY` (1,072,500 total preserved, now
   matching the UI); Silent_Tower 7 legacy identities mapped (e.g.
   `T2_RANGER`→`T2_MARKSMAN`, `T1_SHIELD`→`T1_WATCHMAN`), totals recomputed
   505,990 STR / 432,530 DEF; pamtpkziq5 `T1_Rifleman`→`T1_RIFLEMAN` @ 95.
   Re-run: 0 changes (idempotent).
9. **`__tests__/unit/catalog-unification.test.ts`** — 6 drift guards: enum
   value uniqueness, exact config↔blueprint match (stats + costs), full
   blueprint-roster coverage, Infantry@100 pin, per-tier STR/DEF presence +
   exponential slot costs, runtime Record exhaustiveness.
10. **`scripts/probe-tutorial-fresh-account.ts`** — digger-count assertion
    fixed (a universal digger bumps the item list + both counters; count
    physical items only). Fresh-account tutorial probe: **16/16 PASS** —
    all 7 steps validate, reward granted exactly once, replay guard holds.

## 6. Gates

- tsc `--noEmit`: **0 errors**
- eslint (app/lib/components/types/scripts): **0 errors**
- vitest: **434 passed / 1 skipped** (37 files; 6 new catalog guards)
- `next build`: **exit 0**
- Live migration verified idempotent; post-migration DB census shows every
  unit identity in the unified catalog with recomputed truthful totals
- Fresh-account tutorial probe: **16/16 PASS**

## 7. Residuals & follow-ups

- **Pre-provenance invested totals stay 0** (FID-032 §7): fame's 10,725
  Infantry predate `producedAt`, so factory invested columns remain a live
  lower bound; write-time `$inc` now makes them exact going forward, priced
  on the unified configs.
- **Migrated bot identities are nearest-equivalent approximations**; the
  weekly Beer Base respawn will organically replace them with
  generation-native unified-pool armies over time.
- **SPEC/PRESTIGE configs remain hand-maintained** (no blueprint
  counterpart); the drift guard intentionally covers the 40-unit T-tier
  roster only.
- **`UnitBuildPanel.tsx` is dead code** (unmounted duplicate of
  `UnitBuildPanelEnhanced`) — candidate for deletion in a cleanup pass.
