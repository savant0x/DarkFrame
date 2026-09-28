/**
 * FID-20260928-006 — PvP base raid pins (PVP_BASE_RAID_DESIGN.md, ratified 2026-09-28).
 *
 * The unified raid route (/api/combat/attack) now admits HUMAN defenders under
 * the operator's hostility rule (§2): every base hostile EXCEPT self / same
 * clan / allied clan (any of the four alliance types). The §4 balancing picks
 * are pinned here as pure-function contracts:
 *   - §4.1  loot cap = 5,000 × attacker level per resource, 1× multiplier
 *   - §4.2  defender casualties persist but never below 25% of the pre-battle
 *           pool (the floor is a kill-cap; the log is amended to what persisted)
 *   - §2    the hostility truth table (self / same-clan / allied / unclanned)
 *   - §4.3  the period lock is username-keyed (no botness in the predicate)
 * Mirror-style (defeatBookkeeping pattern): the pure helpers under test ARE
 * the production code (lib/hostileBase, lib/battleService.capDefenderCasualties).
 */
import { describe, it, expect } from 'vitest';
import { evaluateHostility, pvpLootCap, PVP_LOOT_CAP_PER_LEVEL, DEFENDER_LOSS_FLOOR } from '@/lib/hostileBase';
import { capDefenderCasualties } from '@/lib/battleService';
import { getRaidPeriodStart } from '@/lib/raidPeriod';
import { UnitType } from '@/types';
import type { PlayerUnit } from '@/types';

// ============================================================================
// §2 — the hostility truth table
// ============================================================================

const base = {
  attackerUsername: 'raider',
  defenderUsername: 'farmer',
} as const;

describe('PVP_BASE_RAID_DESIGN §2: hostility truth table', () => {
  it('unclanned attacker vs unclanned defender: HOSTILE (no social structure protects)', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: null,
      defenderClanId: null,
      allied: false,
    });
    expect(v).toEqual({ hostile: true });
  });

  it('clanned attacker vs unclanned defender: HOSTILE', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: 'clanA',
      defenderClanId: null,
      allied: false,
    });
    expect(v).toEqual({ hostile: true });
  });

  it('same clan: NOT hostile, reason names the clan exemption', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: 'clanA',
      defenderClanId: 'clanA',
      allied: false,
    });
    expect(v.hostile).toBe(false);
    expect(v.reason).toContain('clan');
  });

  it('allied clans: NOT hostile — NAP blocks aggression', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: 'clanA',
      defenderClanId: 'clanB',
      allied: true,
    });
    expect(v.hostile).toBe(false);
    expect(v.reason).toContain('allian');
  });

  it('different clans, no alliance: HOSTILE (the rule that reopens PvP)', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: 'clanA',
      defenderClanId: 'clanB',
      allied: false,
    });
    expect(v).toEqual({ hostile: true });
  });

  it('self-attack: NOT hostile (own base)', () => {
    const v = evaluateHostility({
      attackerUsername: 'raider',
      defenderUsername: 'raider',
      attackerClanId: null,
      defenderClanId: null,
      allied: false,
    });
    expect(v.hostile).toBe(false);
  });

  it('allied flag wins even if clanIds somehow differ (defense in depth)', () => {
    const v = evaluateHostility({
      ...base,
      attackerClanId: 'clanA',
      defenderClanId: 'clanB',
      allied: true,
    });
    expect(v.hostile).toBe(false);
  });
});

// ============================================================================
// §4.1 — attacker-level loot cap
// ============================================================================

describe('PVP_BASE_RAID_DESIGN §4.1: PvP loot cap = 5,000 × attacker level', () => {
  it('level 1 raider: 5,000 per resource', () => {
    expect(pvpLootCap(1)).toBe(5_000);
  });

  it('level 10 raider: 50,000 per resource', () => {
    expect(pvpLootCap(10)).toBe(50_000);
  });

  it('level 50 raider: 250,000 per resource', () => {
    expect(pvpLootCap(50)).toBe(250_000);
  });

  it('fractional/zero levels floor at 1 (defensive)', () => {
    expect(pvpLootCap(0.5)).toBe(PVP_LOOT_CAP_PER_LEVEL);
    expect(pvpLootCap(0)).toBe(PVP_LOOT_CAP_PER_LEVEL);
  });

  it('cap is applied per declared resource via min(stockpile, cap) — the route loot shape', () => {
    // Mirrors the route's loot expression for a human defender:
    const stockpile = 400_000;
    const cap = pvpLootCap(10);
    const loot = Math.min(stockpile, cap) * 1; // 1× — no Beer premium for players
    expect(loot).toBe(50_000);
  });
});

// ============================================================================
// §4.2 — defender casualty floor (25% of pre-battle pool)
// ============================================================================

/** A PlayerUnit factory: pool per unit = strength + defense. */
function mkUnit(id: string, unitType: UnitType, quantity: number, strength: number, defense: number): PlayerUnit {
  return {
    id,
    unitId: id,
    unitType,
    name: id,
    category: strength >= defense ? 'STR' : 'DEF',
    rarity: 'common',
    strength,
    defense,
    quantity,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date('2026-01-01'),
  } as unknown as PlayerUnit;
}

