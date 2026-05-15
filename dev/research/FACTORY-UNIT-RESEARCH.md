# Deep Research Prompt: Factory & Unit System Redesign for DarkFrame

## What DarkFrame ACTUALLY Is

DarkFrame is a text-based browser MMO strategy game (Next.js + Supabase). Players interact entirely through clicking buttons and reading text results. There is no real-time action, no unit movement on a map, no combat animations. Combat is fully automated — player clicks "Attack", server calculates, displays text outcome.

**Core Loop:**
1. Move across 150×150 tile map (WASD/arrow keys)
2. Harvest resources on Metal/Energy tiles (G key, 400-750 per tile, 5-min cooldown)
3. Explore caves for items (F key, 1.5% drop rate, diggers go to inventory)
4. **Factory Loop**: Capture a factory → build units using slots → abandon factory → move to next factory → repeat
5. Factory levels are PRESERVED when abandoned — the map's total capacity grows over time
6. Players attack each other by visiting the tile where the other player's base is located and clicking Attack
7. Auto-farm automates map sweep in ~6 hours (VIP) or ~12 hours (basic)

## CRITICAL GAMEPLAY MECHANIC: Factory Cycling + Persistent Upgrades

The intended factory gameplay has TWO layers:

### Layer 1: Player Cycling (Temporary Ownership)
Players constantly cycle through factories:
1. Find an uncaptured (or enemy) factory
2. Attack and capture it
3. Build units using the factory's slots
4. Abandon the factory once slots are full
5. Move to the next factory and repeat

Factories are TEMPORARY production sites. The capture-abandon cycle should be fast and frictionless. Players might cycle through DOZENS of factories per play session.

### Layer 2: Map-Wide Progression (Permanent Upgrades)
When a player abandons a factory, the LEVEL IS PRESERVED. The factory does NOT reset to level 1.

This means:
- As the game progresses, more and more factories on the map are at higher levels
- Higher level factories have MORE slots, so players can build MORE units per capture
- The map's TOTAL factory capacity grows over time as players upgrade factories
- A factory that was upgraded to L5 by Player A, then abandoned, is still L5 when Player B captures it
- Over time, the map becomes more powerful — late-game players can build massive armies quickly because there are many high-level factories available
- This creates a natural progression curve: early game = few slots per factory, late game = many slots per factory

### Combined Effect
- Early game: Players capture L1 factories (5,000 slots), build small armies, abandon, repeat
- Mid game: Some factories have been upgraded to L3-L5 (6,000-7,000 slots), players can build larger armies per cycle
- Late game: Many factories at L7-L10 (8,000-9,500 slots), players can build massive armies quickly
- The map itself becomes more powerful over time as a collective result of all players upgrading factories

## Current Factory System — Complete Data

### Map Distribution
- 22,500 total tiles (150×150)
- 2,250 Factory tiles (10%)
- 5,625 Metal, 3,350 Energy, 1,350 Cave, 450 Forest, 9,345 Wasteland, 1 Shrine, 1 AuctionHouse, 8 Banks

### Factory Defense
Formula: `defense = level² × 5,000`

| Level | Defense |
|-------|---------|
| 1 | 5,000 |
| 2 | 20,000 |
| 3 | 45,000 |
| 4 | 80,000 |
| 5 | 125,000 |
| 6 | 180,000 |
| 7 | 245,000 |
| 8 | 320,000 |
| 9 | 405,000 |
| 10 | 500,000 |

Every factory at the same level has IDENTICAL defense. No variation.

### Factory Capture
- `successChance = min(0.90, playerPower / factoryDefense)`
- `playerPower = 100 + (rank × 10) + total_strength + (factory_count × 50)`
- 5-minute cooldown per factory per player
- Lucky strike: L1 factory + player power ≤ 200 = 5-15% auto-success chance
- Max 10 factories per player
- On capture: owner set, used_slots reset to 0, slots set to max for level

