# Phase 3 PVP Combat System - Complete Specification

> Comprehensive breakdown of player-vs-player combat mechanics

**Created:** 2025-10-17  
**Priority:** CRITICAL  
**Estimated Time:** 12 hours  
**Complexity:** 5/5

---

## 🎯 OVERVIEW

DarkFrame features a sophisticated three-tiered PVP combat system:

1. **Player Pike Attacks (Master Pikers)** - Quick tile-based skirmishes
2. **Base Attacks** - Full-scale assaults on player home bases
3. **Factory Attacks** - Strategic captures for territorial control

All combat is **HP-based** with **unit-by-unit resolution**, **capture mechanics**, and **detailed battle logging**.

---

## ⚔️ COMBAT TYPE 1: PLAYER PIKE ATTACKS

### **When It Happens:**
- Two players occupy the same map tile
- Attacker clicks "Attack Player" button
- Battle triggers **immediately**

### **Battle Mechanics:**
- **ONLY Pikemen fight** (Tier 1 STR unit)
- Both players' Pikemen counts compared
- **HP-based calculation:** `totalHP = pikemenCount * pikemenUnitHP`

### **Battle Resolution:**
```typescript
// Example Battle
Attacker: 50 Pikemen × 10 HP = 500 total HP
Defender: 40 Pikemen × 10 HP = 400 total HP

Result: Attacker Wins (500 > 400)

Casualties:
- Defender: All 40 Pikemen lost
- Attacker: 15 Pikemen lost (damaged in battle)

Captures:
- Attacker gains 6 Pikemen (15% of 40)

Resources Stolen:
- Attacker chose "Metal" before attack
- Steals 20% of defender's Metal (up to 50,000 Metal)

Teleport:
- Defender returned to base immediately
```

### **Master Pikers Leaderboard:**
- Tracks pike attack wins (not factory captures!)
- Weekly reset (Monday 00:00 UTC)
- Displays Top 10 players

---

## 🏰 COMBAT TYPE 2: BASE ATTACKS

### **When It Happens:**
- Attacker clicks player's name/base on map
- "Attack Base" button appears
- **Base Visualization Modal** opens

### **Base Visualization:**
```
┌────────────────────────────────────────┐
│      JUNIE.STREICH94'S BASE            │
├────────────────────────────────────────┤
│                                        │
│    [3D Base Image - Rank-Based]        │
│    Shows: Rank 1-6 buildings           │
│    Yellow defensive structures         │
│    Command center in middle            │
│                                        │
├────────────────────────────────────────┤
│ Loot Available:                        │
│ Metal (M): Penny (5)                   │
│                                        │
│ Defender Stats:                        │
│ Clan: 5679                             │
│ Metal (M): Penny (5)                   │
│                                        │
│ [Attack Metal] [Attack Energy] [Cancel]│
└────────────────────────────────────────┘
```

### **Battle Mechanics:**
- **ALL units participate** (full army battle)
- Defender gets **20% home defense bonus**
- Unit-by-unit combat resolution (tier-by-tier)

### **Combat Algorithm:**
```typescript
// Step 1: Calculate Effective Defense
const defenderDefense = defender.totalDefense * 1.20; // 20% home bonus

// Step 2: Sort Units by Tier (lowest to highest)
const attackerUnits = sortByTier(attacker.units); // STR units
const defenderUnits = sortByTier(defender.units); // DEF units

// Step 3: Unit-by-Unit Battles
for (let i = 0; i < maxUnits; i++) {
  const attUnit = attackerUnits[i];
  const defUnit = defenderUnits[i];
  
  if (!attUnit || !defUnit) continue;
  
  const attHP = attUnit.count * attUnit.hp;
  const defHP = defUnit.count * defUnit.hp;
  
  if (attHP > defHP) {
    // Attacker wins this matchup
    defenderLosses.push({ unit: defUnit.id, lost: defUnit.count });
    attackerDamage += defHP; // Attacker takes damage
  } else {
    // Defender wins this matchup
    attackerLosses.push({ unit: attUnit.id, lost: attUnit.count });
    defenderDamage += attHP; // Defender takes damage
  }
}

// Step 4: Determine Overall Winner
const attackerTotalDamage = calculateTotalDamage(attackerUnits);
const defenderTotalDamage = calculateTotalDamage(defenderUnits);

if (attackerTotalDamage > defenderTotalDamage) {
  winner = 'attacker';
} else {
  winner = 'defender';
}
```

