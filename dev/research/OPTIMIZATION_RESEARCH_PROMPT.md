# DarkFrame — Complete Game Balance & Optimization Research Prompt

> **Version:** 2.0 | **Date:** May 2026 | **Scope:** Full game systems analysis with formalized math
>
> This prompt contains every formula, constant, mechanic, and number in the DarkFrame codebase. Use this data to analyze, balance, and optimize the game. Do not make assumptions — use only the numbers provided here. Where you need to calculate derived values, show your work.

---

## 1. GAME OVERVIEW

**DarkFrame** is a persistent browser-based MMORTS (Massively Multiplayer Online Real-Time Strategy) built with Next.js, Supabase (PostgreSQL), and TypeScript.

**Core concept:** Players spawn on a 150×150 tile map, harvest resources (metal/energy), explore caves for permanent upgrades (diggers), build military units at captured factories, attack other players and AI bots, and compete for a flag-bearer buff. The game features auto-farming, clan warfare, an auction house, and a WMD/missile subsystem.

**Player lifecycle:** Register → Spawn on random Wasteland → Harvest nearby tiles → Explore caves for diggers → Build first army from starting resources → Capture a factory → Expand territory → Engage in PvP → Compete for flag → Repeat with higher tiers

**Concurrent player estimate:** 500–2,000 (design for this range)

---

## 2. MAP & TERRAIN

### Map Specifications
| Parameter | Value |
|---|---|
| Dimensions | 150 × 150 |
| Total tiles | 22,500 |
| Coordinate system | 1-based (1–150) |
| Wrap-around edges | Yes |

### Terrain Distribution
| Terrain | Count | % | Purpose |
|---|---|---|---|
| Metal | 4,500 | 20.0% | Primary resource (harvest) |
| Energy | 4,500 | 20.0% | Primary resource (harvest) |
| Cave | 1,800 | 8.0% | Digters and tradeable items |
| Forest | 450 | 2.0% | Same mechanics as Cave |
| Factory | 2,250 | 10.0% | Unit production + passive income |
| Wasteland | 8,995* | 39.98% | Empty/filler |
| Bank | 4 | 0.018% | Fixed storage locations |
| Shrine | 1 | 0.004% | Fixed buff location |
| AuctionHouse | 1 | 0.004% | Fixed trading location |

*Wasteland: 9,000 in array minus 5 overwritten by special locations (Shrine + 4 Banks + AuctionHouse = 5 tiles). Effective count: 8,995.*

### Fixed Locations
- Shrine: (1, 1)
- Auction House: (10, 10)
- Metal Bank: (25, 25)
- Energy Bank: (75, 75)
- Exchange Bank 1: (50, 50)
- Exchange Bank 2: (100, 100)

### Map Generation Algorithm
- Fisher-Yates shuffle on pre-allocated exact-count arrays
- Special locations overwrite shuffled tiles at fixed coordinates
- Idempotent (checks existence before regeneration)

---

## 3. RESOURCE HARVEST SYSTEM

### Base Harvest
| Parameter | Value |
|---|---|
| MIN_AMOUNT | 400 |
| MAX_AMOUNT | 750 |
| Distribution | Uniform random |
| Average per tile | 575 |

### Harvest Reset Cycle
| Tile X Range | Reset Time | Period Label |
|---|---|---|
| 1–75 | 00:00 UTC (midnight) | `YYYY-MM-DD-AM` |
| 76–150 | 12:00 UTC (noon) | `YYYY-MM-DD-PM` |

### Harvest Formula
```
baseAmount = random uniform integer in [400, 750]
permanentBonus = player.gathering_metal_bonus or gathering_energy_bonus (from diggers)

Step 1: amount = floor(baseAmount × (1 + permanentBonus/100))

Step 2: totalMultiplier = calculateTotalMultiplier([VIP, Flag Bearer, Shrine])
         (See Section 7 — Bonus Stacking)

Step 3: amount = floor(amount × totalMultiplier)

Step 4: balanceMultiplier = balanceEffects.gatheringMultiplier (0.75–1.10)
         amount = floor(amount × balanceMultiplier)

finalResult = amount
```

### Maximum Single-Tile Harvest Calculation
```
base = 750 (max roll)
permanentBonus = 200% (digger cap)
Step 1: 750 × (1 + 2.00) = 2,250

rawBonus = 50 (VIP) + 50 (Flag) + 70 (Shrine) = 170%
Diminishing: First 100% × 1.0 = 100, Next 70% × 0.75 = 52.5
effective = 152.5%
totalMultiplier = 1 + 1.525 = 2.525

Step 2: floor(2,250 × 2.525) = 5,681

Step 3: floor(5,681 × 1.10) [optimal balance] = 6,249
```

**Theoretical absolute maximum: ~6,249 per tile (all systems aligned, optimal balance)**
**Realistic VIP max: ~5,681 per tile (no balance bonus)**
**Realistic average harvest: ~1,800/tile (partial bonuses, moderate diggers)**

---

## 4. CAVE EXPLORATION & DIGGERS

### Cave/Forest Drop Mechanics
| Parameter | Value |
|---|---|
| Base drop rate | 2.5% (0.025) per cave/forest |
| Digger share of drops | 20% (0.20) |
| Tradeable share of drops | 80% (0.80) |
| Effective digger chance per cave | 0.5% (0.025 × 0.20) |
| Guaranteed digger interval | Every 75 caves |
| Expected diggers per full sweep (1,800 caves) | ~33 (9 RNG + 24 guaranteed) |

### Item Type Distribution (when a drop occurs)
| Item Type | Chance | Rarity |
|---|---|---|
| Metal Digger | 40% | Common |
| Energy Digger | 20% | Common |
| Universal Digger | 5% | Rare |
| Tradeable Item | 35% | Uncommon |

### Digger Bonus Formula (Exponential Decay)
```
Bonus = 200 × (1 - e^(-0.008 × n))
where n = total digger count, cap = 200%

Digger Count → Bonus:
  0 → 0%
  10 → 15.4%
  25 → 36.3%
  50 → 65.9%
  75 → 90.2%
  100 → 110.1%
  150 → 139.8%
  200 → 159.6%
  500 → 196.3%
```

### Digger Types
- **Metal Digger:** Adds to `gathering_metal_bonus` and `inventory_metal_digger_count`
- **Energy Digger:** Adds to `gathering_energy_bonus` and `inventory_energy_digger_count`
- **Universal Digger:** Adds to BOTH metal and energy bonuses and both counts

### Inventory System
| Parameter | Value |
|---|---|
| Default capacity | 2,000 items |
| Metal/Energy digger counts | Tracked separately per player |

---

## 5. XP & LEVELING SYSTEM

### XP Formula (Polynomial Level Curve)
```
XP to reach level L = floor(250 × L^2.5)
Level from XP = floor((totalXP / 250) ^ (1/2.5)) + 1

Level → Cumulative XP Required:
  1 → 0
  5 → 13,975
  10 → 79,056
  15 → 217,855
  20 → 447,213
  25 → 781,250
  30 → 1,232,375
  35 → 1,811,799
  40 → 2,529,822
  45 → 3,396,028
  50 → 4,419,417
```

### XP Rewards by Action
| Action | XP |
|---|---|
| Harvest resource tile | 3 |
| Cave exploration | 30 |
| Cave item (rare) | 50 |
| Cave item (legendary) | 100 |
| Factory capture | 200 |
| Factory upgrade | 100 |
| Unit build | 10 |
| Shrine sacrifice | 40 |
| Infantry attack win | 300 |
| Infantry attack loss | 50 |
| Base attack win | 400 |
| Base attack loss | 60 |
| Defense success | 150 |
| Factory defense | 100 |
| First login | 200 |
| Daily login | 20 |

