# FID-20260506-BALANCE-P2: New Resource Sinks

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-BALANCE-P2 |
| **Date Created** | 2026-05-06 |
| **Status** | PLANNING |
| **Priority** | HIGH |
| **Phase** | Phase 2 — New Sinks |
| **Parent FID** | FID-20260506-BALANCE-MASTER |
| **Depends On** | FID-20260506-BALANCE-P1 |

---

## Context

Phase 2 introduces the resource sinks that were completely missing from the game. These sinks ensure that resources are constantly being destroyed, preventing infinite accumulation. Combined with Phase 1's faucet reductions, this creates a healthy economy where resources flow in and out.

---

## Changes

### 1. Unit Upkeep System

**File:** New `lib/upkeepService.ts`

Every unit costs metal + energy per hour to maintain. Cost scales exponentially past supply cap.

**DB fields needed on players table:**
- `last_upkeep_tick` (timestamp) — last time upkeep was deducted
- `total_unit_count` (number) — cached count of all units
- `avg_unit_metal_cost` (number) — cached average metal cost per unit
- `avg_unit_energy_cost` (number) — cached average energy cost per unit
- `supply_cap` (number) — calculated from level + factories + tech + clan perks

```typescript
export function calculateHourlyUpkeep(
  unitCount: number,
  avgUnitMetalCost: number,
  avgUnitEnergyCost: number,
  supplyCap: number
): { metal: number; energy: number } {
  const baseRate = 0.01; // 1% of base cost per hour
  const overRatio = unitCount / Math.max(supplyCap, 1);
  const exponentialMultiplier = Math.pow(1 + overRatio, 1.5);
  
  const metal = Math.floor(unitCount * avgUnitMetalCost * baseRate * exponentialMultiplier);
  const energy = Math.floor(unitCount * avgUnitEnergyCost * baseRate * exponentialMultiplier);
  
  return { metal, energy };
}

export function getSupplyCap(player: Player): number {
  let cap = 100; // Base
  cap += (player.level || 1) * 10; // +10 per level
  // TODO: Add factory bonuses, tech tree bonuses, clan perks
  return cap;
}

// Called on every player action (harvest, move, attack) — checks if upkeep is due
export function processUpkeepIfDue(player: Player): { metalDeducted: number; energyDeducted: number } {
  const now = Date.now();
  const lastTick = new Date(player.last_upkeep_tick || 0).getTime();
  const hoursSinceLastTick = (now - lastTick) / (1000 * 60 * 60);
  
  if (hoursSinceLastTick < 1) return { metalDeducted: 0, energyDeducted: 0 }; // Less than 1 hour, skip
  
  const hoursToProcess = Math.floor(hoursSinceLastTick);
  const hourly = calculateHourlyUpkeep(
    player.total_unit_count || 0,
    player.avg_unit_metal_cost || 0,
    player.avg_unit_energy_cost || 0,
    getSupplyCap(player)
  );
  
  return {
    metalDeducted: hourly.metal * hoursToProcess,
    energyDeducted: hourly.energy * hoursToProcess,
  };
}
```

### 2. Auto-Farm Tool Durability System

**File:** New `lib/toolDurabilityService.ts`

Auto-farm tool has condition (0-100%) that decays with use. Repair costs scale exponentially.

```typescript
export type ToolTier = 'basic' | 'advanced' | 'premium' | 'legendary';

interface ToolStats {
  tier: ToolTier;
  condition: number; // 0-100
  decayRate: number; // % per tile
  speedBonus: number; // multiplier
  repairCostMetal: number;
  repairCostEnergy: number;
}

const TOOL_STATS: Record<ToolTier, Omit<ToolStats, 'condition'>> = {
  basic:    { tier: 'basic',    decayRate: 0.05, speedBonus: 1.0, repairCostMetal: 50000,  repairCostEnergy: 25000  },
  advanced: { tier: 'advanced', decayRate: 0.02, speedBonus: 1.2, repairCostMetal: 200000, repairCostEnergy: 100000 },
  premium:  { tier: 'premium',  decayRate: 0.01, speedBonus: 1.5, repairCostMetal: 500000, repairCostEnergy: 250000 },
  legendary:{ tier: 'legendary',decayRate: 0.005,speedBonus: 2.0, repairCostMetal: 2000000,repairCostEnergy: 1000000 },
};

// Speed scales with condition (soft, never zero)
export function getToolSpeed(tier: ToolTier, condition: number): number {
  const base = TOOL_STATS[tier].speedBonus;
  const conditionMultiplier = Math.max(0.05, condition / 100); // Min 5% speed
  return base * conditionMultiplier;
}

// Repair cost scales exponentially with degradation
export function getRepairCost(tier: ToolTier, currentCondition: number): { metal: number; energy: number } {
  const base = TOOL_STATS[tier];
  const degradation = 100 - currentCondition;
  const multiplier = Math.pow(1 + degradation / 100, 2); // Exponential
  return {
    metal: Math.floor(base.repairCostMetal * multiplier * (degradation / 100)),
    energy: Math.floor(base.repairCostEnergy * multiplier * (degradation / 100)),
  };
}
```

