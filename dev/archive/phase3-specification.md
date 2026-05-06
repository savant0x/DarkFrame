# DarkFrame - Phase 3 Complete Specification

> Detailed technical specification for Advanced Game Systems

**Created:** 2025-10-17  
**Target Completion:** 2025-10-25  
**Total Estimated Time:** 50+ hours

---

## 🎯 SYSTEM OVERVIEW

Phase 3 introduces 11 major subsystems totaling 70+ features:
1. Bank & Exchange System (5 fixed locations)
2. Boost Center (shrine-based item trading)
3. Factory Slot System (regenerating capacity)
4. Unit Building System (40 units: 20 STR, 20 DEF)
5. **PVP Combat System (player battles, resource raiding, unit capture)**
6. **Base Defense System (home base attacks with visual base display)**
7. Power Balance Enforcement (STR/DEF ratio penalties)
8. Factory Management (auto-fill, mass abandonment)
9. Comprehensive Leaderboard System (10 ranking categories)
10. Activity Logging System (complete action tracking)
11. Admin Control Panel (player management, real-time monitoring)

---

## 📍 SECTION 1: BANK & EXCHANGE SYSTEM

### **1.1 Bank Locations (Fixed Coordinates)**

| Bank Type | Coordinates | Purpose |
|-----------|-------------|---------|
| Metal Bank | (25, 25) | Metal-only deposit/withdrawal |
| Energy Bank | (75, 75) | Energy-only deposit/withdrawal |
| Exchange Bank 1 | (50, 50) | Resource conversion (Metal ↔ Energy) |
| Exchange Bank 2 | (100, 100) | Resource conversion (Metal ↔ Energy) |

### **1.2 Bank Mechanics**

**Deposit System:**
- Players can deposit unlimited Metal or Energy
- Transaction fee: 1,000 of deposited resource
- Bank storage is permanent and persistent
- UI shows: Bank Balance, Available to Deposit

**Withdrawal System:**
- Players can withdraw any amount from their bank
- No withdrawal fee (already paid on deposit)
- Instant transfer to player inventory

**Security:**
- Banked resources are safe from raids (future feature)
- Each resource type has separate storage
- Transaction logs track all deposits/withdrawals

### **1.3 Exchange Bank Mechanics**

**Conversion Rates:**
- Metal → Energy: 20% exchange fee
- Energy → Metal: 20% exchange fee
- Formula: `receivedAmount = Math.floor(givenAmount * 0.80)`

**UI Interface:**
- Two conversion modes:
  * Energy → Metal (input Energy, get 80% Metal)
  * Metal → Energy (input Metal, get 80% Energy)
- "MAX" button to fill all available resources
- Real-time preview of conversion amount
- Confirm button with summary

**Example:**
- Exchange 100 Energy → Receive 80 Metal
- Exchange 1,000 Metal → Receive 800 Energy

### **1.4 Database Schema**

```typescript
Player {
  bank: {
    metal: number;      // Banked metal amount
    energy: number;     // Banked energy amount
    lastDeposit: Date;  // For transaction tracking
  };
}

interface BankTransaction {
  playerId: ObjectId;
  type: 'deposit' | 'withdrawal' | 'exchange';
  resourceType: 'metal' | 'energy';
  amount: number;
  fee: number;
  timestamp: Date;
}
```

---

## 🏛️ SECTION 2: BOOST CENTER (SHRINE SYSTEM)

### **2.1 Boost Center Location**
- **Coordinates:** (1, 1)
- **Purpose:** Trade cave items for timed resource gathering boosts

### **2.2 Multiple Boosts System (Gathering Yield Enhancement)**

**🆕 UPDATED DESIGN: Four Simultaneous Boosts**

Players can activate **up to FOUR distinct boosts**, one for each suit type (Speed, Heart, Diamond, Club). All four can be active simultaneously and stack additively to increase **resource gathering yield**.

**Important:** These boosts increase the **quantity/amount of resources gathered per harvest action**. They do NOT affect player movement speed or any other speed mechanics.

**Available Boosts (Per Suit Type):**

| Boost Type | Max Duration | Effect (Per Boost) | Item Cost (Initial) | Time Extension |
|------------|--------------|-------------------|---------------------|----------------|
| Speed Tier | 8 hours | +25% resource yield | 3 items | +15 min per item |
| Heart Tier | 8 hours | +25% resource yield | 10 items | +30 min per item |
| Diamond Tier | 8 hours | +25% resource yield | 30 items | +1 hr per item |
| Club Tier | 8 hours | +25% resource yield | 60 items | +2 hr per item |

**Progressive Scaling Mechanics:**
```typescript
// Base resource yield (amount gathered per harvest action)
const baseResourceYield = 1.0;

// Calculate total boost multiplier (stacks additively per boost)
const activeBoosts = player.activeBoosts; // Array of active boost types
let yieldMultiplier = 1.0;

if (activeBoosts.includes('speed')) yieldMultiplier += 0.25;  // +25% resources
if (activeBoosts.includes('heart')) yieldMultiplier += 0.25;  // +25% resources
if (activeBoosts.includes('diamond')) yieldMultiplier += 0.25; // +25% resources
if (activeBoosts.includes('club')) yieldMultiplier += 0.25;    // +25% resources

// With all 4 boosts active: 1.0 + (4 × 0.25) = 2.0x resource yield (100% increase)
const effectiveResourceYield = baseResourceYield * yieldMultiplier;

// Example: 4/4 boosts active = 2x resources per harvest action
```

**Resource Yield Stacking Examples:**
- **0 boosts:** 1.0x (base yield) → 1,000 Metal per harvest
- **1 boost:** 1.25x yield → 1,250 Metal per harvest
- **2 boosts:** 1.50x yield → 1,500 Metal per harvest
- **3 boosts:** 1.75x yield → 1,750 Metal per harvest
- **4 boosts (max):** 2.0x yield → 2,000 Metal per harvest

