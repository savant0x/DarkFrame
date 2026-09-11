/**
 * @file __tests__/lib/beerBasePowerBands.test.ts
 * @overview FID-20260909-034 — Beer Base power-band integrity regression.
 *
 * Bands are the difficulty contract (PowerTier comment block = the spec):
 * WEAK 15K-50K, MID 50K-500K, STRONG 500K-2M, ELITE 2M-10M, ULTRA 10M-50M,
 * LEGENDARY 50M-100M TOTAL army power (strength + defense). Before this FID
 * the generator leaked band guarantees two ways:
 *
 * 1. Cross-stat spillover: budgets were computed on the picked axis only, so
 *    dual-stat SPEC_TAC/PRESTIGE units delivered their other stat unbudgeted
 *    (Silent_Citadel spawned 11.56M actual against the 10M ELITE ceiling).
 * 2. Hollow armies: post-unification unit costs (T1 = 100) exceed the old
 *    1K WEAK floor and its per-tier slices; floor(quantity) = 0 skipped every
 *    tier, spawning zero-STR bases.
 *
 * The contract now: for every (tier, specialization) draw, Σ(quantity ×
 * (str + def)) lands inside the tier band; every tier slot is populated;
 * only PURE units (one nonzero stat) are fielded when the pool allows.
 */

import { describe, it, expect } from 'vitest';
import {
  generateBeerBaseUnits,
  UNIT_POOLS,
  __testing,
} from '../../lib/beerBaseService';
import { BotSpecialization, UNIT_CONFIGS, UnitTier } from '../../types/game.types';

const { getTargetPowerForTier, POWER_BANDS } = __testing;

const SPECIALIZATIONS = [
  BotSpecialization.Balanced,
  BotSpecialization.Raider,
  BotSpecialization.Fortress,
  BotSpecialization.Ghost,
  BotSpecialization.Hoarder,
];

const SAMPLES_PER_CELL = 40;

describe('Beer Base power-band integrity (FID-20260909-034)', () => {
  it('draws every tier target strictly inside its band (generator is honest)', () => {
    for (const tier of Object.values(POWER_BANDS)) {
      for (let i = 0; i < 200; i++) {
        const draw = getTargetPowerForTier(tier.key);
        expect(draw).toBeGreaterThanOrEqual(tier.min);
        expect(draw).toBeLessThanOrEqual(tier.max);
      }
    }
  });

  it('fields armies strictly inside the band for every tier × specialization', () => {
    for (const tier of Object.values(POWER_BANDS)) {
      for (const spec of SPECIALIZATIONS) {
        for (let i = 0; i < SAMPLES_PER_CELL; i++) {
          const units = generateBeerBaseUnits(spec, tier.key);
          const total = units.reduce((s, u) => s + (u.strength + u.defense) * u.quantity, 0);
          expect(total).toBeGreaterThanOrEqual(tier.min);
          expect(total).toBeLessThanOrEqual(tier.max);
        }
      }
    }
  });

  it('never spawns a hollow army (core slots always populated, total in-band)', () => {
    // FID-20260909-035: slots the budget cannot afford are SKIPPED (small
    // armies legitimately lack T5 units), but at the 15K WEAK floor the T1-T3
    // slices always afford at least one unit on both STR and DEF sides, and
    // the floor top-up guarantees the army total never undershoots the band.
    for (const spec of SPECIALIZATIONS) {
      const units = generateBeerBaseUnits(spec, POWER_BANDS.weak.key);
      expect(units.length).toBeGreaterThanOrEqual(4); // ≥ T1-T3 on one axis + core DEF
      const total = units.reduce((s, u) => s + (u.strength + u.defense) * u.quantity, 0);
      expect(total).toBeGreaterThanOrEqual(POWER_BANDS.weak.min);
      expect(total).toBeLessThanOrEqual(POWER_BANDS.weak.max);
    }
    // And no band can ever produce an empty army.
    for (const band of Object.values(POWER_BANDS)) {
      for (const spec of SPECIALIZATIONS) {
        const units = generateBeerBaseUnits(spec, band.key);
        expect(units.length).toBeGreaterThan(0);
      }
    }
  });

  it('fields pure units only (one nonzero stat) — no cross-stat leakage', () => {
    const units = generateBeerBaseUnits(BotSpecialization.Raider, POWER_BANDS.elite.key);
    for (const u of units) {
      expect(u.strength === 0 || u.defense === 0).toBe(true);
    }
  });

  it('respects the specialization STR/DEF ratio within tolerance', () => {
    // Raider (70/30) vs Fortress (30/70): the STR share must reflect the spec.
    const strShare = (spec: BotSpecialization) => {
      const units = generateBeerBaseUnits(spec, POWER_BANDS.mid.key);
      const str = units.reduce((s, u) => s + u.strength * u.quantity, 0);
      const total = units.reduce((s, u) => s + (u.strength + u.defense) * u.quantity, 0);
      return str / total;
    };
    for (let i = 0; i < 10; i++) {
      expect(strShare(BotSpecialization.Raider)).toBeGreaterThan(0.5);
      expect(strShare(BotSpecialization.Fortress)).toBeLessThan(0.5);
    }
  });

  it('UNIT_POOLS mirror the unified catalog exactly (FID-033 drift guard)', () => {
    for (const tierNum of [1, 2, 3, 4, 5]) {
      const expected = Object.values(UNIT_CONFIGS)
        .filter((c) => Number(c.tier) === tierNum)
        .map((c) => ({ type: c.type, name: c.name, str: c.strength, def: c.defense }));
      expect(new Set(UNIT_POOLS[tierNum as UnitTier].map((u) => JSON.stringify(u))))
        .toEqual(new Set(expected.map((u) => JSON.stringify(u))));
    }
  });
});
