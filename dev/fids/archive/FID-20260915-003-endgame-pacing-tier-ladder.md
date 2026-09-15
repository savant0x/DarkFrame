# FID-20260915-003: endgame raid pacing — tier-multiplier ladder on the garrison weight floor

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260915-003-endgame-pacing-tier-ladder.md`
**ID:** FID-20260915-003
**Severity:** MEDIUM (endgame bases fell in 2 rounds at 15% cost — no pacing)
**Status:** closed (commit `f7f0921`, canonical: PR #45)
**Created:** 2026-09-15

---

## 1. Summary

Operator directive: "Tune the endgame raid difficulty: raise GARRISON_SIZE_CAP and re-run
the rebalance E2E to prove high-tier bases now fight multi-round." The sim sweep
(`scripts/simulateCombatTiers.ts` Matrix 4) **falsified the premise**: the weight floor
distributes across any unit count, so cap 60/150/300/600 produced byte-identical outcomes
(only per-unit stats shrink). Difficulty is governed by the floor's magnitude, not the cap.

**Fix:** a tier-multiplier ladder on the weight floor —
`GARRISON_TIER_MULT = { 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.2, 5: 1.35, 6: 1.5 }`.
Measured tuning curve (220k STR endgame raider vs fresh top-tier synth):
×1.0–1.3 → 2-round wins at 15–33% losses; ×1.4–1.5 → 3 rounds at 80–95% losses
(the multi-round band); ≥×1.6 → raider annihilated. The ladder keeps low tiers near
flat and lands the top tiers in the band.

**Live finding fixed in the same pass:** the route's tier came from the `b[WMSEUL]`
username marker, which matches NOTHING on the live map (bot usernames are name-shaped,
e.g. "Rusted_Depot") — every live bot silently degraded to tier 1, both for the ladder
and for tier-scaled XP/RP. `resolveBotTier` now reads `bot_config.tier` (the spawner's
canonical field; `botTierResync` maintains tier = rank 1..6) with the marker as fallback.

## 2. Verification (evidence)

- Sim: post-ladder fresh-synth gradient is monotonic — T1/T2/T3 unchanged (2r, 15–20%),
  T4 (2–4r, 28–38%), T5 (3–9r, 60–75%), T6/T7 (3–5r, 90–95%); under-tier raids
  (T1 army vs T6/T7) repelled (level-gap protection) — recorded as finding, not smuggled.
- Live E2E (`scripts/e2eEndgamePacing.ts`, production route):
  - Leg A: 220k STR raider (level 45) vs tier-6 fresh base → **3 rounds, 2,090/2,200
    losses**, 110 survivors intact in the DB.
  - Leg B: 1-unit raider → R1 repulsion, garrison unscratched. Never a DRAW.
  - Leg C: the operator's real account (fame, 10,725 units) raided tier-3
    `Rusted_Depot` → 2 rounds, 1,514,950 damage dealt, 938 losses (8.7%), 9,787
    survivors intact, loot credited; base removed + tile released (win path by design).
- Gates: tsc 0 · lint 0 · vitest 794/1 skipped.

## 3. Driver corrections found live (recorded honestly)

- Fixture restore must snapshot `units` **and** `total_defense` (a partial restore left
  the fixture bot at total_defense 0; healed + driver hardened).
- The first `finally` runs before leg C — fame's position restore needs leg C's own
  `finally`.
- Fresh bases don't exist on a mature map (the scheduler regrows every garrison); the
  fixture snapshots + empties the strongest bot's garrison, restored in `finally`.

## 4. Files

- `app/api/combat/attack/route.ts` — tier ladder + `resolveBotTier` (bot_config first)
- `scripts/simulateCombatTiers.ts` — Matrix 4 (cap × multiplier sweep → ladder selection)
- `scripts/e2eEndgamePacing.ts` — new (3-leg live verification)
- `dev/audits/COMBAT-TIER-SIM-2026-09-15.md` — addendum (cap verdict, ladder, E2E)
- `CHANGELOG.md`, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-15-004.md` — bookkeeping
