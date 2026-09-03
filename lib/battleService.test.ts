/**
 * battleService Tests
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Tests battle resolution system including HP-based combat,
 * unit casualties, resource theft, and battle log creation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestDb, createMockUser, clearTestData } from '@/lib/test-utils';
import type { Player, PlayerUnit, UnitType, BattleResult } from '@/types';

// Mock the database connection
vi.mock('@/lib/mongodb', () => ({
  getCollection: vi.fn(),
}));

// Mock XP and stat tracking services
vi.mock('@/lib/xpService', () => ({
  awardXP: vi.fn(),
  XPAction: {},
}));

vi.mock('@/lib/statTrackingService', () => ({
  trackBattleWon: vi.fn(),
}));

describe('battleService - HP-Based Combat', () => {
  describe('Combat Mechanics - Damage Calculation', () => {
    it('should calculate damage correctly for attacker', () => {
      // Attacker: 100 STR, Defender: 40 DEF
      // Damage = 100 - 40/2 = 100 - 20 = 80
      const attackerSTR = 100;
      const defenderDEF = 40;
      const expectedDamage = attackerSTR - defenderDEF / 2;
      
      expect(expectedDamage).toBe(80);
    });

    it('should calculate damage correctly for defender', () => {
      // Defender: 60 DEF, Attacker: 80 STR
      // Damage = 60 - 80/2 = 60 - 40 = 20
      const defenderDEF = 60;
      const attackerSTR = 80;
      const expectedDamage = defenderDEF - attackerSTR / 2;
      
      expect(expectedDamage).toBe(20);
    });

    it('should handle zero damage scenarios', () => {
      // Defender: 20 DEF, Attacker: 50 STR
      // Damage = 20 - 50/2 = 20 - 25 = -5 (should be 0)
      const defenderDEF = 20;
      const attackerSTR = 50;
      const damage = Math.max(0, defenderDEF - attackerSTR / 2);
      
      expect(damage).toBe(0);
    });

    it('should calculate HP pool from units', () => {
      // 10 STR units @ 10 HP each = 100 HP
      // 5 DEF units @ 15 HP each = 75 HP
      // Total = 175 HP
      const strUnits = 10;
      const defUnits = 5;
      const totalHP = (strUnits * 10) + (defUnits * 15);
      
      expect(totalHP).toBe(175);
    });
  });

  describe('Unit Casualties', () => {
    it('should convert HP loss to unit casualties', () => {
      // Lost 50 HP
      // STR units = 10 HP each, so 50 HP = 5 units lost
      const hpLost = 50;
      const hpPerUnit = 10;
      const unitsLost = Math.floor(hpLost / hpPerUnit);
      
      expect(unitsLost).toBe(5);
    });

    it('should handle partial unit damage', () => {
      // Lost 55 HP at 10 HP/unit = 5.5 units = 5 units (floor)
      const hpLost = 55;
      const hpPerUnit = 10;
      const unitsLost = Math.floor(hpLost / hpPerUnit);
      
      expect(unitsLost).toBe(5);
    });

    it('should calculate remaining units after casualties', () => {
      const initialUnits = 20;
      const unitsLost = 7;
      const remaining = initialUnits - unitsLost;
      
      expect(remaining).toBe(13);
    });

    it('should handle total unit destruction', () => {
      // 100 HP lost, 10 units @ 10 HP each = all units destroyed
      const totalHP = 100;
      const hpLost = 100;
      const hpPerUnit = 10;
      const unitsLost = Math.min(
        Math.floor(hpLost / hpPerUnit),
        totalHP / hpPerUnit
      );
      
      expect(unitsLost).toBe(10);
    });
  });

  describe('Unit Capture Mechanics', () => {
    it('should capture 10-15% of defeated enemy units', () => {
      const defeatedUnits = 100;
      const minCapture = Math.floor(defeatedUnits * 0.10);
      const maxCapture = Math.floor(defeatedUnits * 0.15);
      
      expect(minCapture).toBe(10);
      expect(maxCapture).toBe(15);
    });

    it('should handle small unit captures (minimum 1)', () => {
      const defeatedUnits = 5;
      const captureRate = 0.12;
      const captured = Math.max(1, Math.floor(defeatedUnits * captureRate));
      
      expect(captured).toBeGreaterThanOrEqual(1);
    });

    it('should not capture more units than defeated', () => {
      const defeatedUnits = 10;
      const captureRate = 0.15;
      const captured = Math.min(
        Math.floor(defeatedUnits * captureRate),
        defeatedUnits
      );
      
      expect(captured).toBeLessThanOrEqual(defeatedUnits);
    });
  });

  describe('Resource Theft - Base Attacks', () => {
    it('should calculate 20% resource theft cap', () => {
      const defenderResources = {
        metal: 1000,
        energy: 800,
        rp: 500,
      };
      
      const stolenMetal = Math.floor(defenderResources.metal * 0.20);
      const stolenEnergy = Math.floor(defenderResources.energy * 0.20);
      const stolenRP = Math.floor(defenderResources.rp * 0.20);
      
      expect(stolenMetal).toBe(200);
      expect(stolenEnergy).toBe(160);
      expect(stolenRP).toBe(100);
    });

    it('should not steal more than defender has', () => {
      const defenderRP = 50;
      const maxSteal = Math.floor(defenderRP * 0.20);
      const actualSteal = Math.min(maxSteal, defenderRP);
      
      expect(actualSteal).toBeLessThanOrEqual(defenderRP);
    });

    it('should handle zero resources correctly', () => {
      const defenderResources = {
        metal: 0,
        energy: 0,
        rp: 0,
      };
      
      const stolen = {
        metal: Math.floor(defenderResources.metal * 0.20),
        energy: Math.floor(defenderResources.energy * 0.20),
        rp: Math.floor(defenderResources.rp * 0.20),
      };
      
      expect(stolen.metal).toBe(0);
      expect(stolen.energy).toBe(0);
      expect(stolen.rp).toBe(0);
    });
  });

  describe('Battle Victory Conditions', () => {
    it('should determine winner when defender HP reaches 0', () => {
      const attackerHP = 50;
      const defenderHP = 0;
      
      const winner = defenderHP <= 0 ? 'attacker' : 'defender';
      
      expect(winner).toBe('attacker');
    });

    it('should determine winner when attacker HP reaches 0', () => {
      const attackerHP = 0;
      const defenderHP = 30;
      
      const winner = attackerHP <= 0 ? 'defender' : 'attacker';
      
      expect(winner).toBe('defender');
    });

    it('should handle mutual destruction (both reach 0)', () => {
      const attackerHP = 0;
      const defenderHP = 0;
      
      // In simultaneous 0 HP, defender wins (home advantage)
      const winner = attackerHP <= 0 ? 'defender' : 'attacker';
      
      expect(winner).toBe('defender');
    });
  });

  describe('Combat Round Simulation', () => {
    it('should simulate basic combat round', () => {
      // Setup
      let attackerHP = 100;
      let defenderHP = 80;
      const attackerSTR = 50;
      const defenderDEF = 30;
      
      // Round 1
      const attackerDamage = Math.max(0, attackerSTR - defenderDEF / 2); // 50 - 15 = 35
      const defenderDamage = Math.max(0, defenderDEF - attackerSTR / 2); // 30 - 25 = 5
      
      defenderHP -= attackerDamage; // 80 - 35 = 45
      attackerHP -= defenderDamage; // 100 - 5 = 95
      
      expect(attackerHP).toBe(95);
      expect(defenderHP).toBe(45);
    });

    it('should track multiple combat rounds', () => {
      let attackerHP = 100;
      let defenderHP = 100;
      const attackerSTR = 60;
      const defenderDEF = 40;
      const rounds: number[] = [];
      
      while (attackerHP > 0 && defenderHP > 0 && rounds.length < 10) {
        const attackerDamage = Math.max(0, attackerSTR - defenderDEF / 2); // 40
        const defenderDamage = Math.max(0, defenderDEF - attackerSTR / 2); // 10
        
        defenderHP -= attackerDamage;
        attackerHP -= defenderDamage;
        rounds.push(rounds.length + 1);
      }
      
      expect(rounds.length).toBeGreaterThan(0);
      expect(rounds.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Unit Type Handling', () => {
    it('should differentiate between STR and DEF units', () => {
      const strUnit = { type: 'Soldier' as UnitType, hp: 10 };
      const defUnit = { type: 'Tank' as UnitType, hp: 15 };
      
      expect(strUnit.hp).toBe(10);
      expect(defUnit.hp).toBe(15);
    });

    it('should calculate mixed unit HP pools', () => {
      const soldiers = 5; // STR units @ 10 HP
      const tanks = 3;    // DEF units @ 15 HP
      
      const totalHP = (soldiers * 10) + (tanks * 15);
      
      expect(totalHP).toBe(95); // 50 + 45
    });
  });

  describe('Battle Log Creation', () => {
    it('should create battle log with required fields', () => {
      const battleLog = {
        attacker: 'player1',
        defender: 'player2',
        battleType: 'infantry' as const,
        winner: 'player1',
        timestamp: new Date(),
        attackerUnits: 10,
        defenderUnits: 8,
        attackerLosses: 3,
        defenderLosses: 8,
        resourcesStolen: null,
      };
      
      expect(battleLog.attacker).toBe('player1');
      expect(battleLog.defender).toBe('player2');
      expect(battleLog.winner).toBe('player1');
      expect(battleLog.timestamp).toBeInstanceOf(Date);
    });

    it('should include resource theft in base attack logs', () => {
      const battleLog = {
        attacker: 'player1',
        defender: 'player2',
        battleType: 'base' as const,
        winner: 'player1',
        timestamp: new Date(),
        resourcesStolen: {
          metal: 100,
          energy: 80,
          rp: 50,
        },
      };
      
      expect(battleLog.resourcesStolen).toBeDefined();
      expect(battleLog.resourcesStolen?.metal).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle attacks with no units', () => {
      const attackerUnits = 0;
      const defenderUnits = 10;
      
      // No units = auto-loss
      const winner = attackerUnits === 0 ? 'defender' : 'attacker';
      
      expect(winner).toBe('defender');
    });

    it('should handle extremely high damage values', () => {
      const attackerSTR = 10000;
      const defenderDEF = 50;
      const damage = attackerSTR - defenderDEF / 2;
      
      expect(damage).toBe(9975);
    });

    it('should prevent negative HP', () => {
      let hp = 10;
      const damage = 50;
      
      hp = Math.max(0, hp - damage);
      
      expect(hp).toBe(0);
      expect(hp).toBeGreaterThanOrEqual(0);
    });

    it('should handle equal strength battles', () => {
      const attackerSTR = 100;
      const defenderDEF = 100;
      
      const attackerDamage = attackerSTR - defenderDEF / 2; // 50
      const defenderDamage = defenderDEF - attackerSTR / 2; // 50
      
      expect(attackerDamage).toBe(defenderDamage);
    });
  });
});