### Level-Up Rewards
- **1 RP per level gained** (automatic on level-up)

### Time-to-Level Estimates (harvest-only, 3 XP/tile)
| Level | XP Required | Tiles Needed | Days at 100 harvests/day | Days at 500 harvests/day |
|---|---|---|---|---|
| 5 | 13,975 | 4,659 | 47 | 10 |
| 10 | 79,056 | 26,352 | 264 | 53 |
| 20 | 447,213 | 149,071 | 1,491 | 299 |
| 30 | 1,232,375 | 410,792 | 4,108 | 822 |
| 50 | 4,419,417 | 1,473,139 | 14,731 | 2,947 |

*Note: Combat XP (300/win) and cave exploration (30/cave) dramatically reduce these times for active fighters.*

---

## 6. TIER UNLOCKS & UNIT SYSTEM

### Tier Unlock Requirements
| Tier | Level | RP Cost | Metal Cost |
|---|---|---|---|
| 1 | 1 | 0 | 0 |
| 2 | 10 | 50 | 100,000 |
| 3 | 20 | 150 | 500,000 |
| 4 | 35 | 350 | 2,500,000 |
| 5 | 50 | 750 | 10,000,000 |

### Unit Stats & Costs — Tier 1 (Level 1+, 0 RP, Slot cost: 100)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Rifleman | 5 | 0 | 200 | 100 |
| Scout | 8 | 0 | 300 | 150 |
| Grenadier | 12 | 0 | 400 | 200 |
| Sniper | 15 | 0 | 500 | 250 |
| Bunker | 0 | 5 | 200 | 100 |
| Barrier | 0 | 8 | 300 | 150 |
| Turret | 0 | 12 | 400 | 200 |
| Shield | 0 | 15 | 500 | 250 |

### Unit Stats & Costs — Tier 2 (Level 5+, 5 RP, Slot cost: 300)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Commando | 30 | 0 | 1,200 | 600 |
| Ranger | 40 | 0 | 1,600 | 800 |
| Assassin | 50 | 0 | 2,000 | 1,000 |
| Demolisher | 60 | 0 | 2,400 | 1,200 |
| Fortress | 0 | 30 | 1,200 | 600 |
| Barricade | 0 | 40 | 1,600 | 800 |
| Cannon | 0 | 50 | 2,000 | 1,000 |
| Sentinel | 0 | 60 | 2,400 | 1,200 |

### Unit Stats & Costs — Tier 3 (Level 10+, 15 RP, Slot cost: 700)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Striker | 90 | 0 | 3,600 | 1,800 |
| Raider | 105 | 0 | 4,200 | 2,100 |
| Enforcer | 120 | 0 | 4,800 | 2,400 |
| Warlord | 135 | 0 | 5,400 | 2,700 |
| Citadel | 0 | 90 | 3,600 | 1,800 |
| Bulwark | 0 | 105 | 4,200 | 2,100 |
| Artillery | 0 | 120 | 4,800 | 2,400 |
| Guardian | 0 | 135 | 5,400 | 2,700 |

### Unit Stats & Costs — Tier 4 (Level 20+, 30 RP, Slot cost: 1,500)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Titan | 180 | 0 | 7,200 | 3,600 |
| Juggernaut | 210 | 0 | 8,400 | 4,200 |
| Destroyer | 240 | 0 | 9,600 | 4,800 |
| Annihilator | 270 | 0 | 10,800 | 5,400 |
| Stronghold | 0 | 180 | 7,200 | 3,600 |
| Rampart | 0 | 210 | 8,400 | 4,200 |
| Dreadnought | 0 | 240 | 9,600 | 4,800 |
| Colossus | 0 | 270 | 10,800 | 5,400 |

### Unit Stats & Costs — Tier 5 (Level 30+, 50 RP, Slot cost: 3,000)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Overlord | 360 | 0 | 14,400 | 7,200 |
| Conqueror | 420 | 0 | 16,800 | 8,400 |
| Devastator | 480 | 0 | 19,200 | 9,600 |
| Apocalypse | 540 | 0 | 21,600 | 10,800 |
| Bastion | 0 | 360 | 14,400 | 7,200 |
| Monolith | 0 | 420 | 16,800 | 8,400 |
| Leviathan | 0 | 480 | 19,200 | 9,600 |
| Immortal | 0 | 540 | 21,600 | 10,800 |

### Specialized Units (Level 15+, 25 RP + mastery requirements)

**Offensive Doctrine:**
| Unit | STR | Metal | Energy | Slot | Mastery |
|---|---|---|---|---|---|
| Vanguard | 200 | 4,000 | 2,000 | 200 | 0%+ |
| Berserker | 280 | 6,500 | 3,250 | 300 | 0%+ |
| Executioner | 360 | 9,000 | 4,500 | 300 | 25%+ |
| Annihilator | 480 | 12,000 | 6,000 | 400 | 75%+ |
| Warmonger | 620 | 16,000 | 8,000 | 500 | 100% |

**Defensive Doctrine:**
| Unit | DEF | Metal | Energy | Slot | Mastery |
|---|---|---|---|---|---|
| Guardian | 200 | 4,000 | 2,000 | 200 | 0%+ |
| Fortress | 280 | 6,500 | 3,250 | 300 | 0%+ |
| Citadel | 360 | 9,000 | 4,500 | 300 | 25%+ |
| Bulwark | 480 | 12,000 | 6,000 | 400 | 75%+ |
| Invincible | 620 | 16,000 | 8,000 | 500 | 100% |

**Tactical Doctrine (Balanced STR/DEF):**
| Unit | STR/DEF | Metal | Energy | Slot | Mastery |
|---|---|---|---|---|---|
| Striker | 120/120 | 4,500 | 2,250 | 200 | 0%+ |
| Vanguard | 160/160 | 7,000 | 3,500 | 300 | 0%+ |
| Elite | 210/210 | 10,000 | 5,000 | 300 | 25%+ |
| Commander | 280/280 | 13,000 | 6,500 | 400 | 75%+ |
| Supreme | 360/360 | 17,000 | 8,500 | 500 | 100% |

### Prestige Units (Achievement Unlocks)
| Unit | STR | DEF | Metal | Energy |
|---|---|---|---|---|
| Prestige Titan | 700 | 0 | 25,000 | 15,000 |
| Master Fabricator | 400 | 400 | 20,000 | 20,000 |
| Supreme Overlord | 1,000 | 0 | 35,000 | 25,000 |
| Mega Harvester | 450 | 450 | 22,000 | 22,000 |
| Vault Keeper | 0 | 800 | 30,000 | 18,000 |
| Shrine Mystic | 500 | 500 | 24,000 | 24,000 |
| Ancient Sentinel | 550 | 550 | 26,000 | 26,000 |
| Master Spelunker | 400 | 400 | 20,000 | 20,000 |
| Legendary Champion | 600 | 600 | 28,000 | 28,000 |
| Apex Predator | 900 | 0 | 32,000 | 20,000 |

---

## 7. BONUS STACKING SYSTEM (Multiplier Service)

### Additive Diminishing Returns
All bonuses are summed into a raw pool, then filtered through tiered effectiveness:

```
Raw Bonus = sum of all active bonus sources

Effectiveness Tiers:
  First +100% of raw → 100% effective (×1.0)
  Next +100% of raw → 75% effective (×0.75)
  Next +100% of raw → 50% effective (×0.50)
  Beyond +300% of raw → 10% effective (×0.10)

Effective Bonus = sum of (tier portion × tier effectiveness)
Final Multiplier = 1 + (Effective Bonus / 100)
```

