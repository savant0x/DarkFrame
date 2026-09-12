/**
 * @file __tests__/lib/factoryCurves.test.ts
 * @overview FID-20260912-072 — pins every factory curve value for levels 1-10.
 *
 * These tables are the contract: any future curve edit must consciously
 * update them (and the FID), not silently drift. Values are the exact
 * docstring examples in lib/factoryUpgradeService.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  getMaxSlots,
  getRegenRate,
  getProductionRate,
  getFactoryDefense,
  calculateUpgradeCost,
} from '@/lib/factoryUpgradeService';

describe('FID-072 factory curves (levels 1-10, exact tables)', () => {
  it('slots: 400 + 150/level → L1=400 … L10=1750', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getMaxSlots)).toEqual([
      400, 550, 700, 850, 1000, 1150, 1300, 1450, 1600, 1750,
    ]);
  });

  it('regen: 30 + 10/level → L1=30 … L10=120/hr (full L10 drain ≈ 15h)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getRegenRate)).toEqual([
      30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
    // Full L10 pool: 1750 / 120 ≈ 14.6h
    expect(1750 / 120).toBeLessThan(15);
  });

  it('production: 5L²+5 → continues the admin table (L1=10, L2=25, L3=50), L10=505', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getProductionRate)).toEqual([
      10, 25, 50, 85, 130, 185, 250, 325, 410, 505,
    ]);
  });

  it('defense: L1=1000 kept accessible; L2+= (L-1)²×12,500 — cliff smoothed, ladder restored', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getFactoryDefense)).toEqual([
      1000, 12500, 50000, 112500, 200000, 312500, 450000, 612500, 800000, 1012500,
    ]);
    // The design intent: L2 must be raidable by strong bots (~23k STR) —
    // the old curve put L2 at 50,000, above every bot in the game.
    expect(getFactoryDefense(2)).toBeLessThan(23000);
    // Endgame wall intact: fame-class (1M+ STR) rules L10.
    expect(getFactoryDefense(10)).toBeGreaterThan(1000000);
  });

  it('costs: base 2500/1250 ×1.5^target — L1→2 is a real purchase, L9→10 a project', () => {
    const l12 = calculateUpgradeCost(1);
    expect(l12).toEqual({ metal: 5625, energy: 2812, level: 2 });
    const l910 = calculateUpgradeCost(9);
    expect(l910.metal).toBeGreaterThan(100000);
    // monotonic
    let prev = 0;
    for (let lvl = 1; lvl <= 9; lvl += 1) {
      const c = calculateUpgradeCost(lvl);
      expect(c.metal).toBeGreaterThan(prev);
      prev = c.metal;
    }
  });

  it('bounds: rejects out-of-range levels', () => {
    expect(() => getProductionRate(0)).toThrow();
    expect(() => getProductionRate(11)).toThrow();
    expect(() => getFactoryDefense(0)).toThrow();
    expect(() => getFactoryDefense(11)).toThrow();
  });
});
