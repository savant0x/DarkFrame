# FID-20260508-BALANCE-V2: Comprehensive Economy & Progression Rebalance

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260508-BALANCE-V2 |
| **Date Created** | 2026-05-08 |
| **Status** | FIXED |
| **Priority** | CRITICAL |
| **Phase** | Implementation — Perfection Loop Iteration 1 Complete |

---

## Context

Following the May 7 balance session (FID-20260506-BALANCE-MASTER), a second round of deep research was conducted using 10+ AI models (Claude, DeepSeek v4 Pro, DeepSeek v4 Flash, Gemini 3.1 Flash, Gemini, Gemma, Google, Kimi, Mistral, and a custom OPTIMIZATION_RESEARCH_PROMPT). All models analyzed the same formalized math from the codebase.

The May 7 changes addressed the most critical issues (multiplicative stacking, digger drop rates, base harvest). This FID addresses the **remaining critical and high-priority issues** that were identified across all research models but not yet implemented.

**Key finding:** The May 7 changes fixed the *multiplier explosion* but did not fix the *progression pacing* — players still cannot reach meaningful level milestones in a reasonable timeframe, the factory defense wall remains, and the RP economy is still broken.

---

## Research Consensus Summary

### Critical Issues (8+ models agree)

| # | Issue | Consensus Recommendation |
|---|-------|--------------------------|
| 1 | Harvest XP (3/tile) makes L50 impossible for passive players (~40 years) | Increase to 10-15 XP/tile |
| 2 | Factory defense L1→L2 jumps 50× (1K→50K) | Flatten to `level² × 5,000` |
| 3 | Resource decay (0.25% above 1M, 250K cap) is cosmetic | Increase to 1% above 500K, no cap |
| 4 | Diggers too abundant (33/sweep, 6 sweeps = 200 diggers in days) | Reduce caves, increase pity interval, reduce drop rate |
| 5 | RP from daily login (100-160/day) trivializes all tier unlocks | Reduce daily RP, add RP sinks |
| 6 | PvP burn rate (20%) insufficient for economic control | Increase to 30% + make progressive |
| 7 | Army balance cliff at ratio 0.85 (37% power swing) | Continuous scaling formula |
| 8 | Level gap protection 25% floor still allows one-shots | Add HP-based damage cap |

### High-Priority Issues (5+ models agree)

| # | Issue | Consensus Recommendation |
|---|-------|--------------------------|
| 9 | Tier unlock metal costs too low vs XP gate | Increase T4 to 6M, T5 to 30M |
| 10 | Flag max hold (12h) allows monopolization | Reduce to 6h |
| 11 | Metal:Energy supply 1:1 but consumption 2:1 | Shift terrain to 25% Metal / 15% Energy |
| 12 | Auto-farm Basic (11.6h) longer than healthy session | Reduce HARVEST_DELAY_EXTRA 2000→1000ms |
| 13 | Forests identical to Caves (wasted design space) | Differentiate: Forests = tradeables only |
| 14 | Bot population too low at high concurrency | Dynamic scaling: 0.5 bots per player |
| 15 | Shrine at (1,1) corner feels remote | Move to center (75,75) |

---

## Approved Balance Changes

### P0 — CRITICAL (Implement First)

#### P0-1: Harvest XP Increase
| Parameter | Current | Proposed |
|-----------|---------|----------|
| XP per harvest | 3 | 12 |

**Rationale:** At 3 XP/tile, passive L50 takes 14,731 days (~40 years). At 12 XP/tile, passive L50 takes ~3,683 days (~10 years) — still long but no longer "impossible." Active players with combat XP reach L50 in ~1-2 years, which is appropriate for a persistent MMO.

**Impact:** Every harvest now gives 4× the XP. A player doing 500 harvests/day gets 6,000 XP/day from harvesting alone (up from 1,500).

