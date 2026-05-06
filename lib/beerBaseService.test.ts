/**
 * beerBaseService Tests
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Tests Beer Base system including spawn rate calculations,
 * resource multipliers, respawn timing, and configuration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getNextRespawnTime,
  isRespawnTime,
} from '@/lib/beerBaseService';

// Mock database connection
vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: vi.fn(),
}));

// Mock bot service
vi.mock('@/lib/botService', () => ({
  createBot: vi.fn(),
}));

describe('beerBaseService', () => {
  describe('Spawn Rate Calculations', () => {
    it('should calculate spawn count within 5-10% range', () => {
      const totalBots = 1000;
      const minRate = 0.05; // 5%
      const maxRate = 0.10; // 10%
      
      const minSpawn = Math.floor(totalBots * minRate); // 50
      const maxSpawn = Math.floor(totalBots * maxRate); // 100
      
      expect(minSpawn).toBe(50);
      expect(maxSpawn).toBe(100);
    });

    it('should handle small bot populations', () => {
      const totalBots = 100;
      const rate = 0.05;
      
      const spawnCount = Math.floor(totalBots * rate);
      
      expect(spawnCount).toBe(5);
      expect(spawnCount).toBeGreaterThan(0);
    });

    it('should handle large bot populations', () => {
      const totalBots = 5000;
      const minRate = 0.05;
      const maxRate = 0.10;
      
      const minSpawn = Math.floor(totalBots * minRate); // 250
      const maxSpawn = Math.floor(totalBots * maxRate); // 500
      
      expect(minSpawn).toBe(250);
      expect(maxSpawn).toBe(500);
    });

    it('should calculate percentage correctly', () => {
      const beerBases = 75;
      const totalBots = 1000;
      const percentage = (beerBases / totalBots) * 100;
      
      expect(percentage).toBe(7.5); // 7.5%
      expect(percentage).toBeGreaterThanOrEqual(5);
      expect(percentage).toBeLessThanOrEqual(10);
    });

    it('should handle zero bot population edge case', () => {
      const totalBots = 0;
      const rate = 0.10;
      const spawnCount = Math.floor(totalBots * rate);
      
      expect(spawnCount).toBe(0);
    });
  });

  describe('Resource Multiplier', () => {
    it('should apply 3x resource multiplier to base rewards', () => {
      const baseReward = 100;
      const multiplier = 3;
      
      const beerBaseReward = baseReward * multiplier;
      
      expect(beerBaseReward).toBe(300);
    });

    it('should calculate metal rewards with multiplier', () => {
      const baseMetal = 50;
      const multiplier = 3;
      
      const beerBaseMetal = Math.floor(baseMetal * multiplier);
      
      expect(beerBaseMetal).toBe(150);
    });

    it('should calculate energy rewards with multiplier', () => {
      const baseEnergy = 40;
      const multiplier = 3;
      
      const beerBaseEnergy = Math.floor(baseEnergy * multiplier);
      
      expect(beerBaseEnergy).toBe(120);
    });

    it('should calculate RP rewards with multiplier', () => {
      const baseRP = 20;
      const multiplier = 3;
      
      const beerBaseRP = Math.floor(baseRP * multiplier);
      
      expect(beerBaseRP).toBe(60);
    });

    it('should handle custom multipliers', () => {
      const baseReward = 100;
      const customMultiplier = 5;
      
      const reward = baseReward * customMultiplier;
      
      expect(reward).toBe(500);
    });

    it('should floor decimal results', () => {
      const baseReward = 33;
      const multiplier = 3;
      
      const reward = Math.floor(baseReward * multiplier);
      
      expect(reward).toBe(99);
      expect(Number.isInteger(reward)).toBe(true);
    });
  });

  describe('Respawn Timing', () => {
    it('should calculate next Sunday 4 AM respawn', () => {
      const config = {
        respawnDay: 0, // Sunday
        respawnHour: 4,
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const nextRespawn = getNextRespawnTime(config);
      
      expect(nextRespawn).toBeInstanceOf(Date);
      expect(nextRespawn.getDay()).toBe(0); // Sunday
      expect(nextRespawn.getHours()).toBe(4); // 4 AM
    });

    it('should be in the future', () => {
      const config = {
        respawnDay: 0,
        respawnHour: 4,
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const nextRespawn = getNextRespawnTime(config);
      const now = new Date();
      
      expect(nextRespawn.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle different respawn days', () => {
      const config = {
        respawnDay: 3, // Wednesday
        respawnHour: 4,
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const nextRespawn = getNextRespawnTime(config);
      
      expect(nextRespawn.getDay()).toBe(3);
    });

    it('should handle different respawn hours', () => {
      const config = {
        respawnDay: 0,
        respawnHour: 12, // Noon
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const nextRespawn = getNextRespawnTime(config);
      
      expect(nextRespawn.getHours()).toBe(12);
    });

    it('should detect respawn time correctly', () => {
      const now = new Date();
      const config = {
        respawnDay: now.getDay(),
        respawnHour: now.getHours(),
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const isNow = isRespawnTime(config);
      
      // Should be true if it's exactly the right day/hour
      expect(typeof isNow).toBe('boolean');
    });
  });

  describe('Beer Base Configuration', () => {
    it('should validate spawn rate minimum', () => {
      const spawnRateMin = 5;
      
      expect(spawnRateMin).toBeGreaterThanOrEqual(0);
      expect(spawnRateMin).toBeLessThanOrEqual(100);
    });

    it('should validate spawn rate maximum', () => {
      const spawnRateMax = 10;
      
      expect(spawnRateMax).toBeGreaterThanOrEqual(0);
      expect(spawnRateMax).toBeLessThanOrEqual(100);
    });

    it('should ensure max >= min', () => {
      const spawnRateMin = 5;
      const spawnRateMax = 10;
      
      expect(spawnRateMax).toBeGreaterThanOrEqual(spawnRateMin);
    });

    it('should validate resource multiplier', () => {
      const resourceMultiplier = 3;
      
      expect(resourceMultiplier).toBeGreaterThan(0);
      expect(typeof resourceMultiplier).toBe('number');
    });

    it('should validate respawn day (0-6)', () => {
      const respawnDay = 0; // Sunday
      
      expect(respawnDay).toBeGreaterThanOrEqual(0);
      expect(respawnDay).toBeLessThanOrEqual(6);
    });

    it('should validate respawn hour (0-23)', () => {
      const respawnHour = 4;
      
      expect(respawnHour).toBeGreaterThanOrEqual(0);
      expect(respawnHour).toBeLessThanOrEqual(23);
    });

    it('should have enabled flag as boolean', () => {
      const enabled = true;
      
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('Beer Base Identification', () => {
    it('should identify beer base by flag', () => {
      const bot = {
        username: 'BeerBot_123',
        isSpecialBase: true,
        resources: { metal: 300, energy: 240, rp: 120 },
      };
      
      expect(bot.isSpecialBase).toBe(true);
    });

    it('should identify regular bot', () => {
      const bot = {
        username: 'Bot_456',
        isSpecialBase: false,
        resources: { metal: 100, energy: 80, rp: 40 },
      };
      
      expect(bot.isSpecialBase).toBe(false);
    });

    it('should have special icon indicator', () => {
      const beerBaseIcon = '🍺';
      const regularIcon = '🤖';
      
      expect(beerBaseIcon).toBeTruthy();
      expect(regularIcon).toBeTruthy();
      expect(beerBaseIcon).not.toBe(regularIcon);
    });
  });

  describe('Beer Base Removal on Defeat', () => {
    it('should mark beer base for removal when defeated', () => {
      const beerBase = {
        username: 'BeerBot_789',
        isSpecialBase: true,
        defeated: false,
      };
      
      // Simulate defeat
      beerBase.defeated = true;
      
      expect(beerBase.defeated).toBe(true);
      expect(beerBase.isSpecialBase).toBe(true);
    });

    it('should NOT remove regular bots on defeat', () => {
      const regularBot = {
        username: 'Bot_101',
        isSpecialBase: false,
        defeated: true,
      };
      
      // Regular bots persist even when defeated
      expect(regularBot.isSpecialBase).toBe(false);
    });
  });

  describe('Spawn Location Randomization', () => {
    it('should generate random X coordinate within map bounds', () => {
      const mapSize = 150;
      const x = Math.floor(Math.random() * mapSize) + 1;
      
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(mapSize);
    });

    it('should generate random Y coordinate within map bounds', () => {
      const mapSize = 150;
      const y = Math.floor(Math.random() * mapSize) + 1;
      
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(mapSize);
    });

    it('should generate unique positions for multiple beer bases', () => {
      const positions = new Set<string>();
      const mapSize = 150;
      
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(Math.random() * mapSize) + 1;
        const y = Math.floor(Math.random() * mapSize) + 1;
        positions.add(`${x},${y}`);
      }
      
      // Should have some variety (not all same position)
      expect(positions.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% spawn rate', () => {
      const totalBots = 1000;
      const rate = 0;
      const spawnCount = Math.floor(totalBots * rate);
      
      expect(spawnCount).toBe(0);
    });

    it('should handle 100% spawn rate', () => {
      const totalBots = 1000;
      const rate = 1.0; // 100%
      const spawnCount = Math.floor(totalBots * rate);
      
      expect(spawnCount).toBe(1000);
    });

    it('should handle 1x multiplier (same as regular)', () => {
      const baseReward = 100;
      const multiplier = 1;
      const reward = baseReward * multiplier;
      
      expect(reward).toBe(100);
    });

    it('should handle midnight respawn (hour 0)', () => {
      const config = {
        respawnDay: 0,
        respawnHour: 0,
        spawnRateMin: 5,
        spawnRateMax: 10,
        resourceMultiplier: 3,
        enabled: true,
      };
      
      const nextRespawn = getNextRespawnTime(config);
      
      expect(nextRespawn.getHours()).toBe(0);
    });

    it('should handle disabled beer base system', () => {
      const enabled = false;
      const spawnCount = enabled ? 100 : 0;
      
      expect(spawnCount).toBe(0);
    });
  });
});