**Shrine Offering & Time Extension Mechanic:**
- **Maximum Duration:** 8 hours per boost type
- **Dynamic Extension:** Players can donate items to extend any active boost
- **Item Value System:**
  * Common items: +15 minutes
  * Rare items: +30 minutes
  * Epic items: +1 hour
  * Legendary items: +2 hours
- **Cap Enforcement:** Total duration cannot exceed 8 hours per boost
- **Extension Formula:** `newDuration = min(currentDuration + itemValue, 8 hours)`

**Boost Mechanics (Updated):**
- **Four independent timers** (one per suit type)
- Each boost operates independently
- Boosts stack with permanent digger bonuses
- Boosts apply to BOTH Metal and Energy harvesting
- UI displays all four timers simultaneously (e.g., "Speed: 2h 15m, Heart: 5h 30m")
- Players can donate items at any time to extend duration
- Expired boosts are automatically removed

### **2.3 Item Sacrifice System**

**Accepted Items:**
- Rose (stat boosters from caves)
- Red Sun (stat boosters)
- Red Skin (stat boosters)
- Truck (tradeables)
- Salmon (tradeables)
- Divine (tradeables)

**Sacrifice Rules:**
- Items are consumed permanently when activating boost
- Can sacrifice ANY combination of items to reach cost
- Example: 3 Rose + 7 Truck = 10 items → Heart Boost (1hr)

### **2.4 UI Interface (Shrine Style)**

**"Shrine of Remembrance" Modal:**
- Shows 4 boost options in grid layout
- Each boost displays:
  * Boost tier icon (Speed/Heart/Diamond/Club)
  * Duration (1h/4h/8h)
  * Item cost (3/10/30/60)
  * Effect: "+25% Resource Yield"
  * Timer if active ("0h 11m" countdown)
- "Available Items" section shows player's tradeable/stat items
- "Offer Tribute" button grid:
  * "Give 3" → Speed Tier Boost (1hr, +25% resources)
  * "Give 10" → Heart Tier Boost (1hr, +25% resources)
  * "Give 30" → Diamond Tier Boost (4hr, +25% resources)
  * "Give 60" → Club Tier Boost (8hr, +25% resources)
- "130 min each (60 items)" info text

**Active Boost Display (Main UI):**
- "Shrine Buffs" panel in sidebar
- Shows all active boost tiers with timers
- Example: "🔶 Diamond 0h 11m | ♥️ Heart 2h 45m"
- Total yield multiplier displayed: "Current Gathering Bonus: +50% (2 boosts active)"

---

## 🏭 SECTION 3: FACTORY SLOT SYSTEM

### **3.1 Factory Levels & Progression**

| Level | Max Slots | Regen Rate (slots/hr) | Upgrade Cost (Metal) | Upgrade Cost (Energy) |
|-------|-----------|------------------------|----------------------|----------------------|
| 1 | 10,000 | 1,000 | - | - |
| 2 | 15,000 | 1,250 | 5,000 | 2,500 |
| 3 | 20,000 | 1,500 | 10,000 | 5,000 |
| 4 | 30,000 | 2,000 | 20,000 | 10,000 |
| 5 | 45,000 | 2,750 | 40,000 | 20,000 |
| 6 | 60,000 | 3,500 | 75,000 | 37,500 |
| 7 | 75,000 | 4,250 | 125,000 | 62,500 |
| 8 | 90,000 | 5,000 | 200,000 | 100,000 |
| 9 | 100,000 | 5,500 | 350,000 | 175,000 |
| 10 | 120,000 | 6,000 | 600,000 | 300,000 |

**Key Design Principles:**
- Starting factories (Level 1) provide meaningful slot count (10K)
- Exponential cost scaling discourages easy max-level factories
- Higher levels provide significant advantages (encourage competition)
- Max-level factory (120K slots) is a major achievement

### **3.2 Slot Regeneration System**

**Mechanics:**
- Background job runs every 15 minutes
- Calculates elapsed time since last regeneration
- Formula: `slotsToAdd = Math.floor(elapsedHours * factory.regenerationRate)`
- Capped at `factory.maxSlots`
- Updates `factory.lastRegeneration` timestamp

**Example:**
- Level 5 factory: 2,750 slots/hour
- If 30 minutes elapsed: 2,750 / 2 = 1,375 slots added
- Current: 30,000 / 45,000 → After regen: 31,375 / 45,000

### **3.3 Database Schema**

```typescript
Factory {
  _id: ObjectId;
  x: number;
  y: number;
  level: number;                  // 1-10
  owner: ObjectId | null;          // Player ID or null if unclaimed
  capturedAt: Date | null;
  slots: {
    current: number;                // Currently available slots
    max: number;                    // Max slots (based on level)
    regenerationRate: number;       // Slots per hour
    lastRegeneration: Date;         // For calculating regen
  };
  defense: number;                  // Factory defense power
  cooldownUntil: Date | null;      // Attack cooldown
}
```

---

## ⚔️ SECTION 4: UNIT BUILDING SYSTEM (40 UNITS)

### **4.1 Unit Statistics Structure**

```typescript
interface Unit {
  id: string;                // Unique identifier
  name: string;             // Display name
  type: 'strength' | 'defense';
  stats: {
    power: number;           // STR or DEF contribution
    hp: number;              // Health points for PVP
    slots: number;           // Factory slots consumed
  };
  cost: {
    metal: number;
    energy: number;
  };
  description: string;      // Flavor text
}
```

### **4.2 Strength Units (20 Types)**

