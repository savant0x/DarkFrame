# Warfare & Alliance System - Enhanced Design

**Created:** 2025-10-18  
**Status:** Design Phase  
**Priority:** 🔴 CRITICAL for meaningful clan gameplay

---

## 🎯 **DESIGN GOALS**

1. **High Stakes:** War must be expensive and risky, not casual
2. **High Rewards:** Winners get massive spoils making victory worthwhile
3. **Strategic Depth:** Territory control provides passive income and bonuses
4. **Admin Control:** All costs/rewards configurable via admin panel
5. **Alliance System:** Clans can cooperate through formal contracts

---

## 💰 **ENHANCED WAR COSTS** (Admin Configurable)

### War Declaration Costs
```typescript
DEFAULT_WAR_DECLARATION_COST = {
  metal: 50000,     // 100x increase from 500
  energy: 50000,    // Requires ~1 week of clan farming
  rp: 10000,        // NEW: Research point cost
}

// Admin configurable multiplier (0.1 - 10.0)
finalCost = baseCost * warCostMultiplier
```

### Daily War Upkeep (NEW)
```typescript
DAILY_WAR_UPKEEP = {
  metal: 5000,      // Per day of active war
  energy: 5000,     // Deducted at midnight UTC
  // If clan can't pay: Auto-surrender with penalty
}
```

### Surrender Penalty
```typescript
SURRENDER_PENALTY = {
  treasuryPercent: 20,    // 20% of treasury to winner
  rpPercent: 30,          // 30% of RP to winner
  territoryLoss: 5,       // Lose 5 random territories
}
```

---

## 🏆 **WAR REWARDS SYSTEM** (Admin Configurable)

### Victory Spoils (Winner Takes All)
```typescript
VICTORY_REWARDS = {
  // Financial Spoils
  treasuryPercent: 30,        // 30% of loser's Metal + Energy
  rpPercent: 50,              // 50% of loser's Research Points
  
  // Territory Rewards
  capturedTerritoriesKeep: true,  // All captured tiles stay with winner
  bonusTerritories: 10,           // 10 random tiles from loser
  
  // Buffs & Bonuses (7-day duration)
  memberXpBoost: 20,              // +20% XP for all members
  memberResourceBoost: 15,        // +15% harvest for all members
  clanLevelBoost: 1,              // +1 clan level (capped at earned)
  
  // Unique Rewards
  freeResearchUnlock: 1,          // Unlock 1 research for free
  freePerkActivation: 1,          // Activate 1 perk for free
  warVictorTitle: true,           // "War Victor" achievement
  
  // Admin Configurable
  rewardMultiplier: 1.0,          // 0.5 - 5.0 range
}
```

### Defeat Penalties (Loser Loses Hard)
```typescript
DEFEAT_PENALTIES = {
  treasuryLoss: 30,               // Lose 30% treasury
  rpLoss: 50,                     // Lose 50% RP
  territoryLoss: 'ALL_CAPTURED',  // Lose all captured territories
  memberMoraleDebuff: -10,        // -10% XP gain for 7 days
  warCooldown: 168,               // 7 days before can declare again
}
```

---

## 🗺️ **TERRITORY AUTO-FARMING** (Game Changer!)

### Passive Resource Generation
```typescript
TERRITORY_AUTO_FARM_RATES = {
  // Hourly generation per territory
  METAL_TILE: {
    metal: 100,
    energy: 0,
  },
  ENERGY_TILE: {
    metal: 0,
    energy: 100,
  },
  FOREST_TILE: {
    metal: 50,
    energy: 50,
  },
  CAVE_TILE: {
    metal: 25,
    energy: 25,
    caveItems: 0.1,  // 10% chance per hour for cave item
  },
  FACTORY_TILE: {
    metal: 200,
    energy: 200,
    // Factories are 2x valuable!
  },
  
  // Scaling with clan level
  levelBonus: 0.10,  // +10% per clan level
  // Example: Level 10 clan with Metal tile = 100 * (1 + 10*0.10) = 200/hour
  
  // Admin configurable multiplier
  globalMultiplier: 1.0,  // 0.1 - 10.0 range
}

// All farmed resources go to clan bank automatically
// Hourly background job processes all territories
```

### Territory Economic Value
```typescript
// Example: Clan with 100 territories (50 Metal, 50 Energy)
// Base: 5000 Metal/hour + 5000 Energy/hour = 120k Metal + 120k Energy/day
// Level 10 clan: 240k Metal + 240k Energy/day passive income!
// This makes territory control EXTREMELY valuable
```

---

## 🏰 **ENHANCED TERRITORY SYSTEM**

### Increased Territory Limits
```typescript
MAX_TERRITORIES = {
  default: 2000,              // 9% of 22k map (was 100 = 0.45%)
  adminConfigurable: true,    // Range: 100 - 10000
  
  // Unlock via clan level
  level1to10: 500,
  level11to20: 1000,
  level21to30: 1500,
  level31plus: 2000,
}
```