### Factory Slots & Regen
- `maxSlots = 5,000 + (level - 1) × 500`
- `regenRate = 416.67 + (level - 1) × 41.67 slots/hour`
- Balance penalty: 85%-100% regen speed based on army STR/DEF ratio

| Level | Max Slots | Regen/Hour |
|-------|-----------|------------|
| 1 | 5,000 | 416.67 |
| 5 | 7,000 | 583.33 |
| 10 | 9,500 | 791.67 |

### Factory Upgrade Costs
`Metal = 1,000 × 1.5^nextLevel`, `Energy = 500 × 1.5^nextLevel`, `RP = 25`

| Upgrade | Metal | Energy | Cumulative Metal |
|---------|-------|--------|-----------------|
| 1→2 | 1,500 | 750 | 1,500 |
| 2→3 | 2,250 | 1,125 | 3,750 |
| 3→4 | 3,375 | 1,688 | 7,125 |
| 4→5 | 5,063 | 2,531 | 12,188 |
| 5→6 | 7,594 | 3,797 | 19,781 |
| 6→7 | 11,391 | 5,695 | 31,172 |
| 7→8 | 17,086 | 8,543 | 48,258 |
| 8→9 | 25,629 | 12,814 | 73,887 |
| 9→10 | 38,443 | 19,222 | 112,330 |

### Passive Factory Income
- `metalPerHour = level × 1,000`
- `energyPerHour = level × 500`
- Minimum collection interval: 1 minute

