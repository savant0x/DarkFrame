# PvP Army-Balance Seam Simulation — 2026-09-15

**FID:** FID-20260915-004 follow-up (operator directive: *simulate PvP under the new
army-balance seam — mixed vs mono at equal power*)
**Driver:** `scripts/simulatePvpBalance.ts` (tier arg 1–5; real `resolveBattle`,
`applyCasualties: false` — zero DB writes, deterministic `calculateDamage`)
**Method:** six archetypes at an **identical 200k pool** (pool = STR + DEF = HP since
FID-20260915-001 Phase 3, so equal pool ⇒ equal attrition capacity; only the STR/DEF
distribution differs). Each ordered pairing runs **twice** — seam ON (auto-computed
balance) vs seam OFF (neutral ×1.0 overrides) — isolating the seam's effect per cell.

## Archetypes (engine-verified bands, 250 units each)

| archetype | STR | DEF | ratio | band |
|---|---|---|---|---|
| monoStr | 200k | 0 | 0.000 | CRITICAL |
| skew60 | 120k | 80k | 0.667 | CRITICAL |
| skew55 | 110k | 90k | 0.816 | IMBALANCED |
| bal53 | 106k | 94k | 0.884 | BALANCED (neutral control) |
| even | 100k | 100k | 1.000 | OPTIMAL |
| nearOpt | 98k | 102k | 0.963 | OPTIMAL |
| monoDef | 0 | 200k | 0.000 | CRITICAL |

## League table (seam ON; W-D-L across 14 matchups: 7 as attacker, 7 as defender)

| archetype | W-D-L | avg rounds | avg pool lost |
|---|---|---|---|
| **monoStr** | **7-1-5** | 9.5 | **42.6%** |
| skew60 | 7-0-6 | 3.0 | 68.3% |
| skew55 | 7-0-6 | 3.0 | 68.7% |
| bal53 | 7-0-6 | 3.2 | 66.7% |
| even | 7-0-6 | 3.3 | 70.3% |
| nearOpt | 6-0-7 | 3.3 | 72.2% |
| monoDef | 5-1-7 | 9.5 | 56.9% |

## Findings

### F1 — The seam reprices, it does not flip winners
**Zero outcome changes across all 36 ordered cells** (ON vs OFF per cell). The
multipliers shift *how much* you pay (rounds, pool lost), never *who wins* in the
matrix. Balanced/mixed armies systematically pay less and stall longer
(`skew60→even`: 40%→82% pool lost, 3→4 rounds), but wins stay with the higher-strike
side. Balance is a *tax*, not a *counter-meta* — at equal pool, raw STR still rules.

### F2 — Mono-STR wins the league despite its CRITICAL tax — the counter-suppression dead zone
The damage algebra's suppression term (`counter = DEF − attackerSTR/2`, min 5) makes
DEF ineffective against an attacker with STR ≥ 2×DEF:
mono-STR attacker took **0% pool damage against every archetype up to DEF-share 0.50**
(50k DEF counters `50k − 100k → 5`, the floor). Real counter-fire only begins at
**DEF-share 0.55** (11k), scaling to 42k at 0.70. So the league is:
mono-STR (42.6% avg loss) < bal53 (66.7%) < skew55 (68.7%) < skew60 (68.3%) < even
(70.3%) < nearOpt (72.2%). The "best" band per the UI (OPTIMAL) loses the most pool.
**The balance tax and the suppression algebra pull in opposite directions, and the
suppression algebra dominates.**

### F3 — Mirror rule
- STR ≥ DEF mirrors resolve by first-strike: `monoStr→monoStr` 1 round clean kill;
  skew60/skew55/bal53/even mirrors 3–5 rounds, winner keeps a tail.
- DEF > STR mirrors are **suicidal**: `nearOpt→nearOpt` and `even→nearOpt` end
  DEFENDER_WIN with 94–98% pool loss on the winner — the counter `1.5×(DEF−STR)`
  exceeds the strike and kills the mirror opponent before the strike phase can
  finish the job. `monoDef→monoDef` is an instant 1-round defender win (attacker
  strike floors at 5, counter is 200k).
- Degenerate cell: `monoDef→monoStr` = 100-round **STALL** (defender holds;
  strikes floor at 5 both ways vs 200k pools). Pre-existing repelled-raid semantics
  (FID-20260915-001), not a seam effect — same ON and OFF.

### F4 — The seam is scale-invariant
League tables at T1, T3, T5 are structurally identical (same ranks, same W-D-L,
pool-lost within ~2 points) — army-balance outcomes don't depend on unit tier, only
on the STR/DEF distribution. The T5 `nearOpt` band shift (0.963 → BALANCED) is a
unit-granularity artifact of the filler rounding (98/102 split rounds differently
against T5 unit stats), not an engine change.

### F5 — Neutral control passes
`bal53→bal53` (both BALANCED, all multipliers ×1.0): seam ON ≡ seam OFF bit-identical.
Cross cells with a non-balanced opponent are *not* controls — the opponent's band
legitimately applies ON (`skew60→bal53`: skew60's CRITICAL tax ON only). First
control run flagged those; corrected design, second run passes.

## Design verdict for the operator

1. **The UI's balance promise is now half-true.** Mixed armies pay less tax — real,
   measurable. But mono-STR remains strictly dominant because the suppression
   dead zone (DEF ≤ STR/2 counters nothing) outweighs every balance penalty.
   If mixed armies are meant to be *viable* rather than merely *cheaper*, the
   counter formula needs a floor share (e.g. counter ≥ 0.1×DEF instead of min 5)
   or the suppression term softened (e.g. `DEF − attackerSTR/4`).
2. **DEF-heavy archetypes are traps in PvP**: they lose mirrors suicidally and
   can't threaten anyone (their own strike floors at 5 vs 200k pools). Fine as
   base-defense shape, useless as field armies.
3. **The stall cell is bounded** (repelled semantics) and rare (requires both
   sides unable to deal meaningful damage) — acceptable.
4. **No matchmaking holes**: no FREE-WIN/UNWINNABLE flags; the matrix's worst
   cases (mirror suicides, the stall) are algebra-inevitable given equal pools,
   not band-induced.

## Repro

```bash
npx tsx -r dotenv/config scripts/simulatePvpBalance.ts [1|3|5]
```
