# DarkFrame - Phase 3 Development Plan

> Comprehensive plan for Advanced Game Systems implementation

**Created:** 2025-10-17  
**Target Completion:** 2025-10-25  
**Total Features:** 34 across 8 subsystems

---

## 🎯 PHASE 3 OVERVIEW

Phase 3 introduces core competitive gameplay mechanics including:
- Banking and resource boost systems (missed in Phase 2)
- Factory slot management and unit building
- Power balance enforcement
- Player progression (XP/Leveling)
- Research and technology trees
- Rankings and leaderboards
- Hidden discoveries

---

## 📋 FEATURE BREAKDOWN

### **3.1 - Banking & Boost System** (Priority: CRITICAL)
**FID-20251017-018: Add Bank Tiles and Boost System**
- **Estimate:** 4 hours
- **Complexity:** 3

**Requirements:**
- Add "Bank" terrain type to map generation
- 50 bank tiles randomly distributed across map
- Bank deposit API (store resources safely)
- Bank withdrawal API (retrieve resources)
- Boost purchase system (spend resources for temporary multipliers)
- Boost types: 2x Harvest (1 hour), 2x Power (1 hour), 2x Slots (1 hour)
- Boost timer tracking and expiration

**Database Changes:**
```typescript
Player {
  bank: {
    metal: number;
    energy: number;
  };
  activeBoosts: [{
    type: 'harvest' | 'power' | 'slots';
    multiplier: number;
    expiresAt: Date;
  }];
}
```

---

### **3.2 - Factory Slot & Unit Building** (Priority: CRITICAL)
**FID-20251017-019: Factory Slot System and Basic Units**
- **Estimate:** 6 hours
- **Complexity:** 4

**Requirements:**
- Factory slots schema (current, max, regeneration rate)
- Background job for slot regeneration (1 slot/hour per factory)
- 4 basic units with stats:
  * Rifleman: 5 STR, 200 Metal, 100 Energy, 1 Slot
  * Scout: 3 STR, 150 Metal, 150 Energy, 1 Slot
  * Bunker: 5 DEF, 200 Metal, 100 Energy, 1 Slot
  * Barrier: 3 DEF, 150 Metal, 150 Energy, 1 Slot
- Unit building API with resource/slot deduction
- Unit ownership tracking
- Factory sidebar display

**Database Changes:**
```typescript
Factory {
  slots: {
    current: number;
    max: number;
    regenerationRate: number; // slots per hour
    lastRegeneration: Date;
  };
  level: number;
}

Player {
  units: [{
    type: string;
    strength: number;
    defense: number;
    builtAt: Date;
    factoryId: ObjectId;
  }];
  strength: number; // sum of unit strength
  defense: number;  // sum of unit defense
}
```

---

### **3.3 - Power Balance System** (Priority: CRITICAL)
**FID-20251017-020: STR/DEF Balance Enforcement**
- **Estimate:** 3 hours
- **Complexity:** 3

**Requirements:**
- Separate STR and DEF tracking
- Balance ratio validation (0.7x to 1.5x)
- Power penalty calculation
- UI warnings when out of balance
- Effective power formula

**Formula:**
```typescript
const ratio = Math.min(strength, defense) / Math.max(strength, defense);
const balanceMultiplier = ratio < 0.7 ? 0.5 : (ratio >= 0.7 && ratio <= 1.5 ? 1.0 : 0.8);
const effectivePower = (strength + defense) * balanceMultiplier;
```

---

### **3.4 - Factory Management Panel** (Priority: HIGH)
**FID-20251017-021: Factory Upgrade and Management UI**
- **Estimate:** 5 hours
- **Complexity:** 3

**Requirements:**
- Factory list view (all owned factories)
- Factory upgrade system (levels 1-10)
- Upgrade costs scale with level
- Abandon factory functionality
- 10 factory ownership limit enforcement
- Factory details: coordinates, slots, level, units

**Upgrade Formula:**
```typescript
const upgradeCost = {
  metal: 1000 * Math.pow(1.5, factory.level),
  energy: 500 * Math.pow(1.5, factory.level)
};
const newMaxSlots = 10 + (factory.level * 2);
const newRegenRate = 1 + (factory.level * 0.1); // slots per hour
```

---

### **3.5 - Rankings & Leaderboard** (Priority: HIGH)
**FID-20251017-022: Player Rankings and Leaderboard**
- **Estimate:** 3 hours
- **Complexity:** 2

**Requirements:**
- Rank calculation based on effective power
- Leaderboard API (top 100 players)
- Leaderboard UI panel (toggle with "L" key)
- Real-time rank updates
- Player search in leaderboard

**Database:**
```typescript
Player {
  rank: number;
  effectivePower: number; // cached for sorting
}
```

