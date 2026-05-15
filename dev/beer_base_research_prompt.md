# 🍺 Beer Base System — Deep Research Prompt

## Game Context

**DarkFrame** is a top-down 2D persistent browser strategy game. The map is 150×150 tiles with terrain types (Wasteland, Metal, Energy, Cave, Forest, Factory, Bank, Shrine, AuctionHouse). Players build factories, produce armies, harvest resources, and compete for map control.

## The Beer Base Concept

Beer Bases are **NPC bot bases** that function as **"loot boxes on the map"** — PvE targets players can discover and attack for large resource payouts without harming real players. They provide a safe alternative to PvP for resource acquisition and serve as the primary PvE combat content.

## Current System (Already Implemented)

### Storage
- Beer bases are stored as `players` table rows with `is_bot: true, is_special_base: true`
- They have coordinates (`current_x, current_y`) marking their map position
- They spawn on **Wasteland** terrain tiles only

### Power Tiers & Scaling
```
WEAK:     2x resource multiplier,   low STR/DEF,   low level
MID:      3x resource multiplier,   medium STR/DEF
STRONG:   5x resource multiplier,   high STR/DEF
ELITE:    8x resource multiplier,   very high STR/DEF
ULTRA:    12x resource multiplier,  extreme STR/DEF
LEGENDARY: 20x resource multiplier,  maximum STR/DEF
```

Higher tiers are exponentially harder but give proportionally more loot. Tier determines resources carried, STR/DEF stats, player level needed to challenge.

### Smart Spawning Algorithm
- Analyzes active player levels (last 7 days, 15-min cache)
- Tier mapping: Low (1-9), Mid (10-19), High (20-29), Elite (30+)
- Spread: 40% same tier, 30% one up, 10% one down, 20% two up
- Total beer base count = 5-10% of regular bot population
- Safety caps: max 1000 total, max 100 spawned per cycle, 10% of totalBotCap
- Admin-configurable spawn rate and respawn schedule (default: weekly)

### Bot Specializations
6 types with different behaviors (already in code):
- **Hoarder** (25%): High resources, low defense, stationary
- **Fortress** (20%): High defense, low resources, stationary
- **Raider** (25%): Aggressive, mobile, attacks frequently
- **Ghost** (15%): Teleports randomly, high resources
- **Balanced** (15%): Standard stats, moderate movement

### Existing Artwork
- Player bases: `bases/rank1-10/base.png` (rank-based player base buildings)
- Tile bases: `tiles/bases/1-10.jpg` (base overlays for map tiles)
- Factories: `factories/level1-10/factory.png` (level-based factory buildings)
- **Unused artwork** awaiting gameplay integration:
  - `tiles/ancient_forge/` — Ancient Forge location
  - `tiles/grand_temple/` — Grand Temple location
  - `tiles/market_plaza/` — Market Plaza location
  - `tiles/research_lab/` — Research Lab location
  - `tiles/vault/` — Vault location
  - `tiles/war_memorial/` — War Memorial location

## What's Missing (What We Need To Design)

### 1. Tile-Level Interaction
When a player moves to a tile where a beer base is located, they should see:
- Beer base artwork (tier-appropriate) instead of the underlying wasteland terrain
- Beer base name, tier badge, STR/DEF stats, resource value
- An **Attack** button to engage the base

### 2. Combat System Integration
Players have armies built from factories. The army system uses 4 archetypes:
- **Striker**: High offense, counters Bulwarks (130% damage)
- **Bulwark**: High defense, frontline tanks
- **Artillery**: Strikes Support units first (disrupts multipliers)
- **Support**: Amplifies STR/DEF of other units (max +60%)

**Needs design:**
- How should player army power be calculated against beer base STR/DEF?
- Should the intransitive combat system apply to beer base attacks?
- What determines victory — pure stat comparison, probabilistic, or multi-round combat?

### 3. Attack Flow
- Player clicks "Attack" on beer base tile
- Server validates player has units (from player_units table)
- Combat resolves using player's army vs beer base's STR/DEF
- Result determines loot/resources gained
- Cooldown before same base can be attacked again
- Different tiers should have different cooldowns

### 4. Loot & Economy
- Defeating a beer base should give: Metal, Energy, maybe Research Points
- Higher tiers = exponentially better loot
- Potential for bonus loot from specializations (Hoarder = more resources, Fortress = more defense XP, etc.)
- Loot should feel rewarding but not replace PvP or harvesting
- Anti-farming mechanics (cooldowns, diminishing returns)

### 5. Defeat & Respawn
- When a beer base is defeated: player gets loot, base is removed/defeated
- Defeated bases respawn on weekly schedule (admin-configurable)
- Defeated bases could leave behind a "ruins" tile state
- Beer Base analytics track: spawns, defeats, loot distributed, survival time

### 6. Tier-Based Visual Design
- Each of the 6 power tiers should look distinct on the map
- Weak bases: small, ramshackle
- Legendary bases: imposing, glowing, massive
- Consider using the existing `tiles/bases/1-10.jpg` artwork mapped to tiers
- Or the unused location artwork (`ancient_forge`, `grand_temple`, etc.) as special high-tier bases

### 7. Risk vs Reward Design
- **Weak**: Very easy, low resources (good for new players learning combat)
- **Mid**: Moderate challenge, decent payout
- **Strong**: Hard fight, very good loot
- **Elite**: Very hard, excellent loot
- **Ultra**: Extreme difficulty, massive payout
- **Legendary**: Endgame challenge, game-changing loot

### 8. Balance Considerations
- How many beer bases should exist relative to player population?
- What's the optimal time investment vs reward ratio?
- How do beer bases interact with the balance system (STR/DEF ratio penalties)?
- Should VIP or Flag Bearer status affect beer base loot?

## Design Goals

1. **Excitement**: Finding a beer base should feel like discovering treasure
2. **Risk/Reward**: Higher tiers should be tempting but dangerous
3. **Accessibility**: New players should be able to challenge weak bases
4. **Depth**: Experienced players should strategize about which tiers to tackle
5. **Economy**: Beer bases should be a significant but controlled resource source
6. **Performance**: System must handle up to 1000 concurrent bases efficiently

## Deliverable

Please provide:
1. Complete combat resolution formula for player army vs beer base
2. Loot table and scaling formulas per tier
3. Cooldown and anti-farming system design
4. Tier-based visual design recommendations (mapping tiers to existing assets)
5. Attack flow sequence (client → server → combat → result)
6. Economy impact analysis (how beer base loot affects the game economy)
7. Integration considerations for the intransitive combat system (Striker → Bulwark → Artillery → Support)
