# Enhanced Warfare & Territory System - Design Document

**Created:** 2025-10-18  
**Status:** APPROVED - Ready for Implementation  
**Priority:** 🔴 CRITICAL (Core Economic System)

---

## 🎯 **CORE PHILOSOPHY**

**War should be:**
- **Expensive** - Significant resource investment required
- **Risky** - Potential for major losses
- **Rewarding** - Massive gains for victors
- **Strategic** - Requires planning and coordination

**Territories should be:**
- **Valuable** - Passive income generation
- **Scalable** - Rewards grow with clan level
- **Contested** - Worth fighting over
- **Manageable** - Leaders can distribute rewards

---

## 💰 **ENHANCED TERRITORY PASSIVE FARMING**

### **Base Income Per Territory**

**Formula:** `income = baseTileIncome * (1 + (clanLevel - 1) * scalingFactor)`

**Parameters:**
- `baseTileIncome` = 1,000 Metal + 1,000 Energy per day
- `scalingFactor` = 0.1 (10% increase per clan level)

**Income By Clan Level:**

| Clan Level | Income Per Territory Per Day | 10 Territories | 50 Territories | 100 Territories |
|------------|------------------------------|----------------|----------------|-----------------|
| 1 | 1,000 M/E | 10K | 50K | 100K |
| 5 | 1,400 M/E | 14K | 70K | 140K |
| 10 | 1,900 M/E | 19K | 95K | 190K |
| 15 | 2,400 M/E | 24K | 120K | 240K |
| 20 | 2,900 M/E | 29K | 145K | 290K |
| 25 | 3,400 M/E | 34K | 170K | 340K |
| 30 | 3,900 M/E | 39K | 195K | 390K |
| 40 | 4,900 M/E | 49K | 245K | 490K |
| 50 | 5,900 M/E | 59K | 295K | 590K |

**Example Scenarios:**

**Small Active Clan (Level 10, 20 territories):**
- Daily Income: 1,900 * 20 = **38,000 Metal + 38,000 Energy per day**
- Weekly: 266K Metal/Energy
- Monthly: ~1.14M Metal/Energy

**Mid-Size Competitive Clan (Level 20, 75 territories):**
- Daily Income: 2,900 * 75 = **217,500 Metal + 217,500 Energy per day**
- Weekly: 1.52M Metal/Energy
- Monthly: ~6.5M Metal/Energy

**Large Dominant Clan (Level 30, 200 territories):**
- Daily Income: 3,900 * 200 = **780,000 Metal + 780,000 Energy per day**
- Weekly: 5.46M Metal/Energy
- Monthly: ~23.4M Metal/Energy

### **Territory Caps**

**Absolute Maximum:** 1,000 territories per clan (increased from 100)
- Rationale: With 22,500 tiles in game, 1,000 = 4.4% of map
- Allows ~22 clans to reach max (highly competitive endgame)
- Creates extreme scarcity and territory wars

**Level-Based Caps:**

| Clan Level | Max Territories | % of Map |
|------------|-----------------|----------|
| 1-5 | 25 | 0.11% |
| 6-10 | 50 | 0.22% |
| 11-15 | 100 | 0.44% |
| 16-20 | 200 | 0.89% |
| 21-25 | 400 | 1.78% |
| 26-30 | 700 | 3.11% |
| 31+ | 1,000 | 4.44% |

---

## ⚔️ **WARFARE COSTS (Meaningful Investment)**

### **War Declaration Costs**

**Base Cost:** 50,000 Metal + 50,000 Energy (25x increase from 2K)

**Cost Scaling by Defender Size:**
- Base: 50K M/E (defender has 0-50 territories)
- +10K M/E for every 25 territories defender controls
- Formula: `cost = 50000 + Math.floor(defenderTerritories / 25) * 10000`

**Examples:**
- War vs small clan (10 territories): 50K M/E
- War vs mid clan (50 territories): 70K M/E
- War vs large clan (150 territories): 110K M/E
- War vs dominant clan (300 territories): 170K M/E

**Rationale:** 
- Attacking smaller clans is cheaper (bullying prevention needed)
- Attacking large territory holders requires significant resources
- Makes wars a strategic decision, not casual griefing

