/**
 * @file __tests__/unit/catalog-unification.test.ts
 * @overview FID-20260909-033 — unit catalog unification regression guards.
 *
 * Before the FID, four parallel unit catalogs existed with divergent names,
 * stats, and scales (the Unit Factory UI sold Infantry@100 while UNIT_CONFIGS
 * sold Rifleman@5; beerBaseService hand-copied stats with drift; botGrowthEngine
 * carried a third naming scheme). UNIT_CONFIGS is now generated from the
 * canonical UNIT_BLUEPRINTS roster. These tests pin the unified contract so
 * stat drift between the two tables can never silently return.
 */
import { describe, it, expect } from 'vitest';
import { UNIT_CONFIGS, UnitType, UnitTier } from '@/types/game.types';
import { UNIT_BLUEPRINTS } from '@/types/units.types';

const configEntries = Object.values(UNIT_CONFIGS);
// T-tier (standard, player-buildable) units; SPEC/PRESTIGE are separate
// progression systems with no blueprint counterpart by design. Key on the
// ENUM KEY (T1_Infantry), not the value — T1's value is 'INFANTRY'.
const keyForValue = new Map(Object.entries(UnitType).map(([k, v]) => [v as string, k]));
const tTier = configEntries.filter((c) => /^T[1-5]_/.test(keyForValue.get(c.type) ?? ''));

describe('FID-20260909-033: unit catalog unification', () => {
  it('every UnitType enum value is unique (no canonical/legacy collisions)', () => {
    const values = Object.values(UnitType);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every T-tier config matches its UNIT_BLUEPRINTS source exactly', () => {
    const byName = new Map(
      Object.values(UNIT_BLUEPRINTS).map((b) => [b.name.toLowerCase(), b])
    );
    for (const cfg of tTier) {
      const bp = byName.get(cfg.name.toLowerCase());
      expect(bp, `no blueprint found for config ${cfg.type} ('${cfg.name}')`).toBeDefined();
      expect(cfg.strength, `${cfg.type}.strength`).toBe(bp!.strength);
      expect(cfg.defense, `${cfg.type}.defense`).toBe(bp!.defense);
      expect(cfg.metalCost, `${cfg.type}.metalCost`).toBe(bp!.metalCost);
      expect(cfg.energyCost, `${cfg.type}.energyCost`).toBe(bp!.energyCost);
    }
  });

  it('blueprint roster is fully covered — a blueprint without a config entry fails', () => {
    expect(tTier.length).toBe(Object.keys(UNIT_BLUEPRINTS).length);
  });

  it('the canonical T1 STR unit is Infantry @ 100 STR (operator-verified)', () => {
    const infantry = UNIT_CONFIGS[UnitType.T1_Infantry];
    expect(infantry.name).toBe('Infantry');
    expect(infantry.strength).toBe(100);
    expect(infantry.metalCost).toBe(200);
    expect(infantry.energyCost).toBe(200);
    // the stale 1/20th-scale intruder is gone
    expect(UNIT_CONFIGS[UnitType.T1_Rifleman].strength).toBe(95);
    expect(UNIT_CONFIGS[UnitType.T1_Rifleman].name).toBe('Rifleman');
  });

  it('each tier has STR and DEF units with the exponential slot costs (1/3/7/15/30)', () => {
    const slotByTier: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };
    for (const tier of [1, 2, 3, 4, 5] as UnitTier[]) {
      const inTier = tTier.filter((c) => c.tier === tier);
      expect(inTier.length, `tier ${tier} populated`).toBeGreaterThan(0);
      expect(inTier.some((c) => c.strength > 0), `tier ${tier} STR units`).toBe(true);
      expect(inTier.some((c) => c.defense > 0), `tier ${tier} DEF units`).toBe(true);
      for (const c of inTier) {
        expect(c.slotCost, `${c.type}.slotCost`).toBe(slotByTier[tier]);
      }
    }
  });

  it('runtime net: every enum member resolves in UNIT_CONFIGS (Record exhaustiveness is compile-time only)', () => {
    const configTypes = new Set(configEntries.map((c) => c.type));
    for (const v of Object.values(UnitType)) {
      expect(configTypes.has(v), `missing config for ${v}`).toBe(true);
    }
  });
});