### **Post-Battle:**
**Winner:**
- Captures 10-15% of ALL defeated units
- Steals up to 20% of selected resource (Metal OR Energy)
- Gains battle statistics

**Loser:**
- Loses units destroyed in combat
- Loses stolen resources
- **NOT teleported** (only pike attacks teleport)

### **Example Battle Report:**
```
Battle Report: Base Attack

Attacker: Fame
- Strength (def): 1,333
- Defense Gained: 794

Units Lost:
- Pikemen: 5 lost
- Archers: 15 lost
- Swordsman: 4 lost
- Medusas: 10 lost
- Metalon: 1 lost
- Horseback Rider: 2 lost
- Cross Bow Man: 2 lost
- Kamikaze Man: 12 lost
- Fire Archer: 1 lost
- Flamethrower: 3 lost
- Grenadier: 3 lost
- Sniper: 1 lost
- Fire Cavalry: 2 lost
- Heavy Machine Gunner: 1 lost
- Camouflaged Earthbase Man: 1 lost

Defender: nicky.schowalter2
- Defense Lost: 1,683

Units Lost:
- Trenches: 22 lost
- Tranches: 16 lost
- Monks: 18 lost
- Landmines: 10 lost
- Attack Dog: 8 lost
- Cross Bow Man (def): 10 lost
- HC Turret: 12 lost
- Flame Tower: 7 lost
- Archers Tower: 6 lost
- Pelican Attack Dog: 10 lost
- Rabian Attack Dog: 12 lost
- Fire Crossbow Man (def): 5 lost
- HG Turret: 7 lost
- Grenade Turret: 6 lost
- Breakout Tower: 6 lost
- Pollgunner: 5 lost
- Missile Tower: 8 lost
- Heavy Ho Turret: 6 lost
- Mine Field: 20 lost

Resources Won: 279,222 Metal

Captured Units:
- Attack Dog: 4
- Flame Tower: 5
- Fire Crossbow Man (def): 5
- Missile Tower: 6
```

---

## 🏭 COMBAT TYPE 3: FACTORY ATTACKS

### **When It Happens:**
- Player at factory tile not owned by them
- Clicks "Attack Factory" button
- Uses existing factory combat system (Phase 2)

### **Battle Mechanics:**
- Attacker STR vs Factory DEF
- No unit capture
- No resource theft
- **Factory ownership transfer** on win

### **Already Implemented:**
- This system exists from Phase 2
- No changes needed for Phase 3

---

## 📊 BATTLE LOG SYSTEM

### **Three Log Types:**

**1. Attack Logs** - Battles you initiated
**2. Defense Logs** - Battles against you
**3. Landmine Logs** - (Future feature)

