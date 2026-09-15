# Bot Vault Economy Audit — cap & regen curve (FID-20260915-004 Fix C review)

**Operator question:** *is 2× spawner-max the right long-term economy, and should
hoarder bots scale differently?*
**Driver:** `scripts/simulateVaultEconomy.ts` — replicates the exact
`botGrowthEngine` tick (regen → cap clamp → uncapped 70/20/10 growth write), the
attack route's loot rule (`min(vault, 2×max) × mult`), and defeat-to-zero
bookkeeping. 300 trials × 720h per profile; 39-bot live-mix map, 50 trials × 30 days.

## The two bugs hiding under the cap question

**B1 — Absorbing zero.** Regen is a percentage *of current* (`v × (1 + rate)`), and
the raid win path zeroes the vault (`attack/route.ts` ~496). A raided bot regenerates
0 × 1.05 = **0 forever** — the "Full Permanence Model" is defeated by its own
bookkeeping. The live registry already shows dead 0/0 bots (nothing re-seeds them).
Simulated at 0.5 raids/bot/day (modest pressure, 39 bots): **day-1 loot 1.30M →
day-7 23k → day-30 zero.** The raiding loop is a one-week resource, not an economy.
30-day loot total: **4.44M**.

**B2 — The cap is the vault, not a ceiling.** Every profile reaches 2× spawner-max
in **5–11 hours** from spawn (ghost 5h → hoarder 11h). Vaults sit at cap virtually
always; regen *rate* is nearly cosmetic (it sets time-to-cap, nothing else —
steady state is cap + 7% soft-hover in every spec). So the "economy" is really:
`spawner max × 2`, full stop. That number band is sane (see §Economics), so the cap
**size** is fine — what's broken is the curve that feeds it.

## Measured results

### Vault behavior (300 trials each; cap = 2× spawner max)

| spec | cap T1/T3/T6 | t→cap | steady p50 | post-raid recovery (current) | (linear fix) |
|---|---|---|---|---|---|
| hoarder | 225k / 375k / 600k | 10–11h | cap+7% | **never** (absorbing 0) | 13h→50%, 19–25h→90% |
| fortress | 23k / 38k / 60k | 8h | cap+7% | never | 8h→50%, 12h→90% |
| raider | 60k / 100k / 160k | 6–7h | cap+7% | never | 6h→50%, 9h→90% |
| ghost | 120k / 200k / 320k | 5–6h | cap+7% | never | 5h→50%, 7–8h→90% |
| balanced | 75k / 125k / 200k | 8h | cap+7% | never | 8h→50%, 12h→90% |

### Raid economics at cap vs a 200k-STR army rebuild (534k–800k; 15%-loss raid ≈ 80k–120k)

| spec | loot 1× (T1→T6) | vs T1 army | loot 3× beer (T1→T6) | vs T1 army |
|---|---|---|---|---|
| hoarder | 225k→600k | 28→75% | 675k→1.8M | 84→224% |
| ghost | 120k→320k | 15→40% | 360k→960k | 45→120% |
| balanced | 75k→200k | 9→25% | 225k→600k | 28→75% |
| raider | 60k→160k | 8→20% | 180k→480k | 22→60% |
| fortress | 23k→60k | 3→8% | 68k→180k | 9→22% |

At-cap payouts sit in a defensible band: small targets are chores, hoarders are
jackpots, beer bases are premium. **The loot-cap SIZE is not the problem.**

### Map decay under 0.5 raids/bot/day (the long-term verdict)

| mode | day 1 | day 7 | day 30 | 30-day total |
|---|---|---|---|---|
| current (exp regen) | 1.30M | 23k | **0** | 4.44M |
| linear regen fix | 2.24M | 2.24M | 2.12M | **66.8M** |
| linear + hoarder cap 3× | 2.75M | 2.75M | 2.57M | **81.5M** |

## Verdicts

### Q1: Is 2× spawner-max the right long-term economy?
**Cap size: yes. Regen curve: no — it must go linear.**
Switch `regenerateBotResources` from `v × (1 + rate)` to
`v + rate × range.max` (percentage of the spawner *max*, not of current), keeping
the 2× cap clamp. One-line semantic change; consequences all measured:
- Map loot becomes **sustainable** (2.2M/day forever vs dead-in-a-week) — 15×.
- Raided bots self-heal in 5–25h → bots are a *renewable* farming layer, matching
  the Full Permanence design intent and the beer-base weekly rhythm.
- The already-dead 0/0 bots on the live map **recover automatically** — no
  migration needed (under the current curve they stay dead forever).
- Steady-state payouts, cap size, hoarder capacity, beer premium: unchanged.