### Bonus Sources
| Source | Amount | Condition |
|---|---|---|
| VIP | +50% | Active VIP subscription |
| Flag Bearer | +50% | Currently holding the flag |
| Shrine (max) | +70% | All 4 shrine boosts active (25+20+15+10) |

### Example Calculation: VIP + Flag + Full Shrine
```
Raw = 50 + 50 + 70 = 170%

Tier 1: min(170, 100) = 100 × 1.00 = 100.0
Tier 2: min(70, 100) = 70 × 0.75 = 52.5
Tier 3: 0 × 0.50 = 0
Tier 4: 0 × 0.10 = 0

Effective = 152.5%
Final Multiplier = 1 + 1.525 = 2.525x
```

### Shrine Internal Diminishing (separate from multiplier service)
Each shrine boost gives yield_bonus: 0.25 (+25% raw). When multiple are active:
```
1st boost: +25% (full)
2nd boost: +20% (diminished)
3rd boost: +15% (diminished)
4th boost: +10% (diminished)
Maximum shrine-only bonus: +70%
```

### Shrine Boost Tiers
| Tier | Item Cost | Duration | yield_bonus |
|---|---|---|---|
| Spade | 3 tradeable items | 1 hour | 0.25 |
| Heart | 10 tradeable items | 1 hour | 0.25 |
| Diamond | 30 tradeable items | 4 hours | 0.25 |
| Club | 60 tradeable items | 8 hours | 0.25 |

---

## 8. FACTORY SYSTEM

### Factory Attack Mechanics
| Parameter | Value |
|---|---|
| Attack cooldown | 5 minutes (per factory per player) |
| Success chance formula | `min(0.90, playerPower / factoryDefense)` |
| Max success rate | 90% |
| On capture: used_slots reset | Yes (to 0) |
| On capture: slots reset to max | Yes |
| Max factories per player | 10 |

### Player Power Calculation
```
power = 100 (base)
  + (rank × 10)
  + total_strength
  + (factory_count × 50)
```

### Factory Defense by Level
| Level | Defense |
|---|---|
| 1 | 1,000 |
| 2 | 50,000 |
| 3 | 200,000 |
| 4 | 450,000 |
| 5 | 800,000 |
| 6 | 1,250,000 |
| 7 | 1,800,000 |
| 8 | 2,450,000 |
| 9 | 3,200,000 |
| 10 | 4,050,000 |

Formula: Level 1 = 1,000; Level 2+ = `(level - 1)² × 50,000`

### Factory Upgrade Costs
```
metalCost = floor(1000 × 1.5^targetLevel)
energyCost = floor(500 × 1.5^targetLevel)
```

| Level → | Metal | Energy |
|---|---|---|
| 1→2 | 1,500 | 750 |
| 2→3 | 2,250 | 1,125 |
| 3→4 | 3,375 | 1,688 |
| 4→5 | 5,063 | 2,531 |
| 5→6 | 7,594 | 3,797 |
| 6→7 | 11,391 | 5,695 |
| 7→8 | 17,086 | 8,543 |
| 8→9 | 25,629 | 12,815 |
| 9→10 | 38,444 | 19,222 |
| **Total to 10** | **~169,000** | **~84,500** |

### Factory Stats by Level
| Level | Max Slots | Regen/hr | STR Bonus | DEF Bonus |
|---|---|---|---|---|
| 1 | 5,000 | 416.67 | 5% | 5% |
| 2 | 5,500 | 458.33 | 10% | 10% |
| 3 | 6,000 | 500.00 | 15% | 15% |
| 4 | 6,500 | 541.67 | 20% | 20% |
| 5 | 7,000 | 583.33 | 25% | 25% |
| 6 | 7,500 | 625.00 | 30% | 30% |
| 7 | 8,000 | 666.67 | 35% | 35% |
| 8 | 8,500 | 708.33 | 40% | 40% |
| 9 | 9,000 | 750.00 | 45% | 45% |
| 10 | 9,500 | 791.67 | 50% | 50% |

Formulas: `maxSlots = 5000 + (level-1)×500`, `regenRate = 416.67 + (level-1)×41.67`, `bonus = level×5%`

### Factory Passive Income
| Parameter | Value |
|---|---|
| Metal per hour | `factoryLevel × 1,000` |
| Energy per hour | `factoryLevel × 500` |
| Min collection interval | 1 minute |
| Income formula | `floor(hourlyRate × hoursElapsed)` |

### Unit Production at Factories
| Parameter | Value |
|---|---|
| Cost | 100 Metal + 50 Energy per unit |
| Unit produced | T1_Rifleman (STR: 5, DEF: 0) |
| Slot consumption | 1 per unit |

---

## 9. PVP COMBAT SYSTEM

### Infantry Battle (Player vs Player)

#### HP Calculation
```
HP per STR unit: 10
HP per DEF unit: 15
Total army HP = sum of all unit HP
```

#### Damage Per Round
```
Attacker Damage = max(5, AttackerSTR - DefenderDEF / 2)
Defender Damage = max(5, DefenderDEF - AttackerSTR / 2)
```

#### Level Gap Protection
```
If level difference > 20:
  damageReduction = 1 - ((levelGap - 20) × 0.05)
  cappedDamage = baseDamage × max(0.25, damageReduction)
  damage = max(5, floor(cappedDamage))
```
- Level difference threshold: 20
- Reduction: 5% per level above 20
- Minimum damage floor: 25% of calculated damage
- Absolute minimum damage: 5

#### Battle Resolution
- Max rounds: 100 (forces draw if exceeded)
- Unit casualties: `floor(hpLost / avgHPPerUnit)` distributed randomly
- Winner captures 10–15% of defeated units (random)

#### XP Awards (Infantry)
| Outcome | Attacker XP | Defender XP |
|---|---|---|
| Attacker wins | 300 | 50 |
| Defender wins | 50 | 150 |

#### XP Awards (Base Attack)
| Outcome | Attacker XP | Defender XP |
|---|---|---|
| Attacker wins | 400 | 60 |
| Defender wins | 60 | 150 |

#### RP Awards
- Infantry victory: `100 + (levelDifference × 20)` RP
- Base attack victory: `150 + (levelDifference × 20)` RP
- Level difference = `max(0, opponentLevel - winnerLevel)`

### PvP Resource Theft & Burn
| Parameter | Value |
|---|---|
| Base theft rate (base attack) | 20% of chosen resource |
| Resource burn rate | 20% of stolen resources permanently destroyed |
| Attack cost | 1,000 Metal + 1,000 Energy (even on loss) |
| Destroyed units | Permanently removed from economy |

```
burned = floor(stolen × 0.20)
actualGain = stolen - burned
```

### Army Balance Effects
| Status | STR/DEF Ratio | Power | Dmg Taken | Dmg Dealt | Gathering | Slot Regen |
|---|---|---|---|---|---|---|
| CRITICAL | < 0.7 | 0.5x | 1.3x | 0.8x | 0.75x | 0.85x |
| IMBALANCED | 0.7–0.85 | 0.8x | 1.15x | 0.9x | 0.9x | 1.0x |
| BALANCED | 0.85–1.15 | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |
| OPTIMAL | 0.95–1.05 | 1.1x | 0.95x | 1.05x | 1.1x | 1.0x |

```
ratio = min(str, def) / max(str, def)
```

---

