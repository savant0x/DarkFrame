# FID-20260506-BALANCE-P1: Critical Economy Fixes

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-BALANCE-P1 |
| **Date Created** | 2026-05-06 |
| **Status** | PLANNING |
| **Priority** | CRITICAL |
| **Phase** | Phase 1 — Stop the Bleeding |
| **Parent FID** | FID-20260506-BALANCE-MASTER |

---

## Context

Phase 1 addresses the most critical economy-breaking issues. These are the changes that will have the most immediate impact on game balance. Without these, no amount of new sinks will matter because the faucets are too powerful.

---

## Changes

### 1. Fix Forest Harvest Bug (Already Done)
- Add `TerrainType.Forest` to `canHarvestTile()` in `lib/harvestService.ts`
- Status: COMPLETED in previous session

### 2. Convert Multipliers to Additive with Diminishing Returns

**File:** `lib/balanceService.ts` (or new `lib/multiplierService.ts`)

Replace multiplicative stacking with additive + soft diminishing:

```typescript
// Bonus sources are resolved from player state:
// - VIP: +50% (from player.is_vip)
// - Flag Bearer: +50% (from flag bearer status)
// - Shrine: up to +70% (from active shrine sacrifices with diminishing stacking)
// - Balance: up to +10% (from army balance optimization)

function calculateTotalMultiplier(bonusSources: number[]): number {
  const totalRaw = bonusSources.reduce((sum, b) => sum + b, 0);
  
  let effective = 0;
  let remaining = totalRaw;
  
  const tier1 = Math.min(remaining, 100);
  effective += tier1 * 1.0;
  remaining -= tier1;
  
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 100);
    effective += tier2 * 0.75;
    remaining -= tier2;
  }
  
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 100);
    effective += tier3 * 0.50;
    remaining -= tier3;
  }
  
  if (remaining > 0) {
    effective += remaining * 0.10;
  }
  
  return 1 + (effective / 100);
}
```

**Critical:** This must be applied everywhere multipliers are used: harvest, combat, display.

### 3. Implement Digger Exponential Decay

**File:** New `lib/diggerService.ts`

```typescript
const DIGGER_BONUS_CAP = 200; // 200% max bonus (asymptote)
const DIGGER_DECAY_CONSTANT = 0.008;

export function getDiggerBonus(diggerCount: number): number {
  return DIGGER_BONUS_CAP * (1 - Math.exp(-DIGGER_DECAY_CONSTANT * diggerCount));
}

// Guaranteed digger mechanic — tracked per player in DB
const GUARANTEED_DIGGER_INTERVAL = 75; // Every 75 caves, guaranteed digger

export function rollDiggerDrop(cavesSinceLastDigger: number): { isDigger: boolean; isGuaranteed: boolean; newCount: number } {
  const newCount = cavesSinceLastDigger + 1;
  
  if (newCount >= GUARANTEED_DIGGER_INTERVAL) {
    return { isDigger: true, isGuaranteed: true, newCount: 0 };
  }
  
  // Normal roll: 20% of drops are diggers
  const isDigger = Math.random() < 0.20;
  
  return { isDigger, isGuaranteed: false, newCount: isDigger ? 0 : newCount };
}

// Player DB field needed: caves_since_last_digger (number, default 0)
```

**Files to update:**
- `app/api/harvest/route.ts` — Use new digger drop logic
- `lib/harvestService.ts` — Apply digger bonus from new service

### 4. Reduce Base Harvest Amounts

**File:** `types/game.ts`

```typescript
// OLD
HARVEST: { MIN_AMOUNT: 800, MAX_AMOUNT: 1500 }

// NEW
HARVEST: { MIN_AMOUNT: 400, MAX_AMOUNT: 750 }
```

### 5. Reduce XP Per Harvest + Polynomial Curve

**File:** `types/game.ts` and `lib/xpService.ts`

```typescript
// types/game.ts — XP rewards
[XPAction.HARVEST_RESOURCE]: 3, // Down from 20

// lib/xpService.ts — New level curve
export function calculateLevel(totalXP: number): number {
  if (totalXP < 1) return 1;
  // Polynomial: XP = 250 × L^2.5
  // Inverse: L = (XP / 250) ^ (1/2.5)
  return Math.floor(Math.pow(totalXP / 250, 1 / 2.5)) + 1;
}

// Get cumulative XP required to reach a specific level
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(250 * Math.pow(level, 2.5));
}

// Get XP progress within current level
export function getXPProgress(totalXP: number): {
  currentLevelXP: number;
  progressPercent: number;
  xpForNextLevel: number;
} {
  const level = calculateLevel(totalXP);
  const xpAtLevelStart = getXPForLevel(level);
  const xpForNextLevel = getXPForLevel(level + 1) - xpAtLevelStart;
  const currentLevelXP = totalXP - xpAtLevelStart;
  return { currentLevelXP, progressPercent: Math.min((currentLevelXP / xpForNextLevel) * 100, 100), xpForNextLevel };
}
```

### 6. Preserve Inventory on Move (Bug Fix)

**File:** `context/GameContext.tsx`

```typescript
// In movePlayer function, preserve existing inventory:
setPlayer((prev) => ({
  ...moveResult.data.player,
  inventory: prev?.inventory || moveResult.data.player.inventory,
}));
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `lib/harvestService.ts` | Add Forest to canHarvestTile, use new multiplier, use new digger bonus |
| 2 | `lib/balanceService.ts` | Add calculateTotalMultiplier with diminishing returns |
| 3 | `lib/diggerService.ts` | NEW: Exponential decay formula + guaranteed digger mechanic |
| 4 | `lib/xpService.ts` | Polynomial level curve, reduced harvest XP |
| 5 | `types/game.ts` | Reduce MIN/MAX_AMOUNT, reduce XP_REWARDS[harvest] |
| 6 | `app/api/harvest/route.ts` | New drop rates (2.5%), new digger distribution (20%), new digger drop logic |
| 7 | `components/ShrinePanel.tsx` | Diminishing shrine stacking |
| 8 | `context/GameContext.tsx` | Preserve inventory on move |

---

## Verification Checklist
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Forest tiles can be harvested
- [ ] Multiplier stacking is additive (VIP + Flag + Shrine = ~2.25x, not 8x)
- [ ] Digger bonus approaches but never exceeds 200%
- [ ] Guaranteed digger drops every 75 caves
- [ ] Base harvest is 400-750 per tile
- [ ] Level 30 requires ~1.23M XP (not 29K)
- [ ] Inventory persists after moving
- [ ] Shrine buffs stack to +70% max (not +100%)

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Max multiplier | 8.8x+ | ~3-4x |
| Diggers per 12h | ~400 | 0-3 |
| Digger bonus | Unbounded (+973%) | Capped at 200% |
| Base harvest | 800-1,500 | 400-750 |
| XP to level 30 | 29K | ~1.23M |
| Shrine max | +100% | +70% |
| Daily resources (full sweep) | ~193M | ~10-15M |