### Scaling Territory Costs (Prevents Spam)
```typescript
TERRITORY_CLAIM_COST = {
  base: 500,
  scalingFormula: 'base + (currentTerritories * 10)',
  
  // Examples:
  // 1st territory: 500
  // 100th territory: 500 + (99 * 10) = 1,490
  // 500th territory: 500 + (499 * 10) = 5,490
  // 1000th territory: 500 + (999 * 10) = 10,490
  
  // Admin can adjust scaling factor (1 - 100)
}
```

### Territory Upkeep Costs (NEW)
```typescript
TERRITORY_UPKEEP = {
  hourly: {
    metal: 10,    // Per territory per hour
    energy: 10,
  },
  
  // Example: 100 territories = 1000 Metal + 1000 Energy/hour upkeep
  // Daily: 24k Metal + 24k Energy
  // BUT auto-farming generates 120k+ per day, so net positive!
  
  // If clan can't pay upkeep:
  autoAbandon: true,        // Lose random territories
  abandonCount: 5,          // Lose 5 territories per failed payment
}
```

### Dominance Bonuses (NEW)
```typescript
DOMINANCE_TIERS = {
  // % of total map controlled (22,500 tiles)
  tier1: {
    percent: 1,           // 225 territories
    bonus: {
      allMemberStats: 5,  // +5% attack, defense, harvest
      clanXp: 10,         // +10% clan XP gain
    },
  },
  tier2: {
    percent: 3,           // 675 territories
    bonus: {
      allMemberStats: 10,
      clanXp: 20,
      unlockSpecialResearch: true,
    },
  },
  tier3: {
    percent: 5,           // 1,125 territories
    bonus: {
      allMemberStats: 20,
      clanXp: 30,
      unlockSpecialMonument: true,
      globalPrestige: 100,  // Shown on global leaderboard
    },
  },
}
```

---

## 🤝 **ALLIANCE SYSTEM**

### Alliance Structure
```typescript
interface Alliance {
  _id: ObjectId;
  allianceId: string;
  name: string;              // "Northern Coalition"
  tag: string;               // "NORTH" (3-5 chars)
  description: string;
  
  // Member clans (max 3)
  memberClanIds: string[];
  leaderClanId: string;      // Clan that created alliance
  
  // Alliance stats
  totalMembers: number;      // Sum of all clan members
  totalTerritories: number;
  combinedPower: number;     // Sum of all clan levels
  
  // Alliance features
  sharedChat: boolean;
  sharedResearch: boolean;
  activeContracts: AllianceContract[];
  
  createdAt: Date;
  disbandedAt?: Date;
}
```

### Alliance Contracts (Formal Agreements)
```typescript
enum ContractType {
  RESOURCE_SHARING = 'RESOURCE_SHARING',      // % of harvest shared
  DEFENSE_PACT = 'DEFENSE_PACT',              // Auto-join defensive wars
  NON_AGGRESSION = 'NON_AGGRESSION',          // Cannot war each other
  TERRITORY_LEASE = 'TERRITORY_LEASE',        // Allow claiming in ally territory
  RESEARCH_SHARING = 'RESEARCH_SHARING',      // Shared research unlocks
  JOINT_TREASURY = 'JOINT_TREASURY',          // Shared bank account
}

interface AllianceContract {
  _id: ObjectId;
  contractId: string;
  type: ContractType;
  
  // Parties
  proposingClanId: string;
  acceptingClanId: string;
  
  // Terms
  terms: {
    duration: number;         // Hours
    renewAuto: boolean;
    
    // Contract-specific terms
    resourceSharePercent?: number;    // For RESOURCE_SHARING
    territoryRegion?: { x1, y1, x2, y2 };  // For TERRITORY_LEASE
    researchBranch?: string;          // For RESEARCH_SHARING
  };
  
  // Status
  status: 'PROPOSED' | 'ACTIVE' | 'EXPIRED' | 'VIOLATED' | 'CANCELLED';
  
  // Violation penalties
  violationPenalty: {
    metal: number;
    energy: number;
    rpLoss: number;
  };
  
  createdAt: Date;
  activatedAt?: Date;
  expiresAt?: Date;
}
```

### Alliance War Mechanics
```typescript
ALLIANCE_WAR = {
  // When one clan declares war on alliance member:
  autoDefenseActivation: true,      // All allies auto-join
  sharedWarCosts: true,             // Split declaration cost
  sharedWarRewards: true,           // Split victory spoils
  
  // Alliance vs Alliance wars
  massConflict: {
    maxClansPerSide: 3,
    coordinatedCaptures: true,      // Can assign territories to allies
    sharedWarChest: true,           // Pool resources for upkeep
  },
  
  // Betrayal mechanics
  allyBetrayalPenalty: {
    reputationLoss: 1000,
    cannotFormAlliance: 30,         // Days
    globalShaming: true,            // Shown in activity feed
  },
}
```

---