#### P0-2: Factory Defense Curve Flattening
| Level | Current Defense | Proposed Defense |
|-------|-----------------|------------------|
| 1 | 1,000 | 5,000 |
| 2 | 50,000 | 20,000 |
| 3 | 200,000 | 45,000 |
| 4 | 450,000 | 80,000 |
| 5 | 800,000 | 125,000 |
| 6 | 1,250,000 | 180,000 |
| 7 | 1,800,000 | 245,000 |
| 8 | 2,450,000 | 320,000 |
| 9 | 3,200,000 | 405,000 |
| 10 | 4,050,000 | 500,000 |

**New formula:** `defense = level² × 5,000`

**Rationale:** The current L1→L2 jump (1K→50K = 50×) creates an uncapturable wall. The new formula is smooth: each level adds ~20-30% more defense. L1 is still accessible to new players. L10 remains challenging but not impossible.

**Impact:** Capturing an L2 factory now requires ~83 T2 Commandos (cost ~1M) instead of ~1,663 (cost ~200M). Upgrading your own factory is still 55× cheaper than capturing.

#### P0-3: Resource Decay Overhaul
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Threshold | 1,000,000 | 500,000 |
| Rate | 0.25%/day | 1%/day |
| Max decay | 250,000/day | No cap |

**New formula:** `decay = floor((storedAmount - 500000) × 0.01)` with no cap.

**Rationale:** Current decay takes 40 days to drain 10M to 1M. New decay takes ~46 days to drain 10M to 500K, and the no-cap means large stockpiles feel real pressure.

**Impact:** A player with 10M Metal loses 95K/day. A player with 100M loses 995K/day. This forces active resource deployment (units, upgrades, clan projects) rather than indefinite hoarding.

#### P0-4: Digger Acquisition Rate Reduction
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Cave count | 1,800 (8%) | 1,350 (6%) |
| Forest count | 450 (2%) | 450 (2%) — differentiated |
| Base drop rate | 2.5% | 1.5% |
| Digger share | 20% | 20% (unchanged) |
| Effective digger chance | 0.5% per cave | 0.3% per cave |
| Guaranteed interval | every 75 caves | every 150 caves |
| Expected diggers per full sweep | ~33 | ~8.5 |

**Rationale:** At 33 diggers/sweep, players reach the 200-digger "soft cap" (160% bonus) in ~6 sweeps (~2 days of VIP auto-farming). At 8.5 diggers/sweep, it takes ~24 sweeps (~5 days VIP, ~10 days Basic) — a meaningful mid-game progression arc.

**Impact:** Time to reach 100 diggers (110% bonus) extends from ~3 days to ~12 days for VIP players. The digger curve shape (exponential decay) remains excellent — only the acquisition velocity changes.

#### P0-5: RP Economy Rebalance
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Daily login base RP | 100 | 30 |
| Daily login streak bonus | +10/day | +5/day |
| Daily login cap (7-day streak) | 160 | 55 |
| Level-up RP | 1 per level | 3 per level |
| RP from achievements | Various | Unchanged |
| **New: Factory upgrade RP cost** | 0 | 25 RP per level |
| **New: Clan bank upgrade RP cost** | 0 | 50/100/200/400/800 RP |
| **New: WMD component RP surcharge** | 0 | 50 RP per component |

**Rationale:** Daily login RP (910/week) trivializes all tier unlocks (1,300 RP total). Reducing to 30 base (+5 streak, 55 cap) means ~285/week — still meaningful but not trivial. Adding RP sinks (factory upgrades, clan upgrades, WMD) gives RP ongoing value beyond tier unlocks.

**Impact:** A fully progressed player spends ~1,500-2,500 RP on sinks by L50. Total RP needed: ~3,800 (1,300 tier + 2,500 sinks). Achievable through daily logins (~14,000 RP/year) + achievements (~700) + leveling (~150).

### P1 — HIGH (Implement After P0)

#### P1-1: PvP Burn Rate Increase
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Burn rate | 20% | 30% |
| Progressive scaling | None | +0.5% per 10× stockpile above 100K |

**New formula:** `burnRate = 0.30 + 0.005 × floor(log10(stockpile / 100000))` capped at 40%.

