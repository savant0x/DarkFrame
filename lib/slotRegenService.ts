/**
 * @file lib/slotRegenService.ts
 * @created 2025-10-17
 * @updated 2025-11-04 - Aligned with new capacity model (usedSlots regen, large caps)
 * @overview Factory slot regeneration helpers (on-demand calculations)
 * 
 * OVERVIEW:
 * New model: factory.slots is the MAX CAPACITY (derived from level).
 * Regeneration reduces usedSlots over time. Capacity is large (e.g., 5,000 at L1)
 * and regen rates ensure a 12-hour full recovery curve across levels.
 * 
 * This file provides lightweight, on-demand helpers used by API endpoints to
 * compute regeneration without waiting for the background job tick. These helpers
 * mirror the logic in the background job for consistency.
 */

import { Factory } from '@/types';
import { getMaxSlots, getRegenRate } from '@/lib/factoryUpgradeService';

/** Milliseconds in one hour */
const HOUR_IN_MS = 60 * 60 * 1000;

/**
 * Calculate how many used slots should be recovered based on time elapsed
 * 
 * @param lastRegenTime - Timestamp of last regeneration
 * @param regenRatePerHour - Slots recovered per hour (depends on factory level)
 * @returns Whole slots to recover
 */
function calculateRecoveredSlots(lastRegenTime: Date, regenRatePerHour: number): number {
  const now = new Date();
  const timeDiff = now.getTime() - new Date(lastRegenTime).getTime();
  const hoursElapsed = timeDiff / HOUR_IN_MS;
  return Math.floor(hoursElapsed * regenRatePerHour);
}

/**
 * Apply on-demand regeneration to a factory object (in-memory only)
 * - Decreases usedSlots by the recovered amount (min 0)
 * - Advances lastSlotRegen by the exact whole-slot intervals consumed
 * - Does NOT change factory.slots (capacity)
 * 
 * @param factory - Factory data to update
 * @param balanceMultiplier - Optional multiplier (0.85-1.0) to nerf regen if needed
 * @returns Updated factory with potentially reduced usedSlots
 */
export function applySlotRegeneration(factory: Factory, balanceMultiplier: number = 1.0): Factory {
  const level = factory.level || 1;
  const regenRate = getRegenRate(level);
  let recovered = calculateRecoveredSlots(factory.lastSlotRegen, regenRate);

  if (recovered <= 0) {
    return factory;
  }

  if (balanceMultiplier < 1.0) {
    recovered = Math.floor(recovered * balanceMultiplier);
  }

  const newUsedSlots = Math.max(0, (factory.usedSlots || 0) - recovered);

  // Advance lastSlotRegen by the number of full slots worth of time
  const msPerSlot = HOUR_IN_MS / regenRate;
  const lastRegenTime = new Date(factory.lastSlotRegen);
  const newLastRegen = new Date(lastRegenTime.getTime() + recovered * msPerSlot);

  return {
    ...factory,
    usedSlots: newUsedSlots,
    lastSlotRegen: newLastRegen,
  };
}

/**
 * Calculate available slots for building (capacity - used)
 */
export function getAvailableSlots(factory: Factory): number {
  const capacity = getMaxSlots(factory.level || 1);
  return Math.max(0, capacity - (factory.usedSlots || 0));
}

/**
 * Check if factory has enough slots to build a unit
 */
export function hasEnoughSlots(factory: Factory, requiredSlots: number): boolean {
  const available = getAvailableSlots(factory);
  return available >= requiredSlots;
}

/**
 * Consume slots when building a unit (increments usedSlots)
 * Throws if insufficient capacity.
 */
export function consumeSlots(factory: Factory, slotsToConsume: number): Factory {
  if (!hasEnoughSlots(factory, slotsToConsume)) {
    throw new Error(`Not enough slots available. Need ${slotsToConsume}, have ${getAvailableSlots(factory)}`);
  }

  return {
    ...factory,
    usedSlots: (factory.usedSlots || 0) + slotsToConsume,
  };
}

/**
 * Time until the next recovered slot (based on level regen rate)
 */
export function getTimeUntilNextSlot(factory: Factory): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const regenRate = getRegenRate(factory.level || 1);
  const msPerSlot = HOUR_IN_MS / regenRate;
  const now = new Date();
  const lastRegen = new Date(factory.lastSlotRegen);
  const nextRegen = new Date(lastRegen.getTime() + msPerSlot);

  const timeLeft = nextRegen.getTime() - now.getTime();
  if (timeLeft <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  const hours = Math.floor(timeLeft / HOUR_IN_MS);
  const minutes = Math.floor((timeLeft % HOUR_IN_MS) / (60 * 1000));
  const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
  return { hours, minutes, seconds, totalMs: timeLeft };
}

/**
 * Get current capacity for a factory (convenience)
 */
export function getFactoryCapacity(factory: Factory): number {
  return getMaxSlots(factory.level || 1);
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * SLOT REGENERATION LOGIC (NEW):
 * - Capacity is derived from level: getMaxSlots(level)
 * - usedSlots decreases over time based on getRegenRate(level)
 * - Background job performs periodic DB updates
 * - These helpers provide immediate, in-memory calculations for endpoints
 */

// ============================================================
// END OF FILE
// ============================================================