**Files to update:**
- `types/game.ts` — Add tool tier types, add tool state to Player
- `lib/autoFarmEngine.ts` — Integrate tool durability into auto-farm
- New `app/api/tool/route.ts` — Repair endpoint, upgrade endpoint
- `components/AutoFarmPanel.tsx` — Display condition, repair button, upgrade options

### 3. Stamina System — Soft Diminishing

**File:** New `lib/staminaService.ts`

```typescript
const STAMINA_TIERS = [
  { threshold: 2000, efficiency: 1.0 },
  { threshold: 3000, efficiency: 0.75 },
  { threshold: 4000, efficiency: 0.50 },
  { threshold: Infinity, efficiency: 0.25 },
];

export function getStaminaEfficiency(actionsToday: number): number {
  for (const tier of STAMINA_TIERS) {
    if (actionsToday < tier.threshold) return tier.efficiency;
  }
  return 0.25; // Floor
}

// Resets daily
export function getDailyStaminaReset(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
```

**Files to update:**
- `lib/harvestService.ts` — Apply stamina efficiency to harvest yields
- `app/api/player/route.ts` — Include stamina data in player response
- `components/StatsPanel.tsx` — Display stamina status

### 4. PvP Resource Destruction

**File:** `app/api/combat/attack/route.ts` (or equivalent)

When a player attacks another player:
- 20% of stolen resources are permanently burned
- Attack costs 1K metal + 1K energy (even on loss)
- Destroyed units are permanently removed from economy
- Defender gets XP + small resource reward

```typescript
export function processAttackResult(attacker: Player, defender: Player, stolen: { metal: number; energy: number }) {
  const BURN_RATE = 0.20;
  const ATTACK_COST = { metal: 1000, energy: 1000 };
  
  const burned = {
    metal: Math.floor(stolen.metal * BURN_RATE),
    energy: Math.floor(stolen.energy * BURN_RATE),
  };
  
  const actualGain = {
    metal: stolen.metal - burned.metal,
    energy: stolen.energy - burned.energy,
  };
  
  // Attacker pays cost, gains actualGain
  // Defender loses stolen amount
  // burned amount is permanently destroyed
  
  return { actualGain, burned, ATTACK_COST };
}
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `lib/upkeepService.ts` | NEW: Unit upkeep calculation |
| 2 | `lib/toolDurabilityService.ts` | NEW: Auto-farm tool durability |
| 3 | `lib/staminaService.ts` | NEW: Stamina soft diminishing |
| 4 | `types/game.ts` | Add tool types, stamina types |
| 5 | `app/api/player/route.ts` | Include upkeep, tool, stamina data |
| 6 | `app/api/combat/attack/route.ts` | PvP resource destruction |
| 7 | `app/api/tool/route.ts` | NEW: Repair and upgrade endpoints |
| 8 | `components/StatsPanel.tsx` | Display upkeep, tool condition, stamina |
| 9 | `components/AutoFarmPanel.tsx` | Tool condition display, repair UI |
| 10 | `components/UnitFactoryPanel.tsx` | Upkeep warnings |

---

## Verification Checklist
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Unit upkeep deducts resources hourly
- [ ] Auto-farm tool decays with use
- [ ] Tool repair costs scale exponentially
- [ ] Stamina reduces yield after 2,000 actions
- [ ] Stamina never hits zero (25% floor)
- [ ] PvP attacks burn 20% of stolen resources
- [ ] Tool tiers have meaningful differences
- [ ] All new code follows ECHO v1.3.4 standards

---

## Expected Impact

| Sink | Daily Cost (Mid-Game Player) |
|------|------------------------------|
| Unit upkeep (500 units) | ~50K-200K metal/energy |
| Auto-farm repair | ~100K-500K metal/energy |
| PvP attacks (5/day) | ~5K metal/energy per attack |
| Stamina (reduced efficiency) | ~25% less from extra actions |
| **Total daily sink** | **~200K-1M+ resources** |

This creates a healthy cycle: players earn ~10-15M/day, spend ~1-2M on sinks, net ~8-13M/day progression.