| Tier | Unit Name | STR | HP | Slots | Metal Cost | Energy Cost |
|------|-----------|-----|----|----|------|-----|------------|
| 1 | Rifleman | 5 | 10 | 200 | 500 | 250 |
| 1 | Scout | 8 | 15 | 300 | 800 | 400 |
| 1 | Infantry | 12 | 20 | 450 | 1,200 | 600 |
| 1 | Grenadier | 18 | 25 | 650 | 1,800 | 900 |
| 2 | Assault Trooper | 25 | 35 | 1,000 | 3,000 | 1,500 |
| 2 | Flame Trooper | 35 | 45 | 1,400 | 4,500 | 2,250 |
| 2 | Heavy Infantry | 50 | 60 | 2,000 | 7,000 | 3,500 |
| 2 | Sniper | 40 | 50 | 1,600 | 5,500 | 2,750 |
| 3 | Battle Tank | 80 | 100 | 3,500 | 12,000 | 6,000 |
| 3 | Artillery | 100 | 120 | 4,500 | 16,000 | 8,000 |
| 3 | War Mech | 150 | 180 | 7,000 | 25,000 | 12,500 |
| 3 | Siege Engine | 200 | 250 | 10,000 | 35,000 | 17,500 |
| 4 | Drone Swarm | 120 | 140 | 5,500 | 20,000 | 10,000 |
| 4 | Gunship | 180 | 200 | 8,500 | 30,000 | 15,000 |
| 4 | Bomber | 250 | 300 | 12,000 | 45,000 | 22,500 |
| 4 | Orbital Strike | 400 | 500 | 20,000 | 75,000 | 37,500 |
| 5 | Titan Mech | 500 | 600 | 25,000 | 100,000 | 50,000 |
| 5 | Dreadnought | 750 | 900 | 40,000 | 150,000 | 75,000 |
| 5 | Superweapon | 1,000 | 1,200 | 60,000 | 250,000 | 125,000 |
| 5 | Apocalypse Unit | 1,500 | 1,800 | 100,000 | 500,000 | 250,000 |

### **4.3 Defense Units (20 Types)**

| Tier | Unit Name | DEF | HP | Slots | Metal Cost | Energy Cost |
|------|-----------|-----|----|----|------------|-------------|
| 1 | Barrier | 5 | 15 | 200 | 500 | 250 |
| 1 | Bunker | 8 | 20 | 300 | 800 | 400 |
| 1 | Guard Tower | 12 | 25 | 450 | 1,200 | 600 |
| 1 | Wall Section | 18 | 30 | 650 | 1,800 | 900 |
| 2 | Turret | 25 | 40 | 1,000 | 3,000 | 1,500 |
| 2 | Fortification | 35 | 50 | 1,400 | 4,500 | 2,250 |
| 2 | Cannon Battery | 50 | 70 | 2,000 | 7,000 | 3,500 |
| 2 | Watchtower | 40 | 55 | 1,600 | 5,500 | 2,750 |
| 3 | Fortress | 80 | 110 | 3,500 | 12,000 | 6,000 |
| 3 | Defense Grid | 100 | 130 | 4,500 | 16,000 | 8,000 |
| 3 | Shield Generator | 150 | 200 | 7,000 | 25,000 | 12,500 |
| 3 | Missile Silo | 200 | 280 | 10,000 | 35,000 | 17,500 |
| 4 | Laser Defense | 120 | 150 | 5,500 | 20,000 | 10,000 |
| 4 | EMP Tower | 180 | 220 | 8,500 | 30,000 | 15,000 |
| 4 | Ion Cannon | 250 | 320 | 12,000 | 45,000 | 22,500 |
| 4 | Planetary Shield | 400 | 550 | 20,000 | 75,000 | 37,500 |
| 5 | Command Bunker | 500 | 650 | 25,000 | 100,000 | 50,000 |
| 5 | Citadel | 750 | 950 | 40,000 | 150,000 | 75,000 |
| 5 | Mega Fortress | 1,000 | 1,300 | 60,000 | 250,000 | 125,000 |
| 5 | Invincible Wall | 1,500 | 2,000 | 100,000 | 500,000 | 250,000 |

**Design Notes:**
- Slot costs scale with unit power (cheap units = low slots, powerful units = high slots)
- HP values allow for future PVP combat system
- Tier 1-2: Early game units (affordable, low slots)
- Tier 3-4: Mid game units (expensive, moderate slots)
- Tier 5: Endgame units (very expensive, high slots)
- Perfect balance: Multiple cheap units vs few powerful units

---

## 🎮 SECTION 5: AUTO-FILL UNIT BUILDING

### **5.1 Auto-Fill Algorithm**

**When player selects a unit type to build:**
1. Calculate total available slots across ALL owned factories
2. Calculate max buildable based on resources
3. Calculate max buildable based on total slots
4. Take minimum of resource-limited and slot-limited
5. Auto-populate quantity input with calculated max
6. Distribute units across factories efficiently

**Example:**
- Player owns 3 factories: 10K, 15K, 8K slots available = 33K total
- Wants to build "Assault Trooper" (1,000 slots each)
- Has 100,000 Metal, 50,000 Energy
- Resource limit: 100K / 3K = 33 units
- Slot limit: 33K / 1K = 33 units
- **Auto-fill: 33 units**

### **5.2 Distribution Algorithm**

**Efficient Slot Distribution:**
```typescript
function distributeUnits(unitSlotCost: number, quantity: number, factories: Factory[]) {
  const distribution: { factoryId: string; count: number }[] = [];
  let remaining = quantity;
  
  // Sort factories by available slots (descending)
  const sorted = factories.sort((a, b) => b.slots.current - a.slots.current);
  
  for (const factory of sorted) {
    const maxFromThisFactory = Math.floor(factory.slots.current / unitSlotCost);
    const assigned = Math.min(maxFromThisFactory, remaining);
    
    if (assigned > 0) {
      distribution.push({ factoryId: factory._id, count: assigned });
      remaining -= assigned;
    }
    
    if (remaining === 0) break;
  }
  
  return distribution;
}
```

