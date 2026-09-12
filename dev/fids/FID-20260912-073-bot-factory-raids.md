# FID-20260912-073 — Bot Factory Raids: the War Half of the Loop

**Follows:** FID-072 (defense curve smoothed so mid-game factory war could exist)
**Trigger:** follow-up check — "do bots actually attack L2+ factories now?"

## Audit answer

**No — no bot path attacked factories, ever.** `runBotAttackCycle` (player-vs-bot
combat) has zero factory references and isn't even scheduled; `botGrowthEngine`
built armies and moved bots but never contested ownership. FID-072's curve fix
was necessary but not sufficient: the raid *actor* didn't exist. Also measured:
before 073 only **4 of 52 bots** clear the L2 threshold (12,500 STR) — correct
for a tier-gated elite activity, wrong if every bot raided.

## Design (bounded contest, not a land-grab)

| Parameter | Value | Rationale |
|---|---|---|
| Eligible tiers | T2/T3 only | T1 is the peaceful starter-district population |
| Strength gate | STR ≥ L2 defense (12,500) | Raiding is earned by army growth |
| Chance per hourly cycle | 20% | ~1 raid per eligible bot per ~5h on average |
| Per-bot cooldown | 6h (reuses `botConfig.attackCooldown`) | No chained captures; scouts back off after failure |
| Ownership cap | 2 factories per bot (players keep 10) | Districts get contested, not starved |
| Radius | 20 tiles from bot position | Local district pressure only |
| Combat resolution | **`attackFactory()` — the same function players use** | Identical power/defense math, one source of truth |

Capture effects are the standard ones: ownership flips, usedSlots reset, income
clock starts — making bot-held factories high-value player raid targets (they
keep producing while bot-owned; players take them with the accrued clock reset).

## Implementation

- `lib/botFactoryRaid.ts` — eligibility gates, target selection, cooldown writes,
  config exports for the admin panel.
- `lib/factoryService.findNearestWildFactory(x, y, radius)` — Chebyshev-radius
  wild scan, lowest-level tiebreak (weak districts get contested first).
- `botGrowthEngine.runGrowthCycle` — raid phase after movement; cycle return
  gains `factoryCaptures`; log line `[Factory Raids]` when attempts occur.

## Verification plan

Live boot → force raid-eligible conditions → confirm `[Factory Raids]` attempts
land with captures only where STR ≥ defense, ownership counters maintained.