## 10. FLAG BEARER SYSTEM

### Flag Bot Stats
| Parameter | Value |
|---|---|
| Specialization | Balanced |
| Tier | 2 |
| HP | 1,000 |
| STR | 5,000 |
| DEF | 5,000 |
| Level | 15 |
| Rank | 3 |
| Resources | 50,000 Metal, 50,000 Energy |

### Flag Movement
| Parameter | Value |
|---|---|
| Movement type | Teleport to random (1–150, 1–150) |
| Movement interval | Every 30 minutes (cron job) |
| Trail duration | 8 minutes |
| Trail cap | 200 entries |

### Flag Bearer Bonuses
| Bonus | Value |
|---|---|
| Harvest multiplier | 2.0x |
| XP multiplier | 2.0x |
| Cave drop boost | 1.5x |
| Auto-farm speed boost | 1.5x |
| Unit STR boost | 1.25x |
| Unit DEF boost | 1.25x |
| Bank capacity boost | 1.5x |
| Inventory capacity boost | 1.5x |

### Flag Challenge Mechanics
| Parameter | Value |
|---|---|
| Challenge range | 15 tiles |
| Channel duration | 30 seconds |
| Lock duration | 5 seconds |
| Challenge cooldown | 30 minutes |
| Cancel challenge cooldown | 5 minutes |
| Anti-hoard cooldown | 2 hours |
| Max hold time | 12 hours |
| Grace period after claim | 1 hour |
| Respawn countdown | 30 minutes |

### Flee Mechanics
| Flee # | Cost (% of session resources) |
|---|---|
| 1 | 10% |
| 2 | 15% |
| 3 | 20% |
| 4 | 25% |
| 5 | 30% |
| Max flees | 5 |
| Flee distance | 5 tiles (random direction) |
| Flee cooldown | 1 minute |

### Flag Respawn Terrain Preference
| Terrain | Weight |
|---|---|
| Metal | 40% |
| Cave | 30% |
| Factory | 30% |
| Energy | 0% |
| Forest | 0% |

### Permanent Flag Bonus
| Parameter | Value |
|---|---|
| Permanent harvest bonus | +2% per flag hold (cumulative) |
| Max hold bonus (metal) | 2,000,000 |
| Max hold bonus (energy) | 2,000,000 |

---

## 11. BANKS & AUCTION HOUSE

### Bank Locations & Types
| Location | Type |
|---|---|
| (25, 25) | Metal Bank |
| (75, 75) | Energy Bank |
| (50, 50) | Exchange Bank |
| (100, 100) | Exchange Bank |

### Bank Mechanics
| Parameter | Value |
|---|---|
| Deposit fee | 1,000 Metal/Energy per deposit |
| Withdrawal fee | 0 (free) |
| Exchange rate | 80% (20% fee) |
| Banked resources safe from PvP | Yes |

### Exchange Formula
```
receivedAmount = floor(amount × 0.80)
```

### Auction House
| Parameter | Value |
|---|---|
| Location | (10, 10) |
| Max active listings per player | 10 |
| Listing fee (12h) | 100 Metal |
| Listing fee (24h) | 150 Metal |
| Listing fee (48h) | 200 Metal |
| Public sale fee | 5% |
| Clan sale fee | 0% |
| Min bid increment | 100 |
| Min starting bid | 100 |
| Max starting bid | 1,000,000 |
| Valid durations | 12, 24, 48 hours |
| Settlement grace period | 60 minutes |
| Max bids per auction per player | 1 |

---

## 12. CLAN SYSTEM

### Clan Creation
| Parameter | Value |
|---|---|
| Cost | 1,500,000 Metal + 1,500,000 Energy |
| Min members | 1 (solo allowed) |
| Name length | 3–30 characters |
| Tag length | 2–6 characters |
| Default max members | 20 |
| Max clan level | 50 |

### Clan Roles (Hierarchy)
1. LEADER
2. CO_LEADER
3. OFFICER
4. ELITE
5. MEMBER
6. RECRUIT

### Role Permissions
| Permission | Minimum Role |
|---|---|
| Invite | OFFICER+ |
| Kick | OFFICER+ |
| Promote to Co-Leader | LEADER only |
| Promote to Officer | CO_LEADER+ |
| Promote to Elite | OFFICER+ |
| Demote | OFFICER+ |
| Edit description | OFFICER+ |
| Critical settings | LEADER only |
| Claim territory | LEADER, CO_LEADER, OFFICER |

### Territory Claiming
| Parameter | Value |
|---|---|
| Base cost | 500 Metal + 500 Energy |
| Adjacency required | Yes (4-directional) |
| Defense bonus per adjacent tile | +10% |
| Max defense bonus | +50% |

### Territory Cost Tiers
| Territory Count | Metal Cost | Energy Cost |
|---|---|---|
| ≤ 10 | 2,500 | 2,500 |
| ≤ 25 | 3,000 | 3,000 |
| ≤ 50 | 3,500 | 3,500 |
| ≤ 100 | 4,000 | 4,000 |
| ≤ 250 | 5,000 | 5,000 |
| ≤ 500 | 6,000 | 6,000 |
| ≤ 750 | 7,000 | 7,000 |
| ≤ 1,000 | 8,000 | 8,000 |

### Territory Limits by Clan Level
| Clan Level | Max Territories |
|---|---|
| 1 | 25 |
| 6 | 50 |
| 11 | 100 |
| 16 | 200 |
| 21 | 400 |
| 26 | 700 |
| 31 | 1,000 |

### Territory Income
```
incomePerTerritory = floor(1000 × (1 + (clanLevel - 1) × 0.1))
totalDailyIncome = incomePerTerritory × territoryCount
```
- Collection: Once per day (midnight UTC)
- Income deposited to clan bank

### Territory Decay
| Parameter | Value |
|---|---|
| Grace period | 14 days after capture |
| Decay check interval | 24 hours |
| Revert chance per check | 5% |

### Clan Bank
| Parameter | Value |
|---|---|
| Base capacity (per resource) | 1,000,000 |
| Tax rate range | 0%–50% |
| Bank upgrade level 2 | 50,000 M + 50,000 E + 100 RP |
| Bank upgrade level 3 | 100,000 M + 100,000 E + 250 RP |
| Bank upgrade level 4 | 200,000 M + 200,000 E + 500 RP |
| Bank upgrade level 5 | 400,000 M + 400,000 E + 1,000 RP |
| Bank upgrade level 6 | 800,000 M + 800,000 E + 2,000 RP |
| Capacity multipliers | 1×, 1.5×, 2×, 3×, 4×, 6× |

### Clan Warfare
| Parameter | Value |
|---|---|
| Base war cost | 50,000 M + 50,000 E |
| Scaling per territory | +400 per territory |
| Metal spoils | 15% |
| Energy spoils | 15% |
| RP spoils | 10% |
| Victory XP | 50,000 |
| Defeat XP penalty | 25,000 |
| Min war duration | 48 hours |
| War cooldown | 168 hours (7 days) |
| Min clan level | 10 |
| Min clan members | 5 |

### Clan Invitations
| Parameter | Value |
|---|---|
| Expiration | 7 days |
| Chat message max length | 500 |
| Chat history limit | 100 messages |
| Chat retention | 7 days |

---

## 13. BOT ECOSYSTEM

