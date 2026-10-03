/**
 * @file __tests__/lib/techEffects.test.ts
 * @overview FID-20261002-012 §5.1/§5.2 — the ONE combat effect composition
 *           seam's contract pins: multiplicative ACROSS source categories,
 *           additive WITHIN a category, clamped damage-taken reductions,
 *           neutral passthrough, and the shared harvest cadence.
 */
import { describe, it, expect } from 'vitest';
import {
  composeCombatEffects,
  getPersonalTechCombatEffects,
  getResourceHarvestDelayMs,
  BASE_RESOURCE_HARVEST_DELAY_MS,
  MAX_DAMAGE_TAKEN_REDUCTION_PCT,
  TECH_EFFECTS,
} from '@/lib/research/techEffects';

describe('techEffects — composition seam (FID-20261002-012 §5.2)', () => {
  it('neutral inputs return the identity snapshot (unresearched/unclanned baseline)', () => {
    const s = composeCombatEffects({});
    expect(s.strMul).toBe(1);
    expect(s.defMul).toBe(1);
    expect(s.damageDealtMul).toBe(1);
    expect(s.damageTakenMul).toBe(1);
    expect(s.critChance).toBe(0);
    expect(s.critDamageMultiplier).toBe(1);
  });

  it('categories compose MULTIPLICATIVELY (clan 10% × discovery 20% × tech 20% on STR)', () => {
    const s = composeCombatEffects({
      clan: { attackPct: 10, defensePct: 0 },
      discovery: { unitStrengthPct: 20, unitDefensePct: 0, damageDealtPct: 0, damageTakenReductionPct: 0 },
      tech: { attackStrPct: 20, defensePct: 0, damageTakenReductionPct: 0, critChanceBonus: 0, critDamageMultiplier: 1 },
    });
    // 1.10 × 1.20 × 1.20 = 1.584 (NOT 1 + 0.5 = 1.5 additive)
    expect(s.strMul).toBeCloseTo(1.584, 10);
    expect(s.defMul).toBe(1);
  });

  it('doctrine and flag multipliers join the multiplicative chain (mastery-weighted truth)', () => {
    const s = composeCombatEffects({
      doctrine: { strMul: 1.15, defMul: 1.0 },
      flag: { strMul: 1.25, defMul: 1.25 },
      clan: { attackPct: 10, defensePct: 0 },
    });
    expect(s.strMul).toBeCloseTo(1.15 * 1.25 * 1.10, 10);
    expect(s.defMul).toBeCloseTo(1.25, 10);
  });

  it('damage-taken reductions are ADDITIVE within the reduction bucket then clamped (≤ 80%)', () => {
    const modest = composeCombatEffects({
      discovery: { unitStrengthPct: 0, unitDefensePct: 0, damageDealtPct: 0, damageTakenReductionPct: 30 },
      tech: { attackStrPct: 0, defensePct: 0, damageTakenReductionPct: 15, critChanceBonus: 0, critDamageMultiplier: 1 },
    });
    expect(modest.damageTakenMul).toBeCloseTo(0.55, 10);

    // 70% + 15% = 85% requested → clamped to the 80% ceiling (never zero damage).
    const extreme = composeCombatEffects({
      discovery: { unitStrengthPct: 0, unitDefensePct: 0, damageDealtPct: 0, damageTakenReductionPct: 70 },
      tech: { attackStrPct: 0, defensePct: 0, damageTakenReductionPct: 15, critChanceBonus: 0, critDamageMultiplier: 1 },
    });
    expect(extreme.damageTakenMul).toBeCloseTo(1 - MAX_DAMAGE_TAKEN_REDUCTION_PCT / 100, 10);
  });

  it('damage dealt is reported separately (never folded into the stat axes)', () => {
    const s = composeCombatEffects({
      discovery: { unitStrengthPct: 0, unitDefensePct: 0, damageDealtPct: 25, damageTakenReductionPct: 0 },
    });
    expect(s.damageDealtMul).toBeCloseTo(1.25, 10);
    expect(s.strMul).toBe(1);
    expect(s.defMul).toBe(1);
  });

  it('crit chance clamps at 0.5 and non-finite inputs fall back to neutral', () => {
    const s = composeCombatEffects({
      tech: { attackStrPct: 20, defensePct: 0, damageTakenReductionPct: 0, critChanceBonus: 0.9, critDamageMultiplier: 1.5 },
    });
    expect(s.critChance).toBe(0.5);

    const garbage = composeCombatEffects({
      doctrine: { strMul: Number.NaN, defMul: 1 },
      clan: { attackPct: Number.POSITIVE_INFINITY, defensePct: 0 },
    });
    expect(garbage.strMul).toBe(1); // NaN/∞ → neutral fallback per term
  });
});

describe('techEffects — personal tech coefficients (FID-20261002-012 §5.4)', () => {
  it('tactical-warfare: +20% attacking STR, +5pp crit, 1.5× crit damage', () => {
    const t = getPersonalTechCombatEffects(['tactical-warfare']);
    expect(t.attackStrPct).toBe(20);
    expect(t.critChanceBonus).toBeCloseTo(0.05, 10);
    expect(t.critDamageMultiplier).toBe(1.5);
    expect(t.baseDefensePct).toBe(0);
  });

  it('fortification: +15% base DEF and −15% raid damage (defense coefficients only)', () => {
    const t = getPersonalTechCombatEffects(['fortification']);
    expect(t.baseDefensePct).toBe(15);
    expect(t.baseRaidDamageReductionPct).toBe(15);
    expect(t.attackStrPct).toBe(0);
  });

  it('unresearched/null tech lists are fully neutral', () => {
    for (const techs of [null, undefined, [], ['advanced-mining'], ['bot-magnet']]) {
      const t = getPersonalTechCombatEffects(techs);
      expect(t).toEqual({
        attackStrPct: 0,
        baseDefensePct: 0,
        baseRaidDamageReductionPct: 0,
        critChanceBonus: 0,
        critDamageMultiplier: 1,
      });
    }
  });

  it('catalog prices are unchanged (22,500 RP for the three core techs — R9 evidence)', () => {
    expect(TECH_EFFECTS['advanced-mining'].harvestYieldPct).toBe(10);
    expect(TECH_EFFECTS.fortification.defensePct).toBe(15);
    expect(TECH_EFFECTS['tactical-warfare'].attackStrPct).toBe(20);
  });
});

describe('techEffects — the authoritative harvest cadence (§5.3 source-audit contract)', () => {
  it('base 3000ms; advanced-mining owners act at 2400ms (3000 ÷ 1.25)', () => {
    expect(BASE_RESOURCE_HARVEST_DELAY_MS).toBe(3000);
    expect(getResourceHarvestDelayMs(false)).toBe(3000);
    expect(getResourceHarvestDelayMs(true)).toBe(2400);
  });
});