### Factory Stats Bonus
- `strengthBonus = level × 5%` (owner's army gets +STR% per factory level)
- `defenseBonus = level × 5%` (owner's army gets +DEF% per factory level)

## Current Unit System — Complete Data

### Unit Count: 65 Types

**Tier 1** (Level 1+, 0 RP, Slot Cost 100):
- STR: Rifleman(5), Scout(8), Grenadier(12), Sniper(15)
- DEF: Bunker(5), Barrier(8), Turret(12), Shield(15)
- Costs: 200-500 Metal, 100-250 Energy

**Tier 2** (Level 5+, 5 RP, Slot Cost 300):
- STR: Commando(30), Ranger(40), Assassin(50), Demolisher(60)
- DEF: Fortress(30), Barricade(40), Cannon(50), Sentinel(60)
- Costs: 1,200-2,400 Metal, 600-1,200 Energy

**Tier 3** (Level 10+, 15 RP, Slot Cost 700):
- STR: Striker(90), Raider(105), Enforcer(120), Warlord(135)
- DEF: Citadel(90), Bulwark(105), Artillery(120), Guardian(135)
- Costs: 3,600-5,400 Metal, 1,800-2,700 Energy

**Tier 4** (Level 20+, 30 RP, Slot Cost 1,500):
- STR: Titan(180), Juggernaut(210), Destroyer(240), Annihilator(270)
- DEF: Stronghold(180), Rampart(210), Dreadnought(240), Colossus(270)
- Costs: 7,200-10,800 Metal, 3,600-5,400 Energy

**Tier 5** (Level 30+, 50 RP, Slot Cost 3,000):
- STR: Overlord(360), Conqueror(420), Devastator(480), Apocalypse(540)
- DEF: Bastion(360), Monolith(420), Leviathan(480), Immortal(540)
- Costs: 14,400-21,600 Metal, 7,200-10,800 Energy

**Specialized** (Level 15+, 25 RP, mastery-gated, Slot Cost 200-500):
- Offensive: Vanguard(200 STR), Berserker(280), Executioner(360), Annihilator(480), Warmonger(620)
- Defensive: Guardian(200 DEF), Fortress(280), Citadel(360), Bulwark(480), Invincible(620)
- Tactical: Striker(120/120), TacVanguard(160/160), Elite(210/210), Commander(280/280), Supreme(360/360)
- Costs: 4,000-16,000 Metal, 2,000-8,000 Energy

**Prestige** (Achievement unlocks, various slot costs 6-700):
- Various STR/DEF combinations from 400-1,000
- Costs: 20,000-35,000 Metal, 15,000-25,000 Energy

### Tier Unlock Requirements
| Tier | Level | RP | Metal |
|------|-------|----|-------|
| 1 | 1 | 0 | 0 |
| 2 | 10 | 50 | 100,000 |
| 3 | 20 | 150 | 500,000 |
| 4 | 35 | 350 | 6,000,000 |
| 5 | 50 | 750 | 30,000,000 |

### Cost-Per-STR Analysis
T1 Sniper: 500M / 15 STR = 33.3 metal/STR
T3 Warlord: 5,400M / 135 STR = 40 metal/STR
T5 Apocalypse: 21,600M / 540 STR = 40 metal/STR

Cost-per-STR is roughly constant across all tiers. Higher tiers are just "bigger numbers."

### XP Level Curve
`XP for level L = 250 × L^2.5`
- L5: ~17,678 XP | L10: ~79,057 XP | L20: ~447,214 XP | L50: ~4,419,417 XP

### Balance Effects
- `gatheringMultiplier = 0.75 + 0.35 × ratio` (ratio = STR/(STR+DEF))
- `powerMultiplier`: 0.5x to 1.1x based on balance
- `slotRegenMultiplier`: 0.85x to 1.0x based on balance

### PvP Combat
- Fully automated calculation
- Player visits opponent's base tile → clicks Attack → sees text result
- Compares total STR vs total DEF
- No unit matchups, no counters, no tactical choices beyond "build more STR"

### Two Production Systems Exist
1. **`build-unit` API** (correct): Uses UNIT_CONFIGS, proper costs, proper slot consumption
2. **`produceUnit` API** (broken): Always makes T1_Rifleman, costs 100M+50E, increments slots by 1

## What We Need Solved

Given that factories are meant to be cycled through (capture → build → abandon → repeat) AND levels persist on the map, redesign both the factory system and unit building system.

### Factory System Questions:
- How should factory defense scale across 10 levels?
- Should factories have any variation at the same level? (Types, traits, terrain bonuses?)
- How should terrain interact with factories?
- What's the right slot/capacity system for unit production?
- How should passive income scale?
- What should factory upgrades cost and require?
- How should capture mechanics work for different level gaps?
- What makes factory capture strategically interesting in a text-based game with automated combat?
- Should there be a max factories per player? Currently 10.
- How does the capture-abandon loop interact with PvP?
- How should the map's growing capacity be balanced over time?

### Unit System Questions:
- How many unit types should there be? (Currently 65)
- What roles should units have?
- How should unit costs scale across tiers?
- How can PvP combat involve tactical depth without real-time gameplay?
- How should the production system work? (One system, not two)
- How could unit veterancy/experience work?
- What should prestige/achievement units offer?
- How should the slot/capacity system interact with unit types?

## Constraints
- Text-based browser game — no real-time action, no combat animations
- Combat is automated calculation (click Attack → see text result)
- Auto-farm sweeps entire map in 6-12 hours
- Must work with Supabase (no complex server-side logic)
- Must support both PvE (bot factories) and PvP (player factories)
- Solo players and clans must both be viable
- Players attack each other by visiting tiles and clicking Attack
- Players cycle through factories (capture → build → abandon → repeat)
- Factory levels persist when abandoned — map capacity grows over time
- Factory slots limit units per capture: 5,000 (L1) to 9,500 (L10)
- Base harvest: 400-750 per tile, 5-min cooldown per tile
- Digger sacrifice system provides permanent gathering bonuses (separate from factories)

## Desired Output
Complete specifications for BOTH systems with specific formulas, numbers, and tables. The research should determine the best approach for making factories and unit building strategically interesting in a text-based automated-combat browser MMO where players cycle through factories to build armies.