### **Territory Claiming Costs**

**Base Cost:** 2,500 Metal + 2,500 Energy per tile (5x increase from 500)

**Cost Scaling by Clan's Current Territory Count:**
- First 10 territories: 2,500 M/E each
- 11-25: 3,000 M/E each
- 26-50: 3,500 M/E each
- 51-100: 4,000 M/E each
- 101-250: 5,000 M/E each
- 251-500: 6,000 M/E each
- 501-750: 7,000 M/E each
- 751+: 8,000 M/E each

**Formula:**
```typescript
let cost = 2500;
if (territoryCount >= 10) cost = 3000;
if (territoryCount >= 25) cost = 3500;
if (territoryCount >= 50) cost = 4000;
if (territoryCount >= 100) cost = 5000;
if (territoryCount >= 250) cost = 6000;
if (territoryCount >= 500) cost = 7000;
if (territoryCount >= 750) cost = 8000;
```

**Example - Growing to Max:**
- First 10 tiles: 25K M/E total
- Next 15 (to 25): 45K M/E total
- Next 25 (to 50): 87.5K M/E total
- Next 50 (to 100): 200K M/E total
- Next 150 (to 250): 750K M/E total
- Next 250 (to 500): 1,500K M/E total
- Next 250 (to 750): 1,750K M/E total
- Next 250 (to 1000): 2,000K M/E total
- **Total for 1,000 territories: 6.36M M/E**

**ROI Calculation (Level 30 clan, 1000 territories):**
- Cost for 1,000 territories: 6.36M M/E
- Daily income (level 30): 3,900 * 1,000 = 3.9M M/E
- **Payback period: 1.63 days**
- After 1 week: +20.94M M/E profit
- After 1 month: ~110M M/E profit

---

## 🏆 **WAR REWARDS (Massive Incentives)**

### **Victory Spoils**

**Resource Capture:**
- 15% of loser's clan bank Metal
- 15% of loser's clan bank Energy
- 10% of loser's Research Points (RP)

**Example - War Against Mid-Size Clan:**

Loser's Bank:
- 500,000 Metal
- 400,000 Energy
- 100,000 RP

Winner Receives:
- 75,000 Metal (15%)
- 60,000 Energy (15%)
- 10,000 RP (10%)

**XP Rewards:**
- Winner: +50,000 XP to clan
- Loser: -25,000 XP penalty

**Territory Retention:**
- All territories captured during war are kept
- Winner can choose to return some territories (diplomacy option)

### **War Objectives & Bonus Rewards**

**Objective 1: Conquest Victory**
- Capture 20+ enemy territories
- Bonus: +25% spoils (18.75% instead of 15%)

**Objective 2: Blitzkrieg**
- Win war in under 3 days
- Bonus: +10,000 RP

**Objective 3: Decisive Victory**
- Win with 0 territories lost
- Bonus: +25,000 XP

**Objective 4: Strategic Domination**
- Capture enemy's highest-value territories (near resources)
- Bonus: Double passive income on those tiles for 7 days

---

## 🤝 **ALLIANCE SYSTEM**

### **Alliance Formation**

**Requirements:**
- Both clans level 5+
- Alliance contract signed by both Leaders
- Optional: Resource deposit (escrow) for contract enforcement

**Alliance Types:**

**1. Non-Aggression Pact (NAP)**
- Cannot declare war on each other
- Cannot capture each other's territories
- Duration: 7-30 days
- Cost: None

**2. Trade Alliance**
- Can transfer resources between clan banks (with % fee)
- Shared territory vision (see ally territories on map)
- Duration: 7-90 days
- Cost: 10K M/E to establish

**3. Military Alliance**
- All Trade Alliance benefits
- Can declare joint wars (2v1 or 2v2)
- Share war spoils 50/50
- Duration: 30-180 days
- Cost: 50K M/E to establish

**4. Federation (Mega Alliance)**
- All Military Alliance benefits
- Shared clan bank (separate federation bank)
- Combined territory caps (500 per clan, but shared defense)
- Federation leader elected by member clan leaders
- Duration: 90-365 days
- Cost: 200K M/E to establish

### **Alliance Contracts**