### Bot Specialization Distribution
| Specialization | Spawn % | Movement | Regen Rate | DEF Multiplier |
|---|---|---|---|---|
| Hoarder | 24.75% | Stationary | 5%/hr | 0.5x |
| Raider | 24.75% | Roam | 15%/hr | 1.0x |
| Fortress | 19.80% | Stationary | 10%/hr | 3.0x |
| Ghost | 14.85% | Teleport | 20%/hr | 0.8x |
| Balanced | 14.85% | Roam | 10%/hr | 1.0x |
| Boss | 1.00% | Stationary | 2%/hr | 20.0x |

### Bot Resource Ranges (base, before tier multiplier)
| Specialization | Min | Max |
|---|---|---|
| Hoarder | 50,000 | 150,000 |
| Fortress | 5,000 | 15,000 |
| Raider | 10,000 | 40,000 |
| Ghost | 20,000 | 80,000 |
| Balanced | 15,000 | 50,000 |
| Boss | 4,000,000 | 6,000,000 |

### Bot Tier Multiplier
```
tierMultiplier = 0.5 + (tier × 0.25)
```
Tier 1: 0.75x, Tier 2: 1.0x, Tier 3: 1.25x, Tier 4: 1.5x, Tier 5: 1.75x, Tier 6: 2.0x, Tier 7: 2.25x

### Player Level Bonus to Bot Resources
```
bracket = min(floor(playerLevel / 10), 6)
levelBonus = 1.0 + (bracket × 0.25)
```
Level 1–9: 1.0x, Level 10–19: 1.25x, Level 20–29: 1.5x, Level 30–39: 1.75x, Level 40–49: 2.0x, Level 50–59: 2.25x, Level 60+: 2.5x

### Bot Tier by Zone
| Zones | Tier Range |
|---|---|
| 0–2 | 1–3 (random) |
| 3–5 | 3–5 (random) |
| 6–8 | 5–7 (random) |

### Bot Defense by Tier
```
baseDefense = 100 + (tier × 50)
scalingFactor = 2^(tier - 1)
defense = floor(baseDefense × scalingFactor × 0.1)
```

### Bot Level by Tier
| Tier | Level |
|---|---|
| 1 | 5 |
| 2 | 15 |
| 3 | 25 |
| 4 | 35 |
| 5 | 45 |
| 6 | 55 |
| 7 | 65 |

### Bot Combat Mechanics
```
Bot Power = botSTR + (botDEF × 0.5)
Player Power = (targetSTR × 0.5 + targetDEF) × balanceMultiplier
botRoll = botPower × (0.8 + random × 0.4)    // 80-120%
targetRoll = targetPower × (0.8 + random × 0.4)  // 80-120%

Bot resource theft on win: 10-30% (0.10 + random × 0.20)
Bot revenge chance: 60%
```

### Bot Aggression Multipliers
| Specialization | Multiplier | Effective Cooldown |
|---|---|---|
| Raider | 3.0x | 2 hours |
| Balanced | 1.0x | 6 hours |
| Hoarder | 0.7x | ~8.5 hours |
| Fortress | 0.5x | 12 hours |
| Ghost | 0.3x | ~20 hours |
| Base cooldown | 6 hours | — |

### Bot Reputation
| Defeats | Reputation | Loot Bonus |
|---|---|---|
| 0–5 | Unknown | 1.0x |
| 6–15 | Notorious | 1.25x |
| 16–30 | Infamous | 1.5x |
| 31+ | Legendary | 2.0x |

### Bot XP for Player
```
Base: 50 + (tier × 25) = 75–125 XP
With reputation bonus: up to 2x
```

### Bot Growth Cycle
```
70% chance: current × (1.05 to 1.15) — growth
20% chance: no change
10% chance: current × (0.90 to 0.95) — shrinkage
Resource regeneration: newAmount = current + floor(current × 0.1)
```

### Bot Migration
| Parameter | Value |
|---|---|
| When | Sundays at 8:00 AM UTC |
| Percentage | 30% of bots migrate |
| Raiders | Move toward player activity |
| Hoarders | Move away from players |
| Fortress | Cluster near nests (within 300 tiles) |
| Ghost | Random teleport |
| Balanced | Even 10×10 grid distribution |

### Bot Nests (8 Fixed Locations)
| ID | Name | Position | Theme |
|---|---|---|---|
| 0 | Central Nexus | (75, 75) | Mixed |
| 1 | Northwest Outpost | (25, 25) | Fortress heavy |
| 2 | Northeast Stronghold | (125, 25) | Raider heavy |
| 3 | Southwest Haven | (25, 125) | Hoarder heavy |
| 4 | Southeast Enclave | (125, 125) | Ghost heavy |
| 5 | Shrine Guardians | (1, 1) | Balanced, high rewards |
| 6 | North Bank Nest | (75, 10) | Banking bots |
| 7 | South Border Camp | (75, 140) | Patrol bots |

- Target bot count per nest: 15–20
- Default nest radius: 15 tiles

### Bot Scanner
| Parameter | Value |
|---|---|
| Basic range | 50 tiles |
| Advanced range | 100 tiles |
| Basic cooldown | 1 hour |
| Advanced cooldown | 30 minutes |
| Tech requirement (basic) | `bot-hunter` |
| Tech requirement (advanced) | `advanced-tracking` |

### Bot Magnet Beacon
| Parameter | Value |
|---|---|
| Duration | 168 hours (7 days) |
| Cooldown | 336 hours (14 days) |
| Attraction radius | 100 tiles |
| Attraction chance | 30% |
| Max beacons per player | 1 |
| Offset range | ±20 tiles |

### Bot Summoning Circle
| Parameter | Value |
|---|---|
| Bots summoned | 5 |
| Spawn radius | 20 tiles |
| Resource multiplier | 1.5x |
| Cooldown | 168 hours (7 days) |
| Tech requirement | `bot-summoning-circle` |

### Beer Bases (Special Bots)
| Parameter | Value |
|---|---|
| Resource multiplier | 3x base |
| Respawn | Sundays at 4:00 AM |
| Spawn count | 5–10 |
| On defeat | Base destroyed (removed) |

---

## 14. STAMINA & AUTO-FARM

### Stamina System
| Actions Today | Efficiency |
|---|---|
| 0–1,999 | 100% |
| 2,000–2,999 | 75% |
| 3,000–3,999 | 50% |
| 4,000+ | 25% (floor) |

- Resets daily (tracked by date string YYYY-MM-DD)
- Never hits zero (25% floor)

### Auto-Farm Engine

#### Movement Pattern
- Snake pattern: Row 1 left→right, Row 2 right→left, alternating
- Covers entire 150×150 map systematically

#### Timing (per tile)
| Parameter | VIP | Basic |
|---|---|---|
| MOVEMENT_WAIT | 200ms | 200ms |
| HARVEST_WAIT | 800ms | 800ms |
| MOVEMENT_DELAY | 300ms | 500ms |
| HARVEST_DELAY_EXTRA | 0ms | 2,000ms |
| **Total per tile** | **~1.3s** | **~3.5s** |

#### Map Completion Time
| Mode | Time per tile | Total tiles | Estimated completion |
|---|---|---|---|
| VIP | ~1.3s | 22,500 | ~5.6 hours |
| Basic | ~3.5s | 22,500 | ~11.6 hours |
| VIP + Flag Bearer (1.5x) | ~0.87s | 22,500 | ~3.7 hours |

#### Auto-Farm Combat
- Optional player base attacks (configurable: attackPlayers flag)
- Rank filter: ALL, LOWER, HIGHER
- Resource target: METAL, ENERGY, LOWEST
- Unit selection: strongest STR units first
- Max 10 units per attack

#### Stats Update Interval
- Every 1,000ms (1 second)

---

## 15. RESOURCE DECAY & UPKEEP

