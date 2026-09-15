# FID-20260915-006: linear bot-vault regen + hoarder capacity tier

**Severity:** HIGH · **Status:** closed (canonical `2681571`, PR #49) · **Created:** 2026-09-15

**Convergence evidence:** `dev/audits/BOT-VAULT-ECONOMY-2026-09-15.md` (Monte Carlo:
current curve is an absorbing-zero one-week economy — map loot 1.30M/day → 0 by
day 30; linear restores 2.24M/day indefinitely) + live census addendum (7/54 bots
dead-both, all raid-killed, **7/7 revivable** — every dead bot has a valid
botConfig with a known spec).

## Spec (as converged with the operator)

1. **Linear regen.** `regenerateBotResources` changes from
   `v × (1 + rate)` to `v + rate × getResourceRange(spec, tier).max`
   (percentage of the spawner **max**, not of current). Same 5–20% rate table,
   same hourly cadence. Absorbing zero dies: a 0-vault gains
   `floor(rate × range.max × tierMult)` every tick.
2. **Cap size unchanged** at 2 × spawner max for all specializations **except**:
3. **Hoarder capacity tier: 3 × spawner max.** Hoarder identity already lives
   in capacity (10× fortress cap); 3× makes it a true jackpot target (+22%
   sustainable map loot, absorbed once the curve is linear). Expressed via a
   single shared helper so regen clamp, growth clamp, loot cap, and the resync
   tooling all agree.
4. **Live acceptance gate:** the census's 7 dead bots must all show resources
   > 0 after one manual growth-cycle run on the dev DB — zero migration, the
   fix itself does the revival.

Side benefit: beer bases spawn at 3×U — under hoarder-style 3× caps the
33% spawn-above-cap clamp (audit §Notes) disappears for beer hoarders.

## Non-goals

- No player-facing loot numbers change at cap (loot = min(vault, cap) × mult;
  caps only move up for hoarders).
- No change to growth 70/20/10 pattern or FID-005's growth clamp semantics.

## Verification results

- Unit: 8/8 (`__tests__/lib/vaultRegen.test.ts`) — revival-from-0 for every
  spec, first-tick math equals the census values exactly, linear two-tick
  signature (compound would fail), cap clamps, hoarder 3×/others 2×, growth
  clamp agreement via `nextGrownVault`.
- Full gates: tsc 0 · lint 0 · vitest 815/1 skipped.
- **Live acceptance gate PASSED:** census before = 7 dead-both (Golem_Zero_919,
  Flag_Bearer_1027, Topaz_Power_438, Eclipse_Omega, Super_Zeta_530,
  Zulu_Nightmares_333, Fairy_Zeta) → one real `runGrowthCycle()` (processed 54,
  regenerated 19, moved 22, unitsBuilt 5, errors 0) → census after = **0 dead,
  0 half-dead**. 7/7 revived by the fix itself; zero migration.
- One behavior note: the cycle's regen diff-counter now fires on every bot
  (linear adds ≥ floor(rate×max) ≥ 3,750 each tick until cap), so hourly
  `regenerated` counts rise from ~19 to ~54 — expected, not a regression.
- **Player-path jackpot verification (2026-09-15, three hoarders):** fame
  raided three hoarder bots through the production route with declared metal;
  every payout exceeded the pre-006 2× cap (300,000):
  | target | loot | pre-006 would pay |
  |---|---|---|
  | Marauder_Control (T2) | 323,739 | 300,000 |
  | Micro_Mu_534 (T2) | 352,804 | 300,000 |
  | Scorpion_Recon (T2) | 411,713 | 300,000 |
  Each = exactly `min(vault, 3× cap 450,000)`; the bots' energy survived
  untouched (FID-005 preserve-axis live), including an at-cap energy axis
  staying clamped at 450,000 (regen-clamp proof). Two real growth cycles
  after each raid: metal 0 → inside the composed regen+growth window each
  tick (constant +7,500 linear step — Marauder_Control ran 0 → 8,463 →
  15,963) while preserved energy climbed toward the 450,000 cap. Driver kept
  permanent: `scripts/e2eHoarderJackpot.ts` (`RAID_TARGET` selects the bot).

## Original plan (retained)

- Unit: revival-from-0 exact first-tick math (Ghost/T2 = +16,000 matches the
  census), hoarder 3× clamp vs non-hoarder 2×, linear two-tick signature,
  shared-cap agreement across regen/growth/loot seams.
- Full gates: tsc · lint · vitest.
- Live: census → one `runGrowthCycle()` on dev → census again → 7/7 > 0.

## Status

**CLOSED per G2** — shipped as commit `2681571` (rebase-merged via PR #49,
2026-09-15). Verification record: 8 unit pins + live acceptance gate (7/7
revival) + three-hoarder player-path jackpot driver
(`scripts/e2eHoarderJackpot.ts`) + re-measured Monte Carlo on shipped code
(2.73M/day flat = 2.24M × 1.22 hoarder-3×, audit addendum).
