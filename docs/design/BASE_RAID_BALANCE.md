# BASE RAID BALANCE — combat design (mechanics source of truth)

Created 2026-09-14 (FID-20260914-002). Governs the synthesized garrison model
for raids on hostile bot bases (Beer Bases + regular specializations) and the
attacker-loss experience. The implementation consumes these constants from
`app/api/combat/attack/route.ts` — fine-tuning is editing this doc plus the
matching constants.

## Combat math (lib/battleService.ts — read-only reference)

- Damage/round: `max(5, floor(attackerSTR − defenderDEF/2))` (defender
  symmetric), level-gap protection above 20 levels (−5%/level, floor 25%).
- Unit HP (**FID-20260915-001 Phase 3, power-proportional**):
  `strength + defense` per unit (zero-power units floor at 10). Previously
  flat 10/15 by category — a scale on which army pools (hundreds) evaporated
  against per-round damage (hundreds–thousands), so every battle resolved in
  round 1 and the annihilation-DRAW incident class (BATTLE-17894) was the
  norm. Under the unified rule an army's pool equals its total power
  projection: mirror matches fight ~2 rounds at any tier, tanky garrisons
  fight multi-round, overreached raids die fast. Casualties stay proportional
  to the HP actually deducted; sequential resolution (Phase 1) means dead
  defenders never counter-attack; the 100-round cap is a Draw safety net
  (structurally unreachable under this scale).
- The raid path's type-tally write-back drains casualties ACROSS a type's
  entries (per-entry subtraction annihilated multi-entry armies — caught by
  live verification, same fix in the PvP decrementer).

## The garrison model

Bots spawn with `units: []` — the garrison is synthesized per raid. Its job:
make the raid a real fight (multi-round, real attacker losses) while staying
winnable and keeping casualty counts believable (not 500 phantom units).

| Knob | Constant (route.ts) | Default | Effect |
|------|---------------------|---------|--------|
| Garrison unit DEF | `GARRISON_DEF` | 20 | garrison DEF = units × this |
| Garrison unit HP | (derived) | 10 | battleService `HP_PER_STR_UNIT` — garrison units are STR-class (`strength > 0`), so 10 HP each; derived, not tunable via a constant |
| Garrison unit STR | `GARRISON_STR` | 10 | garrison STR = units × this |
| Size divisor | `GARRISON_SIZE_DIVISOR` | 20 | units = ceil(totalDefense / this) |
| Size cap | `GARRISON_SIZE_CAP` | 60 | max units per battle; ALSO the resistance ceiling — raiders above ≈75×garrisonSize STR out-damage any capped garrison in R1 (pool scales with the 60 units' STR+DEF), so longer/harder endgame fights raise this, not the HP scale |
| Weight-class ratio | `GARRISON_STR_RATIO` | 0.6 | garrison total STR ≥ ceil(attackerSTR × this) |

**Weight-class matching (the load-bearing knob).** The damage formula's
defender term is `defSTR − attackerSTR/2` — a fixed-STR garrison can never
hurt a larger attacker beyond the 5-damage floor. That floor was the root
cause of the audit finding "the attacker never took a single unit loss":
raids ended in 1 round, the floor dealt 5 damage, and 5 < one unit's 10 HP.
The garrison therefore mirrors the raider's weight class: its total STR is
floored at `ceil(attackerSTR × GARRISON_STR_RATIO)` (per-unit STR
redistributed across the synthesized units). At the default 0.6 the garrison
deals `≈ 0.1 × attackerSTR` damage per round — proportional resistance, real
losses at any attacker size, no unwinnable tiers.

## Tuning targets (default constants, 50-unit attacker: STR 750, HP ~600)

<!-- FID-20260915-006a: this worked example predates the FID-003 tier ladder and
     quotes spawner base-defense values that were later rescaled ×0.1 (real
     spawner output is T1=15 … T7=2880 before spec multipliers). The garrison
     knobs below are governed by ATTACKER STR (weight floor), not these
     scalars, so the table's shape remains illustrative; the absolute
     totalDefense column labels are historical. -->

| | T1 base (totalDefense 150) | T7 base (totalDefense 9600) |
|---|---|---|
| Garrison size | 8 units | 60 units (capped) |
| Garrison STR (weight floor) | 456 | 600 |
| Garrison HP / DEF | 80 / 160 | 900 / 1200 |
| Rounds | ~1 | ~3+ (50-unit armies are repelled) |
| Attacker losses | ~8 units (~16%) | army annihilated — T7 requires a bigger force |

Fine-tuning: raise `GARRISON_DEF_RATIO` for riskier raids (the counter knob);
raise `GARRISON_TIER_MULT[6]` toward 1.6 for boss-tier endgame walls (≥1.6
annihilates the raider). `GARRISON_SIZE_CAP` is NOT a difficulty knob — it was
swept (FID-20260915-003 Matrix 4) and proved cosmetic: the weight floor
distributes across any unit count.

## FID-20260915-004 addendum: real garrisons + army balance + economy caps

- **The weight-class floor now governs REAL regrown garrisons too** (Fix B):
  `reinforceRealGarrison` supplements a base's actual units with ephemeral
  T1_BARRICADE walls (DEF 100) / T1_MILITIA pads (STR 90) to the same ladder
  target the synthesis path uses. Pre-fix, an overmatched raider killed a real
  garrison inside his own strike phase — sequential resolution meant it never
  countered (live proof: BATTLE-17894's rerun, garrison DEF 184,090, counter 0,
  0 attacker losses, 452M loot).
- **Army balance now executes in combat** (engine seam in `resolveBattle`):
  every strike is multiplied by the attacker's `damageDealtMultiplier` and the
  defender's `damageTakenMultiplier` (CRITICAL 0.8/1.3, IMBALANCED 0.9/1.15,
  BALANCED 1.0/1.0, OPTIMAL 1.05/0.95). Mono-axis armies are punished on BOTH
  sides — pure-offense raiders strike softer and absorb harder. The StatsPanel
  ×0.50 threat is finally real. `powerMultiplier` remains display/leaderboard-
  only by design; `slotRegenMultiplier` still has no consumer (dead knob,
  recorded).
- **Economy caps**: bot vaults clamp at 2× their specialization/tier spawner
  maximum (`getResourceRange` — one source of truth for growth and loot); raid
  loot is capped at the same ceiling × beer multiplier; a one-time resync
  (`scripts/resyncBotVaults.ts`) drained 8.8B from 45 bloated vaults. Player
  balances were never touched.

## Out of scope

PvP infantry balance (`lib/battleService` level-gap protection unchanged);
land-mine combat (no `LandMine` battle type exists yet — the Battle Log panel
row is future-proofing).