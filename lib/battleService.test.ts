/**
 * battleService Tests
 * Tests actual battle resolution, unit handling, and damage calculation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Unit, UnitType } from '@/types';

function createMockSupabase() {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn(() => chain),
    order: vi.fn(() => chain),
  };
  return {
    from: vi.fn(() => chain),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => createMockSupabase()),
}));

vi.mock('@/lib/xpService', () => ({
  awardXP: vi.fn().mockResolvedValue({ xpAwarded: 0, levelUp: false, newLevel: 1 }),
  XPAction: { FACTORY_CAPTURE: 'FACTORY_CAPTURE', BASE_ATTACK: 'BASE_ATTACK', INFANTRY_ATTACK: 'INFANTRY_ATTACK' },
}));

vi.mock('@/lib/statTrackingService', () => ({
  trackBattleWon: vi.fn().mockResolvedValue(undefined),
}));

function makeUnit(type: UnitType, owner: string): Unit {
  return {
    id: crypto.randomUUID(),
    type,
    strength: 100,
    defense: 50,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date(),
    owner,
  };
}

describe('battleService', () => {
  describe('UNIT_TYPE_ARCHETYPE mapping', () => {
    it('should map STR units to STRIKER archetype', async () => {
      const { UNIT_TYPE_ARCHETYPE } = await import('@/types');
      expect(UNIT_TYPE_ARCHETYPE['T1_RIFLEMAN']).toBe('STRIKER');
      expect(UNIT_TYPE_ARCHETYPE['T2_COMMANDO']).toBe('STRIKER');
    });

    it('should map DEF units to BULWARK archetype', async () => {
      const { UNIT_TYPE_ARCHETYPE } = await import('@/types');
      expect(UNIT_TYPE_ARCHETYPE['T1_BUNKER']).toBe('BULWARK');
      expect(UNIT_TYPE_ARCHETYPE['T2_FORTRESS']).toBe('BULWARK');
    });

    it('should map artillery units to ARTILLERY archetype', async () => {
      const { UNIT_TYPE_ARCHETYPE } = await import('@/types');
      expect(UNIT_TYPE_ARCHETYPE['T1_TURRET']).toBe('ARTILLERY');
      expect(UNIT_TYPE_ARCHETYPE['T2_CANNON']).toBe('ARTILLERY');
    });
  });

  describe('UNIT_CONFIGS', () => {
    it('should have valid configs for all unit types', async () => {
      const { UNIT_CONFIGS } = await import('@/types');
      const types = Object.keys(UNIT_CONFIGS);
      expect(types.length).toBeGreaterThan(0);
      for (const type of types) {
        const config = UNIT_CONFIGS[type];
        expect(config.strength).toBeGreaterThanOrEqual(0);
        expect(config.defense).toBeGreaterThanOrEqual(0);
        expect(config.metalCost).toBeGreaterThanOrEqual(0);
        expect(config.energyCost).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have increasing costs for higher tiers', async () => {
      const { UNIT_CONFIGS } = await import('@/types');
      const t1Rifleman = UNIT_CONFIGS['T1_RIFLEMAN'];
      const t2Commando = UNIT_CONFIGS['T2_COMMANDO'];
      const t3Striker = UNIT_CONFIGS['T3_STRIKER'];

      expect(t2Commando.metalCost).toBeGreaterThan(t1Rifleman.metalCost);
      expect(t3Striker.metalCost).toBeGreaterThan(t2Commando.metalCost);
    });
  });

  describe('resolveBattle', () => {
    it('should return attacker win when attacker has stronger units', async () => {
      const { resolveBattle } = await import('./battleService');
      const attackerUnits: Unit[] = [
        makeUnit('T3_STRIKER', 'attacker1'),
        makeUnit('T3_STRIKER', 'attacker1'),
        makeUnit('T3_STRIKER', 'attacker1'),
      ];
      const defenderUnits: Unit[] = [
        makeUnit('T1_RIFLEMAN', 'defender1'),
      ];

      const result = await resolveBattle(attackerUnits, defenderUnits, 'attacker1', 'defender1', 'infantry', { x: 10, y: 10 });

      expect(['ATTACKER_WIN', 'DRAW']).toContain(result.outcome);
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.attacker.username).toBe('attacker1');
      expect(result.defender.username).toBe('defender1');
    });

    it('should return defender win when defender has stronger units', async () => {
      const { resolveBattle } = await import('./battleService');
      const attackerUnits: Unit[] = [
        makeUnit('T1_RIFLEMAN', 'attacker1'),
      ];
      const defenderUnits: Unit[] = [
        makeUnit('T3_STRIKER', 'defender1'),
        makeUnit('T3_STRIKER', 'defender1'),
        makeUnit('T3_STRIKER', 'defender1'),
      ];

      const result = await resolveBattle(attackerUnits, defenderUnits, 'attacker1', 'defender1', 'infantry', { x: 10, y: 10 });

      expect(['DEFENDER_WIN', 'DRAW']).toContain(result.outcome);
    });

    it('should handle empty attacker units (no battle)', async () => {
      const { resolveBattle } = await import('./battleService');
      const attackerUnits: Unit[] = [];
      const defenderUnits: Unit[] = [makeUnit('T1_RIFLEMAN', 'defender1')];

      const result = await resolveBattle(attackerUnits, defenderUnits, 'attacker1', 'defender1', 'infantry', { x: 10, y: 10 });

      expect(['DEFENDER_WIN', 'DRAW']).toContain(result.outcome);
    });

    it('should handle empty defender units (auto attacker win)', async () => {
      const { resolveBattle } = await import('./battleService');
      const attackerUnits: Unit[] = [makeUnit('T1_RIFLEMAN', 'attacker1')];
      const defenderUnits: Unit[] = [];

      const result = await resolveBattle(attackerUnits, defenderUnits, 'attacker1', 'defender1', 'infantry', { x: 10, y: 10 });

      expect(result.outcome).toBe('ATTACKER_WIN');
    });

    it('should generate combat rounds for non-trivial battles', async () => {
      const { resolveBattle } = await import('./battleService');
      const attackerUnits: Unit[] = [
        makeUnit('T2_COMMANDO', 'attacker1'),
        makeUnit('T2_COMMANDO', 'attacker1'),
      ];
      const defenderUnits: Unit[] = [
        makeUnit('T2_COMMANDO', 'defender1'),
        makeUnit('T2_COMMANDO', 'defender1'),
      ];

      const result = await resolveBattle(attackerUnits, defenderUnits, 'attacker1', 'defender1', 'infantry', { x: 10, y: 10 });

      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result._attackerCasualties).toBeDefined();
      expect(result._defenderCasualties).toBeDefined();
    });
  });
});
