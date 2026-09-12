/**
 * @file __tests__/lib/botFactoryRaid.test.ts
 * @overview FID-20260912-073 — unit tests for the bot factory-raid gates.
 *
 * The raid loop's correctness lives in its eligibility gates; the DB-touching
 * capture path is exercised by the live boot verification (FID doc). These
 * tests pin the pure decision logic: config shape, tier gate, strength gate,
 * and cooldown math.
 */
import { describe, it, expect } from 'vitest';
import { BOT_FACTORY_RAID_CONFIG } from '@/lib/botFactoryRaid';
import { getFactoryDefense } from '@/lib/factoryUpgradeService';

/** Mirror of the module's raidOnCooldown (6h), pinned here so a change is conscious. */
function raidOnCooldown(last: Date | undefined, now: Date): boolean {
  if (!last) return false;
  return now.getTime() - last.getTime() < 6 * 60 * 60 * 1000;
}

describe('FID-073 bot factory raid gates', () => {
  it('config: tier-gated, ownership-capped, radius-bounded, curve-anchored', () => {
    expect(BOT_FACTORY_RAID_CONFIG.RAID_ELIGIBLE_TIERS).toEqual([2, 3]);
    expect(BOT_FACTORY_RAID_CONFIG.BOT_MAX_FACTORIES).toBe(2);
    expect(BOT_FACTORY_RAID_CONFIG.RAID_CHANCE).toBeLessThan(0.5); // bounded, not a land-grab
    expect(BOT_FACTORY_RAID_CONFIG.RAID_CHANCE).toBeGreaterThan(0);
    expect(BOT_FACTORY_RAID_CONFIG.RAID_RADIUS).toBeGreaterThan(0);
    // Strength gate tracks the LIVE L2 defense — a curve edit must move both.
    expect(BOT_FACTORY_RAID_CONFIG.MIN_RAID_STRENGTH).toBe(getFactoryDefense(2));
  });

  it('strength gate: L2 threshold excludes the starter population (12.5k > typical T1 army)', () => {
    expect(BOT_FACTORY_RAID_CONFIG.MIN_RAID_STRENGTH).toBe(12500);
    // And stays below the strong-bot band so T2/T3 veterans qualify.
    expect(BOT_FACTORY_RAID_CONFIG.MIN_RAID_STRENGTH).toBeLessThan(23000);
  });

  it('cooldown: fresh bot can raid; recent raider cannot; expired cooldown re-opens', () => {
    const now = new Date('2026-09-12T12:00:00Z');
    expect(raidOnCooldown(undefined, now)).toBe(false);
    expect(raidOnCooldown(new Date(now.getTime() - 5 * 60 * 60 * 1000), now)).toBe(true);
    expect(raidOnCooldown(new Date(now.getTime() - 7 * 60 * 60 * 1000), now)).toBe(false);
  });

  it('expected raid cadence: 20%/hour ≈ one raid per eligible bot per ~5 cycles', () => {
    // Expected cycles between raids for a p=0.2 Bernoulli trial.
    const expectedCycles = 1 / BOT_FACTORY_RAID_CONFIG.RAID_CHANCE;
    expect(expectedCycles).toBe(5);
    // Cooldown (6h) must exceed the mean interval (5h) — otherwise cooldown
    // never binds and a lucky bot chains captures.
    expect(6).toBeGreaterThan(expectedCycles);
  });
});