**Resource Sharing Contract:**
```
Clan A provides to Clan B:
- 10,000 Metal per day
- 5,000 Energy per day

In exchange, Clan B provides:
- 15,000 Energy per day

Duration: 14 days
Penalty for breach: 50,000 M/E
```

**Territory Defense Contract:**
```
Clan A will defend Clan B's territories:
- Region: Coordinates (50,50) to (100,100)

In exchange:
- 20% of passive income from defended territories
- Clan B cannot declare war without Clan A approval

Duration: 30 days
```

**War Support Contract:**
```
If Clan A is attacked:
- Clan B will declare war on attacker within 24 hours
- Share war spoils 60/40 (A/B split)

If Clan B is attacked:
- Clan A will provide 50K M/E war support
- No obligation to join war

Duration: 60 days
Penalty for breach: 200,000 M/E
```

---

## 💼 **CLAN BANK & FUND DISTRIBUTION**

### **Passive Income Collection**

**All passive territory income goes to Clan Bank automatically**
- Collected every 24 hours at server reset (midnight UTC)
- Logged in clan activity feed
- Viewable by all members

### **Leader Fund Distribution**

**Distribution Methods:**

**1. Equal Split**
```
Total to distribute: 100,000 Metal
Members: 20
Each receives: 5,000 Metal
```

**2. Percentage-Based**
```
Leader: 30% (30,000 M)
Co-Leaders: 20% each (20,000 M each)
Officers: 10% each (10,000 M each)
Members: Split remaining equally
```

**3. Merit-Based**
```
Based on contribution metrics:
- Territories claimed: 40% weight
- Wars participated: 30% weight
- Resources donated: 30% weight
```

**4. Direct Grant**
```
Leader can grant specific amounts to specific members:
- PlayerA: 10,000 Metal
- PlayerB: 5,000 Energy
- PlayerC: 2,500 Metal + 2,500 Energy
```

**Permissions:**
- Leader: All distribution methods
- Co-Leader: Equal Split and Direct Grant (up to 50K per day)
- Officer: View only

---

## 🛡️ **TERRITORY DEFENSE MECHANICS**

### **Defense Calculation**

**Base Defense:** +10% per adjacent tile (max +50%)

**Enhanced Defense Modifiers:**

**Fortress Territory (Upgraded):**
- Cost: 25,000 M/E to upgrade
- Defense Bonus: +25% (stacks with adjacent bonus)
- Visible on map to enemies (deterrent)
- Max: 10% of clan's territories can be fortresses

**Monument Territory (Level 25+ clans):**
- Captured monuments provide unique bonuses
- Defense Bonus: +40%
- Cannot be captured in war (only monument control battles)

**Researched Defenses:**
- Clan research can increase base defense
- Example: "Defensive Positions" research: +5% all territory defense

**Total Defense Example:**
```
Base adjacent defense: 40% (4 adjacent tiles)
Fortress bonus: +25%
Research bonus: +5%
Total Defense: 70%

Capture success rate: 70% - (70% * 0.5) = 35% base
```

---

## ⚙️ **ADMIN CONTROLS**

**All warfare parameters configurable via Admin Panel:**

### **Warfare Config**
```json
{
  "warCosts": {
    "baseMetal": 50000,
    "baseEnergy": 50000,
    "scalingPerTerritory": 400
  },
  "warRewards": {
    "metalSpoilsPercent": 15,
    "energySpoilsPercent": 15,
    "rpSpoilsPercent": 10,
    "victoryXP": 50000,
    "defeatXPPenalty": 25000
  },
  "warDuration": {
    "minimumHours": 48,
    "cooldownHours": 168
  },
  "warRequirements": {
    "minimumLevel": 10,
    "minimumMembers": 5
  }
}
```