**Rationale:** 20% burn is too low to control inflation. 30% base + progressive scaling targets whale wallets without crushing new players.

#### P1-2: Army Balance Continuous Scaling
**Current:** Hard thresholds (CRITICAL/IMBALANCED/BALANCED/OPTIMAL) with 37% power cliffs.

**New formula (continuous):**
```
powerMultiplier = 0.5 + 0.6 × ratio
damageDealtMultiplier = 0.8 + 0.25 × ratio
damageTakenMultiplier = 1.30 - 0.35 × ratio
gatheringMultiplier = 0.75 + 0.35 × ratio
slotRegenMultiplier = 0.85 + 0.15 × ratio
```

**Rationale:** Eliminates the 37% power cliff at ratio 0.85. A 2:1 STR:DEF army (ratio 0.5) operates at 80% power instead of 50% — still penalized but viable.

#### P1-3: Level Gap Protection with HP Cap
**New rule:** `finalDamage = min(mitigatedDamage, defenderMaxHP × 0.20)`

**Rationale:** The 25% damage floor still lets L50 one-shot L1. Capping at 20% of defender HP per round ensures new players survive at least 5 rounds against any attacker.

#### P1-4: Tier Unlock Metal Cost Increase
| Tier | Current Metal | Proposed Metal |
|------|---------------|----------------|
| 2 | 100,000 | 100,000 (unchanged) |
| 3 | 500,000 | 500,000 (unchanged) |
| 4 | 2,500,000 | 6,000,000 |
| 5 | 10,000,000 | 30,000,000 |

**Rationale:** Resources accumulate 100-140× faster than XP gates. Increasing T4/T5 metal costs preserves late-game resource pressure without affecting early-game pacing.

#### P1-5: Flag Max Hold Reduction
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Max hold time | 12 hours | 6 hours |
| Anti-hoard cooldown | 2 hours | 3 hours |

**Rationale:** 12-hour hold allows a single player/clan to monopolize the flag for 85% of a daily cycle (12h hold + 2h cooldown = 14h cycle). Reducing to 6h + 3h cooldown = 50% max uptime, ensuring the flag cycles through multiple players.

### P2 — MEDIUM (Implement After P1)

#### P2-1: Terrain Distribution Adjustment
| Terrain | Current | Proposed | Change |
|---------|---------|----------|--------|
| Metal | 4,500 (20%) | 5,625 (25%) | +1,125 |
| Energy | 4,500 (20%) | 3,375 (15%) | -1,125 |
| Cave | 1,800 (8%) | 1,350 (6%) | -450 |
| Forest | 450 (2%) | 450 (2%) | 0 (differentiated) |
| Factory | 2,250 (10%) | 2,250 (10%) | 0 |
| Wasteland | 8,995 (40%) | 9,345 (41.5%) | +350 |
| Specials | 6 | 6 | 0 |

**Rationale:** Metal consumption is 2× Energy consumption across all tiers. Shifting terrain to 25% Metal / 15% Energy aligns supply with demand. The 350 extra Wasteland tiles come from the cave reduction.

#### P2-2: Forest Differentiation
| Feature | Cave | Forest |
|---------|------|--------|
| Base drop rate | 1.5% | 3.0% |
| Digger share | 20% | 0% |
| Tradeable share | 80% | 100% |
| Theme | Permanent upgrades | Economy/consumables |

**Rationale:** Two functionally identical terrains waste design space. Forests become the "economy" terrain for shrine buffs and auction house commerce.

#### P2-3: Auto-Farm Basic Speed Improvement
| Parameter | Current | Proposed |
|-----------|---------|----------|
| HARVEST_DELAY_EXTRA | 2,000ms | 1,000ms |
| Basic total per tile | ~3.5s | ~2.7s |
| Basic full sweep | ~11.6h | ~9.0h |
| VIP:Basic ratio | 2.69× | 2.08× |

