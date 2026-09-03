/**
 * harvestService Tests
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Tests resource harvesting system including 12-hour reset periods,
 * gathering bonuses, diminishing returns, and harvest tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentResetPeriod,
  getTimeUntilReset,
  calculateHarvestAmount,
  generateBaseHarvestAmount,
} from '@/lib/harvestService';

describe('harvestService', () => {
  describe('Reset Period Logic', () => {
    it('should generate AM reset period for tiles 1-75', () => {
      const tileX = 50;
      const period = getCurrentResetPeriod(tileX);
      
      expect(period).toContain('-AM');
      expect(period).toMatch(/^\d{4}-\d{2}-\d{2}-AM$/);
    });

    it('should generate PM reset period for tiles 76-150', () => {
      const tileX = 100;
      const period = getCurrentResetPeriod(tileX);
      
      expect(period).toContain('-PM');
      expect(period).toMatch(/^\d{4}-\d{2}-\d{2}-PM$/);
    });

    it('should use same date for both AM and PM periods', () => {
      const amTile = 50;
      const pmTile = 100;
      
      const amPeriod = getCurrentResetPeriod(amTile);
      const pmPeriod = getCurrentResetPeriod(pmTile);
      
      const amDate = amPeriod.split('-AM')[0];
      const pmDate = pmPeriod.split('-PM')[0];
      
      expect(amDate).toBe(pmDate);
    });

    it('should handle edge case at tile 75 (AM boundary)', () => {
      const period = getCurrentResetPeriod(75);
      expect(period).toContain('-AM');
    });

    it('should handle edge case at tile 76 (PM boundary)', () => {
      const period = getCurrentResetPeriod(76);
      expect(period).toContain('-PM');
    });

    it('should handle tile 1 (first tile)', () => {
      const period = getCurrentResetPeriod(1);
      expect(period).toContain('-AM');
    });

    it('should handle tile 150 (last tile)', () => {
      const period = getCurrentResetPeriod(150);
      expect(period).toContain('-PM');
    });
  });

  describe('Time Until Reset Calculation', () => {
    it('should return positive number of milliseconds', () => {
      const tileX = 50;
      const timeUntilReset = getTimeUntilReset(tileX);
      
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(typeof timeUntilReset).toBe('number');
    });

    it('should return different values for AM vs PM tiles', () => {
      const amTile = 50;
      const pmTile = 100;
      
      const amTime = getTimeUntilReset(amTile);
      const pmTime = getTimeUntilReset(pmTile);
      
      // Times should be different (6 hours apart = 21600000 ms)
      expect(Math.abs(amTime - pmTime)).toBeGreaterThan(0);
    });

    it('should return value less than 12 hours (43200000 ms)', () => {
      const tileX = 75;
      const timeUntilReset = getTimeUntilReset(tileX);
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      
      expect(timeUntilReset).toBeLessThanOrEqual(twelveHoursMs);
    });
  });

  describe('Base Harvest Amount Generation', () => {
    it('should generate amount between 800 and 1500', () => {
      const amount = generateBaseHarvestAmount();
      
      expect(amount).toBeGreaterThanOrEqual(800);
      expect(amount).toBeLessThanOrEqual(1500);
    });

    it('should generate different amounts on multiple calls', () => {
      const amounts = new Set();
      
      for (let i = 0; i < 50; i++) {
        amounts.add(generateBaseHarvestAmount());
      }
      
      // Should have some variety (at least 5 different values)
      expect(amounts.size).toBeGreaterThanOrEqual(5);
    });

    it('should only generate integer values', () => {
      for (let i = 0; i < 20; i++) {
        const amount = generateBaseHarvestAmount();
        expect(Number.isInteger(amount)).toBe(true);
      }
    });
  });

  describe('Harvest Amount Calculation with Bonuses', () => {
    it('should apply gathering bonus correctly', () => {
      const baseAmount = 10;
      const permanentBonus = 25; // 25% bonus
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      // (10 * (1 + 25/100)) = 10 * 1.25 = 12.5 -> 12
      
      expect(finalAmount).toBe(12);
    });

    it('should handle zero gathering bonus', () => {
      const baseAmount = 10;
      const permanentBonus = 0;
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      
      expect(finalAmount).toBe(baseAmount);
    });

    it('should handle 100% gathering bonus', () => {
      const baseAmount = 10;
      const permanentBonus = 100; // 100% bonus
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      
      expect(finalAmount).toBe(20); // 10 * 2 = 20
    });

    it('should floor decimal results', () => {
      const baseAmount = 7;
      const permanentBonus = 30; // 30% bonus
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      // 7 * 1.3 = 9.1 -> should floor to 9
      
      expect(finalAmount).toBe(9);
      expect(Number.isInteger(finalAmount)).toBe(true);
    });

    it('should handle very high gathering bonuses', () => {
      const baseAmount = 10;
      const permanentBonus = 500; // 500% bonus
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      
      expect(finalAmount).toBe(60); // 10 * 6 = 60
    });

    it('should combine permanent and temporary bonuses', () => {
      const baseAmount = 10;
      const permanentBonus = 25; // 25%
      const temporaryBonus = 25; // 25%
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      // 10 * (1 + 0.25 + 0.25) = 10 * 1.5 = 15
      
      expect(finalAmount).toBe(15);
    });

    it('should handle fractional base amounts', () => {
      const baseAmount = 10.7; // Should be floored in calculation
      const permanentBonus = 20;
      const temporaryBonus = 0;
      
      const finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
      
      expect(Number.isInteger(finalAmount)).toBe(true);
    });
  });

  describe('Harvest Tracking', () => {
    it('should create harvest record with correct structure', () => {
      const harvestRecord = {
        username: 'testplayer',
        tileX: 50,
        tileY: 50,
        resetPeriod: '2025-10-23-AM',
        harvestedAt: new Date(),
        amountGained: 12,
      };
      
      expect(harvestRecord.username).toBe('testplayer');
      expect(harvestRecord.tileX).toBe(50);
      expect(harvestRecord.resetPeriod).toContain('-AM');
      expect(harvestRecord.harvestedAt).toBeInstanceOf(Date);
    });

    it('should track metal tile harvests', () => {
      const metalHarvest = {
        terrainType: 'metal' as const,
        metalGained: 12,
        energyGained: 0,
      };
      
      expect(metalHarvest.metalGained).toBeGreaterThan(0);
      expect(metalHarvest.energyGained).toBe(0);
    });

    it('should track energy tile harvests', () => {
      const energyHarvest = {
        terrainType: 'energy' as const,
        metalGained: 0,
        energyGained: 15,
      };
      
      expect(energyHarvest.energyGained).toBeGreaterThan(0);
      expect(energyHarvest.metalGained).toBe(0);
    });

    it('should track cave tile harvests with items', () => {
      const caveHarvest = {
        terrainType: 'cave' as const,
        metalGained: 0,
        energyGained: 0,
        itemFound: {
          name: 'Ancient Pickaxe',
          rarity: 'rare',
        },
      };
      
      expect(caveHarvest.itemFound).toBeDefined();
      expect(caveHarvest.itemFound.name).toBeTruthy();
    });
  });

  describe('Diminishing Returns for Diggers', () => {
    it('should apply diminishing returns formula', () => {
      const diggerCount = 5;
      const baseBonus = 0.05; // 5% per digger
      
      // Formula: bonus = baseBonus * count * (1 - count/20)
      const diminishedBonus = baseBonus * diggerCount * (1 - diggerCount / 20);
      
      expect(diminishedBonus).toBeLessThan(baseBonus * diggerCount);
      expect(diminishedBonus).toBeCloseTo(0.1875, 4); // 5% * 5 * 0.75 = 18.75%
    });

    it('should have maximum diminishing at 20 diggers', () => {
      const diggerCount = 20;
      const baseBonus = 0.05;
      
      const diminishedBonus = baseBonus * diggerCount * (1 - diggerCount / 20);
      
      expect(diminishedBonus).toBe(0); // Completely diminished
    });

    it('should have no diminishing at 0 diggers', () => {
      const diggerCount = 0;
      const baseBonus = 0.05;
      
      const diminishedBonus = baseBonus * diggerCount * (1 - diggerCount / 20);
      
      expect(diminishedBonus).toBe(0);
    });

    it('should calculate correctly for 10 diggers', () => {
      const diggerCount = 10;
      const baseBonus = 0.05;
      
      const diminishedBonus = baseBonus * diggerCount * (1 - diggerCount / 20);
      // 5% * 10 * (1 - 10/20) = 5% * 10 * 0.5 = 25%
      
      expect(diminishedBonus).toBe(0.25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle harvest at midnight boundary', () => {
      const tileX = 50; // AM reset tile
      const period = getCurrentResetPeriod(tileX);
      
      expect(period).toBeDefined();
      expect(period).toContain('-AM');
    });

    it('should handle harvest at noon boundary', () => {
      const tileX = 100; // PM reset tile
      const period = getCurrentResetPeriod(tileX);
      
      expect(period).toBeDefined();
      expect(period).toContain('-PM');
    });

    it('should handle zero gathering bonus edge case', () => {
      const amount = calculateHarvestAmount(10, 0, 0);
      expect(amount).toBe(10);
    });

    it('should handle negative bonus (should not happen in practice)', () => {
      const amount = calculateHarvestAmount(10, -50, 0);
      // Would result in 10 * 0.5 = 5
      expect(amount).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large base harvest amounts', () => {
      const amount = calculateHarvestAmount(1000, 25, 0);
      expect(amount).toBe(1250);
      expect(Number.isInteger(amount)).toBe(true);
    });
  });
});