### Resource Decay (Rot)
| Parameter | Value |
|---|---|
| Threshold | 1,000,000 (no decay below) |
| Rate | 0.25% daily on amount above threshold |
| Max decay per day | 250,000 per resource |

```
decay = min(floor((storedAmount - 1000000) × 0.0025), 250000)
```

### Unit Upkeep
| Parameter | Value |
|---|---|
| Base rate | 1% of base cost per hour |
| Supply cap formula | `100 + (level × 10) + (factoryCount × 25)` |
| Exponential scaling | `(1 + overRatio)^1.5` |

```
overRatio = unitCount / supplyCap
multiplier = (1 + overRatio) ^ 1.5
hourlyCost = unitCount × avgUnitCost × 0.01 × multiplier
```

---

## 16. DISCOVERY & SPECIALIZATION SYSTEM

### Discovery System
| Parameter | Value |
|---|---|
| Drop rate | 5% per cave exploration |
| Total available | 15 discoveries |
| Categories | Industrial (5), Combat (4), Strategic (5) |

### All 15 Discoveries
| ID | Name | Category | Bonus | Value |
|---|---|---|---|---|
| AUTO_HARVESTER | Automated Harvester | Industrial | Metal Yield | +15% |
| FUSION_CORE | Fusion Core Reactor | Industrial | Energy Yield | +15% |
| NANO_FORGE | Nano-Fabrication Forge | Industrial | Unit Cost Reduction | -10% |
| QUANTUM_FACTORY | Quantum Factory Matrix | Industrial | Factory Slots | +2 |
| RAPID_ASSEMBLY | Rapid Assembly Protocol | Industrial | Slot Regen Speed | +20% |
| TITAN_ARMOR | Titan Composite Armor | Combat | Unit Defense | +10% |
| PLASMA_WEAPONS | Plasma Weapon Systems | Combat | Unit Strength | +10% |
| TACTICAL_AI | Tactical Combat AI | Combat | Damage Dealt | +5% |
| SHIELD_MATRIX | Energy Shield Matrix | Combat | Damage Taken Reduction | -5% |
| REPAIR_NANITES | Regenerative Nanites | Combat | Unit HP | +15% |
| BANK_PROTOCOL | Secure Banking Protocol | Strategic | Bank Capacity | +25% |
| SHRINE_BLESSING | Ancient Shrine Blessing | Strategic | Shrine Boost Duration | +10% |
| WARP_DRIVE | Warp Drive Prototype | Strategic | Fast Travel | Unlocked |
| CRYSTAL_RESONATOR | Crystal Resonator | Strategic | XP Gain | +20% |
| FORTUNE_ALGORITHM | Fortune Algorithm | Strategic | Cave Loot Quality | +10% |

### Specialization System
| Parameter | Value |
|---|---|
| Unlock level | 15 |
| Unlock cost | 25 RP |
| Respec cost | 50 RP + 50,000 M + 50,000 E |
| Respec cooldown | 48 hours |
| Mastery XP per level | 100 |
| Max mastery level | 100 (10,000 XP total) |

### Doctrine Bonuses
| Doctrine | STR Multiplier | DEF Multiplier | Cost Reduction |
|---|---|---|---|
| Offensive | 1.15x | — | -10% metal |
| Defensive | — | 1.15x | -10% energy |
| Tactical | 1.10x (balanced) | 1.10x (balanced) | -5% all costs |

### Mastery Milestone Bonuses
| Mastery | Bonus |
|---|---|
| 25% | +5% bonus stats |
| 50% | +10% bonus stats |
| 75% | +15% bonus stats, 4th unit unlocked |
| 100% | +20% bonus stats, 5th unit unlocked, prestige available |

---

## 17. ACHIEVEMENTS

### All Achievement Thresholds & Rewards
| ID | Requirement | Metal | Energy | RP | XP | VIP Days | Other |
|---|---|---|---|---|---|---|---|
| harvest_1k | 1,000 harvests | 10,000 | — | — | 500 | — | — |
| harvest_10k | 10,000 harvests | 50,000 | — | 10 | 2,000 | — | — |
| harvest_100k | 100,000 harvests | 250,000 | — | 50 | 10,000 | 1 | — |
| harvest_1m | 1,000,000 harvests | 1,000,000 | — | 200 | 50,000 | 7 | cosmetic |
| cave_100 | 100 caves | 15,000 | — | — | 1,000 | — | — |
| cave_500 | 500 caves | 75,000 | — | 15 | 5,000 | — | — |
| cave_2000 | 2,000 caves | 300,000 | — | 75 | 25,000 | 3 | — |
| attack_10 | 10 wins | 20,000 | — | — | 2,000 | — | — |
| attack_50 | 50 wins | 100,000 | — | 20 | 10,000 | — | — |
| factory_5 | 5 captures | 500,000 | — | 100 | 50,000 | 5 | — |
| diggers_10 | 10 diggers | 25,000 | — | — | 1,500 | — | — |
| diggers_50 | 50 diggers | 150,000 | — | 30 | 7,500 | — | — |
| diggers_200 | 200 diggers | 750,000 | — | 150 | 30,000 | 7 | — |
| referral_1 | 1 referral (level 5) | 10,000 | — | 5 | — | — | — |
| referral_5 | 5 referrals (level 15) | 50,000 | — | 25 | — | 3 | — |
| referral_25 | 25 referrals (level 25) | 250,000 | — | 100 | — | 14 | cosmetic |
| streak_7 | 7-day streak | 25,000 | — | — | 3,000 | — | — |
| streak_30 | 30-day streak | 150,000 | — | 50 | 15,000 | 3 | — |
| streak_100 | 100-day streak | 1,000,000 | — | 200 | 100,000 | 30 | cosmetic |

---

## 18. DAILY LOGIN & REFERRALS

### Daily Login Rewards
```
BASE_DAILY_RP = 100
STREAK_BONUS_PER_DAY = 10
MAX_STREAK_DAYS = 7
STREAK_BREAK_HOURS = 24

effectiveStreak = min(newStreak, 7)
streakBonus = (effectiveStreak - 1) × 10
totalRP = 100 + streakBonus
VIP multiplier: 1.5x
```

| Streak Day | RP Award |
|---|---|
| 1 | 100 |
| 2 | 110 |
| 3 | 120 |
| 4 | 130 |
| 5 | 140 |
| 6 | 150 |
| 7+ | 160 (cap) |

### Referral System
| Parameter | Value |
|---|---|
| Code format | DF-XXXXXXXX (8 alphanumeric) |
| Validation period | 7 days + ≥4 logins |
| Max referrals per IP | 3 |
| Max signups/hour per code | 5 |
| VIP cap | 30 days total |

### Per-Referral Rewards (progressive)
```
Base: 10,000 M + 10,000 E + 15 RP + 2,000 XP + 1 VIP day
progressiveFactor = min(1.05^(referralCount - 1), 2.0)
reward = base × progressiveFactor
```

### Referral Milestone Rewards
| Count | Metal | Energy | RP | XP | VIP Days | Special |
|---|---|---|---|---|---|---|
| 1 | 25,000 | 25,000 | 20 | 3,000 | 2 | Recruiter Title |
| 3 | 50,000 | 50,000 | 40 | 6,000 | 3 | 5 Elite Infantry |
| 5 | 100,000 | 100,000 | 80 | 10,000 | 5 | Bronze Badge |
| 10 | 250,000 | 250,000 | 200 | 25,000 | 7 | Unit + 5% Resource |
| 15 | 500,000 | 500,000 | 400 | 50,000 | 5 | Silver Badge + 2 Legendary Units |
| 25 | 750,000 | 750,000 | 800 | 100,000 | 2 | Ambassador Unit + 10% XP |
| 50 | 625,000 | 625,000 | 1,500 | 200,000 | 0 | Gold Badge + 10% Resource + Research Pack |
| 100 | 150,000 | 150,000 | 3,000 | 500,000 | 0 | Diamond Badge + 25% All Bonuses |

