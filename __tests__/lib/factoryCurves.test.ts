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
import {
  applySlotRegeneration,
  getTimeUntilNextSlot,
  getSlotRegenBalanceMultiplier,
} from '@/lib/slotRegenService';
import type { Factory } from '@/types/game.types';
import { UNIT_BLUEPRINTS, UNIT_TIER_ORDER } from '@/types/units.types';
import {
  UNIT_CONFIGS,
  TIER_UNLOCK_REQUIREMENTS,
  isTierAdmissible,
  isTierUnlocked,
  resolveCanonicalUnitType,
  unitConfigForIdentifier,
  UnitTier,
  UnitType,
} from '@/types/game.types';

const HOUR_IN_MS = 60 * 60 * 1000;

function makeFactory(overrides: Partial<Factory> = {}): Factory {
  return {
    x: 5,
    y: 5,
    owner: 'regen_probe',
    defense: 0,
    level: 10,
    slots: 1750,
    usedSlots: 500,
    productionRate: 1,
    lastSlotRegen: new Date(Date.now() - HOUR_IN_MS),
    lastResourceGeneration: null,
    lastAttackedBy: null,
    lastAttackTime: null,
    ...overrides,
  } as Factory;
}

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

describe('FID-20261002-011 shared slot regeneration (applySlotRegeneration contract)', () => {
  it('L10 neutral, one hour → exactly 120 recovered (canonical curve, multiplier BEFORE flooring)', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const factory = makeFactory({ lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS), usedSlots: 500 });
    const regenerated = applySlotRegeneration(factory, { now, balanceMultiplier: 1 });
    expect(regenerated.usedSlots).toBe(500 - 120); // getRegenRate(10) = 120/hr
  });

  it('CRITICAL balance applies 0.85 to the RATE (L10 one hour → floor(120×0.85) = 102)', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const factory = makeFactory({ lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS), usedSlots: 500 });
    const regenerated = applySlotRegeneration(factory, { now, balanceMultiplier: 0.85 });
    // The OLD helper floored 120 first and then multiplied (and advanced the
    // checkpoint at the unmodified rate) — this pin states the corrected math.
    expect(regenerated.usedSlots).toBe(500 - Math.floor(120 * 0.85));
    expect(regenerated.usedSlots).toBe(500 - 102);
  });

  it('many short ticks equal one long tick while slots remain (fractional time preserved)', () => {
    const start = new Date('2026-10-02T12:00:00Z');
    let factory = makeFactory({ lastSlotRegen: start, usedSlots: 500 });
    // 12 ticks of 5 minutes at L10 (120/hr) → 12 × 10 = 120 slots, one long hour
    for (let i = 1; i <= 12; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000);
      factory = applySlotRegeneration(factory, { now: tick, balanceMultiplier: 1 });
    }
    expect(factory.usedSlots).toBe(500 - 120);
    const oneLong = applySlotRegeneration(
      makeFactory({ lastSlotRegen: start, usedSlots: 500 }),
      { now: new Date(start.getTime() + HOUR_IN_MS), balanceMultiplier: 1 },
    );
    expect(factory.usedSlots).toBe(oneLong.usedSlots);
  });

  it('empty-idle discards surplus and rebases the checkpoint — idle time never banks slots', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    // Empty for 10 hours: the OLD accounting let the next build inherit the
    // whole banked window; the corrected one discards it.
    const factory = makeFactory({ usedSlots: 0, lastSlotRegen: new Date(now.getTime() - 10 * HOUR_IN_MS) });
    const regenerated = applySlotRegeneration(factory, { now, balanceMultiplier: 1 });
    expect(regenerated.usedSlots).toBe(0); // never negative, never banked
    expect(regenerated.lastSlotRegen.getTime()).toBe(now.getTime()); // rebase
  });

  it('draining to empty this tick discards the surplus and rebases to now', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const factory = makeFactory({ usedSlots: 30, lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS) });
    const regenerated = applySlotRegeneration(factory, { now, balanceMultiplier: 1 });
    expect(regenerated.usedSlots).toBe(0);
    expect(regenerated.lastSlotRegen.getTime()).toBe(now.getTime());
  });

  it('future/corrupt timestamps fail safe: no fabricated recovery, checkpoint rebased', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const future = applySlotRegeneration(
      makeFactory({ usedSlots: 100, lastSlotRegen: new Date(now.getTime() + HOUR_IN_MS) }),
      { now, balanceMultiplier: 1 },
    );
    expect(future.usedSlots).toBe(100);
    expect(future.lastSlotRegen.getTime()).toBe(now.getTime());

    const corrupt = applySlotRegeneration(
      makeFactory({ usedSlots: 100, lastSlotRegen: new Date('not-a-date') }),
      { now, balanceMultiplier: 1 },
    );
    expect(corrupt.usedSlots).toBe(100);
    expect(corrupt.lastSlotRegen.getTime()).toBe(now.getTime());
  });

  it('getTimeUntilNextSlot uses the SAME effective rate as the recovery', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const factory = makeFactory({ lastSlotRegen: now, usedSlots: 500 });
    // L10 neutral: one slot every 30s. At 0.85: 3600/102 ≈ 35.29s.
    const neutral = getTimeUntilNextSlot(factory, { now, balanceMultiplier: 1 });
    expect(neutral.totalMs).toBeCloseTo(HOUR_IN_MS / 120, 0);
    const critical = getTimeUntilNextSlot(factory, { now, balanceMultiplier: 0.85 });
    expect(critical.totalMs).toBeCloseTo(HOUR_IN_MS / (120 * 0.85), 0);
  });

  it('ownerless/invalid multiplier input fails safe to neutral (1.0)', () => {
    expect(getSlotRegenBalanceMultiplier(0, 0)).toBe(1);
    expect(getSlotRegenBalanceMultiplier(null, undefined)).toBe(1);
    expect(getSlotRegenBalanceMultiplier(NaN, NaN)).toBe(1);
    const now = new Date('2026-10-02T12:00:00Z');
    const factory = makeFactory({ lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS), usedSlots: 500 });
    expect(applySlotRegeneration(factory, { now, balanceMultiplier: NaN }).usedSlots).toBe(380);
  });
});