### **5.3 UI Interface**

**Build Unit Modal:**
- Unit card display: Name, STR/DEF, HP, Slot Cost
- Resource costs: Metal & Energy
- **Quantity Input:**
  * Pre-filled with calculated max
  * MAX button to recalculate
  * Manual override allowed
- **Factory Summary:**
  * "Available Factories: 10"
  * "Total Slots: 90,000"
  * "Slots After Build: 45,000"
- **Build Button:** "Build 81 Mine Fields"

---

## ⚔️ SECTION 6: PVP COMBAT SYSTEM (COMPREHENSIVE)

### **6.1 Combat Overview**

DarkFrame features a sophisticated PVP combat system with three attack types:

| Attack Type | Target | Primary Unit | Resource Steal | Return to Base |
|-------------|--------|--------------|----------------|----------------|
| **Player Pike Attack** | Player on tile | Pikemen (lowest tier) | Metal OR Energy | Yes (on loss) |
| **Base Attack** | Player's home base | All units | Metal OR Energy | No |
| **Factory Attack** | Factory tile | All units | None (capture factory) | No |

### **6.2 Player Pike Attack (Master Pikers)**

**Trigger Conditions:**
- Attacker and defender both on same non-base tile
- Attacker initiates attack via "Attack Player" button
- System identifies "Pikemen" (Tier 1 STR unit) as battle unit

**Battle Mechanics:**
```typescript
interface PikeAttack {
  attacker: {
    username: string;
    pikemenCount: number;
    pikemenHP: number;        // Total HP of all Pikemen
  };
  defender: {
    username: string;
    pikemenCount: number;
    pikemenHP: number;
  };
}

// Battle Resolution
const attackerTotalHP = attacker.pikemenCount * pikemenUnitHP;
const defenderTotalHP = defender.pikemenCount * pikemenUnitHP;

if (attackerTotalHP > defenderTotalHP) {
  // Attacker wins
  const capturedUnits = Math.floor(defender.pikemenCount * 0.15); // 15% capture rate
  const destroyedUnits = defender.pikemenCount - capturedUnits;
  
  // Defender loses all Pikemen, teleported to base
  // Attacker gains captured Pikemen, steals resources
} else {
  // Defender wins
  const attackerLosses = Math.floor(attacker.pikemenCount * 0.30); // 30% loss rate
  
  // Attacker loses units, no capture
}
```

**Post-Battle:**
- **Winner:** Gains captured units + steals resources (player chooses Metal OR Energy)
- **Loser:** All Pikemen destroyed/captured, teleported to home base automatically
- Battle report generated for both players

### **6.3 Base Attack System**

**Visual Base Display:**
- When attacking a player's base, show 3D base visualization
- Base displays player's rank-based buildings (Rank 1-6 assets)
- Shows: "JUNIE.STREICH94'S BASE" header
- Displays loot available: "Metal (M): Penny (5)"

**Attack Mechanics:**
```typescript
interface BaseAttack {
  attacker: {
    username: string;
    totalStrength: number;      // All STR units combined
    unitComposition: UnitCount[]; // Which units participating
  };
  defender: {
    username: string;
    totalDefense: number;        // All DEF units + base defense
    unitComposition: UnitCount[];
    baseDefenseBonus: number;    // 20% bonus for defending
  };
}

// Base Defense Bonus
const effectiveDefense = defender.totalDefense * 1.20; // 20% home advantage

// Battle Calculation (Unit-by-Unit)
// System matches units 1-on-1, comparing HP and power
// Lower-tier units fight first, working up to higher tiers
```

