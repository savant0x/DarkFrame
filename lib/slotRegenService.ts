/**
 * @file lib/slotRegenService.ts
 * @created 2025-10-17
 * @updated 2025-11-04 - Aligned with new capacity model (usedSlots regen, large caps)
 * @updated 2026-10-02 - FID-20261002-011: one regeneration curve for every consumer
 *
 * @overview Factory slot regeneration helpers (on-demand calculations)
 *
 * OVERVIEW:
 * Factory.slots is the MAX CAPACITY (derived from level). Regeneration reduces
 * usedSlots over time. FID-20261002-011 makes the on-demand helper, the hourly
 * background job, and every read path use the SAME accounting:
 *
 *   effectiveRate = getRegenRate(level) × balance.slotRegenMultiplier
 *   recovered     = floor(elapsed × effectiveRate / HOUR)
 *   checkpoint   += recovered × HOUR / effectiveRate   (fractional time kept)
 *
 * The multiplier is applied to the RATE BEFORE flooring (the old helper
 * floored the base recovery first and then multiplied, and advanced the
 * checkpoint by the unmodified rate — a 0.85 critical-balance factory both
 * under-recovered and drifted its clock). Empty factories discard surplus
 * recovery and rebase the checkpoint to now, so idle time cannot bank slots
 * for future purchases. Corrupt or future timestamps fail safe: no negative
 * usedSlots, no fabricated recovery.
 */

import { Factory } from '@/types';
import { getMaxSlots, getRegenRate } from '@/lib/factoryUpgradeService';
import { calculateBalanceEffects } from '@/lib/balanceService';

/** Milliseconds in one hour */
const HOUR_IN_MS = 60 * 60 * 1000;

/** Options accepted by the regeneration helpers. */
export interface SlotRegenOptions {
  /**
   * Explicit clock so the background job, request paths and tests share one
   * `now` instead of racing separate Date.now() calls (FID-20261002-011 §5.2).
   */
  now?: Date;
  /**
   * Balance multiplier for the owner's army (calculateBalanceEffects
   * .slotRegenMultiplier, 0.85–1.0). Invalid values fail safe to 1 (neutral);
   * ownerless factories use the neutral multiplier.
   */
  balanceMultiplier?: number;
}

/** Neutral, sanitized multiplier: non-finite or non-positive input → 1. */
function sanitizeMultiplier(multiplier: number | undefined): number {
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier <= 0) {
    return 1;
  }
  return multiplier;
}

/** Accept the legacy positional-number form and the new options object. */
function resolveOptions(
  options: number | SlotRegenOptions | undefined,
): { now: Date; balanceMultiplier: number } {
  if (typeof options === 'number') {
    return { now: new Date(), balanceMultiplier: sanitizeMultiplier(options) };
  }
  const opts = options ?? {};
  return { now: opts.now ?? new Date(), balanceMultiplier: sanitizeMultiplier(opts.balanceMultiplier) };
}

/**
 * The army-balance regen multiplier for one owner's raw totals
 * (players.totalStrength / totalDefense). Ownerless callers (owner NULL)
 * pass nothing and get the neutral multiplier.
 */
export function getSlotRegenBalanceMultiplier(
  totalStrength?: number | null,
  totalDefense?: number | null,
): number {
  return calculateBalanceEffects(Number(totalStrength) || 0, Number(totalDefense) || 0)
    .slotRegenMultiplier;
}

/** Internal result of one regeneration pass. */
interface RegenOutcome {
  newUsedSlots: number;
  newCheckpoint: Date;
}

/**
 * Compute one regeneration pass against an explicit clock.
 * Returns null when nothing observable changes (checkpoint untouched).
 */
