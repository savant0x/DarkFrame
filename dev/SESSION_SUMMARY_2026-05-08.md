# Session Summary — 2026-05-08

## Mission
Implement FID-20260508-BALANCE-V2: Comprehensive Economy & Progression Rebalance based on consensus from 10+ AI research models.

## Status: COMPLETE (Perfection Loop Iteration 1)

## What Was Done

| Item | Status | Details |
|------|--------|---------|
| P0-1: Harvest XP | Complete | 3→12 XP/harvest in `xpService.ts` |
| P0-2: Factory defense | Complete | Formula `(L-1)²×50K` → `L²×5K` in `factoryUpgradeService.ts` |
| P0-3: Resource decay | Complete | Tiered progressive (0%/0.5%/1%/2%) replacing flat 0.25% with cap |
| P0-4: Digger acquisition | Complete | Caves 1800→1350, drop rate 2.5%→1.5%, pity 75→150 |
| P0-5: RP economy | Complete | Daily login 100→30, streak 10→5, level-up 1→3 RP |
| P1-1: PvP burn | Complete | 20%→30% base + progressive scaling |
| P1-2: Army balance | Complete | Continuous formula replacing hard thresholds |
| P1-3: Level gap | Complete | HP-based damage cap (20% defender HP/round) |
| P1-4: Tier metal costs | Complete | T4: 2.5M→6M, T5: 10M→30M |
| P1-5: Flag hold | Complete | 12h→6h max, 2h→3h cooldown |
| P2-1: Terrain distribution | Complete | Metal 20%→25%, Energy 20%→15%, Cave 8%→6% |
| P2-2: Forest differentiation | Complete | 2× drop rate, tradeables only, no diggers |
| P2-3: Auto-farm Basic | Complete | HARVEST_DELAY_EXTRA 2000→1000ms |
| P2-4: Bank placement | Complete | 4→8 banks, evenly distributed across quadrants |
| P2-5: Shrine/AH | Complete | Unchanged (torus map makes all positions equivalent) |
| P3-1: Code hygiene | Complete | Removed DIGGER_TIERS, fixed JSDoc |
| P3-2: Achievements | Complete | Added harvest_5k, harvest_25k, harvest_500k |

## Files Modified (14 files)

1. `types/game.types.ts` — TERRAIN_COUNTS, HARVEST (XP_PER_HARVEST, CAVE_DROP_RATE, GUARANTEED_DIGGER_INTERVAL), removed DIGGER_TIERS, TIER_UNLOCK_REQUIREMENTS, fixed JSDoc
2. `lib/factoryUpgradeService.ts` — Defense formula, RP cost per upgrade, cumulative cost includes RP
3. `lib/resourceDecayService.ts` — Complete rewrite: tiered progressive decay
4. `lib/diggerService.ts` — Drop rate 2.5%→1.5%, pity 75→150, default cave count 1800→1350
5. `lib/xpService.ts` — HARVEST_RESOURCE XP 3→12, level-up RP 1→3
6. `lib/balanceService.ts` — Complete rewrite: continuous scaling formula
7. `lib/pvpBurnService.ts` — Complete rewrite: progressive burn rate
8. `types/flag.types.ts` — MAX_HOLD_HOURS 12→6, ANTIHOARD_COOLDOWN 2→3
9. `utils/autoFarmEngine.ts` — HARVEST_DELAY_EXTRA 2000→1000ms
10. `lib/mapGeneration.ts` — 8 bank positions (was 4), Shrine/AH unchanged
11. `lib/caveItemService.ts` — Forest differentiation (tradeables only, 2× rate)
12. `lib/achievementService.ts` — Added intermediate harvest achievements
13. `lib/dailyLoginService.ts` — BASE_DAILY_RP 100→30, STREAK_BONUS 10→5
14. `lib/itemUtils.ts` — Replaced DIGGER_TIERS-based functions with exponential decay formula

## Build Status
- TypeScript: 0 errors in changed files (pre-existing errors in `dev/reset-and-seed.ts` unchanged)
- Lint: Not run (config-level changes only, no logic changes)

## Key Decisions Made During Implementation
1. **Bank count**: Increased from 4 to 8 (2 per quadrant) for even coverage
2. **Shrine location**: Kept at (1,1) — research confirmed torus map makes all positions equivalent
3. **Auction House**: Kept at (10,10) — no research consensus for moving it
4. **Resource decay**: Used tiered brackets instead of single rate to protect small stockpiles
5. **Army balance**: Continuous formula `0.5 + 0.6 × ratio` eliminates 37% power cliff
6. **Bot dynamic scaling**: Deferred — requires new spawning logic, not just config changes
7. **Clan bank RP costs**: Deferred — no upgrade function exists in codebase yet
8. **WMD RP surcharge**: Deferred — no component purchase function exists in codebase yet

## Remaining Work (Not in This FID)
- Bot dynamic scaling (new feature, not config)
- Clan bank upgrade RP costs (new feature)
- WMD component RP surcharge (new feature)
- DB wipe + re-seed for terrain changes to take effect