### **Battle Log Database Schema:**
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
    homeDefenseBonus: number; // 1.20 for base attacks, 1.00 for pike
  };
  
  battleDetails: {
    unitBattles: {
      attackerUnit: string;
      attackerCount: number;
      attackerHP: number;
      defenderUnit: string;
      defenderCount: number;
      defenderHP: number;
      winner: 'attacker' | 'defender';
      attackerLosses: number;
      defenderLosses: number;
    }[];
    totalAttackerLosses: number;
    totalDefenderLosses: number;
    capturedUnits: {
      unitId: string;
      unitName: string;
      quantity: number;
    }[];
    resourcesStolen: {
      type: 'metal' | 'energy';
      amount: number;
    } | null;
  };
  
  result: {
    winner: 'attacker' | 'defender';
    attackerDamageTaken: number;
    defenderDamageTaken: number;
    defenderReturnedToBase: boolean; // True only for pike attacks
  };
  
  // Metadata
  battleLocation: { x: number, y: number };
  viewed: { attacker: boolean, defender: boolean };
}
```

### **Battle Log UI:**
```
┌─────────────────────────────────────────────────┐
│ Battle History                                  │
├─────────────────────────────────────────────────┤
│ [Attack Logs] [Defense Logs] [Landmine Logs]   │
├─────────────────────────────────────────────────┤
│ Recent Battles:                                 │
│                                                 │
│ ⚔️ 2 hours ago - vs nicky.schowalter2           │
│    Base Attack - WON                            │
│    Captured: 20 units | Stole: 279K Metal      │
│    [View Report]                                │
│                                                 │
│ 🛡️ 5 hours ago - vs junie.streich94            │
│    Pike Attack - LOST                           │
│    Lost: 40 Pikemen | Returned to Base         │
│    [View Report]                                │
│                                                 │
│ ⚔️ 1 day ago - vs darkwarrior                   │
│    Factory Attack - WON                         │
│    Captured: Factory (45, 67)                   │
│    [View Report]                                │
└─────────────────────────────────────────────────┘
```

---

## 🎖️ UNIT CAPTURE MECHANICS

### **Capture Rates:**
- **Pike Attack Winner:** 10-15% of loser's Pikemen
- **Base Attack Winner:** 10-15% of ALL defeated units
- **Factory Attack:** No captures (ownership transfer only)

### **Capture Calculation:**
```typescript
function calculateCaptures(
  defeatedUnits: UnitCount[], 
  captureRate: number = 0.15
): CapturedUnit[] {
  return defeatedUnits.map(unit => ({
    unitId: unit.unitId,
    unitName: unit.unitName,
    captured: Math.floor(unit.lost * captureRate),
  })).filter(u => u.captured > 0);
}
```

### **Adding Captured Units:**
```typescript
async function awardCapturedUnits(
  winnerId: ObjectId, 
  capturedUnits: CapturedUnit[]
) {
  const winner = await Player.findById(winnerId);
  
  for (const capture of capturedUnits) {
    const existingUnit = winner.units.find(u => u.unitId === capture.unitId);
    
    if (existingUnit) {
      // Add to existing unit count
      existingUnit.quantity += capture.captured;
    } else {
      // New unit type captured
      winner.units.push({
        unitId: capture.unitId,
        quantity: capture.captured,
      });
    }
  }
  
  await winner.save();
  
  // Notification: "You captured 6 Pikemen!"
}
```

---

## 🏠 RETURN TO BASE MECHANIC

### **When Triggered:**
- **Pike attack loser ONLY** (either attacker or defender)
- Specific ability activations (future)

### **Implementation:**
```typescript
async function returnPlayerToBase(playerId: ObjectId) {
  const player = await Player.findById(playerId);
  
  // Find player's base tile
  const baseTile = await Tile.findOne({ 
    type: 'base', 
    ownerId: playerId 
  });
  
  if (baseTile) {
    // Teleport player
    player.x = baseTile.x;
    player.y = baseTile.y;
    await player.save();
    
    // Send notification
    await createNotification(playerId, {
      type: 'teleport',
      message: 'You have been returned to your base after losing a pike attack!',
    });
  }
}
```

### **Base Coordinates Storage:**
```typescript
// When player registers, store base coordinates
Player {
  baseCoordinates: {
    x: number;
    y: number;
  };
}