function computeRegenOutcome(
  factory: Factory,
  now: Date,
  effectiveRate: number,
): RegenOutcome | null {
  const nowMs = now.getTime();
  // Fail safe: a negative stored count is clamped, never propagated.
  const usedSlots = Math.max(0, Number(factory.usedSlots) || 0);

  const lastRegenMs = new Date(factory.lastSlotRegen as unknown as string).getTime();
  if (!Number.isFinite(lastRegenMs) || lastRegenMs > nowMs) {
    // Corrupt or future-dated checkpoint: no fabricated recovery; rebase to
    // now so the next elapsed window is measured from a sane clock.
    return { newUsedSlots: usedSlots, newCheckpoint: now };
  }

  if (usedSlots === 0) {
    // Empty-idle discard (FID-20261002-011 §5.4): an empty factory cannot bank
    // unbounded recovery for future purchases — surplus is dropped and the
    // checkpoint rebases to now.
    return { newUsedSlots: 0, newCheckpoint: now };
  }

  const elapsedMs = nowMs - lastRegenMs;
  const recovered = Math.floor((elapsedMs * effectiveRate) / HOUR_IN_MS);
  if (recovered <= 0) {
    return null; // not enough time for a whole slot — checkpoint untouched
  }

  const applied = Math.min(recovered, usedSlots);
  const newUsedSlots = usedSlots - applied;

  // Preserve fractional time: advance the checkpoint by exactly the consumed
  // slot intervals at the EFFECTIVE rate. When the factory drains to empty
  // this tick, the surplus recovery is discarded and the checkpoint rebases.
  const newCheckpoint =
    newUsedSlots === 0
      ? now
      : new Date(lastRegenMs + (applied * HOUR_IN_MS) / effectiveRate);

  return { newUsedSlots, newCheckpoint };
}

/**
 * Apply on-demand regeneration to a factory object (in-memory only)
 * - Decreases usedSlots by the recovered amount (min 0)
 * - Advances lastSlotRegen by the exact whole-slot intervals consumed at the
 *   effective rate, preserving fractional time
 * - Discards surplus and rebases the checkpoint when the factory is/becomes empty
 * - Does NOT change factory.slots (capacity)
 *
 * @param factory - Factory data to update
 * @param options - Balance multiplier (number, legacy) or { now, balanceMultiplier }
 * @returns Updated factory with potentially reduced usedSlots
 *
 * @example
 * applySlotRegeneration(factory, { now, balanceMultiplier: 0.85 });
 */
export function applySlotRegeneration(
  factory: Factory,
  options: number | SlotRegenOptions = 1.0,
): Factory {
  const { now, balanceMultiplier } = resolveOptions(options);
  const level = factory.level || 1;
  const effectiveRate = getRegenRate(level) * balanceMultiplier;
  const outcome = computeRegenOutcome(factory, now, effectiveRate);
  if (!outcome) return factory;

  return {
    ...factory,
    usedSlots: outcome.newUsedSlots,
    lastSlotRegen: outcome.newCheckpoint,
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
 * Time until the next recovered slot — computed at the SAME effective rate
 * the recovery itself uses (FID-20261002-011 §5.3), so the UI countdown
 * cannot promise a slot the job would deliver at a different pace.
 */
export function getTimeUntilNextSlot(
  factory: Factory,
  options?: SlotRegenOptions,
): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const { now, balanceMultiplier } = resolveOptions(options);
  const effectiveRate = getRegenRate(factory.level || 1) * balanceMultiplier;
  const msPerSlot = HOUR_IN_MS / effectiveRate;

  const lastRegenMs = new Date(factory.lastSlotRegen as unknown as string).getTime();
  // Fail safe: corrupt/future checkpoints count from now (full period).
  const safeLastRegen =
    Number.isFinite(lastRegenMs) && lastRegenMs <= now.getTime() ? lastRegenMs : now.getTime();

  const timeLeft = safeLastRegen + msPerSlot - now.getTime();
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
 * SLOT REGENERATION LOGIC (FID-20261002-011):
 * - Capacity is derived from level: getMaxSlots(level)
 * - usedSlots decreases at effectiveRate = getRegenRate(level) × balance
 * - The hourly job (lib/jobs/factorySlotRegeneration.ts) and every request
 *   path share THIS module — one curve, one clock contract, one multiplier
 * - Background job performs periodic DB updates inside the FID-002 tx boundary
 */
// ============================================================
// END OF FILE
// ============================================================
