# BASE RAID BALANCE — combat design (mechanics source of truth)

Created 2026-09-14 (FID-20260914-002). Governs the synthesized garrison model
for raids on hostile bot bases (Beer Bases + regular specializations) and the
attacker-loss experience. The implementation consumes these constants from
`app/api/combat/attack/route.ts` — fine-tuning is editing this doc plus the
matching constants.

## Combat math (lib/battleService.ts — read-only reference)

- Damage/round: `max(5, floor(attackerSTR − defenderDEF/2))` (defender
  symmetric), level-gap protection above 20 levels (−5%/level, floor 25%).
- Unit HP: STR units 10 HP, DEF units 15 HP.
- Casualties/round: `floor(damage / avgHPPerUnit)` of the loser's survivors.
- Battles cap at 100 rounds (forced draw).

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
| Size cap | `GARRISON_SIZE_CAP` | 60 | max units per battle |
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

| | T1 base (totalDefense 150) | T7 base (totalDefense 9600) |
|---|---|---|
| Garrison size | 8 units | 60 units (capped) |
| Garrison STR (weight floor) | 456 | 600 |
| Garrison HP / DEF | 80 / 160 | 900 / 1200 |
| Rounds | ~1 | ~3+ (50-unit armies are repelled) |
| Attacker losses | ~8 units (~16%) | army annihilated — T7 requires a bigger force |

Fine-tuning: raise `GARRISON_STR_RATIO` for riskier raids (0.75 → ~25%
losses/round); lower it toward 0.5 to return to the old safe raids; raise
`GARRISON_SIZE_CAP` for longer battles and larger defender casualty counts.
The weight-class floor self-scales with the attacker, so no per-tier table is
required — one ratio governs all tiers.

## Out of scope

PvP infantry balance (`lib/battleService` level-gap protection unchanged);
land-mine combat (no `LandMine` battle type exists yet — the Battle Log panel
row is future-proofing).