### Q2: Should hoarders scale differently?
**They already do — through capacity, and that's the right axis.** Hoarder identity
today = 10× fortress cap (225k vs 23k at T1) + slowest regen. With exponential
regen saturating everything, capacity was the *only* axis that mattered anyway.
Two coherent choices, both measured:
- **Keep 2× (status quo size):** hoarder = biggest flat target. Map loot 66.8M/30d.
- **Hoarder 3× cap (recommended):** hoarder = genuine jackpot (T6 beer-scale 1.8M
  at 3× loot; T1 hoarders out-pay T6 fortresses), gives scouts a reason to hunt
  spec-specific targets. Map loot +22% (81.5M/30d) — absorbed easily now that the
  curve is sustainable. Identity expressed where players can feel it: **capacity,
  not regen speed** (slower regen would only make hoarders *worse* targets).

### Notes
- **Soft-cap hover:** growth writes up to cap × 1.15; the next tick's regen clamp
  pulls it back. Cosmetic (route loot already caps); optionally clamp after growth.
- **Beer spawn vs cap:** beer bases spawn at 3×U vs cap 2×max → 33% spawn above
  cap and clamp within a tick. Harmless: loot = min(vault, cap) × 3, so the beer
  premium (≤6× spawner max vs 2× regular) survives via the multiplier.
- **Defeat zeroes BOTH resources** (metal + energy) regardless of declared loot
  resource — harsher than the loot taken; under linear regen it self-heals in
  hours, but worth a deliberate look (separate decision).

## Implementation sketch (if approved as a FID)

```ts
// lib/botGrowthEngine.ts — regenerateBotResources
const range = getResourceRange(specialization, tier ?? 1);
const regen = REGENERATION_RATES[regenKey] * range.max; // % of MAX, not of current
const vaultCap = range.max * 2;                          // unchanged
// metal: Math.min(currentMetal + regen, vaultCap) — same clamp as today
```
Hoarder variant: `const vaultCap = range.max * (specialization === 'Hoarder' ? 3 : 2)`
+ the same split in the attack route's loot cap (they share the ceiling by design).

## Live census addendum (2026-09-15, post-audit)

Read-only DB census (`SELECT … WHERE is_bot = 1`, 54 bots):