### **Territory Config**
```json
{
  "territoryCosts": {
    "baseMetal": 2500,
    "baseEnergy": 2500,
    "costTiers": [
      { "upTo": 10, "cost": 2500 },
      { "upTo": 25, "cost": 3000 },
      { "upTo": 50, "cost": 3500 },
      { "upTo": 100, "cost": 4000 },
      { "upTo": 250, "cost": 5000 },
      { "upTo": 500, "cost": 6000 },
      { "upTo": 750, "cost": 7000 },
      { "upTo": 1000, "cost": 8000 }
    ]
  },
  "passiveIncome": {
    "baseMetal": 1000,
    "baseEnergy": 1000,
    "scalingFactor": 0.1
  },
  "territoryLimits": {
    "absoluteMax": 1000,
    "levelBasedCaps": [
      { "level": 1, "max": 25 },
      { "level": 6, "max": 50 },
      { "level": 11, "max": 100 },
      { "level": 16, "max": 200 },
      { "level": 21, "max": 400 },
      { "level": 26, "max": 700 },
      { "level": 31, "max": 1000 }
    ]
  }
}
```

### **Alliance Config**
```json
{
  "allianceTypes": {
    "NAP": { "cost": 0, "maxDuration": 30 },
    "TRADE": { "cost": 10000, "maxDuration": 90 },
    "MILITARY": { "cost": 50000, "maxDuration": 180 },
    "FEDERATION": { "cost": 200000, "maxDuration": 365 }
  },
  "contractLimits": {
    "maxActiveContracts": 5,
    "maxAlliances": 3
  }
}
```

---

## 📊 **ECONOMIC BALANCE EXAMPLES**

### **Scenario 1: Active Mid-Size Clan**

**Clan Stats:**
- Level: 15
- Members: 25
- Territories: 75

**Income:**
- Passive: 2,400 * 75 = 180,000 M/E per day
- Weekly: 1.26M M/E

**Expenses:**
- Territory maintenance: None
- War declaration (vs similar clan): 80K M/E

**Distribution:**
- Keep in bank: 60% (108K M/E daily)
- Distribute to members: 40% (72K M/E daily)
- Per member: 2,880 M/E per day

**Member Benefit:**
- Personal farming: ~10K M/E per day
- Clan distribution: 2,880 M/E per day
- **Total: 12,880 M/E per day (28.8% increase from clan membership!)**

### **Scenario 2: War Economics**

**Attacking Clan (Level 20):**
- War cost: 90K M/E
- Territories captured: 15
- War spoils: 75K M + 60K E + 10K RP

**Immediate Profit:**
- Resources: +45K M/E (spoils - cost)
- RP gain: +10K
- XP gain: +50K

**Long-term Profit (captured territories):**
- 15 territories at 2,900 M/E daily = 43,500 M/E per day
- Weekly: 304,500 M/E
- Monthly: ~1.3M M/E

**ROI:** 2.07 days to break even on war cost from passive income alone

---

## 🚀 **IMPLEMENTATION PRIORITIES**

### **Phase 1: Enhanced Territory System** (Current)
- ✅ Increase territory cap to 500
- ✅ Implement level-based caps
- ✅ Add passive farming with scaling
- ✅ Add fund distribution system
- ✅ Update territory claiming costs

### **Phase 2: Enhanced Warfare** (Next)
- Update war costs with scaling
- Add war spoils system (resource capture)
- Add war objectives and bonuses
- Add admin controls for warfare config
- Update warfare API routes

### **Phase 3: Alliance System** (After Phase 2)
- Alliance creation and management
- Contract system (NAP, Trade, Military, Federation)
- Resource sharing between allies
- Joint warfare
- Alliance admin panel

### **Phase 4: Admin Panel Integration** (Final)
- Warfare config editor
- Territory config editor
- Alliance oversight
- War history viewer
- Economic analytics dashboard

---

## 📈 **SUCCESS METRICS**

**Territory System:**
- Average territories per clan: 40-60
- Daily passive income per clan: 100K-200K M/E
- Member satisfaction: 80%+ receive distributions

**Warfare System:**
- Wars per week: 5-10 (meaningful, not spam)
- Average war duration: 3-5 days
- War participation rate: 60%+ of clans
- Territory turnover: 10-15% per month

**Alliance System:**
- Active alliances: 20-30% of clans
- Contract completion rate: 85%+
- Federation formation: 2-5 mega-alliances
- Diplomatic incidents: Measured and tracked

---

**This design creates a meaningful, strategic clan warfare and territory system with proper economic incentives for cooperation, competition, and strategic gameplay.**