**Unit Casualties & Capture:**
- Each unit type battles independently
- Losing side loses units based on damage taken
- Winner can capture 10-15% of defeated units
- Resources stolen: Winner chooses Metal OR Energy (up to 20% of defender's total)

**Example Battle Report:**
```
Battle Report: Base Attack

Attacker: Fame
- Strength (def): 1,333
- Defense Gained: 794

Captured Units:
- Attack Dog: 4
- Flame Tower: 5
- Fire Crossbow Man (def): 5
- Missile Tower: 6

Defender: nicky.schowalter2
- Defense Lost: 1,683
- Units Lost: (see above)

Resources Won: 279,222 Metal
```

### **6.4 Detailed Battle Resolution Algorithm**

**Step 1: Unit Sorting**
```typescript
// Sort units by tier (lowest to highest)
const sortedAttackerUnits = sortByTier(attacker.units);
const sortedDefenderUnits = sortByTier(defender.units);
```

**Step 2: Unit-by-Unit Combat**
```typescript
interface UnitBattle {
  attackerUnit: UnitType;
  attackerCount: number;
  attackerTotalHP: number;
  
  defenderUnit: UnitType;
  defenderCount: number;
  defenderTotalHP: number;
  
  result: {
    winner: 'attacker' | 'defender';
    attackerLosses: number;
    defenderLosses: number;
    capturedUnits: number;
  };
}

// Example: Pikemen vs Wall
Attacker: 23 Pikemen (HP: 10 each = 230 total HP)
Defender: 24 Wall (HP: 15 each = 360 total HP)

Result: Defender wins
- Attacker loses: 23 Pikemen (all destroyed)
- Defender loses: 10 Wall (damaged)
- No captures (attacker lost)
```

**Step 3: Resource Theft Calculation**
```typescript
if (attackerWins) {
  const attackerChoice = 'metal' | 'energy'; // Player selects before attack
  const maxSteal = Math.floor(defender[attackerChoice] * 0.20); // 20% cap
  const actualSteal = Math.min(maxSteal, defender[attackerChoice]);
  
  // Transfer resources
  attacker[attackerChoice] += actualSteal;
  defender[attackerChoice] -= actualSteal;
}
```

### **6.5 Battle Log System**

**Log Types:**
1. **Attack Logs** - Battles you initiated
2. **Defense Logs** - Battles against you
3. **Landmine Logs** - Future feature (trap system)

**Battle Log Schema:**
```typescript
interface BattleLog {
  _id: ObjectId;
  timestamp: Date;
  battleType: 'pike_attack' | 'base_attack' | 'factory_attack';
  
  attacker: {
    playerId: ObjectId;
    username: string;
    totalStrength: number;
    totalDefense: number;
    unitsUsed: UnitCount[];
    resourceTarget: 'metal' | 'energy' | null;
  };
  
  defender: {
    playerId: ObjectId;
    username: string;
    totalStrength: number;
    totalDefense: number;
    unitsUsed: UnitCount[];
  };
  
  battleDetails: {
    unitBattles: UnitBattle[];     // Detailed unit-by-unit results
    totalAttackerLosses: number;
    totalDefenderLosses: number;
    capturedUnits: CapturedUnit[];
    resourcesStolen: { type: 'metal' | 'energy', amount: number } | null;
  };
  
  result: {
    winner: 'attacker' | 'defender';
    attackerDamageTaken: number;
    defenderDamageTaken: number;
    defenderReturnedToBase: boolean; // True for pike attacks
  };
  
  // Metadata
  battleLocation: { x: number, y: number };
  viewed: { attacker: boolean, defender: boolean }; // Track if players viewed report
}
```

**Battle Report UI:**
```
┌─────────────────────────────────────────────────┐
│ [← Back to History]      Battle Report          │
├─────────────────────────────────────────────────┤
│ Fame                    vs  nicky.schowalter2   │
│ Strength (def): 1,333       Defense Lost: 1,683 │
│ Defense Gained: 794                             │
├─────────────────────────────────────────────────┤
│ Pikemen: 5 lost                                 │
│ Archers: 15 lost            Trenches: 22 lost   │
│ Swordsman: 4 lost           Tranches: 16 lost   │
│ Medusas: 10 lost            Monks: 18 lost      │
│ Metalon: 1 lost             Landmines: 10 lost  │
│ Horseback Rider: 2 lost     Attack Dog: 8 lost  │
│ Cross Bow Man: 2 lost       HC Turret: 12 lost  │
│ Kamikaze Man: 12 lost       Flame Tower: 7 lost │
│ Fire Archer: 1 lost         Archers Tower: 6 lost│
│ Flamethrower: 3 lost        Pelican Attack Dog: 10 lost│
├─────────────────────────────────────────────────┤
│ Resources Won: 279,222 Metal                    │
├─────────────────────────────────────────────────┤
│ Captured Units:                                 │
│ - Attack Dog: 4                                 │
│ - Flame Tower: 5                                │
│ - Fire Crossbow Man (def): 5                    │
│ - Missile Tower: 6                              │
└─────────────────────────────────────────────────┘
```

### **6.6 Battle Initiation Flow**

**Pike Attack:**
1. Player moves to tile with another player
2. "Attack Player" button appears in UI
3. Click button → Confirmation modal:
   - "Attack [username] with Pikemen?"
   - "Resource Target: [Metal / Energy]"
   - "Risk: You will be returned to base if you lose"
4. Confirm → Battle resolves instantly
5. Battle report generated for both players
6. Loser teleported to base coordinates

**Base Attack:**
1. Player clicks on another player's name/base on map
2. "Attack Base" button appears
3. Click button → Base visualization modal opens
4. Shows: Base image, loot available, defender stats
5. Confirmation: "Attack with all units? Target: [Metal / Energy]"
6. Confirm → Full army battle resolution
7. Battle report shows detailed casualties and captures

### **6.7 Return to Base Mechanic**

**When Triggered:**
- Pike attack loss (attacker or defender)
- Specific ability activations (future)

**Behavior:**
```typescript
async function returnPlayerToBase(playerId: ObjectId) {
  const player = await Player.findById(playerId);
  
  // Find player's base tile (where they spawned)
  const baseTile = await Tile.findOne({ 
    type: 'base', 
    ownerId: playerId 
  });
  
  if (baseTile) {
    player.x = baseTile.x;
    player.y = baseTile.y;
    await player.save();
    
    // Notification: "You have been returned to your base!"
  }
}
```

### **6.8 Unit Capture Mechanics**

**Capture Rates:**
- Pike Attack Winner: 10-15% of loser's Pikemen
- Base Attack Winner: 10-15% of ALL defeated units
- Factory Attack Winner: No unit capture (factory ownership only)

**Capture Distribution:**
```typescript
function calculateCaptures(defeatedUnits: UnitCount[], captureRate: number): UnitCount[] {
  return defeatedUnits.map(unit => ({
    unitId: unit.unitId,
    captured: Math.floor(unit.lost * captureRate),
  }));
}
```

**Adding Captured Units to Winner:**
```typescript
async function awardCapturedUnits(winnerId: ObjectId, capturedUnits: UnitCount[]) {
  const winner = await Player.findById(winnerId);
  
  for (const capture of capturedUnits) {
    const existingUnit = winner.units.find(u => u.unitId === capture.unitId);
    
    if (existingUnit) {
      existingUnit.quantity += capture.captured;
    } else {
      winner.units.push({
        unitId: capture.unitId,
        quantity: capture.captured,
      });
    }
  }
  
  await winner.save();
}
```

### **6.9 Database Schema Updates**

**Player Schema Additions:**
```typescript
Player {
  // ... existing fields ...
  
  battleStats: {
    pikeAttacks: { initiated: number, won: number, lost: number };
    baseAttacks: { initiated: number, won: number, lost: number };
    baseDefenses: { total: number, won: number, lost: number };
    totalResourcesStolen: { metal: number, energy: number };
    totalResourcesLost: { metal: number, energy: number };
    unitsCaptured: number;
    unitsLost: number;
  };
  
  baseCoordinates: { x: number, y: number }; // Home base location
}
```

**Tile Schema Additions:**
```typescript
Tile {
  // ... existing fields ...
  
  // For base tiles only
  ownerId: ObjectId | null;     // Player who owns this base
  baseRank: number;             // 1-6 for visual base display
}
```

---

## 🏢 SECTION 7: FACTORY MANAGEMENT PANEL

### **6.1 Factory List View**

**Display Columns:**
- Factory ID (coordinates X, Y)
- Level (1-10)
- Slots (Current / Max)
- Regeneration Rate (per hour)
- Units Assigned (count)
- Upgrade Cost (if not max level)
- Actions (Upgrade, Abandon)

**Example Row:**
```
Factory (113, 5) | Level 11 | Slots: 96,000 / 96,000 | Regen: 1,850/hr | Units: 0 | [Upgrade] [Abandon]
```

### **6.2 Mass Abandonment System**

**Abandon Empty Button:**
- Scans all owned factories
- Identifies factories with `slots.current === slots.max` (no units built)
- Confirmation modal: "Abandon 5 empty factories?"
- Sets `factory.owner = null` for all empty factories
- Instant execution

**Abandon All Button:**
- Confirmation modal with WARNING
- "This will abandon ALL 10 factories, including those with units. This action cannot be undone."
- Requires typing "CONFIRM" to proceed
- Sets `factory.owner = null` for ALL owned factories
- Returns slots and units (units are destroyed)

### **6.3 Factory Upgrade System**

**Upgrade Button:**
- Check if player has required Metal & Energy
- Deduct resources
- Increment `factory.level`
- Update `factory.slots.max` and `factory.slots.regenerationRate`
- Show success notification
- Refresh factory list

---

## 💪 SECTION 8: POWER BALANCE SYSTEM

### **7.1 Balance Calculation**

**Formula:**
```typescript
const totalSTR = player.units.filter(u => u.type === 'strength').reduce((sum, u) => sum + u.stats.power, 0);
const totalDEF = player.units.filter(u => u.type === 'defense').reduce((sum, u) => sum + u.stats.power, 0);

const ratio = Math.min(totalSTR, totalDEF) / Math.max(totalSTR, totalDEF);

let balanceMultiplier: number;
if (ratio < 0.7) {
  balanceMultiplier = 0.5; // 50% penalty (severely imbalanced)
} else if (ratio >= 0.7 && ratio <= 1.5) {
  balanceMultiplier = 1.0; // No penalty (balanced)
} else {
  balanceMultiplier = 0.8; // 20% penalty (moderately imbalanced)
}

const effectivePower = Math.floor((totalSTR + totalDEF) * balanceMultiplier);
```

### **7.2 Balance Indicator UI**

**Visual Meter:**
- Green zone: 0.7 - 1.5 ratio (balanced)
- Yellow zone: 0.5 - 0.7 or 1.5 - 2.0 ratio (warning)
- Red zone: < 0.5 or > 2.0 ratio (penalty)

**Warning Messages:**
- "⚠️ Your army is unbalanced! Build more Defense units."
- "⚠️ Too much Defense! Build Strength units to balance."

---

## 🏆 SECTION 9: COMPREHENSIVE LEADERBOARD SYSTEM

### **8.1 Multi-Category Rankings (Top Lists Page)**

Based on reference game screenshots, implement 10 distinct leaderboard categories:

| Leaderboard | Metric | Description |
|-------------|--------|-------------|
| **Top Factory Upgraders** | Upgrades Count | Total factory upgrades completed |
| **Top Factory Smashers** | Downgrades Count | Factories successfully downgraded via attacks |
| **Top Shrine Tributes** | Tribute Items (Week) | Cave items sacrificed at Boost Center this week |
| **Master Pikers** | Factories Captured | Total factories captured from other players |
| **Siege Masters** | Attacks Completed | Total successful factory attacks |
| **Cave Legends** | Caves Entered (Week) | Unique cave tiles explored this week |
| **Tree Huggers** | Forests Explored (Week) | Forest tiles explored this week |
| **Hoarders** | Total Inventory | Combined Metal + Energy + Bank resources |
| **Power Rankings** | Effective Power | STR + DEF with balance penalty applied |
| **XP Legends** | Total XP | Experience points earned (future leveling system) |

### **8.2 Leaderboard Database Schema**

```typescript
interface PlayerStats {
  playerId: ObjectId;
  username: string;
  
  // Power & Combat
  totalStrength: number;           // Sum of all STR units
  totalDefense: number;            // Sum of all DEF units
  effectivePower: number;          // With balance penalty
  
  // Factory Statistics
  factoriesOwned: number;
  factoriesCaptured: number;       // Lifetime captures (Master Pikers)
  factoryUpgrades: number;         // Total upgrades (Factory Upgraders)
  factoryDowngrades: number;       // Successful attacks (Factory Smashers)
  
  // Combat Statistics
  attacksInitiated: number;
  attacksWon: number;              // Siege Masters
  attacksLost: number;
  defensesWon: number;
  defensesLost: number;
  
  // Resource Statistics
  totalInventory: number;          // Metal + Energy + Banked (Hoarders)
  metalMined: number;
  energyHarvested: number;
  
  // Exploration (Weekly Reset)
  cavesEntered: number;            // Cave Legends (week)
  forestsExplored: number;         // Tree Huggers (week)
  
  // Shrine Statistics (Weekly Reset)
  shrineTributes: number;          // Items sacrificed this week
  
  // XP & Progression
  totalXP: number;
  level: number;
  
  // Metadata
  lastActive: Date;
  weeklyResetAt: Date;             // For weekly stats
}
```

### **8.3 Top Lists Page UI**

**Full-Page Leaderboard View:**
- Accessible via main navigation ("Rankings" or "Top Lists" button)
- Grid layout showing all 10 leaderboards simultaneously (2 columns x 5 rows)
- Each leaderboard shows Top 10 players
- Current player highlighted with yellow background if in Top 10
- Real-time updates via WebSocket (every 60 seconds)

**Individual Leaderboard Card:**
```
┌─────────────────────────────────────┐
│ 📊 Top Factory Upgraders            │
├──────┬──────────────┬───────────────┤
│ Rank │ Name         │ Upgrades      │
├──────┼──────────────┼───────────────┤
│  1   │ Firedevil    │ 6179          │
│  2   │ balikho      │ 1677          │
│  3   │ rsiakins     │ 1299          │
│ ...  │ ...          │ ...           │
└──────┴──────────────┴───────────────┘
```

### **8.4 Caching & Performance**

**Redis Caching Strategy:**
- Cache all leaderboards with 5-minute TTL
- Background job recalculates rankings every 5 minutes
- Key format: `leaderboard:{category}:top100`
- Invalidate cache on major player actions (factory capture, level up)

**Weekly Reset Job:**
- Cron job runs every Monday at 00:00 UTC
- Resets weekly statistics: `cavesEntered`, `forestsExplored`, `shrineTributes`
- Archives previous week's data for historical tracking

---

## 🔐 SECTION 10: ADMIN CONTROL PANEL

### **9.1 Admin Role & Authentication**

**Admin User Schema:**
```typescript
User {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  role: 'player' | 'admin' | 'moderator';
  permissions: string[];          // Fine-grained access control
  createdAt: Date;
}

// Admin Permissions
enum AdminPermission {
  VIEW_LOGS = 'view_logs',
  VIEW_PLAYERS = 'view_players',
  BAN_PLAYERS = 'ban_players',
  MODIFY_RESOURCES = 'modify_resources',
  MODIFY_FACTORIES = 'modify_factories',
  VIEW_ANALYTICS = 'view_analytics',
  SYSTEM_SETTINGS = 'system_settings',
}
```

**Admin Access:**
- Separate admin login route: `/admin/login`
- JWT with `role: 'admin'` claim
- Admin panel route protected: `/admin/dashboard`
- Session timeout: 30 minutes (higher security)

### **9.2 Comprehensive Activity Logging System**

**Action Log Schema:**
```typescript
interface ActionLog {
  _id: ObjectId;
  timestamp: Date;
  playerId: ObjectId | null;      // null for system actions
  username: string | null;
  actionType: ActionType;
  category: LogCategory;
  
  // Action Details
  details: {
    // Dynamic object containing action-specific data
    [key: string]: any;
  };
  
  // Context
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  
  // Metadata
  success: boolean;
  errorMessage?: string;
  executionTime?: number;         // ms
}

enum ActionType {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  SESSION_EXPIRED = 'session_expired',
  
  // Movement
  MOVE = 'move',
  TELEPORT = 'teleport',
  
  // Resource Actions
  HARVEST_METAL = 'harvest_metal',
  HARVEST_ENERGY = 'harvest_energy',
  CAVE_ENTER = 'cave_enter',
  CAVE_ITEM_COLLECT = 'cave_item_collect',
  
  // Banking
  BANK_DEPOSIT = 'bank_deposit',
  BANK_WITHDRAW = 'bank_withdraw',
  BANK_EXCHANGE = 'bank_exchange',
  
  // Factory Actions
  FACTORY_CAPTURE = 'factory_capture',
  FACTORY_ATTACK = 'factory_attack',
  FACTORY_DEFEND = 'factory_defend',
  FACTORY_UPGRADE = 'factory_upgrade',
  FACTORY_ABANDON = 'factory_abandon',
  
  // Unit Actions
  UNIT_BUILD = 'unit_build',
  UNIT_DESTROY = 'unit_destroy',
  
  // Shrine/Boost
  SHRINE_TRIBUTE = 'shrine_tribute',
  BOOST_ACTIVATE = 'boost_activate',
  BOOST_EXPIRE = 'boost_expire',
  
  // Admin Actions
  ADMIN_BAN_PLAYER = 'admin_ban_player',
  ADMIN_MODIFY_RESOURCES = 'admin_modify_resources',
  ADMIN_MODIFY_FACTORY = 'admin_modify_factory',
  
  // System Events
  SERVER_START = 'server_start',
  SERVER_SHUTDOWN = 'server_shutdown',
  CRON_JOB_RUN = 'cron_job_run',
}

enum LogCategory {
  AUTH = 'auth',
  MOVEMENT = 'movement',
  RESOURCE = 'resource',
  COMBAT = 'combat',
  FACTORY = 'factory',
  UNIT = 'unit',
  SHRINE = 'shrine',
  ADMIN = 'admin',
  SYSTEM = 'system',
}
```

**Example Log Entries:**
```typescript
// Factory Attack Log
{
  timestamp: new Date('2025-10-17T15:30:45Z'),
  playerId: ObjectId('...'),
  username: 'darkwarrior',
  actionType: 'factory_attack',
  category: 'combat',
  details: {
    targetFactoryId: ObjectId('...'),
    targetX: 45,
    targetY: 67,
    attackerStrength: 15000,
    defenderStrength: 12000,
    attackerUnitsLost: 50,
    defenderUnitsLost: 80,
    result: 'attacker_victory',
  },
  ipAddress: '192.168.1.100',
  success: true,
  executionTime: 234, // ms
}

// Unit Build Log
{
  timestamp: new Date('2025-10-17T16:45:12Z'),
  playerId: ObjectId('...'),
  username: 'builder123',
  actionType: 'unit_build',
  category: 'unit',
  details: {
    unitType: 'Assault Trooper',
    quantity: 50,
    totalSlots: 50000,
    metalCost: 150000,
    energyCost: 75000,
    factoriesUsed: 3,
  },
  success: true,
  executionTime: 145,
}

// Admin Ban Action
{
  timestamp: new Date('2025-10-17T18:20:00Z'),
  playerId: ObjectId('admin123'),
  username: 'admin_user',
  actionType: 'admin_ban_player',
  category: 'admin',
  details: {
    targetPlayerId: ObjectId('...'),
    targetUsername: 'cheater99',
    reason: 'Using exploits to duplicate resources',
    duration: '7 days',
    bannedUntil: new Date('2025-10-24T18:20:00Z'),
  },
  success: true,
}
```

### **9.3 Admin Dashboard UI**

**Dashboard Layout:**
```
┌────────────────────────────────────────────────────┐
│ 🛡️ DarkFrame Admin Control Panel                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  📊 Live Statistics                                │
│  ┌──────────────────────────────────────────────┐ │
│  │ Active Players: 42                           │ │
│  │ Total Players: 1,247                         │ │
│  │ Factories Controlled: 356 / 500              │ │
│  │ Actions (Last Hour): 12,453                  │ │
│  │ Server Uptime: 72h 45m                       │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  🔍 Player Search                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Search by username...]            [Search]  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  📜 Recent Actions (Real-Time Stream)              │
│  ┌──────────────────────────────────────────────┐ │
│  │ 15:45:23 | darkwarrior | factory_attack      │ │
│  │ 15:45:18 | builder123  | unit_build          │ │
│  │ 15:45:10 | speedster   | harvest_metal       │ │
│  │ 15:45:05 | caveman     | cave_enter          │ │
│  │ [Load More...]                               │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [Player Management] [Factory Map] [Logs] [Stats] │
└────────────────────────────────────────────────────┘
```

### **9.4 Player Management Panel**

**Features:**
- Search players by username, ID, or IP address
- View complete player profile:
  * Resources (Metal, Energy, Banked)
  * Factories owned (with coordinates)
  * Units built (all 40 types)
  * Recent activity log (last 100 actions)
  * Account status (active, banned, suspended)

**Admin Actions:**
- **Ban Player:** Temporary or permanent ban with reason
- **Modify Resources:** Add/subtract Metal or Energy
- **Transfer Factories:** Reassign factory ownership
- **Reset Player:** Wipe player data (with confirmation)
- **Send Message:** System message to player

### **9.5 Advanced Filtering & Analytics**

**Log Filtering:**
```typescript
interface LogQuery {
  // Time Range
  startDate?: Date;
  endDate?: Date;
  
  // Player Filter
  playerId?: ObjectId;
  username?: string;
  ipAddress?: string;
  
  // Action Filters
  actionType?: ActionType[];
  category?: LogCategory[];
  successOnly?: boolean;
  
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy: 'timestamp' | 'executionTime';
  sortOrder: 'asc' | 'desc';
}
```

**Analytics Dashboard:**
- **Hourly Activity Chart:** Actions per hour (last 24 hours)
- **Top Actions:** Most frequent action types
- **Failed Actions:** Actions with errors (for debugging)
- **Average Execution Time:** Performance monitoring
- **Resource Generation Rate:** Total metal/energy harvested per hour
- **Combat Statistics:** Total attacks, success rate, average damage

**Export Functionality:**
- Export logs to CSV (date range, filters applied)
- Export player data for backup/analysis
- Generate reports (weekly/monthly activity summaries)

### **9.6 Real-Time Monitoring**

**WebSocket Integration:**
- Live action stream in admin dashboard
- Real-time player count updates
- Alert system for suspicious activity:
  * Multiple failed login attempts (brute force detection)
  * Rapid resource generation (cheat detection)
  * Unusual factory capture rate
  * Excessive API calls (rate limit violations)

**Alert Schema:**
```typescript
interface SecurityAlert {
  _id: ObjectId;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertType: AlertType;
  playerId?: ObjectId;
  username?: string;
  description: string;
  resolved: boolean;
  resolvedBy?: ObjectId;
  resolvedAt?: Date;
}

enum AlertType {
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SUSPICIOUS_RESOURCE_GAIN = 'suspicious_resource_gain',
  RAPID_FACTORY_CAPTURE = 'rapid_factory_capture',
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  DUPLICATE_LOGIN = 'duplicate_login',
}
```

### **9.7 Database Schema for Admin System**

```typescript
// Add to Player Schema
Player {
  // ... existing fields ...
  
  accountStatus: {
    isBanned: boolean;
    bannedUntil: Date | null;
    banReason: string | null;
    bannedBy: ObjectId | null;      // Admin who issued ban
  };
  
  security: {
    failedLoginAttempts: number;
    lastFailedLogin: Date | null;
    lockedUntil: Date | null;       // Temporary lockout
  };
}
```

---

## 📊 UPDATED IMPLEMENTATION PRIORITY

**Week 1 (Days 1-3): Foundation**
1. Bank System (deposit, withdrawal, exchange) - 4 hours
2. Boost Center (shrine UI, item sacrifice) - 3 hours
3. Factory Slot Schema & Regeneration Job - 3 hours

**Week 2 (Days 4-6): Combat Core**
4. 40 Unit Definitions (STR & DEF) - 4 hours
5. Unit Building API & Auto-Fill Logic - 6 hours
6. Power Balance Calculation - 2 hours

**Week 3 (Days 7-9): Management & Analytics**
7. Factory Management Panel - 4 hours
8. Mass Abandonment System - 2 hours
9. Comprehensive Leaderboard System (10 categories) - 6 hours

**Week 4 (Days 10-12): Admin & Monitoring**
10. Activity Logging System (all action types) - 6 hours
11. Admin Dashboard & Player Management - 6 hours
12. Real-Time Monitoring & Security Alerts - 4 hours

---

**Total Estimated Time:** 72+ hours  
**Target Completion:** 2025-11-01