---

### **3.6 - Experience & Leveling** (Priority: HIGH)
**FID-20251017-023: XP System and Player Progression**
- **Estimate:** 4 hours
- **Complexity:** 3

**Requirements:**
- XP tracking for actions:
  * Harvest resource: +10 XP
  * Capture factory: +100 XP
  * Defend against attack: +50 XP
  * Discover cave item: +20 XP
- Level calculation (1000 XP per level)
- Research Point rewards (1 RP per level)
- XP bar in UI
- Level-up notifications

**Database:**
```typescript
Player {
  experience: number;
  level: number;
  researchPoints: number;
}
```

---

### **3.7 - Research System** (Priority: MEDIUM)
**FID-20251017-024: Tech Tree and Advanced Units**
- **Estimate:** 6 hours
- **Complexity:** 4

**Requirements:**
- Research tree data structure
- 3 tiers with prerequisites
- 8 advanced units (Tier 2 & 3)
- Research purchase API (spend RP)
- Tech tree UI panel
- Level requirements for tiers

**Research Tree:**
```typescript
const techTree = {
  tier1: { level: 1, cost: 0 },
  tier2: { level: 5, cost: 1 RP },
  tier3: { level: 10, cost: 2 RP }
};

const advancedUnits = [
  // Tier 2
  { name: 'Assault Trooper', str: 15, cost: { metal: 800, energy: 400, slots: 2 } },
  { name: 'Heavy Tank', str: 40, cost: { metal: 2000, energy: 1000, slots: 4 } },
  { name: 'Turret', def: 15, cost: { metal: 800, energy: 400, slots: 2 } },
  { name: 'Fortress', def: 40, cost: { metal: 2000, energy: 1000, slots: 4 } },
  
  // Tier 3
  { name: 'Siege Mech', str: 100, cost: { metal: 5000, energy: 2500, slots: 8 } },
  { name: 'Drone Swarm', str: 60, cost: { metal: 3500, energy: 2000, slots: 6 } },
  { name: 'Shield Generator', def: 100, cost: { metal: 5000, energy: 2500, slots: 8 } },
  { name: 'Command Bunker', def: 60, cost: { metal: 3500, energy: 2000, slots: 6 } }
];
```

---

### **3.8 - Hidden Tech & Discoveries** (Priority: LOW)
**FID-20251017-025: Rare Tech Drops and Achievements**
- **Estimate:** 3 hours
- **Complexity:** 2

**Requirements:**
- 5% chance for tech drop on cave harvest
- 3 hidden technologies:
  * Ancient Blueprints (unlock special unit)
  * Experimental Core (50% stat boost to all units)
  * Factory Efficiency (20% cost reduction)
- Discovery notification system
- Achievement tracking
- Discovery log UI

---

## 🗓️ IMPLEMENTATION ORDER

**Week 1 (Days 1-3):**
1. FID-20251017-018: Banking & Boost System (4h)
2. FID-20251017-019: Factory Slots & Basic Units (6h)
3. FID-20251017-020: Power Balance System (3h)

**Week 2 (Days 4-6):**
4. FID-20251017-021: Factory Management Panel (5h)
5. FID-20251017-022: Rankings & Leaderboard (3h)
6. FID-20251017-023: XP & Leveling System (4h)

**Week 3 (Days 7-8):**
7. FID-20251017-024: Research System & Tech Tree (6h)
8. FID-20251017-025: Hidden Tech & Discoveries (3h)

**Total Estimated Time:** 34 hours (~8 working days)

---

## ✅ ACCEPTANCE CRITERIA

**Phase 3 Complete When:**
- ✅ Banks functional with deposits/withdrawals
- ✅ 3 boost types purchasable and working
- ✅ 4 basic units buildable from factories
- ✅ Factory slots regenerate over time
- ✅ STR/DEF balance enforced with penalties
- ✅ Players can upgrade factories up to level 10
- ✅ Leaderboard shows top 100 by power
- ✅ XP system tracks actions and awards levels
- ✅ Tech tree unlocks 8 advanced units
- ✅ Hidden tech discoverable in caves (5% rate)
- ✅ All systems integrated and tested

---

## 🚨 DEPENDENCIES & RISKS

**Technical Dependencies:**
- MongoDB schema migrations for new fields
- Background job scheduler for slot regeneration
- Caching layer for leaderboard performance

**Risks:**
- Slot regeneration performance at scale
- Leaderboard query performance (100+ players)
- Balance formula may need tuning
- Tech tree UI complexity

**Mitigation:**
- Use MongoDB TTL indexes for slot regeneration
- Cache leaderboard data (5-minute refresh)
- Make balance multipliers configurable
- Start with simple tree UI, enhance later

---

**Last Updated:** 2025-10-17
