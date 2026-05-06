# DARK FRAME — COMPLETE GAME BALANCE & DESIGN AUDIT

## Instructions
You are a senior game economy designer and systems balancer. Analyze the following game mechanics in extreme detail and provide comprehensive recommendations for long-term balance, player retention, addiction loops, and sustainable progression. Consider:
- The game is a competitive MMO strategy game with auto-farm mechanics
- Players can play 24/7 with auto-farm, sweeping the entire map twice daily
- The game has monetization through VIP subscriptions and referrals
- The target audience is competitive players who want long-term progression
- The game should remain engaging for months/years, not just days

---

## 1. MAP & TERRAIN

**Map:** 150×150 = 22,500 tiles

| Terrain | Count | % |
|---------|-------|---|
| Metal | 4,500 | 20% |
| Energy | 4,500 | 20% |
| Cave | 1,800 | 8% |
| Forest | 450 | 2% |
| Factory | 2,250 | 10% |
| Wasteland | 9,000 | 40% |
| Bank | 4 | Fixed |
| Shrine | 1 | Fixed at (1,1) |
| Auction House | 1 | Fixed at (10,10) |

**Reset System:** 2 resets per day
- Tiles x=1-75 reset at midnight (00:00)
- Tiles x=76-150 reset at noon (12:00)
- Each tile can be harvested once per reset period per player
- Total harvests per full map sweep: ~9,000 (4,500 metal + 4,500 energy) + ~2,250 cave/forest
- Total harvests per day (2 resets): ~18,000 resource tiles + ~4,500 cave/forest

---

## 2. RESOURCE ECONOMY

### Base Harvest
- Metal/Energy: 800-1,500 per tile (random uniform)
- Cave/Forest: Same base, but 30% chance of item drop instead of resources

### Harvest Formula
```
finalAmount = base × (1 + diggerBonus/100 + shrineBonus/100) × vipMultiplier × flagBearerMultiplier × balanceMultiplier
```

### Digger System (Diminishing Returns)
| Digger # | Bonus Each |
|----------|-----------|
| 1-10 | +2.0% |
| 11-30 | +1.0% |
| 31-70 | +0.5% |
| 71-150 | +0.25% |
| 151+ | +0.1% |

Max from 150 diggers (one type): 80%
Universal diggers count for BOTH metal and energy.

**Current Problem:** Players report +973% gathering bonus. This means ~400+ diggers collected. With 2,250 cave/forest tiles giving 30% drop rate, and ~20% of drops being diggers, a full map sweep yields ~135 diggers per reset, ~270 per day. Over several days, bonuses stack extremely high.

### Multiplier Stacking
- VIP: 2x resources
- Flag Bearer: 2x resources
- Shrine: up to +100% (4 tiers × 25%)
- Balance bonus: up to +10%
- **Maximum theoretical multiplier: 2 × 2 × 2 × 1.1 = 8.8x base, PLUS digger bonuses**

### Real-World Example (Reported by Player)
- Gathering bonus: +973.75% (metal), +948.5% (energy)
- Flag Bearer: +100%
- Expected per tile: ~21,475 metal or ~20,970 energy
- Per full sweep (4,500 metal tiles): ~96.6 million metal
- Per day (2 resets): ~193 million metal
- Player reported accumulating 4M metal and 3M energy in a single session (partial sweep)

---

## 3. XP & LEVELING

### XP Per Action
| Action | XP |
|--------|-----|
| Harvest Resource | 20 |
| Cave Exploration | 30 |
| Rare Item | 50 |
| Legendary Item | 100 |
| Factory Capture | 200 |
| Unit Build | 10 |
| Shrine Sacrifice | 40 |
| Attack Win | 300 |
| Base Attack Win | 400 |
| First Login | 200 |
| Daily Login | 20 |

### Level Curve
```
Levels 1-30: 1,000 XP per level (linear)
Level 31+: Previous × 1.1 (gentle exponential)
```

| Level | Total XP |
|-------|----------|
| 5 | 4,000 |
| 10 | 9,000 |
| 20 | 19,000 |
| 30 | 29,000 |
| 35 | ~47,737 |
| 40 | ~52,295 |

**Current Problem:** 20 XP per harvest × 9,000 harvests per sweep = 180,000 XP per sweep. Player can reach level 30+ in a single session. Level 36 was reached in one day of auto-farming.