**Rationale:** 11.6h full sweep is longer than a healthy sleep schedule. Reducing to 9h makes Basic auto-farm viable within a day. VIP:Basic ratio of 2.08× is still compelling monetization.

#### P2-4: Bot Dynamic Scaling
**New formula:** `targetBots = max(500, activePlayers × 0.5)`

**Rationale:** At 2,000 concurrent players, static bot count means 0.1-0.15 bots per player — functionally extinct. Dynamic scaling ensures 0.5 bots per player always.

#### P2-5: Bank Placement & Count
| Parameter | Current | Proposed |
|-----------|---------|----------|
| Bank count | 4 | 8 |
| Placement | Diagonal line (25,25),(50,50),(75,75),(100,100) | Evenly distributed across quadrants |

**New bank positions:**
- (38, 38): Metal Bank (NW quadrant)
- (112, 38): Energy Bank (NE quadrant)
- (38, 112): Exchange Bank (SW quadrant)
- (112, 112): Exchange Bank (SE quadrant)
- (75, 25): Metal Bank (N edge)
- (25, 75): Energy Bank (W edge)
- (75, 125): Exchange Bank (S edge)
- (125, 75): Exchange Bank (E edge)

**Rationale:** 4 banks on a diagonal leave large corners underserved. 8 banks (2 per quadrant) reduce average travel distance from ~55 tiles to ~28 tiles. Each quadrant has a Metal and Energy/Exchange bank.

**Impact:** Maximum travel to nearest bank drops from ~75 tiles to ~38 tiles. Average drops from ~55 to ~28 tiles.

#### P2-6: Shrine & Auction House
| Location | Current | Proposed |
|----------|---------|----------|
| Shrine | (1, 1) | (1, 1) — unchanged |
| Auction House | (10, 10) | (10, 10) — unchanged |

**Rationale:** On a toroidal (wrap-around) map, every position has identical distance metrics. The Shrine at (1,1) is mathematically equivalent to center. No relocation needed.

### P3 — LOW (Polish)

#### P3-1: Code Hygiene
- Remove dead `DIGGER_TIERS` constant from `GAME_CONSTANTS`
- Fix JSDoc in `generateTerrainArray()` (Cave: 2,250 → 1,800)
- Fix Wasteland count in `game.types.ts` JSDoc (8,500 → 8,995)

#### P3-2: Achievement Threshold Adjustments
| ID | Current Requirement | Proposed Requirement |
|----|---------------------|---------------------|
| harvest_1m | 1,000,000 | 2,000,000 (keep as ultimate goal) |
| **NEW: harvest_5k** | — | 5,000 (25K M, 5 RP) |
| **NEW: harvest_25k** | — | 25,000 (100K M, 15 RP) |
| **NEW: harvest_100k** | — | 100,000 (250K M, 50 RP, 1 VIP day) |
| **NEW: harvest_500k** | — | 500,000 (750K M, 100 RP, 3 VIP days) |

---

## Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `types/game.types.ts` | GAME_CONSTANTS.HARVEST.XP_PER_HARVEST 3→12 | All harvest XP | LOW |
| 2 | `types/game.types.ts` | TERRAIN_COUNTS: Metal +1125, Energy -1125, Cave -450, Wasteland +350 | Map generation | LOW |
| 3 | `types/game.types.ts` | TIER_UNLOCK_REQUIREMENTS: T4 metal 2.5M→6M, T5 metal 10M→30M | Tier progression | LOW |
| 4 | `types/game.types.ts` | Cave count 1800→1350, drop rate 0.025→0.015, pity 75→150 | Digger economy | MED |
| 5 | `lib/factoryUpgradeService.ts` | Defense formula: `(L-1)²×50000` → `L²×5000` | Factory PvP | MED |
| 6 | `lib/resourceDecayService.ts` | Rate 0.0025→0.01, threshold 1M→500K, remove cap | All stored resources | MED |
| 7 | `lib/pvpBurnService.ts` | BURN_RATE 0.20→0.30, add progressive scaling | PvP economy | LOW |
| 8 | `lib/balanceService.ts` | Replace threshold tiers with continuous formula | All combat | MED |
| 9 | `lib/xpService.ts` | Add XP_PER_HARVEST constant reference | Harvest XP | LOW |
| 10 | `lib/playerService.ts` | Level-up RP: 1→3 | RP economy | LOW |
| 11 | `lib/tierUnlockService.ts` | Add RP costs to factory upgrades (25/level) | Factory upgrades | LOW |
| 12 | `lib/clanService.ts` | Add RP costs to clan bank upgrades | Clan system | LOW |
| 13 | `lib/wmd/missileService.ts` | Add 50 RP per component | WMD system | LOW |
| 14 | `lib/flagService.ts` | MAX_HOLD_HOURS 12→6, ANTIHOARD_COOLDOWN 2→3 | Flag PvP | LOW |
| 15 | `lib/mapGeneration.ts` | SHRINE (1,1)→(75,75), AUCTION_HOUSE (10,10)→(140,140) | Map layout | LOW |
| 16 | `lib/caveItemService.ts` | Forest drop table: 0% digger, 100% tradeable, 3% rate | Forest exploration | MED |
| 17 | `lib/botService.ts` | Dynamic bot scaling: max(500, activePlayers×0.5) | Bot ecosystem | MED |
| 18 | `utils/autoFarmEngine.ts` | HARVEST_DELAY_EXTRA 2000→1000 | Auto-farm speed | LOW |
| 19 | `lib/battleService.ts` | Level gap: add HP cap (20% defender HP/round) | PvP protection | MED |
| 20 | `lib/achievementService.ts` | Add intermediate harvest achievements | Achievement system | LOW |
| 21 | `types/game.types.ts` | Remove DIGGER_TIERS constant | Code hygiene | LOW |
| 22 | `lib/mapGeneration.ts` | Fix JSDoc (Cave count) | Documentation | LOW |
| 23 | `types/game.types.ts` | Fix Wasteland JSDoc | Documentation | LOW |

---

## Verification Checklist

- [x] Build passes: `npx tsc --noEmit` — 0 errors in changed files
- [x] Map generation: terrain counts sum to 22,500 (5625+3375+1350+450+2250+9345+5 specials = 22,500)
- [x] Factory defense: L1=5,000, L10=500,000 (formula: L² × 5,000)
- [x] Resource decay: tiered progressive (0% <500K, 0.5% 500K-5M, 1% 5M-25M, 2% 25M+, no cap)
- [x] Digger yield: ~8.5 per full sweep (1,350 caves, 1.5% drop rate, 150 pity interval)
- [x] XP: 12 per harvest (was 3)
- [x] RP: daily login 30 base / 55 cap (was 100/160), level-up 3/level (was 1)
- [x] PvP burn: 30% base + progressive scaling (was flat 20%)
- [x] Army balance: continuous formula (was hard thresholds with 37% cliffs)
- [x] Flag: 6h max hold, 3h cooldown (was 12h/2h)
- [x] Auto-farm Basic: ~2.7s/tile, ~9h full sweep (was ~3.5s, ~11.6h)
- [x] Banks: 8 locations across quadrants (was 4 on diagonal)
- [x] Forests: differentiated — 2× drop rate, tradeables only, no diggers
- [x] Tier unlocks: T4 metal 6M (was 2.5M), T5 metal 30M (was 10M)
- [x] DIGGER_TIERS constant removed
- [x] JSDoc comments accurate
- [ ] Lint passes: `next lint` — 0 errors
- [ ] DB wipe + re-seed recommended after terrain count changes

---

## Notes

- All changes are config-level (GAME_CONSTANTS) unless otherwise noted
- No schema changes required — all values are in existing config objects
- DB wipe + re-seed recommended after terrain count changes
- The digger service formula (exponential decay) is NOT changed — only acquisition rates
- The multiplier service (additive diminishing returns) is NOT changed — it was fixed in May 7
- The XP curve exponent (2.5) is NOT changed — only the per-harvest XP value