// During map generation
async function assignPlayerBase(playerId: ObjectId) {
  const baseTile = await Tile.findOne({ type: 'base', ownerId: null });
  
  if (baseTile) {
    baseTile.ownerId = playerId;
    await baseTile.save();
    
    // Store in player schema
    await Player.updateOne(
      { _id: playerId },
      { baseCoordinates: { x: baseTile.x, y: baseTile.y } }
    );
  }
}
```

---

## 💰 RESOURCE THEFT SYSTEM

### **Resource Selection:**
- Player chooses BEFORE attacking: "Metal" or "Energy"
- Selection displayed in attack confirmation modal

### **Theft Calculation:**
```typescript
function calculateResourceTheft(
  defender: Player, 
  resourceType: 'metal' | 'energy'
): number {
  const maxStealPercentage = 0.20; // 20% cap
  const availableResource = defender[resourceType];
  
  const maxSteal = Math.floor(availableResource * maxStealPercentage);
  const actualSteal = Math.min(maxSteal, availableResource);
  
  return actualSteal;
}
```

### **Resource Transfer:**
```typescript
async function transferStolenResources(
  winnerId: ObjectId,
  loserId: ObjectId,
  resourceType: 'metal' | 'energy',
  amount: number
) {
  // Deduct from loser
  await Player.updateOne(
    { _id: loserId },
    { $inc: { [resourceType]: -amount } }
  );
  
  // Add to winner
  await Player.updateOne(
    { _id: winnerId },
    { $inc: { [resourceType]: amount } }
  );
  
  // Track in battle statistics
  await Player.updateOne(
    { _id: winnerId },
    { $inc: { [`battleStats.totalResourcesStolen.${resourceType}`]: amount } }
  );
  
  await Player.updateOne(
    { _id: loserId },
    { $inc: { [`battleStats.totalResourcesLost.${resourceType}`]: amount } }
  );
}
```

---

## 📈 BATTLE STATISTICS TRACKING

### **Player Schema Additions:**
```typescript
Player {
  // ... existing fields ...
  
  battleStats: {
    pikeAttacks: {
      initiated: number;    // Total pike attacks started
      won: number;          // Pike attacks won
      lost: number;         // Pike attacks lost
    };
    baseAttacks: {
      initiated: number;    // Base attacks started
      won: number;          // Base attacks won
      lost: number;         // Base attacks lost
    };
    baseDefenses: {
      total: number;        // Times base was attacked
      won: number;          // Successfully defended
      lost: number;         // Base attacks lost
    };
    factoryAttacks: {
      initiated: number;
      won: number;
      lost: number;
    };
    totalResourcesStolen: {
      metal: number;
      energy: number;
    };
    totalResourcesLost: {
      metal: number;
      energy: number;
    };
    unitsCaptured: number;  // Total units captured from enemies
    unitsLost: number;       // Total units lost in battle
  };
  
  baseCoordinates: { x: number, y: number };
}
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### **Week 1: Core Battle Engine (6 hours)**
- [ ] BattleLog schema and database model
- [ ] battleService.ts - Core battle resolution algorithm
- [ ] unitCaptureService.ts - Capture mechanics
- [ ] returnToBase() function
- [ ] resourceTheft() function
- [ ] Battle statistics tracking

### **Week 2: Pike Attack System (3 hours)**
- [ ] `/api/battle/pike-attack` endpoint
- [ ] Pike attack detection (same tile check)
- [ ] Pikemen-only battle resolution
- [ ] Winner/loser determination
- [ ] Capture 10-15% of loser's Pikemen
- [ ] Teleport loser to base
- [ ] Battle report generation

### **Week 3: Base Attack System (3 hours)**
- [ ] `/api/battle/base-attack` endpoint
- [ ] Base visualization modal component
- [ ] 3D base image display (rank-based)
- [ ] Loot preview display
- [ ] Full army battle resolution
- [ ] 20% home defense bonus
- [ ] Unit-by-unit combat algorithm
- [ ] Capture 10-15% of ALL defeated units
- [ ] Resource theft (20% cap)
- [ ] Battle report generation

### **Week 4: Battle Log UI (2 hours)**
- [ ] `/battle-log` page with tabs (Attack / Defense / Landmine)
- [ ] BattleLogList component
- [ ] BattleReportModal component (detailed view)
- [ ] Attack/Defense log filters
- [ ] "View Report" button functionality
- [ ] Mark logs as "viewed"
- [ ] Real-time battle notifications

### **Testing (1 hour)**
- [ ] Pike attack: Winner captures units, loser teleports
- [ ] Base attack: Full army battle, 20% defense bonus
- [ ] Resource theft: 20% cap enforced
- [ ] Unit capture: 10-15% of defeated units
- [ ] Battle log: Both players receive reports
- [ ] Statistics tracking: All battle stats updated

---

**Total Estimated Time:** 12 hours  
**Priority:** CRITICAL (PVP is core gameplay)  
**Dependencies:** Unit Building System (FID-20251017-019)