- **7/54 bots (13%) are dead-both (0/0), 0 half-dead, 0 beer bases, 0 banned.**
- All 7 carry `lastDefeated` — every death is a raid kill (the absorbing-zero
  bug's fingerprints). One is the T7 fixture bot from the pacing E2E (×7);
  the rest are natural player raids.
- **Linear regen revives 7/7** — every dead bot has a valid botConfig with a
  known spec. First-tick gains: Ghost/T2 +16,000/h … Raider/T1 +4,500/h.
  Back to ~cap in 7h (ghost T2) to ~36h (Balanced T7, hoarder-pace).
- Under current code these 7 stay dead forever; the census confirms B1 at
  live scale. Half-dead count of 0 is consistent with undeclared raids
  (loot-both → zero-both) dominating the raid mix.
- Mini-drift noted: botService's range comment claims "T7 = 3.0×" but the
  formula `0.5 + tier × 0.25` computes 2.25× at T7 — code is the truth; the
  comment (and any doc quoting it) overstates top-tier vaults by 33%.

## Implementation addendum — FID-20260915-006 SHIPPED (2026-09-15)

The recommended design is implemented and the live acceptance gate **passed**:
census before = 7 dead-both → one real `runGrowthCycle()` (processed 54,
regenerated 19, errors 0) → census after = **0 dead**. 7/7 revived by the fix
itself, zero migration, matching the census prediction exactly. Shared cap
shipped as `getVaultCap()` (botService): regen clamp, growth clamp (FID-005
helper), raid loot cap, and resync tooling all consume it — hoarders 3×,
everyone else 2×. Unit suite: 8 pins (revival math matches census values,
linearity signature, cap agreement). Gates: tsc 0 · lint 0 · vitest 815/1.

## Repro

```bash
npx tsx -r dotenv/config scripts/simulateVaultEconomy.ts
```

## Re-measurement addendum — real shipped code, band CONFIRMED (2026-09-15)

The Monte Carlo was re-run against the **shipped engine functions**
(`regenerateBotResources`, `applyGrowthPattern`, `nextGrownVault`,
`getVaultCap` — no mirror), per-axis vaults (metal/energy stored separately),
FID-005 defeat bookkeeping, and a declared-resource raid-mix knob. The first
run exposed two defects, both fixed before the numbers below:

1. **The sim reintroduced absorbing zero.** A `v === 0 ? 0` guard in the
   harness suppressed the engine's linear first-tick revival, reproducing
   exactly the bug FID-006 removed (day-30 loot of 0, contradicting the live
   acceptance gate). Removed — the engine returns `min(0 + rate×max, cap) > 0`
   for a zeroed vault, which IS the revival.
2. **The TS2308 barrel conflict was a real landmine.** Exporting the engine's
   `regenerateBotResources` collided with a stale async duplicate in
   `botService.ts` (zero callers, pre-linear curve, stale `range.max` cap,
   incompatible return shape) exposed through `lib/index.ts`. Deleted; its
   Boss rate (0.02) was carried into the engine's rate table, which previously
   had no Boss entry (latent NaN if a boss ever ticked) plus a `?? 0.10` NaN
   guard for unknown specs.

### Measured band (39-bot live mix, 0.5 raids/bot/day, 50 trials × 30 days)

| mode | day 1 | day 7 | day 30 | 30d total |
|---|---|---|---|---|
| shipped · declared single-axis | 2.74M | 2.83M | **2.73M** | 82.0M |
| shipped · undeclared (loot-both) | 5.48M | 5.63M | **5.45M** | 164.2M |
| legacy counterfactual (pre-FID-006) | 2.75M | 34k | **0** | 9.27M |

**The audit's band is confirmed against shipped code:** the single-axis rows
land at 2.73M/day — exactly the audit's linear-2× prediction (2.24M) × the
hoarder-3× uplift (+22%) = **2.73M**, and flat across 30 days (sustainable,
no decay). The legacy counterfactual still dies (day-30 = 0), the honest
baseline. Live liveness re-check: 54 bots, **0 dead-both** — the revival
holds and no new absorbing-zero deaths since the acceptance gate.

Gates after the fixes: tsc 0 (full, `--incremental false`) · lint 0 ·
vitest 815/1 skipped. Note: `npx tsc --noEmit` briefly emitted TS5033
(ENOSPC) writing buildinfo — disk had 32G free; transient, and the full
non-incremental typecheck is the proof of record.

### Player-path confirmation (same day, live — three hoarders)

Declared-metal raids by fame on three hoarder bots through the production
route — every payout above the old 2× cap (300,000 at T2), each exactly
`min(vault, 3× cap 450,000)`:

| target | loot | pre-006 would pay |
|---|---|---|
| Marauder_Control | 323,739 | 300,000 |
| Micro_Mu_534 | 352,804 | 300,000 |
| Scorpion_Recon | 411,713 | 300,000 |

Energy axes survived every raid (FID-005 preserve), including one at-cap
axis staying clamped at 450,000 (regen-clamp proof). Linear regrowth from
zero verified after each raid — metal 0 → composed regen+growth window each
tick, constant +7,500 step (e.g. Marauder_Control 0 → 8,463 → 15,963) —
while preserved energy climbed toward the cap (307,500 → 347,220 → 395,735).
The vault map now shows hoarders holding above the old 2× cap (Mega_Love_148
at 253,570 metal vs the 225,000 T1 2× cap). Driver:
`scripts/e2eHoarderJackpot.ts`.

## Re-measurement addendum 2 — raid-pressure stress sweep (2026-09-15)

**Question: at how many raids/bot/day does the map start starving?**
Driver: `scripts/simulateVaultPressure.ts` (shipped engine tick, real rate
table via zeroed-vault `regenerateBotResources`, aggressive raids — both axes
looted — with intra-day windows so P>1/day is honest; 5-day warmup discarded;
P=0.5 anchor reproduces the undeclared re-measurement row, 5.39M vs 5.49M).

**Answer: there is no starvation knee in the shipped economy — it saturates.**
Loot plateaus at the supply ceiling ≈ **10.7M/day combined** (Σ 24 × real
rate table × spawner-max, both axes; T2-hoarder entry 7,500/h matches the
live raid evidence) and decay stays 98–103% at every pressure:

| P (raids/bot/day) | 0.25 | 0.5 | 1 | 1.5 | 2 | 3 | 5 | 8 | 12 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|
| 30d day-30 loot | 2.70M | 5.27M | 10.40M | 10.93M | 12.49M | 13.74M | 12.80M | 12.08M | 11.71M | 11.47M |
| decay d30/d1 | 103% | 98% | 100% | 99% | 100% | 100% | 100% | 100% | 100% | 100% |
| per-raid take | 282k | 272k | 267k | 187k | 160k | 117k | 66k | 39k | 25k | 15k |

Under linear regen the map is a **renewable income stream**: even 20 raids
per bot per day (an implausible hammering) yields 11.5M/day forever, with
per-raid take flooring at ~15k because a raided bot pays only what regrew
since its last raid. The legacy counterfactual **starves**: knee at ≤0.5
raids/bot/day (decay → 0%, per-raid take → 0 by day 7) — the absorbing-zero
death spiral. The contrast is the economic case for FID-006, now quantified
per pressure level.

One refinement for a future pass: pressure modeled uniformly across the
population; a location-concentration model (many players camping one region)
would still saturate locally — per-bot regen is pressure-independent — but
tier-mix skew (which tiers absorb the camping) would shift the plateau mix.
Plateau composition (raider-heavy at P≤1 as full vaults drain, ghost-
regen-dominated at P≥8 as regen floor takes over) is printed by the driver.
Original band (0.5 r/b/d): 2.73M/day declared-single-axis; undeclared 5.45M.