describe('FID-20261002-004 canonical blueprint ↔ UnitType catalog (all 40 core units)', () => {
  const CORE_SLOT_COSTS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };
  const coreIds = Object.keys(UNIT_TIER_ORDER);

  it('every one of the 40 roster ids resolves to a canonical UnitType with a derived config', () => {
    expect(coreIds).toHaveLength(40);
    for (const id of coreIds) {
      const unitType = resolveCanonicalUnitType(id);
      expect(unitType, `blueprint '${id}' must resolve`).not.toBeNull();
      expect(UNIT_CONFIGS[unitType as UnitType], `config for '${id}' must exist`).toBeDefined();
    }
  });

  it('all 40 mappings match canonical price/stats/tier/slot costs (no drift, no one-slot fallback)', () => {
    for (const id of coreIds) {
      const blueprint = UNIT_BLUEPRINTS[id];
      const unitType = resolveCanonicalUnitType(id)!;
      const config = UNIT_CONFIGS[unitType];
      const tier = UNIT_TIER_ORDER[id];
      expect(config.tier, `${id} tier`).toBe(tier);
      expect(config.strength, `${id} STR`).toBe(blueprint.strength);
      expect(config.defense, `${id} DEF`).toBe(blueprint.defense);
      expect(config.metalCost, `${id} metal`).toBe(blueprint.metalCost);
      expect(config.energyCost, `${id} energy`).toBe(blueprint.energyCost);
      expect(config.name, `${id} name`).toBe(blueprint.name);
      expect(config.slotCost, `${id} slot cost follows the 1/3/7/15/30 curve`).toBe(CORE_SLOT_COSTS[tier]);
      // Tier requirements mirror the unlock table.
      expect(config.levelRequired).toBe(TIER_UNLOCK_REQUIREMENTS[tier as UnitTier].level);
      expect(config.rpRequired).toBe(TIER_UNLOCK_REQUIREMENTS[tier as UnitTier].rp);
    }
  });

  it('identity resolution accepts blueprint ids, enum keys and persisted values — and refuses junk', () => {
    expect(resolveCanonicalUnitType('titan')).toBe(UnitType.T5_Titan); // blueprint id
    expect(resolveCanonicalUnitType('T5_Titan')).toBe(UnitType.T5_Titan); // enum key
    expect(resolveCanonicalUnitType('T5_TITAN')).toBe(UnitType.T5_Titan); // persisted value
    expect(resolveCanonicalUnitType('TITAN')).toBeNull(); // uppercase label is NOT an identity
    expect(resolveCanonicalUnitType('death_star')).toBeNull();
    expect(resolveCanonicalUnitType('')).toBeNull();
    expect(unitConfigForIdentifier('titan')!.slotCost).toBe(30);
  });

  it('§5.2 tier admission: permanent unlock + level; already-unlocked ignores RP; SPEC/PRESTIGE exempt', () => {
    const tier1Only = [UnitTier.Tier1];
    // Titan = Tier 5 → refuses at level 1 with Tier 1 only.
    expect(isTierAdmissible(UnitType.T5_Titan, 1, tier1Only)).toBe(false);
    // Admitted once the recorded unlock exists — even at the same level with zero RP
    // (current RP balance is NOT the gate).
    expect(isTierAdmissible(UnitType.T5_Titan, 30, [UnitTier.Tier1, UnitTier.Tier5])).toBe(true);
    expect(isTierAdmissible(UnitType.T5_Titan, 29, [UnitTier.Tier1, UnitTier.Tier5])).toBe(false);
    expect(isTierUnlocked(UnitTier.Tier2, 5, [UnitTier.Tier1, UnitTier.Tier2])).toBe(true);
    // SPEC/PRESTIGE units have no blueprint — the tier rule does not apply
    // (their doctrine/achievement gates live elsewhere).
    expect(isTierAdmissible(UnitType.SPEC_OFF_Vanguard, 1, tier1Only)).toBe(true);
    expect(isTierAdmissible(UnitType.PRESTIGE_TITAN, 1, tier1Only)).toBe(true);
  });
});
