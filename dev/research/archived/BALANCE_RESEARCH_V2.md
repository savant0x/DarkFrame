# DARK FRAME — GAME BALANCE & ENGAGEMENT LOOP RESEARCH

## Context
Dark Frame is a competitive MMO strategy game with auto-farm mechanics. The game has been live and players have already broken the economy — one player reached level 36 in a single session, accumulated 4M metal / 3M energy, built 710K STR / 830K DEF, and had a +973% gathering bonus from diggers. The game needs comprehensive rebalancing for long-term sustainability.

The developer's philosophy:
- P2W is acceptable and desired for monetization — VIP should be clearly valuable
- Diminishing returns over hard caps (always feel like you're progressing)
- Engagement loops should reward active play, not just passive auto-farming
- The shrine system should be a core engagement driver — time-limited boosts that require active cave exploration
- Diggers should be rare and special, not hundreds per day
- New mechanics should be fun and add engagement, not just restrictions

---

## Current Broken State

### Map & Harvest
- 150×150 map = 22,500 tiles
- 4,500 Metal + 4,500 Energy + 1,800 Cave + 450 Forest = 11,250 harvestable tiles per reset
- 2 resets per day (AM/PM) = ~22,500 harvest actions per day
- Base harvest: 800-1,500 per tile
- With current multipliers (VIP 2x × Flag 2x × Shrine 2x × diggers 10x+): ~21,000 per tile
- Daily income: ~193M+ resources for a full sweep

### Digger Problem
- 30% drop rate on caves/forests × 60% digger chance = ~400 diggers per reset
- ~800 diggers per day
- Diminishing returns are too generous: +0.1% per digger after 150 = unbounded
- Player reported +973% gathering bonus after one session

### XP/Level Problem
- 20 XP per harvest × 9,000 harvests = 180,000 XP per sweep
- Levels 1-30: 1,000 XP each (linear)
- Player reached level 36 in one session

### Tier Unlock Problem
- Total cost: 100 RP across all 5 tiers
- Harvest milestones give 6,000 RP per full day sweep
- All tiers unlock in one session

### Tech Tree Problem
- Costs: 5,000-75,000 RP per tech
- No level requirements
- All techs unlockable in 1-2 sessions
- UI shows metal costs, API charges RP (currency mismatch)
- 5 of 11 techs inaccessible via API

---

## Proposed Changes (Confirmed by Developer)

### 1. Shrine-Centric Engagement Loop
The shrine should be the PRIMARY engagement driver. Time-limited boosts that require active cave exploration create FOMO and keep players engaged.

**Cave/Forest Drop Rates (REVISED):**
- Drop rate: 2.5% (down from 30%)
- Of drops: 80% tradeable items, 20% diggers (flipped from current 60/40)
- Per reset: 2,250 cave/forest tiles × 2.5% = ~56 drops = ~45 tradeable + ~11 diggers
- Per day (2 resets): ~90 tradeable items, ~22 diggers

**Shrine Sacrifice Costs (REVISED):**
| Tier | Items | Duration | Yield Bonus | Farming Time |
|------|-------|----------|-------------|--------------|
| Spade | 2 items | 30 min | +25% | ~15 min |
| Heart | 5 items | 1 hour | +25% | ~30 min |
| Diamond | 12 items | 3 hours | +25% | ~1.5 hours |
| Club | 25 items | 6 hours | +25% | ~3 hours |

**Shrine Stacking (Diminishing):**
- 1st buff: +25% (full)
- 2nd buff: +20%
- 3rd buff: +15%
- 4th buff: +10%
- Max total: +70% (not +100%)

**Engagement loop:** ~90 tradeable items/day means a dedicated player can maintain 2-3 shrine buffs running most of the day. All 4 requires active play. When buffs expire, player feels the loss and goes back to caves.

### 2. Digger System — Rare & Special
Diggers should be exciting finds, not routine drops.

**Drop rates:** 2.5% cave drop × 20% digger chance = ~11 diggers per reset = ~22/day

**Bonus formula — Exponential Decay:**
```
Bonus = M × (1 - e^(-C×x))
Where M = 200% (asymptote), C = 0.008, x = diggers collected
```

| Diggers | Bonus |
|---------|-------|
| 5 | +4% |
| 10 | +8% |
| 22 (1 day) | +17% |
| 50 | +39% |
| 100 | 66% |
| 200 | 106% |
| 500 | 170% |
| 1000 | 196% (near cap) |

Each digger is exciting because it's rare. The first digger gives +0.8%, the 50th gives +0.3%, the 200th gives +0.04%.

### 3. Multiplier System — Additive with Diminishing Returns

**Current:** Multiplicative (VIP 2x × Flag 2x × Shrine 2x = 8.8x before diggers)

**Proposed:** Additive with soft diminishing returns per bonus source:
- First +100% of bonuses: full value
- Next +100%: 75% effectiveness
- Next +100%: 50% effectiveness
- Beyond +300%: 10% effectiveness per +100%

**VIP benefits (REVISED):**
- +50% resource yield (additive, down from 2x multiplicative)
- 2x auto-farm speed
- Better auto-farm tool (slower decay)
- Priority factory slots
- Advanced analytics dashboard
- Cosmetic perks (badge, title, base skins)
- 1.5x RP earning
- Remote auction house access

**Flag Bearer (REVISED):**
- +50% resource yield (down from 2x)
- 1.5x XP (down from 2x)
- 1.25x unit STR/DEF
- 1.5x bank/inventory capacity
- Auto-farm speed boost removed (too compounding)
- Still visible on map, still creates PvP focus

### 4. XP Curve — Polynomial Scaling

**Current:** 1,000 XP/level for levels 1-30, then ×1.1 per level

**Proposed:** `XP = 250 × L^2.5`

| Level | Cumulative XP | Estimated Time |
|-------|---------------|----------------|
| 5 | ~14K | Day 1 |
| 10 | ~79K | Week 1 |
| 20 | ~447K | Month 1 |
| 30 | ~1.23M | Month 2 |
| 40 | ~2.53M | Month 4 |
| 50 | ~4.42M | Month 6 |
| 60 | ~6.97M | Year 1 |
| 70 | ~10.3M | Year 1.5 |
| 80 | ~14.6M | Year 2 |
| 90 | ~20.0M | Year 3 |
| 100 | ~26.7M | Year 4+ |

**XP per harvest reduced from 20 to 3** — makes passive farming less dominant, shifts XP to active play (combat, exploration, achievements)

### 5. Tier Unlocks — Scaled Costs

**Current:** 0+5+15+30+50 = 100 RP total

**Proposed:**
| Tier | Level | RP Cost | Metal Cost |
|------|-------|---------|------------|
| 1 | 1 | 0 | 0 |
| 2 | 10 | 50 | 100K |
| 3 | 20 | 150 | 500K |
| 4 | 35 | 350 | 2.5M |
| 5 | 50 | 750 | 10M |
| **Total** | | **1,300 RP** | **13.1M metal** |

Hybrid costs (RP + metal) force strategic resource allocation. Can't just farm RP — need both.

### 6. Auto-Farm Maintenance System (NEW — Engagement Sink)

Auto-farm tool has a "condition" stat (0-100%):

**Decay:**
- Condition drops per tile harvested
- Basic tool: -0.05% per tile (breaks after ~2,000 tiles)
- Advanced tool: -0.02% per tile (breaks after ~5,000 tiles)
- Premium tool (VIP): -0.01% per tile (breaks after ~10,000 tiles)

**Speed impact (soft, never zero):**
- 100% condition = 100% speed
- 50% condition = 60% speed
- 10% condition = 20% speed
- 1% condition = 5% speed (can always crawl)

**Repair:**
- Costs metal + energy, scales exponentially with degradation
- Repair from 50%: ~50K metal + 25K energy
- Repair from 10%: ~500K metal + 250K energy
- Repair from 1%: ~2M metal + 1M energy
- Real-time repair: 10 minutes per 10% (or instant for premium currency)

**Tool tiers (progression):**
- Basic: Free, decays fast
- Advanced: 50K metal + 25K energy, decays 2.5x slower
- Premium: 500 RP, decays 5x slower, +10% speed bonus

This creates a constant metal/energy sink that scales with usage. Casual players repair occasionally. Hardcore players either pay for repairs or deal with slowing speeds.

### 7. Stamina System — Soft Diminishing (No Hard Cap)

**Current:** No stamina system

**Proposed:** Soft diminishing returns on harvest yield:
- First 2,000 actions: 100% yield
- Next 1,000 actions: 75% yield
- Next 1,000 actions: 50% yield
- Beyond 4,000: 25% yield (never hits zero)

No hard wall. Players can always farm, but efficiency drops. Casual players stay competitive. Hardcore players get marginal gains.

### 8. Unit Upkeep (NEW — Major Sink)

Every unit costs metal + energy per hour to maintain.

**Formula:**
```
hourly_upkeep = unit_count × base_cost × 0.01 × (1 + unit_count / supply_cap)^1.5
```

**Supply cap** determined by:
- Player level (base)
- Factory levels (bonus)
- Tech tree unlocks (bonus)
- Clan perks (bonus)

**Example:** Player with 500 units, 1,000 supply cap = ~0.7% of army value/hour
**Example:** Player with 5,000 units, 1,000 supply cap = ~112% of army value/hour (unsustainable)

Army size naturally limited by economic capacity. Small armies are free. Massive armies require massive resource generation.

### 9. PvP Resource Destruction (NEW — Sink)

When players attack each other:
- **Attack cost:** 1K metal + 1K energy per attack (even if you lose)
- **Resource destruction:** 20% of stolen resources are permanently burned
- **Unit destruction:** Destroyed units are permanently removed from the economy
- **Defense reward:** Successfully defending gives XP + small resource reward (funded by attacker's cost)

Every PvP battle is a net negative for the overall economy. Active PvP = faster resource burn.

### 10. Achievement System (NEW — Engagement & Rewards)

**Categories:**
- Harvest milestones (1K, 10K, 100K, 1M tiles harvested)
- Exploration (100 caves, 50 rare items, all monuments)
- Combat (10 wins, 5 factories, defeat flag bearer)
- Collection (50 diggers, 200 diggers, full inventory)
- Social (5 referrals, join clan, contribute 10K RP)
- Time (7-day streak, 30 days total, 100 flag challenges)
- Seasonal (harvest 1M this season, win 50 attacks this month)

**Rewards:**
- Small: Metal/energy, small XP boost
- Medium: RP, temporary buffs, cosmetics
- Large: Permanent stat boosts, unique cosmetics, titles, VIP days
- Prestige: Resettable seasonal rewards

### 11. Harvest Milestone RP (Reduced)

**Current:** 6,000 RP per full day (milestones at 1K, 2.5K, 5K, 10K, 15K, 22.5K harvests)

**Proposed:** 1,500 RP per full day (milestones at 2K, 5K, 10K, 20K harvests)
| Harvests | RP |
|----------|-----|
| 2,000 | 250 |
| 5,000 | 500 |
| 10,000 | 500 |
| 20,000 | 250 |

RP is now a premium currency earned through active achievements, not passive farming.

### 12. WMD System — Clan Endgame Sink

- 3 research tracks × 10 tiers = 30 techs
- Total RP: 2.7M per track (8.1M total)
- **NEW:** Building WMDs costs tens of millions of metal/energy per warhead
- **NEW:** Daily maintenance cost for stored WMDs
- **NEW:** WMDs are consumed on use (permanently deletes resources from economy)
- Requires clan coordination — multiple players must contribute

### 13. Referral System (Light Gating)

**Tiered rewards (not hard-gated):**
- Referred player reaches level 5: 10K metal, 5 RP (small)
- Referred player reaches level 15: 50K metal, 25 RP (medium)
- Referred player reaches level 25: 250K metal, 100 RP, 3 VIP days (large)

Anti-fraud via IP/device fingerprinting, not level gating. Rewards scale with referred player quality.

---

## Key Questions for Research

1. **Shrine engagement loop:** With ~90 tradeable items/day and shrine costs of 2-25 items, does this create a compelling daily loop? Should costs be adjusted? Should there be a daily shrine use limit?

2. **Digger rarity:** At ~22 diggers/day with exponential decay, does this feel rewarding enough? Should the first few diggers give a bigger bump? Should there be a "guaranteed digger" mechanic every N caves?

3. **Auto-farm maintenance:** Does the tool durability system feel like engaging maintenance or annoying busywork? Should repair be instant (for cost) or always take time?

4. **XP curve pacing:** Is level 50 in 6 months the right target? Should the curve be steeper or gentler? What's the right level cap?

5. **Tier unlock costs:** Are the hybrid RP+metal costs (1,300 RP + 13.1M metal total) appropriate? Should higher tiers require clan participation?

6. **Unit upkeep:** Does the exponential upkeep formula create the right army size limits? What's the "ideal" army size for a mid-game player?

7. **Stamina soft cap:** Does the 2,000/1,000/1,000/∞ structure feel right? Should the thresholds be different?

8. **VIP value:** With +50% resources (vs current 2x), 2x auto-farm speed, better tool, and cosmetics — is VIP still compelling enough to drive subscriptions?

9. **PvP destruction rate:** Is 20% resource burn per attack too high or too low? Does it discourage PvP or make it more meaningful?

10. **Achievement rewards:** Should achievements give permanent stat boosts (risk of power creep) or only temporary buffs and cosmetics?

11. **New mechanics to consider:**
    - Resource decay/rot on stored resources?
    - Seasonal resets for leaderboards?
    - Territory upkeep for individual players?
    - Tool upgrade progression (basic → advanced → premium → legendary)?
    - Cave difficulty tiers (harder caves = better drops)?
    - Shrine buffs that affect combat, not just harvesting?

12. **Overall economy health:** With all these changes, what's the expected resource accumulation rate per day? Is the ratio of faucets to sinks healthy for a 2-3 year game lifecycle?

13. **Addiction loops:** Beyond the shrine FOMO loop, what other daily/weekly/monthly loops should exist? What creates the "just one more run" feeling?

14. **Competitive balance:** With these changes, what's the expected power difference between a F2P player and a VIP player at 1 month, 3 months, 6 months? Is the gap fair but noticeable?