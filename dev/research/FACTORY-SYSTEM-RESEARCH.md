# Deep Research Prompt: Factory System Redesign for DarkFrame

## What DarkFrame ACTUALLY Is

DarkFrame is a text-based browser MMO strategy game (Next.js + Supabase). Players interact entirely through clicking buttons and reading text results. There is no real-time action, no unit movement on a map, no combat animations. Combat is fully automated — player clicks "Attack", server calculates, displays text outcome.

**Core Loop:**
1. Move across 150×150 tile map (WASD/arrow keys)
2. Harvest resources on Metal/Energy tiles (G key, 400-750 per tile, 5-min cooldown)
3. Explore caves for items (F key, 1.5% drop rate, diggers go to inventory)
4. **Factory Loop**: Capture a factory → build units using slots → abandon factory → move to next factory → repeat
5. Players attack each other by visiting the tile where the other player's base is located and clicking Attack
6. Auto-farm automates map sweep in ~6 hours (VIP) or ~12 hours (basic)

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
- All factories take ~12 hours for full regen regardless of level

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

### Known Code Issues
1. `getFactoryDefense` code doesn't match its JSDoc comments
2. JSDoc total upgrade cost is wrong (says 169K, actual 112K)
3. 4 unused DB tables (factory_production_queue, factory_slots, factory_defense, unit_build_queue)
4. Release and Abandon endpoints do the same thing
5. No auth on /api/factory/attack and /api/factory/produce (takes username from body)
6. DB default defense (100) doesn't match getFactoryDefense(1) = 5,000
7. factory_count on players table is denormalized and manually maintained
8. Two production systems exist (one is broken — always makes T1_Rifleman)

## What We Need Solved

Given that factories are meant to be cycled through (capture → build → abandon → repeat) AND levels persist on the map, redesign the entire factory system. Consider:

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

## Constraints
- Text-based browser game — no real-time action, no combat animations
- Combat is automated calculation (click Attack → see text result)
- Auto-farm sweeps entire map in 6-12 hours
- Must work with Supabase (no complex server-side logic)
- Must support both PvE (bot factories) and PvP (player factories)
- Solo players and clans must both be viable
- Players attack each other by visiting tiles and clicking Attack
- Map: 22,500 tiles, 2,250 factories (10%)
- Base harvest: 400-750 per tile, 5-min cooldown per tile
- Digger sacrifice system provides permanent gathering bonuses (separate from factories)
- Factory level is PRESERVED when abandoned — the map's total capacity grows over time

## Desired Output
A complete factory system specification with specific formulas, numbers, and tables. The research should determine the best approach for a factory system designed around rapid capture-build-abandon cycling with persistent level upgrades in a text-based automated-combat browser MMO.