### RP Earning
- Level ups: 1 RP per level
- Harvest milestones (daily):
  - 1,000 harvests: 500 RP
  - 2,500: 750 RP
  - 5,000: 1,000 RP
  - 10,000: 1,500 RP
  - 15,000: 1,250 RP
  - 22,500: 1,000 RP
  - **Total: 6,000 RP per full day**
- VIP bonus: 1.5x RP
- Referral rewards: 15-3,000 RP per referral

---

## 4. TIER UNLOCKS

| Tier | Level Required | RP Cost |
|------|---------------|---------|
| 1 | 1 | 0 |
| 2 | 5 | 5 |
| 3 | 10 | 15 |
| 4 | 20 | 30 |
| 5 | 30 | 50 |
| **Total** | | **100 RP** |

**Current Problem:** 100 RP total to unlock all tiers. A single map sweep earns 6,000+ RP from milestones alone. All tiers unlock trivially in one session.

---

## 5. UNIT PRODUCTION

### Unit Costs & Stats (abbreviated — 56 units across 5 tiers)

**Tier 1 (Level 1+):** 200-500 metal, 100-250 energy, 5-15 STR/DEF per unit
**Tier 2 (Level 5+, 5 RP):** 1,200-2,400 metal, 600-1,200 energy, 30-60 STR/DEF
**Tier 3 (Level 10+, 15 RP):** 3,600-5,400 metal, 1,800-2,700 energy, 90-135 STR/DEF
**Tier 4 (Level 20+, 30 RP):** 7,200-10,800 metal, 3,600-5,400 energy, 180-270 STR/DEF
**Tier 5 (Level 30+, 50 RP):** 14,400-21,600 metal, 7,200-10,800 energy, 360-540 STR/DEF

**Specialized Units (Level 15+, 25 RP):** Various costs, 200-620 STR/DEF
**Prestige Units (Achievement):** 20,000-35,000 metal, 400-1,000 STR/DEF

**Current Problem:** With 4M metal, a player can build ~220 T5 units (79,200 STR) or ~4,000 T2 units (120,000 STR). The reported 710K STR / 830K DEF army is achievable in one session. No production caps or meaningful gating.

---

## 6. TECH TREE

### Core Techs (6 nodes)
| Tech | Cost | Research Time | Prerequisites | Effects |
|------|------|---------------|---------------|---------|
| Troop Transport | 10,000 RP | 300s | None | Movement 1→5, fast travel |
| Advanced Mining | 5,000 RP | 180s | None | +25% harvest speed, +10% yield |
| Fortification | 8,000 RP | 240s | None | +15% defense, reduced raid damage |
| Tactical Warfare | 12,000 RP | 360s | fortification | +20% attack, crit chance |
| Factory Automation | 15,000 RP | 420s | advanced-mining | -30% production, +2 queue slots |
| Reconnaissance | 6,000 RP | 200s | None | Reveal enemies, view unit counts |

### Bot Hunter Branch (5 nodes — INACCESSIBLE via API bug)
| Tech | Cost | Prerequisites | Effects |
|------|------|---------------|---------|
| Bot Hunter | 5,000 RP | None | Scanner, 50 tile, 1hr CD, +25% loot |
| Advanced Tracking | 15,000 RP | bot-hunter | 100 tile, 30min CD, +75% loot |
| Bot Magnet | 30,000 RP | advanced-tracking | Attract bots, 7d dur / 14d CD |
| Bot Concentration Zones | 35,000 RP | bot-magnet | 3 zones, 70% spawn rate |
| Bot Summoning Circle | 75,000 RP | bot-concentration-zones | Spawn 5 bots, 1.5x resources, 7d CD |
| Fast Travel Network | 50,000 RP | bot-summoning-circle | 5 waypoints, 12h CD |

**Current Problems:**
1. Tech costs (5K-75K RP) are trivial when a single sweep earns 6,000+ RP
2. No level requirements on tech nodes — only tier prerequisites
3. UI shows costs as "Metal" but API charges RP (currency mismatch)
4. 5 of 11 techs are inaccessible via the API (bot-hunter branch missing from API)
5. All techs can be unlocked in 1-2 sessions

---

## 7. SHRINE SYSTEM

