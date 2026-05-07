/**
 * @file lib/upkeepService.ts
 * @created 2026-05-07
 * @overview Unit upkeep system — hourly maintenance costs with exponential scaling
 *
 * Every unit costs metal + energy per hour to maintain.
 * Cost scales exponentially past supply cap.
 */

export interface UpkeepResult {
  metal: number;
  energy: number;
}

const BASE_UPKEEP_RATE = 0.01; // 1% of base cost per hour

/**
 * Calculate hourly upkeep cost for a player's army.
 */
export function calculateHourlyUpkeep(
  unitCount: number,
  avgUnitMetalCost: number,
  avgUnitEnergyCost: number,
  supplyCap: number
): UpkeepResult {
  if (unitCount <= 0) return { metal: 0, energy: 0 };

  const overRatio = unitCount / Math.max(supplyCap, 1);
  const exponentialMultiplier = Math.pow(1 + overRatio, 1.5);

  const metal = Math.floor(unitCount * avgUnitMetalCost * BASE_UPKEEP_RATE * exponentialMultiplier);
  const energy = Math.floor(unitCount * avgUnitEnergyCost * BASE_UPKEEP_RATE * exponentialMultiplier);

  return { metal, energy };
}

/**
 * Calculate supply cap based on player level.
 */
export function getSupplyCap(player: { level?: number; factoryCount?: number }): number {
  let cap = 100; // Base
  cap += (player.level || 1) * 10; // +10 per level
  cap += (player.factoryCount || 0) * 25; // +25 per factory
  // TODO: Add tech tree bonuses, clan perks
  return cap;
}

/**
 * Process upkeep if due (called on every player action).
 */
export function processUpkeepIfDue(
  lastUpkeepTick: string | null,
  unitCount: number,
  avgUnitMetalCost: number,
  avgUnitEnergyCost: number,
  supplyCap: number
): { metalDeducted: number; energyDeducted: number; hoursProcessed: number } {
  const now = Date.now();
  const lastTick = lastUpkeepTick ? new Date(lastUpkeepTick).getTime() : 0;
  const hoursSinceLastTick = (now - lastTick) / (1000 * 60 * 60);

  if (hoursSinceLastTick < 1) return { metalDeducted: 0, energyDeducted: 0, hoursProcessed: 0 };

  const hoursToProcess = Math.floor(hoursSinceLastTick);
  const hourly = calculateHourlyUpkeep(unitCount, avgUnitMetalCost, avgUnitEnergyCost, supplyCap);

  return {
    metalDeducted: hourly.metal * hoursToProcess,
    energyDeducted: hourly.energy * hoursToProcess,
    hoursProcessed: hoursToProcess,
  };
}