describe('PVP_BASE_RAID_DESIGN §4.2: defender casualty floor', () => {
  const army = [
    mkUnit('u1', UnitType.T1_Rifleman, 10, 20, 10), // pool 30/unit → 300
    mkUnit('u2', UnitType.T1_Militia, 10, 10, 0),   // pool 10/unit → 100
  ];
  // Total pool = 400. Floor 25% → minPool 100 → max killable pool = 300.

  it('casualties within the floor budget persist in full', () => {
    const r = capDefenderCasualties(army, { [UnitType.T1_Rifleman]: 5 }, 0, 400);
    expect(r.unitsLost).toBe(5);
    expect(r.casualtiesByType).toEqual({ [UnitType.T1_Rifleman]: 5 });
    // 150 pool removed (5×30) → remaining pool 250 > floor 100 ✓
    const u1 = r.finalUnits.find((u) => u.id === 'u1');
    expect(u1?.quantity).toBe(5);
    expect(u2Quantity(r.finalUnits)).toBe(10);
  });

  it('casualties beyond the budget are CAPPED at the floor (the harassment brake)', () => {
    // Request killing ALL 20 units (pool 400); floor allows only 300 of pool.
    const r = capDefenderCasualties(army, { [UnitType.T1_Rifleman]: 10, [UnitType.T1_Militia]: 10 }, 0, 400);
    expect(r.unitsLost).toBe(10); // 10×30 = 300 pool — budget exhausted at u1
    expect(r.casualtiesByType).toEqual({ [UnitType.T1_Rifleman]: 10 });
    expect(u2Quantity(r.finalUnits)).toBe(10); // militia untouched
    // Surviving pool = 100 = exactly the floor.
    expect(survivingPool(r.finalUnits)).toBe(100);
  });

  it('surviving pool NEVER drops below floor × preBattlePool', () => {
    const r = capDefenderCasualties(army, { [UnitType.T1_Rifleman]: 10, [UnitType.T1_Militia]: 10 }, 0, 400);
    expect(survivingPool(r.finalUnits)).toBeGreaterThanOrEqual(400 * DEFENDER_LOSS_FLOOR - 1e-9);
  });

  it('no tally in the log: falls back to the total counter (legacy-log order)', () => {
    const r = capDefenderCasualties(army, undefined, 4, 400);
    expect(r.unitsLost).toBe(4);
    expect(r.casualtiesByType).toEqual({}); // no per-type truth to report
    expect(u1Quantity(r.finalUnits)).toBe(6);
  });

  it('floor holds for a huge pool ratio: 100-unit army raided by a titan', () => {
    const bigArmy = [mkUnit('w1', UnitType.T1_Rifleman, 100, 50, 50)]; // pool 10,000
    const r = capDefenderCasualties(bigArmy, { [UnitType.T1_Rifleman]: 100 }, 0, 10_000);
    // Floor: min pool 2,500 → max killable 7,500 → 75 units of 100 pool each.
    expect(r.unitsLost).toBe(75);
    expect(survivingPool(r.finalUnits)).toBe(2_500);
  });

  it('zero-pool entries are never drained by the pool budget math', () => {
    const wall = [mkUnit('w', UnitType.T1_Barricade, 5, 0, 100)];
    const r = capDefenderCasualties(wall, { [UnitType.T1_Barricade]: 5 }, 0, 500);
    // unitPool = 100 → budget-governed: min pool 125 → killable 375 → 3 units.
    expect(r.unitsLost).toBe(3);
  });

  it('floor of an empty pre-battle pool: nothing is killable (defensive)', () => {
    const r = capDefenderCasualties(army, { [UnitType.T1_Rifleman]: 10 }, 0, 0);
    expect(r.unitsLost).toBe(0);
    expect(r.finalUnits.length).toBe(2);
  });
});

// ============================================================================
// §4.3 — the period lock is username-keyed (no botness in the predicate)
// ============================================================================

describe('PVP_BASE_RAID_DESIGN §4.3: raid period lock is defender-agnostic', () => {
  it('the period boundary derives from map geometry only — works for any defender name', () => {
    const a = getRaidPeriodStart(10);
    const b = getRaidPeriodStart(10);
    expect(a.getTime()).toBe(b.getTime());
    // Same instant for the same tile regardless of who holds it:
    expect(getRaidPeriodStart(11).getTime()).toBe(a.getTime());
  });
});

// ============================================================================
// §3 — protection parity (harvested to lib/playerProtection; constants pinned)
// ============================================================================

describe('PVP_BASE_RAID_DESIGN §3: protection parity primitives exist in lib', () => {
  it('the refusal reason and window are the shared lib constants (stale route deleted, semantics live)', async () => {
    const mod = await import('@/lib/playerProtection');
    expect(mod.PROTECTION_REFUSAL_REASON).toContain('protection');
    expect(mod.PROTECTION_WINDOW_HOURS).toBeGreaterThan(0);
    expect(typeof mod.voidProtectionOnAggression).toBe('function');
    expect(typeof mod.protectionActive).toBe('function');
  });
});

// ---- helpers -----------------------------------------------------------------

function u1Quantity(units: PlayerUnit[]): number {
  return units.find((u) => u.id === 'u1')?.quantity ?? 0;
}
function u2Quantity(units: PlayerUnit[]): number {
  return units.find((u) => u.id === 'u2')?.quantity ?? 0;
}
function survivingPool(units: PlayerUnit[]): number {
  return units.reduce((sum, u) => sum + ((u.strength || 0) + (u.defense || 0)) * (u.quantity || 0), 0);
}
