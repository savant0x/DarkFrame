# FID-20260906-006: Game-Wide Balance Audit

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-006-game-wide-balance-audit.md`
**ID:** FID-20260906-006
**Severity:** MEDIUM (design economy; depends on the battle-log FID proving combat first)
**Status:** created (RED is data-gathering; no numbers change without operator sign-off)

---

## 1. Summary

Operator directive: a game-wide balance audit. DarkFrame has been dormant for ~a year; nothing
has ever validated its economy curves against actual play. This FID builds the evidence base
(live numbers, not opinion), then proposes a balance change-set for approval. Sequenced AFTER
FID-20260906-004 (battle logs must record real fights first) and alongside -001 (flag numbers
belong to the same economy).

## 1a. Design-doc grounding

Balance constants have authoritative docs where they exist — the audit extracts implemented
values AND doc values, and flags divergences as findings:
- `docs/RP_ECONOMY_GUIDE.md` — RP sources + spend tiers (flag tracking 500→15,000 RP,
  tech/bot unlocks, unit tiers) — reconcile against `lib/researchPointService.ts`.
- `FLAG_FEATURE_PLAN.md` bonus stack — the intended income multipliers (see FID-20260906-001).
- `docs/ENHANCED_WARFARE_DESIGN.md` — territory/war economy philosophy (expensive, risky,
  rewarding; territory passive income scaling with clan level).
- `docs/WEAPONS_OF_MASS_DESTRUCTION_DESIGN.md` — WMD costs/damage (feeds -002 seeding AND
  this audit once revived).

## 2. Scope — the economy surfaces to be measured

| Surface | Current constants (to extract) | Where they live |
| ------- | ------------------------------ | ---------------- |
| Harvest income | base per terrain, VIP bonus, cooldown | `lib/mapConfig*`, harvest route |
| Unit cost/power | per unit type: cost, STR/DEF, build time | factory/balance services |
| Beer Base tiers | HP/loot per tier (WEAK…LEGENDARY) | bot config, spawn tables |
| Flag loop | (see FID-20260906-001 proposal table) | attack route + cron |
| RP economy | generation sources, milestone costs | `lib/researchPointService.ts`, rp-economy routes |
| VIP tiers | multipliers per tier | VIP services/routes |
| Bank | deposit/withdraw fees, exchange rates | bank routes |
| WMD | research/build costs vs damage | (depends on FID-20260906-002 revival) |

## 3. Method (loop steps)

1. **Extract:** one census script dumps every balance constant with file:line into
   `dev/audit/balance-2026-09-06.json` (single source for proposals; committed for review).
2. **Model:** compute a progression curve — XP-to-level per level vs income/hour at early/mid/
   late game; flag points where income jumps >3× with no new unlock (grind walls) or <1.5×
   (meaningless milestones).
3. **Simulate:** headless drive of 3 player archetypes (free / VIP1 / VIP3) through week one:
   resources/hour, combat readiness day-by-day, who can beat which Beer Base tier when.
4. **Propose:** a change-set table (current → proposed → why), each row citing the measured
   curve that justifies it. Operator picks rows; nothing ships unapproved.
5. **Verify post-change:** re-run the simulation harness; deltas match the approved table.

## 4. Known balance smells already observed this session (RED seeds)

- Harvest: flat 1,000 base across metal/energy nodes regardless of player level (harvest
  calculator UI shows identical early/late values — income never scales).
- Beer Base loot = whatever the base accumulated (`resourcesMetal/Energy`) with no tier
  multiplier — LEGENDARY bases may pay less than WEAK ones if spawned recently.
- XP curve: level 1→2 = 1,000 XP (StatsPanel live); combat XP per battle vs that curve is
  unmeasured pending FID-20260906-004 logs.
- Flag attack damage used unbounded power scaling (fixed in -001 proposal with log curve).

## 5. Verification plan

1. Balance JSON committed; every proposal row cites measured data.
2. Simulation harness re-runnable (`dev/scripts/balance-sim.cjs`); results in the FID.
3. After operator-approved changes: live spot-checks (one harvest hour, one battle XP award,
   one Beer-Base loot) match the new tables exactly.
4. Gates: tsc 0, tests green, lint-delta 0, push, prod check.

## 6. Loop record

- **Pass 1:** scope table locked; method is measurement-first; dependency on -004 recorded
  explicitly (no balance proposals from imaginary combat data). Pass-2 after the census script
  produces the JSON.

**Status:** created — loop continues.
