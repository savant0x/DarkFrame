# Shrine Boost System - Clarification Document

**Created:** 2025-10-17  
**Purpose:** Clarify the correct understanding of the Shrine boost mechanics

---

## 🎯 CRITICAL CLARIFICATION

### ❌ INCORRECT Understanding (Previous)
- Boosts affect "harvesting speed"
- "Speed Boost" implies movement or action speed
- Terminology suggested speed mechanics exist in game

### ✅ CORRECT Understanding (Current)
- Boosts increase **RESOURCE GATHERING YIELD/QUANTITY**
- They increase the **AMOUNT** of resources obtained per harvest action
- NO speed mechanics exist in the game
- "Speed", "Heart", "Diamond", "Club" are just **tier names**, not effect types

---

## 🏛️ WHAT THE SHRINE DOES

### Core Mechanic
Players sacrifice cave items at the Shrine of Remembrance (located at 1,1) to activate **resource gathering boosts** that increase the quantity of Metal and Energy harvested.

### Effect
- **All 4 boost tiers provide the SAME effect:** +25% resource yield per boost
- They do **NOT** affect:
  * Player movement speed
  * Harvesting action speed/duration
  * Unit production speed
  * Any other "speed" mechanic

### What Actually Happens
```typescript
// Base harvest (no boosts)
harvest() → 1,000 Metal

// With 1 boost active (any tier)
harvest() → 1,250 Metal (+25%)

// With 2 boosts active (any combination)
harvest() → 1,500 Metal (+50%)

// With 3 boosts active
harvest() → 1,750 Metal (+75%)

// With 4 boosts active (maximum)
harvest() → 2,000 Metal (+100%)
```

---

## 📊 THE FOUR BOOST TIERS

All tiers provide **identical effect** (+25% resource yield). They differ ONLY in:
1. **Initial item cost** (how many items to activate)
2. **Initial duration** (how long it lasts)

| Tier Name | Item Cost | Duration | Effect | Time Extension Value |
|-----------|-----------|----------|--------|---------------------|
| Speed Tier | 3 items | 1 hour | +25% yield | +15 min per item |
| Heart Tier | 10 items | 1 hour | +25% yield | +30 min per item |
| Diamond Tier | 30 items | 4 hours | +25% yield | +1 hr per item |
| Club Tier | 60 items | 8 hours | +25% yield | +2 hr per item |

**Tier Names Explanation:**
- "Speed" = Cheapest/fastest tier to activate (NOT speed boost)
- "Heart", "Diamond", "Club" = Higher tier options with longer durations
- All provide same +25% resource yield benefit

---

## 🔄 MULTIPLE BOOSTS (Key Feature)

### Stacking Mechanics
- Players can have **UP TO 4 BOOSTS ACTIVE SIMULTANEOUSLY**
- One boost from each tier (Speed, Heart, Diamond, Club)
- Each adds +25% to total resource yield
- They stack **additively**

### Formula
```typescript
totalYieldMultiplier = 1.0 + (numberOfActiveBoosts × 0.25)

// Examples:
0 boosts = 1.0x (base yield)
1 boost  = 1.25x yield
2 boosts = 1.50x yield
3 boosts = 1.75x yield
4 boosts = 2.00x yield (maximum possible)
```

---

## ⏱️ TIME EXTENSION SYSTEM

### Shrine Offerings
- Players can donate items to **extend active boost durations**
- Maximum duration: **8 hours per boost tier**
- Different item rarities add different amounts of time:
  * Common items: +15 minutes
  * Rare items: +30 minutes
  * Epic items: +1 hour
  * Legendary items: +2 hours

### Extension Example
```
Player has Diamond boost active: 1h 30m remaining
Player donates 5 common items (5 × 15min = 75min)
New duration: 2h 45m remaining (capped at 8hr max)
```

---

## 🎮 UI DISPLAY

### Shrine Modal ("Shrine of Remembrance")
```
┌─────────────────────────────────────────┐
│     Shrine of Remembrance               │
├─────────────────────────────────────────┤
│                                         │
│  [Speed Tier]    [Heart Tier]          │
│  +25% Yield      +25% Yield            │
│  Cost: 3 items   Cost: 10 items        │
│  Duration: 1hr   Duration: 1hr         │
│  ⏱️ Active: 0h 45m                      │
│                                         │
│  [Diamond Tier]  [Club Tier]           │
│  +25% Yield      +25% Yield            │
│  Cost: 30 items  Cost: 60 items        │
│  Duration: 4hr   Duration: 8hr         │
│  ⏱️ Not Active    ⏱️ Active: 3h 12m      │
│                                         │
├─────────────────────────────────────────┤
│ Current Gathering Bonus: +50%          │
│ (2 boosts active)                      │
│                                         │
│ Available Items: 47                    │
└─────────────────────────────────────────┘
```

### Main Game UI
```
┌─────────────────────┐
│ Shrine Buffs        │
├─────────────────────┤
│ ⚡ Speed: 0h 45m    │
│ 🔶 Diamond: 3h 12m │
│                     │
│ Total Bonus: +50%   │
└─────────────────────┘
```

---

## 🔧 IMPLEMENTATION NOTES

### Terminology to Use
- ✅ "Resource gathering yield"
- ✅ "Resource quantity bonus"
- ✅ "Harvest amount multiplier"
- ✅ "Gathering efficiency" (acceptable)
- ❌ "Harvesting speed"
- ❌ "Speed boost"
- ❌ Any "speed" reference (confusing)

### Code Comments
```typescript
// CORRECT
// Apply shrine boost to resource yield (increases amount gathered)
const yieldMultiplier = calculateActiveBoosts(player);
const resourcesGathered = baseAmount * yieldMultiplier;

// INCORRECT
// Apply speed boost to harvesting
const speedBoost = getActiveSpeedBoost(player);
```

---

## 📋 UPDATED DOCUMENTATION

The following files have been updated with correct terminology:

1. **dev/phase3-specification.md**
   - Section 2.1: Boost Center Location
   - Section 2.2: Multiple Boosts System (Gathering Yield Enhancement)
   - Section 2.3: Item Sacrifice System
   - Section 2.4: UI Interface (Shrine Style)
   - All references changed from "speed" to "yield/quantity"

2. **dev/phase3-implementation-plan.md**
   - Day 3: Boost Center (Shrine System)
   - Acceptance tests updated
   - Testing checklist updated
   - All boost schema references corrected

3. **dev/planned.md**
   - FID-20251017-018: Banking & Boost System
   - Description clarified
   - Acceptance criteria updated

---

## ✅ VALIDATION CHECKLIST

Before implementation begins, verify:

- [ ] All documentation refers to "resource yield" not "speed"
- [ ] Database schema uses `yieldBonus` or `resourceMultiplier` fields
- [ ] API endpoints use `/shrine/` not `/boost/` (to avoid confusion)
- [ ] UI displays "Resource Gathering Bonus: +X%" 
- [ ] Code comments explain "increases quantity gathered"
- [ ] No references to "harvesting speed" anywhere
- [ ] Tier names are clear: "Speed Tier", "Heart Tier", etc.
- [ ] User-facing text never says "speed boost"

---

## 🎯 KEY TAKEAWAY

**The Shrine boosts make you gather MORE resources per harvest action, not harvest FASTER.**

If a tile gives 1,000 Metal normally, with 2 boosts active it gives 1,500 Metal.  
The time to perform the harvest action does not change.
