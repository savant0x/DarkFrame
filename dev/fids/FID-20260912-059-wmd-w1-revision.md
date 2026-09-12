# FID-20260912-059 — W1 Revision: 600k Track, L40+2×tier Gates, Migration 0025

**Date:** 2026-09-12 · **Follows:** FID-20260912-058 (RP Economy v2) · **Trigger:** user
revision of W1 — "600k total, gates at L40+tier×2, migration for existing rows."

## Decision deltas from FID-058

| Parameter | FID-058 (shipped) | FID-059 (this revision) |
|---|---|---|
| Total track cost | 752,000 RP | **600,000 RP exactly** |
| Ladder shape | 52k → 108k, irregular steps | **Arithmetic: 42k + 4k×(t−1) → 78k** |
| Level gates | L40 + 2×(tier−1) → L40–L58 | **L40 + 2×tier → L42–L60** |
| Migration | none (0 live rows) | **0025 (defensive remap/refund/recompute)** |
| Full-arc best case | ~56 days | **~44 days (sim: 47)** |

All other FID-058 decisions stand: single track, domain rotation
(missile {1,4,6,8,10}, defense {2,5,7}, intelligence {3,9}), `wmd_tier_*`
namespace, tier-10 clan gate.

## The ladder (arithmetic series, sums to exactly 600,000)

| Tier | Cost | Cumulative | Gate | Est. (13.5k/day best case) |
|---|---|---|---|---|
| 1 | 42,000 | 42,000 | L42 | 3 days |
| 2 | 46,000 | 88,000 | L44 | 4 days |
| 3 | 50,000 | 138,000 | L46 | 4 days |
| 4 | 54,000 | 192,000 | L48 | 4 days |
| 5 | 58,000 | 250,000 | L50 | 5 days |
| 6 | 62,000 | 312,000 | L52 | 5 days |
| 7 | 66,000 | 378,000 | L54 | 5 days |
| 8 | 70,000 | 448,000 | L56 | 5 days |
| 9 | 74,000 | 522,000 | L58 | 6 days |
| 10 | 78,000 | 600,000 | L60 | 6 days |

## Migration 0025 (`lib/db/migrations/0025_wmd_research_track_v2.sql`)

Live `player_research` had **0 rows** at migration time (verified — WMD
research was never sellable pre-FID-058), so this ships **defensively** for
any pre-v2 install. Per row, in a single idempotent DO block:

1. **Legacy id preservation** — `missile_tier_*` / `defense_tier_*` /
   `spy_tier_*` / `intel_tier_*` ids in `completed_techs` are prefixed
   `legacy_` (auditable, never match the sellable catalog; the domain-tier
   recompute filters over catalog ids, so they are inert).
2. **Tier mapping** — best tier N reached in ANY legacy domain completes
   `wmd_tier_1…N` (same content tier; the per-domain → single-track fold is
   the accepted W1 design decision).
3. **Stale-research refund** — if `current_research_tech_id` is not a
   catalog id, its partially-spent RP is refunded to `players.research_points`
   (join on `players."_id"::text`; no-op-safe if id formats diverge) and the
   slot cleared.
4. **Recompute** — missile/defense/intelligence tiers recomputed exactly as
   `researchService.applyTechEffects` does; `available_techs` = next
   incomplete tier (per `initializePlayerResearch` invariant);
   `locked_techs` = the rest. Level/clan gates for the next tier are
   re-checked by `recalculateAvailableTechs` on the player's next action —
   deliberately not pre-filtered here.

Idempotency: every pass is guarded on legacy prefixes/catalog-id membership;
post-conditions (0 unmapped legacy ids, 0 stale in-progress ids) are listed
in the file footer. Applied to the live DB and verified: `rows: 0, legacy
remaining: 0, stale: 0`.

## Gates

- `tsc --noEmit`: **0 errors**
- `eslint .`: **silent** (0 errors / 0 warnings)
- `vitest run`: **533 passed / 1 skipped** — including the updated
  rpEconomyV2 pins: total === 600,000; costs[0] === 42,000; costs[9] ===
  78,000; gates at 40 + 2×tier; full arc ≤ 50 best-case days (44.4 → 45).
- `npm run build` (`next build --webpack`): **exit 0**
- `npx tsx scripts/rp-economy-sim.ts`: **6/6 PASS** — WMD T1 3.3 best-case
  days, full arc 47 best-case days (140d human / 93d VIP).

## Process notes

- One edit batch produced a transient double-comma (tsc TS1136 ×21) — caught
  immediately by the ladder-verifier script and repaired; the final ladder is
  monotonic, gated, and sums to exactly 600k.
- Build gate lesson: this repo must build via `npm run build`
  (`--webpack`); bare `next build` under Next 16 defaults to Turbopack and
  rejects the repo's webpack config — NOT a code defect.