### Sacrifice Tiers
| Tier | Item Cost | Duration | Yield Bonus |
|------|-----------|----------|-------------|
| Spade | 3 tradeable items | 1 hour | +25% |
| Heart | 10 tradeable items | 1 hour | +25% |
| Diamond | 30 tradeable items | 4 hours | +25% |
| Club | 60 tradeable items | 8 hours | +25% |

- Max 4 simultaneous boosts = +100% yield
- Rarity-to-duration: Common=15min, Uncommon=30min, Rare=1hr, Epic=1.5hr, Legendary=2hr
- Max cap: 8 hours per buff
- Location: Shrine at (1,1) — must be physically present

**Current Problem:** With 450 forest tiles + 1,800 cave tiles, players accumulate tradeable items rapidly. Sacrificing 60 items for 8 hours of +25% is trivial when you find hundreds of items per sweep.

---

## 8. VIP SYSTEM

### Pricing
| Plan | Price | Duration | $/day |
|------|-------|----------|-------|
| Weekly | $9.99 | 7 days | $1.43 |
| Monthly | $24.99 | 30 days | $0.83 |
| Quarterly | $64.99 | 90 days | $0.72 |
| Biannual | $119.99 | 180 days | $0.67 |
| Yearly | $199.99 | 365 days | $0.55 |

### VIP Benefits
- 2x resource multiplier on all harvests
- 1.5x RP earning multiplier
- Faster auto-farm (~3x speed: 1.3s/tile vs 3.5s/tile)
- Priority factory slots (5 simultaneous)
- Advanced battle analytics
- VIP shop access
- Unique badge/title
- 25% faster research speed

### Auto-Farm Speeds
| Mode | Time Per Tile | Full Map Time |
|------|--------------|---------------|
| Non-VIP | ~3.5 seconds | ~11.6 hours |
| VIP | ~1.3 seconds | ~5.6 hours |
| VIP + Flag Bearer | ~0.87 seconds | ~3.7 hours |

**Current Problem:** VIP + Flag Bearer + auto-farm can sweep the entire map in ~3.7 hours, meaning a player could theoretically sweep the map 6+ times per day (limited by 2 resets). The 2x VIP multiplier compounds with digger bonuses and flag bearer bonuses.

---

## 9. FLAG BEARER SYSTEM

### Bonuses
- 2x harvest multiplier
- 2x XP multiplier
- 1.5x cave drop rate
- 1.5x auto-farm speed
- 1.25x unit STR/DEF
- 1.5x bank capacity
- 1.5x inventory capacity
- Max hold time: 12 hours
- Trail duration: 8 minutes

**Current Problem:** The flag bearer compounds ALL other multipliers. With VIP (2x) + Flag Bearer (2x) + Diggers (+973%), a single tile yields ~21,000 resources. The flag bearer can hold for 12 hours, enabling massive accumulation.

---

## 10. REFERRAL SYSTEM

### Per-Referral Rewards (scaling)
```
Base: 10,000 metal, 10,000 energy, 15 RP, 2,000 XP, 1 VIP day
Progressive factor: min(1.05^(referralCount-1), 2.0)
```

### Milestone Rewards
| Milestone | Metal | Energy | RP | XP | VIP Days | Special |
|-----------|-------|--------|-----|-----|----------|---------|
| 1 | 25K | 25K | 20 | 3K | 2 | Title |
| 3 | 50K | 50K | 40 | 6K | 3 | 5 Elite Infantry |
| 5 | 100K | 100K | 80 | 10K | 5 | Bronze Badge |
| 10 | 250K | 250K | 200 | 25K | 7 | Special Unit + 5% Resource |
| 15 | 500K | 500K | 400 | 50K | 5 | Silver Badge + Legendary Units |
| 25 | 750K | 750K | 800 | 100K | 2 | Prestige Unit + 10% XP |
| 50 | 625K | 625K | 1,500 | 200K | 0 | Gold Badge + 10% Resource |
| 100 | 150K | 150K | 3,000 | 500K | 0 | Diamond Badge + 25% All |

### Welcome Packages
**With referral:** 50K metal/energy, Legendary Universal Digger, 25% XP boost 7 days, 3 VIP trial days
**Without referral:** 25K metal/energy, Rare Universal Digger, 15% XP boost 3 days, 1 VIP trial day