### Welcome Package (with referral)
- 50,000 M + 50,000 E
- 1× Legendary Universal Digger
- 25% XP boost (7 days)
- 3 VIP days
- "Recruit" title

### Starter Package (without referral)
- 25,000 M + 25,000 E
- 1× Rare Universal Digger
- 15% XP boost (3 days)
- 1 VIP day
- "Recruit" title

---

## 19. WMD / MISSILE SYSTEM

### Warhead Types & Costs
| Warhead | Tier | Damage | Targets | Flight Time | Intercept Diff |
|---|---|---|---|---|---|
| Tactical | 1 | 25% base | 1 | 5 min | 0.2 |
| Strategic | 5 | 50% base | 1 | 4 min | 0.4 |
| Neutron | 7 | 60% base | 1 | 3 min | 0.5 |
| Cluster | 8 | 40%+20% | 5 | 5 min | 0.6 |
| Clan Buster | 10 | 50%+30%+20% | 100 | 10 min | 0.8 |

### Component Costs (Each)
| Component | Metal | Energy | Production Time | Tier Multiplier |
|---|---|---|---|---|
| Warhead | 500,000 | 1,000,000 | 1 hour | 1.2 |
| Propulsion | 750,000 | 500,000 | 45 min | 1.15 |
| Guidance | 250,000 | 750,000 | 30 min | 1.25 |
| Payload | 1,000,000 | 500,000 | 1 hour | 1.1 |
| Stealth | 500,000 | 1,000,000 | 1.5 hours | 1.3 |

**Total per missile: 3,000,000 Metal + 3,750,000 Energy (5 components)**

### Missile Damage
```
Base damage by type: Tactical 50K, Strategic 250K, Neutron 150K, Cluster 100K, Clan Buster 5,000,000
defenseMitigation = min(0.8, defenseStrength / 1000) - defensePenetration
finalDamage = floor(baseDamage × (1 - max(0, defenseMitigation)))

Splash radius: Tactical 1, Strategic 3, Neutron 2, Cluster 5, Clan Buster 10
```

### Targeting Rules
| Parameter | Value |
|---|---|
| Min target level | 40 |
| Min target power | 10,000 |
| New clan member protection | 3 days |
| Recent attack cooldown | 24 hours |
| Max miss chance | 85% |
| Base hit chance | 15% |

### Spy System
| Spy Type | Metal Cost | Energy Cost |
|---|---|---|
| Surveillance | 100,000 | 200,000 |
| Sabotage | 150,000 | 250,000 |
| Infiltration | 200,000 | 300,000 |
| Cyber | 250,000 | 350,000 |

| Parameter | Value |
|---|---|
| Max spies (base) | 1 |
| Max spies (intel_tier_3) | 3 |
| Max spies (intel_tier_6) | 5 |
| Max spies (intel_tier_9) | 10 |
| Mission success (base) | 70% |
| XP per mission (success) | 15 |
| XP per mission (failure) | 8 |
| Counter-intelligence detection | 40% per enemy spy |

### Defense Batteries
| Parameter | Value |
|---|---|
| Interception chance | interception_range / 100 |
| Cooldown | 30 seconds |
| Repair cost | 50% of base cost |
| Repair time | 1 minute |

---

## 20. TOOL DURABILITY SYSTEM

### Tool Tiers
| Tier | Decay Rate (%/tile) | Speed Bonus | Repair Metal | Repair Energy |
|---|---|---|---|---|
| Basic | 0.05 | 1.0x | 50,000 | 25,000 |
| Advanced | 0.02 | 1.2x | 200,000 | 100,000 |
| Premium | 0.01 | 1.5x | 500,000 | 250,000 |
| Legendary | 0.005 | 2.0x | 2,000,000 | 1,000,000 |

```
conditionMultiplier = max(0.05, condition / 100)
speed = baseSpeedBonus × conditionMultiplier
newCondition = max(0, currentCondition - (decayRate × tilesHarvested))

degradation = 100 - currentCondition
multiplier = (1 + degradation/100)²
repairCost = floor(baseRepairCost × multiplier × degradation/100)
```

---

## 21. ANALYSIS FRAMEWORK

When analyzing DarkFrame's balance, use the following framework:

### 21.1 Economic Flow Analysis
For each resource (Metal, Energy), trace the complete flow:
- **Faucets:** How does the resource enter the economy? (harvesting, bot drops, factory income, daily login, achievements, referrals)
- **Sinks:** How does the resource leave the economy? (unit costs, factory upgrades, tier unlocks, upkeep, PvP burn, auction fees, resource decay)
- **Velocity:** How quickly does a player accumulate and spend the resource?
- **Conversion:** Can players convert between resources? At what rate? (exchange banks: 80%, auction house: market rate)

### 21.2 Time-to-Goal Analysis
For each major progression milestone, calculate the expected time to reach it:
- **First T2 unit:** Time to accumulate 100,000 Metal + 50 RP + reach Level 10
- **First factory capture:** Time to build enough army to defeat a Level 1 factory (1,000 defense)
- **First T3 unit:** Time to accumulate 500,000 Metal + 150 RP + reach Level 20
- **First T4 unit:** Time to accumulate 2,500,000 Metal + 350 RP + reach Level 35
- **First T5 unit:** Time to accumulate 10,000,000 Metal + 750 RP + reach Level 50
- **Digger cap (200%):** Time to accumulate ~500 diggers through cave exploration

### 21.3 Power Curve Analysis
For each stage of the game, model the player's effective power:
- **Early game (L1–L9):** T1 units only, no tier unlocks, minimal diggers
- **Mid game (L10–L24):** T2–T3 units, first factories, moderate diggers
- **Late game (L25–L49):** T4 units, multiple factories, many diggers
- **End game (L50+):** T5 units, max factories, digger cap, flag bearer

### 21.4 PvP Balance Analysis
For combat between players at different progression stages:
- **Power ratio:** How much stronger is a maxed player vs. a new player?
- **Catch-up mechanics:** Can a skilled/active new player beat a less active veteran?
- **Risk vs. reward:** Is attacking another player worth the cost (1K M + 1K E attack cost, 20% burn)?
- **Army balance impact:** How much does the balance system affect combat outcomes?

### 21.5 Retention & Addiction Loop Analysis
Identify and evaluate the game's core loops:
- **Daily loop:** What does a player do in a typical play session? What brings them back?
- **Weekly loop:** What resets or changes weekly? (bot migration, beer bases, territory decay)
- **Monthly loop:** What long-term goals keep players engaged?
- **Variable ratio rewards:** What mechanics use randomness to create engagement? (cave drops, digger RNG, auction house)
- **Sunk cost mechanics:** What investments create switching costs? (diggers, tier unlocks, factory upgrades)
- **Social hooks:** What mechanics create social obligation? (clans, referrals, PvP grudges)

---

## 22. KEY BALANCE QUESTIONS

Answer each question with specific numerical analysis using the formulas above:

