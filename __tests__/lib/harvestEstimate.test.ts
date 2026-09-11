/**
 * @file __tests__/lib/harvestEstimate.test.ts
 * @overview FID-20260910-040 — the shared harvest-estimate module's contract.
 *
 * The two UI calculators render from `estimateHarvest`; the server pays through
 * the same pipeline. These tests pin the exact arithmetic (including the
 * intermediate floors the server applies at every stage) so neither side can
 * drift again.
 */

import { describe, it, expect } from 'vitest';
import { estimateHarvest, estimateHarvestExpected } from '@/lib/harvestEstimate';
import { GAME_CONSTANTS } from '@/types';

const { MIN_AMOUNT, MAX_AMOUNT } = GAME_CONSTANTS.HARVEST;

describe('harvestEstimate (FID-20260910-040 shared pipeline)', () => {
  it('rolls 800–1500 by default (the real GAME_CONSTANTS range)', () => {
    for (let i = 0; i < 50; i++) {
      const e = estimateHarvest({ gatheringBonusPct: 0 });
      expect(e.base).toBeGreaterThanOrEqual(MIN_AMOUNT);
      expect(e.base).toBeLessThanOrEqual(MAX_AMOUNT);
    }
  });

  it('base case: no bonuses → final === base', () => {
    const e = estimateHarvest({ gatheringBonusPct: 0, base: 1000 });
    expect(e.final).toBe(1000);
    expect(e.terms.balanceMultiplier).toBe(1);
    expect(e.terms.vip).toBe(false);
    expect(e.terms.flagBearer).toBe(false);
  });

  it('gathering bonus is additive percent with the server floor', () => {
    // 1000 × (1 + 0.25) = 1250
    expect(estimateHarvest({ gatheringBonusPct: 25, base: 1000 }).final).toBe(1250);
    // 999 × 1.33 = 1328.67 → server floors to 1328
    expect(estimateHarvest({ gatheringBonusPct: 33, base: 999 }).final).toBe(1328);
  });

  it('stacks gathering + shrine + legacy boost additively (server behavior)', () => {
    // temporaryBonus + shrine are one additive bucket: 1000 × (1 + 0.30 + 0.20 + 0.50)
    const e = estimateHarvest({
      gatheringBonusPct: 30,
      temporaryBonusPct: 20,
      shrineBoosts: [{ yieldBonus: 0.5, expiresAt: '2999-01-01' as string | Date }],
      base: 1000,
    });
    expect(e.final).toBe(2000);
    expect(e.terms.shrineBonusPct).toBe(50);
  });

  it('EXPIRED shrine boosts contribute nothing (server filters by expiry)', () => {
    const e = estimateHarvest({
      shrineBoosts: [
        { yieldBonus: 0.5, expiresAt: '2999-01-01' as string | Date },
        { yieldBonus: 0.9, expiresAt: '2000-01-01' as string | Date },
      ],
      base: 1000,
    });
    expect(e.final).toBe(1500);
  });

  it('VIP doubles AFTER the additive floor (stage order matters)', () => {
    // 999 × 1.33 = 1328.67 → floor 1328 → ×2 = 2656 (NOT floor(2655.34)=2655)
    const e = estimateHarvest({ gatheringBonusPct: 33, vip: true, vipExpiration: '2999-01-01' as string | Date, base: 999 });
    expect(e.final).toBe(2656);
  });

  it('flag bearer doubles after VIP (×4 combined)', () => {
    const e = estimateHarvest({
      gatheringBonusPct: 0,
      vip: true,
      vipExpiration: '2999-01-01',
      isFlagBearer: true,
      base: 1000,
    });
    expect(e.final).toBe(4000);
  });

  it('expired VIP does NOT double', () => {
    const e = estimateHarvest({ vip: true, vipExpiration: '2000-01-01' as string | Date, base: 1000 });
    expect(e.final).toBe(1000);
    expect(e.terms.vip).toBe(false);
  });

  it('balance tier: zero army → ×1.0; CRITICAL imbalance → ×0.75', () => {
    expect(estimateHarvest({ gatheringBonusPct: 0, base: 1000 }).final).toBe(1000);
    // 10000 STR vs 1000 DEF → ratio 0.1 < 0.7 → CRITICAL → gathering 0.75
    const crit = estimateHarvest({ gatheringBonusPct: 0, totalStrength: 10000, totalDefense: 1000, base: 1000 });
    expect(crit.terms.balanceStatus).toBe('CRITICAL');
    expect(crit.terms.balanceMultiplier).toBe(0.75);
    expect(crit.final).toBe(750);
  });

  it('balance tier: OPTIMAL (0.95–1.05 ratio) → ×1.10 gathering', () => {
    const opt = estimateHarvest({ gatheringBonusPct: 0, totalStrength: 1000, totalDefense: 1000, base: 1000 });
    expect(opt.terms.balanceStatus).toBe('OPTIMAL');
    expect(opt.terms.balanceMultiplier).toBe(1.1);
    expect(opt.final).toBe(1100);
  });

  it('full pipeline order: additive floor → VIP floor → bearer floor → balance floor', () => {
    // 999 × (1 + 0.33 + 0.2 + 0.5) = 999 × 2.03 = 2027.97 → 2027
    // → ×2 VIP = 4054 → ×2 bearer = 8108 → ×0.75 CRITICAL = 6081
    const e = estimateHarvest({
      gatheringBonusPct: 33,
      temporaryBonusPct: 20,
      shrineBoosts: [{ yieldBonus: 0.5, expiresAt: '2999-01-01' as string | Date }],
      vip: true,
      vipExpiration: '2999-01-01' as string | Date,
      isFlagBearer: true,
      totalStrength: 10000,
      totalDefense: 1000,
      base: 999,
    });
    expect(e.final).toBe(6081);
  });

  it('expected-value helper uses the roll mean (1150)', () => {
    const e = estimateHarvestExpected({ gatheringBonusPct: 0 });
    expect(e.base).toBe((MIN_AMOUNT + MAX_AMOUNT) / 2);
  });
});