---

## 11. CLAN SYSTEM

### Creation Cost: 1.5M metal + 1.5M energy

### Clan Perks (16 perks, 4 tiers)
- Bronze (Level 5+): 100K M/E + 10K RP each — +5% attack/defense/resources/XP
- Silver (Level 10+): 250K M/E + 25K RP each — +10% bonuses
- Gold (Level 15+): 500K M/E + 50K RP each — +15% bonuses
- Legendary (Level 20+): 1M M/E + 100K RP each — +20% bonuses
- Max 4 active perks

### Clan Research (9 nodes): 100-600 RP each — +2-6% attack/defense, +10% yield, -20% territory, +10 max members

### Territory Costs: 2,500-8,000 M/E per tile (scaling with count)
### Territory Limits: 25 at level 1 → 1,000 at level 31

---

## 12. FACTORY SYSTEM

### Stats by Level (1-10)
- Max slots: 5,000 → 9,500
- Regen rate: 416 → 791 slots/hour
- Defense: 1,000 → 4,050,000
- Upgrade costs: 1,500M+750E → 38,444M+19,222E
- Total to level 10: ~112,732 metal + ~56,366 energy

---

## 13. WMD SYSTEM (Endgame, Level 40+)

### 3 Research Tracks × 10 Tiers = 30 techs
- Total RP cost: 2,700,000 RP per track (8.1M total)
- Missile Track: Tactical → Clan Buster warheads
- Defense Track: Basic → AEGIS batteries
- Intelligence Track: Espionage → Nuclear Sabotage

---

## 14. CURRENT BALANCE ISSUES (Observed)

1. **Player reached level 36 in one session** — XP curve too flat
2. **+973% gathering bonus** — Digger diminishing returns too generous
3. **4M metal + 3M energy accumulated** — Harvest amounts too high relative to costs
4. **710K STR + 830K DEF army** — Unit production uncapped, resources too abundant
5. **All tier unlocks trivial** — 100 RP total, earn 6,000+ per sweep
6. **Tech tree meaningless** — All unlockable in 1-2 sessions
7. **Shrine boosts too accessible** — Tradeable items accumulate rapidly
8. **VIP + Flag Bearer = 4x multiplier** — Compounds with digger bonuses absurdly
9. **No meaningful progression gates** — Everything unlocks too fast
10. **Auto-farm enables 24/7 play** — No engagement-based limits

---

## QUESTIONS FOR ANALYSIS

1. **Resource Economy:** What should the target resource accumulation rate be per day for a dedicated player? How do we make resources feel meaningful at all stages?

2. **XP/Level Curve:** What level should a dedicated player reach per week/month? Should there be a level cap? What's the right curve shape?

3. **Digger Balance:** How should diminishing returns work? Should there be a hard cap on gathering bonus? How many diggers should a player reasonably collect per day?

4. **Tier Unlocks:** What should the RP cost curve be? Should level requirements be higher? How long should it take to unlock all 5 tiers?

5. **Tech Tree:** Should techs cost RP, metal, or both? What should the level requirements be? How long should the tech tree take to complete?

6. **Shrine Balance:** Should shrine boosts be more expensive? Should there be daily limits? How do we make the time-based boost feel valuable but not mandatory?

7. **VIP Balance:** Is the 2x resource multiplier too strong? Should VIP have other unique benefits instead of just multipliers?

8. **Flag Bearer:** Is the 2x harvest multiplier too strong? Should it be reduced or have trade-offs?

9. **Auto-Farm:** Should there be engagement-based limits? Diminishing returns on auto-farm? How do we balance convenience with engagement?

10. **Addiction Loops:** What daily/weekly/monthly loops should exist? What creates FOMO? What makes players log in multiple times per day?

11. **New Mechanics:** What new mechanics could add depth? (e.g., resource decay, unit maintenance costs, territory upkeep, seasonal events, PvP seasons)

12. **Monetization Balance:** How do we make VIP feel valuable without being pay-to-win? What should free players vs VIP players look like at various stages?

13. **Referral System:** Are referral rewards too generous? How do we prevent abuse while encouraging growth?

14. **Endgame:** What should endgame look like? How do we keep players engaged after unlocking everything?

Please provide specific numerical recommendations where possible, and explain the reasoning behind each suggestion.