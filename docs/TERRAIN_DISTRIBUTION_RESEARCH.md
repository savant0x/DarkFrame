# DarkFrame — Terrain Distribution Research Prompt

> Use this prompt to get a second opinion on map seeding optimization.
> Share this with another AI or researcher to validate the terrain distribution.

---

## Game Context

DarkFrame is a 150×150 tile browser strategy game (22,500 total tiles). Players move around the map harvesting resources, building armies, capturing factories, and competing for a flag. The game economy must be carefully balanced so that:
- Early players can progress without being overwhelmed
- Late-game players have meaningful decisions about where to expand
- Resources flow at a rate that sustains engagement without causing hyperinflation
- The map feels varied and strategic, not monotonous

---

## Current Terrain Distribution

| Terrain | Count | % of Map | Purpose |
|---------|-------|----------|---------|
| Wasteland | 9,000 | 40.0% | Empty/filler terrain, no resources |
| Metal | 2,250 | 10.0% | Primary resource (metal) |
| Energy | 2,250 | 10.0% | Primary resource (energy) |
| Cave | 450 | 2.0% | Loot drops (diggers, tradeables, rare items) |
| Forest | 225 | 1.0% | Secondary loot (diggers, tradeables) |
| Factory | 225 | 1.0% | Strategic buildings (unit production, territory control) |
| Bank | 4 | 0.018% | Resource storage/exchange |
| Shrine | 1 | 0.004% | Central buff location |
| Auction House | 1 | 0.004% | Player trading hub |

**Total: 22,500 tiles**

---

## Key Questions for Optimization

### 1. Wasteland Ratio (40%)
- **Is 40% too high?** Players may feel like they're wandering through empty space too much.
- **Is 40% too low?** Resources may be too abundant, causing inflation.
- **Consideration:** Wasteland creates "travel time" between points of interest. Too little = everything is clustered. Too much = boring exploration.
- **Question:** What percentage of empty/filler terrain creates the best balance between exploration feel and resource accessibility?

### 2. Resource Tile Balance (Metal + Energy = 20%)
- **Current:** Equal split (10% each). Is this the right ratio?
- **Consideration:** Metal is used for unit production. Energy is used for research and upkeep. If one is more valuable, should it be rarer?
- **Question:** Should Metal and Energy have different frequencies based on their economic roles?

### 3. Cave vs Forest (2% vs 1%)
- **Current:** Caves are 2x more common than Forests.
- **Consideration:** Caves drop diggers (permanent gathering bonuses). Forests drop tradeables. Which should be rarer?
- **Question:** Is the 2:1 ratio correct, or should Forests be equally rare (or rarer) since tradeables have different economic value than diggers?

### 4. Factory Density (1% = 225 factories)
- **Current:** 225 factories across 22,500 tiles = 1 per 100 tiles.
- **Consideration:** Factories are the primary PvP objective. Too many = no competition. Too few = stagnant map.
- **Question:** What factory density creates healthy competition? Should factories cluster in certain regions or be evenly distributed?

### 5. Special Locations (Bank/Shrine/AuctionHouse)
- **Current:** 6 total special tiles (0.027% of map).
- **Consideration:** These are unique, single-location tiles. The Shrine at (1,1) is the central buff location. Banks at 4 corners. Auction House near center.
- **Question:** Are there enough special locations? Should there be more Banks for resource security? Should the Shrine location be more central or more contested?

### 6. Map Region Design
- **Current:** Pure random distribution. No regional clustering.
- **Consideration:** Should certain terrain types cluster? For example:
  - Metal-rich regions in one quadrant
  - Factory-dense "war zones"
  - Cave-heavy "exploration regions"
  - Forest clusters near water/rivers
- **Question:** Would regional clustering create more interesting strategic decisions, or should the map remain uniformly random?

### 7. Player Spawn Distribution
- **Current:** Players spawn at random Wasteland tiles.
- **Question:** Should spawns be guaranteed near certain terrain types? Should there be a minimum distance between spawns to prevent early-game griefing?

### 8. Resource Regeneration
- **Current:** Tiles can be harvested once per reset period (AM/PM cycle).
- **Question:** Should certain terrain types regenerate faster? Should Wasteland tiles have a small chance to "transform" into resource tiles over time?

---

## Economic Parameters to Validate

| Parameter | Current Value | Question |
|-----------|--------------|----------|
| Base harvest (Metal/Energy) | 400-750 per tile | Is this the right range for early/mid/late game? |
| Digger drop chance | 2.5% per cave | Too high? Too low? Should it scale with player level? |
| Digger bonus cap | 200% | Should this be higher/lower? |
| XP per harvest | 3 | Is this enough to feel rewarding? |
| XP curve | 250 × L^2.5 | Does this create meaningful progression milestones? |
| Factory defense (L1) | 1,000 | Is this accessible for new players to capture? |
| Factory slots (L1) | 5,000 | Is this the right starting capacity? |
| PvP burn rate | 20% | Does this sufficiently drain the economy? |
| Resource decay | 0.25% daily above 1M | Is this aggressive enough to prevent hoarding? |

---

## Desired Outcomes

1. **Early game (Levels 1-10):** Players should be able to harvest ~50-100 tiles per session, earn enough metal/energy to build a small army, and reach level 10 within 3-5 days of regular play.

2. **Mid game (Levels 11-30):** Players should need to strategically choose which tiles to harvest, compete for factories, and make meaningful decisions about army composition. Should take 2-4 weeks to reach level 30.

3. **Late game (Levels 31-50+):** Players should be deeply engaged in PvP, territory control, and economic optimization. Should take 1-3 months to reach level 50.

4. **Economy:** Resources should flow in (harvesting) and out (upkeep, decay, PvP burn) at rates that prevent both scarcity and hyperinflation. The total money supply should grow slowly over time.

5. **Map Feel:** The map should feel varied and strategic. Players should have reasons to travel to different regions. Special locations should feel special and contested.

---

## Specific Questions for Researcher

1. Is the 40% Wasteland ratio optimal, or should it be adjusted? What's the ideal "filler" percentage for a strategy game map?

2. Should Metal and Energy have different frequencies, or is the 10/10 split correct?

3. Is 1% factory density (225 factories) appropriate for a game targeting 100-1000 concurrent players?

4. Should the map use regional clustering or pure random distribution? What are the tradeoffs?

5. Are the economic parameters (harvest amounts, XP curve, decay rates) balanced for the desired progression timeline?

6. What terrain distribution would create the most engaging gameplay loop for a resource-gathering strategy game?

7. Should there be any "safe zones" or "contested zones" built into the map layout?

8. How should special locations (Shrine, Banks, Auction House) be positioned for maximum strategic value?