### Terrain & Distribution
1. Is 40% Wasteland the right amount? Calculate the average distance between resource tiles and the time to traverse between them.
2. Should Metal and Energy remain at 20% each, or should one be scarcer? Analyze the unit cost ratios across all 5 tiers.
3. Are 1,800 caves (8%) the right count? Calculate how many diggers a player gets per full auto-farm sweep and how that feeds the exponential decay curve.
4. Should Forests (2%) have different mechanics from Caves? They currently use identical code.
5. Are 2,250 factories (10%) too many, too few, or right? Calculate factories per player at 500, 1,000, and 2,000 concurrent players.
6. Should the 4 banks be increased? Calculate average travel distance from a random tile to the nearest bank.

### Economy & Progression
7. Is the XP curve (250 × L^2.5) appropriately paced? Calculate time-to-level for active vs. passive players.
8. Is 1 RP per level sufficient given the tier unlock costs? Calculate total RP earned by level 50 from all sources.
9. Is the digger exponential decay curve well-tuned? At what digger count does marginal utility become negligible?
10. Is the max harvest (~5,681/tile) too high? Calculate how many max-harvests are needed for a T4 unit.
11. Is the resource decay (0.25% above 1M, max 250K/day) effective? Calculate how long it takes to drain various stockpiles.
12. Is the PvP burn rate (20%) sufficient to prevent runaway economies? Model the resource destruction rate at various player counts.

### Combat & PvP
13. Is the factory defense curve appropriate? Calculate what army composition is needed to capture each factory level.
14. Is the PvP combat damage formula balanced? Model battles between players with different army compositions.
15. Does the level gap protection (5% per level above 20, floor 25%) adequately protect new players?
16. Is the army balance system too punishing? Calculate the effective power difference between balanced and unbalanced armies.

### Strategic & Map Design
17. Should the Shrine move from (1,1) to center (75,75)? Analyze the impact on travel time and PvP dynamics.
18. Should the Auction House move away from the Shrine? Analyze player traffic patterns.
19. Should the map use clustered biomes instead of pure random? Analyze the impact on strategic depth.
20. Should new players spawn in an outer ring with guaranteed nearby resources? Model the impact on early-game retention.
21. Is the flag system well-tuned? Analyze the 12-hour max hold, flee mechanics, and respawn terrain preference.

### Addiction & Retention
22. What is the optimal daily session length? Analyze the stamina system's impact on session pacing.
23. Does the auto-farm system create healthy engagement or unhealthy obligation? Analyze the VIP vs. Basic speed difference.
24. Are the daily login rewards (100–160 RP) sufficient to drive daily returns?
25. Is the referral system well-calculated? Analyze the per-referral value and milestone rewards.
26. Do the achievement thresholds create meaningful long-term goals?
27. Is the bot ecosystem engaging enough? Analyze the variety of bot behaviors and the hunter gameplay loop.

### Code & Design Hygiene
28. Should the dead `DIGGER_TIERS` constant be removed from `GAME_CONSTANTS`?
29. Should the stale JSDoc in `generateTerrainArray()` be corrected (Cave: 2,250 → 1,800)?
30. Should the Wasteland count in `game.types.ts` JSDoc be corrected (8,500 → 8,995)?

---

## 23. DELIVERABLES

For each analysis area, provide:

1. **Current State Analysis:** What the numbers show using the formulas above
2. **Problem Identification:** Where the balance feels off, with specific numerical evidence
3. **Recommendations:** Concrete changes with specific new values
4. **Impact Projection:** What happens if your recommendations are implemented (show the math)
5. **Priority Ranking:** Which changes should be made first, ordered by impact

### Output Format
- Use tables for comparative analysis
- Show all formulas and calculations
- Provide specific numeric recommendations (not "increase slightly" but "change from X to Y")
- Flag any recommendations that would require code changes vs. config changes
- Identify any systems that are missing entirely (gaps in the game design)

---

## 24. CONSTRAINTS & DESIGN PRINCIPLES

When making recommendations, respect these constraints:

1. **Total tiles must equal 22,500** — if you increase one terrain type, decrease another
2. **XP curve exponent (2.5) should stay** — it's a deliberate design choice for steep progression
3. **Digger exponential decay formula should stay** — only the constants (200 cap, 0.008 decay) can be tuned
4. **Factory count affects map strategy** — fewer factories = more competition, more factories = more casual-friendly
5. **VIP must have meaningful advantage** — but not so much that free players can't compete
6. **The game must work for 500–2,000 concurrent players** — design for this range
7. **Auto-farm is a core feature** — not an exploit, but a designed monetization mechanic
8. **PvP must have risk** — attacking should cost resources even on loss
9. **The flag system is the primary PvP driver** — it should create conflict, not be ignorable
10. **Clans are endgame content** — territory, warfare, and perks should feel aspirational

---

## 25. FORMALIZED MATH SUMMARY

### Complete Formula Reference

**Harvest:**
```
base = randint(400, 750)
amount = floor(base × (1 + diggerBonus/100))
amount = floor(amount × multiplierService([VIP, Flag, Shrine]))
amount = floor(amount × balanceMultiplier)
```

**Digger Bonus:**
```
bonus = 200 × (1 - e^(-0.008n))
```

**Multiplier Stacking:**
```
raw = sum of bonuses
effective = Σ(tierPortion × tierEffectiveness)
multiplier = 1 + effective/100
```

**XP:**
```
xpForLevel(L) = floor(250 × L^2.5)
levelFromXP(X) = floor((X/250)^(1/2.5)) + 1
```

**Factory Defense:**
```
L1: 1000
L2+: (L-1)² × 50,000
```

**Factory Upgrade Cost:**
```
metal = floor(1000 × 1.5^targetLevel)
energy = floor(500 × 1.5^targetLevel)
```

**Factory Slots:**
```
maxSlots = 5000 + (level-1) × 500
regenRate = 416.67 + (level-1) × 41.67
```

**Factory Income:**
```
metalPerHour = level × 1000
energyPerHour = level × 500
```

**Player Power:**
```
power = 100 + (rank × 10) + totalStrength + (factoryCount × 50)
```

**PvP Damage:**
```
damage = max(5, attackerSTR - defenderDEF/2)
if levelGap > 20: damage × max(0.25, 1 - (levelGap-20)×0.05)
```

**PvP Burn:**
```
burned = floor(stolen × 0.20)
actualGain = stolen - burned
```

**Resource Decay:**
```
decay = min(floor((amount - 1000000) × 0.0025), 250000)
```

**Upkeep:**
```
overRatio = unitCount / supplyCap
multiplier = (1 + overRatio)^1.5
hourlyCost = unitCount × avgCost × 0.01 × multiplier
```

**Supply Cap:**
```
cap = 100 + (level × 10) + (factoryCount × 25)
```

**Army Balance:**
```
ratio = min(str,def) / max(str,def)
```

**Auto-Farm Timing:**
```
VIP: 200ms move + 800ms harvest + 300ms delay = ~1.3s/tile (~5.6h full map)
Basic: 200ms move + 800ms harvest + 500ms delay + 2000ms extra = ~3.5s/tile (~11.6h full map)
```

**Stamina:**
```
efficiency = 1.0 (<2K), 0.75 (<3K), 0.50 (<4K), 0.25 (4K+)
```

**Bot Power:**
```
botPower = botSTR + (botDEF × 0.5)
playerPower = (targetSTR × 0.5 + targetDEF) × balanceMultiplier
botRoll = botPower × (0.8 + rand×0.4)
```

**Territory Income:**
```
perTerritory = floor(1000 × (1 + (clanLevel-1) × 0.1))
```

**Referral Progressive:**
```
factor = min(1.05^(referralCount-1), 2.0)
reward = base × factor
```

---

*End of Research Prompt*
I w