## 🎛️ **ADMIN CONTROL PANEL**

### War Configuration Settings
```typescript
ADMIN_WAR_CONFIG = {
  // Costs
  warDeclarationCostMultiplier: 1.0,     // 0.1 - 10.0
  dailyUpkeepMultiplier: 1.0,
  surrenderPenaltyPercent: 20,           // 0 - 100
  
  // Rewards
  victoryTreasuryPercent: 30,            // 0 - 100
  victoryRpPercent: 50,                  // 0 - 100
  victoryBuffDuration: 168,              // Hours (7 days)
  victoryXpBoost: 20,                    // Percentage
  
  // Territory
  maxTerritoriesPerClan: 2000,           // 100 - 10000
  territoryClaimCostScaling: 10,         // 1 - 100
  territoryUpkeepPerHour: 10,            // 0 - 1000
  
  // Auto-Farming
  autoFarmGlobalMultiplier: 1.0,         // 0.1 - 10.0
  autoFarmMetalRate: 100,
  autoFarmEnergyRate: 100,
  autoFarmForestRate: 50,
  
  // Alliances
  allianceMaxClans: 3,                   // 2 - 10
  allianceContractsEnabled: true,
  allianceWarEnabled: true,
  
  // Cooldowns
  warCooldownHours: 48,                  // 24 - 336 (2 weeks)
  minWarDurationHours: 24,               // 1 - 168 (1 week)
}
```

### Admin Endpoints
```
POST /api/admin/warfare/config        - Update warfare settings
GET  /api/admin/warfare/config        - Get current settings
POST /api/admin/warfare/force-end     - Force end a war
POST /api/admin/warfare/adjust-costs  - Bulk adjust costs
GET  /api/admin/warfare/active-wars   - View all active wars
POST /api/admin/alliance/approve      - Approve alliance contract
POST /api/admin/alliance/dissolve     - Force dissolve alliance
```

---

## 📊 **IMPLEMENTATION PRIORITY**

### Phase 4A: Enhanced Warfare (Immediate)
1. ✅ Update war costs (50k Metal + 50k Energy)
2. ✅ Add daily upkeep system
3. ✅ Implement victory rewards (treasury %, RP %, buffs)
4. ✅ Add defeat penalties
5. ✅ Territory auto-farming system
6. ✅ Scaling territory costs
7. ✅ Territory upkeep costs
8. ✅ Dominance tier bonuses
9. ✅ Admin config panel

### Phase 4B: Alliance System (Next)
1. ⏳ Alliance creation/management
2. ⏳ Alliance contract system
3. ⏳ Shared alliance chat
4. ⏳ Defense pact mechanics
5. ⏳ Alliance wars
6. ⏳ Admin alliance controls

---

## 🎮 **PLAYER EXPERIENCE**

### Before Enhancement
- War costs 2000 resources (1 hour of farming)
- No rewards for winning
- No penalty for losing
- Territory = just a number
- Wars are casual, no stakes

### After Enhancement
- War costs 50,000 resources + 5000/day upkeep (1 week to afford)
- Massive rewards: 30% treasury + 50% RP + buffs + territories
- Heavy penalties: Lose 30% treasury, 50% RP, -10% XP for 7 days
- Territory = passive income (100/hour per tile) + dominance bonuses
- Wars are strategic decisions with huge risk/reward
- Alliances add diplomacy and coordination

**Result:** Wars become the **endgame content** that high-level clans compete for!

---

## 💡 **EXAMPLE SCENARIO**

**Two Top Clans:**
- Clan A: Level 25, 800 territories, 2M treasury, 500k RP
- Clan B: Level 22, 600 territories, 1.5M treasury, 300k RP

**Clan A declares war:**
- Cost: 50k Metal + 50k Energy upkeep
- Daily upkeep: 5k + 5k (must win within 10 days or bleed resources)

**War outcome - Clan A wins:**
- Gains: 450k treasury (30% of 1.5M), 150k RP (50% of 300k)
- Gains: 100 captured territories + 10 bonus = 110 new territories
- Gains: 20% XP boost for all members (7 days)
- Gains: 1 free research unlock + 1 free perk
- New passive income: +11,000/hour from 110 territories = +264k/day

**Clan B loses:**
- Loses: 450k treasury, 150k RP, 110 territories
- Penalty: -10% XP for all members (7 days)
- Cannot declare war for 7 days
- Loses 11k/hour passive income

**Net effect:** Winning a war can provide **2-3 weeks** worth of clan progress instantly!

---

## ✅ **NEXT STEPS**

1. Get approval on enhanced costs/rewards
2. Update territoryService.ts with auto-farming
3. Update clanWarfareService.ts with rewards/penalties
4. Create allianceService.ts
5. Add admin config panel
6. Create background job for territory farming
7. Create background job for war upkeep
8. Update types for Alliance and Contract
9. Test balance with realistic scenarios

**Estimated Implementation:** 3-4 hours for Phase 4A, 2-3 hours for Phase 4B
