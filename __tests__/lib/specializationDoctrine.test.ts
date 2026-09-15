// @vitest-environment node
/**
 * FID-20260914-008 Phases 1–2: doctrine bonus resolution + earnable mastery.
 *
 * The doctrine contract (converged plan):
 *   - getDoctrineBonuses is the SINGLE resolver: doctrine config → per-axis stat
 *     multipliers (Tactical's balancedMultiplier covers both axes) × mastery
 *     amplification (milestones 25/50/75/100 → +5/10/15/20%, highest applies,
 *     stats only — never the cost discounts).
 *   - Cost seams consume metalCostMul/energyCostMul; combat seams consume
 *     strMul/defMul (join the flag-bearer stack in resolveBattle).
 *   - Mastery XP is earned server-side only: +10 per doctrine-matching unit
 *     build, +25 per battle won; the doctrine counters accrue atomically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDoctrineBonuses,
  masteryAmplificationPercent,
  awardMasteryXP,
  awardBuildMasteryXP,
  MASTERY_XP_UNIT_BUILD,
  MASTERY_XP_BATTLE_WON,
  SpecializationDoctrine,
  type Specialization,
} from '@/lib/specializationService';

const updateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};
const selectLimit = vi.fn().mockResolvedValue([{ specialization: null }]);
const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: selectLimit,
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  },
}));

vi.mock('@/lib/statTrackingService', () => ({
  triggerAchievementCheck: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function spec(partial: Partial<Specialization>): Specialization {
  return {
    doctrine: SpecializationDoctrine.Offensive,
    selectedAt: new Date(),
    masteryLevel: 0,
    masteryXP: 0,
    totalUnitsBuilt: 0,
    totalBattlesWon: 0,
    respecHistory: [],
    lastRespecAt: null,
    ...partial,
  };
}

beforeEach(() => {
  updateChain.set.mockClear();
  updateChain.where.mockClear();
  selectLimit.mockClear();
});

describe('masteryAmplificationPercent', () => {
  it('is 0 below the first milestone and steps at 25/50/75/100', () => {
    expect(masteryAmplificationPercent(0)).toBe(0);
    expect(masteryAmplificationPercent(24)).toBe(0);
    expect(masteryAmplificationPercent(25)).toBe(5);
    expect(masteryAmplificationPercent(49)).toBe(5);
    expect(masteryAmplificationPercent(50)).toBe(10);
    expect(masteryAmplificationPercent(75)).toBe(15);
    expect(masteryAmplificationPercent(100)).toBe(20);
  });
});

describe('getDoctrineBonuses (pure resolver)', () => {
  it('returns neutral identity for no specialization', () => {
    expect(getDoctrineBonuses(null)).toEqual({ strMul: 1, defMul: 1, metalCostMul: 1, energyCostMul: 1 });
  });

  it('maps Offensive config to its own axes', () => {
    const b = getDoctrineBonuses(spec({ doctrine: SpecializationDoctrine.Offensive }));
    expect(b.strMul).toBeCloseTo(1.15);
    expect(b.defMul).toBe(1);
    expect(b.metalCostMul).toBeCloseTo(0.9);
    expect(b.energyCostMul).toBe(1);
  });

  it('maps Defensive config to its own axes', () => {
    const b = getDoctrineBonuses(spec({ doctrine: SpecializationDoctrine.Defensive }));
    expect(b.strMul).toBe(1);
    expect(b.defMul).toBeCloseTo(1.15);
    expect(b.metalCostMul).toBe(1);
    expect(b.energyCostMul).toBeCloseTo(0.9);
  });

  it('applies Tactical balancedMultiplier to BOTH stat axes', () => {
    const b = getDoctrineBonuses(spec({ doctrine: SpecializationDoctrine.Tactical }));
    expect(b.strMul).toBeCloseTo(1.10);
    expect(b.defMul).toBeCloseTo(1.10);
    expect(b.metalCostMul).toBeCloseTo(0.95);
    expect(b.energyCostMul).toBeCloseTo(0.95);
  });

  it('amplifies STATS with mastery but never the cost discounts', () => {
    const b = getDoctrineBonuses(spec({ doctrine: SpecializationDoctrine.Offensive, masteryLevel: 50 }));
    expect(b.strMul).toBeCloseTo(1.15 * 1.1);
    expect(b.metalCostMul).toBeCloseTo(0.9); // unchanged
    const t = getDoctrineBonuses(spec({ doctrine: SpecializationDoctrine.Tactical, masteryLevel: 100 }));
    expect(t.strMul).toBeCloseTo(1.10 * 1.2);
    expect(t.energyCostMul).toBeCloseTo(0.95); // unchanged
  });
});

describe('awardMasteryXP (server-side earn core)', () => {
  it('rejects players without a specialization', async () => {
    selectLimit.mockResolvedValueOnce([{ specialization: null }]);
    const r = await awardMasteryXP('p', 10, 'test');
    expect(r.success).toBe(false);
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it('adds XP, levels up at 100/level, and does NOT touch counters without one', async () => {
    selectLimit.mockResolvedValue([{ specialization: spec({ masteryXP: 95 }) }]);
    const r = await awardMasteryXP('p', 25, 'battle won');
    expect(r.success).toBe(true);
    expect(r.leveledUp).toBe(true);
    expect(r.newMasteryLevel).toBe(1);
    expect(r.newMasteryXP).toBe(120);
    // exactly one update (the specialization write), no counter write
    expect(updateChain.set).toHaveBeenCalledTimes(1);
    expect(updateChain.set.mock.calls[0][0]).toMatchObject({
      specialization: expect.objectContaining({ masteryXP: 120, masteryLevel: 1 }),
    });
  });

  it('accrues the doctrine counter atomically when asked', async () => {
    selectLimit.mockResolvedValue([{ specialization: spec({ totalBattlesWon: 4 }) }]);
    const r = await awardMasteryXP('p', MASTERY_XP_BATTLE_WON, 'battle won', {
      field: 'totalBattlesWon',
      by: 1,
    });
    expect(r.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledTimes(2); // spec write + counter write
  });
});

describe('awardBuildMasteryXP (doctrine-matching builds)', () => {
  it('pays +10 per unit for a matching Offensive (strength) build and counts units', async () => {
    selectLimit.mockResolvedValue([
      { specialization: spec({ doctrine: SpecializationDoctrine.Offensive }) },
      { specialization: spec({ doctrine: SpecializationDoctrine.Offensive, masteryXP: 10 }) },
    ]);
    const r = await awardBuildMasteryXP('p', 3, MASTERY_XP_UNIT_BUILD, 'strength');
    expect(r.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledTimes(2); // xp write + counter write
    expect(updateChain.set.mock.calls[0][0]).toMatchObject({
      specialization: expect.objectContaining({ masteryXP: 30 }),
    });
  });

  it('REJECTS a non-matching build (Offensive ≠ defense units) and pays nothing', async () => {
    selectLimit.mockResolvedValue([
      { specialization: spec({ doctrine: SpecializationDoctrine.Offensive }) },
    ]);
    const r = await awardBuildMasteryXP('p', 3, MASTERY_XP_UNIT_BUILD, 'defense');
    expect(r.success).toBe(false);
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it('Tactical (balanced doctrine) counts every build', async () => {
    selectLimit.mockResolvedValue([
      { specialization: spec({ doctrine: SpecializationDoctrine.Tactical }) },
      { specialization: spec({ doctrine: SpecializationDoctrine.Tactical, masteryXP: 10 }) },
    ]);
    const r = await awardBuildMasteryXP('p', 2, MASTERY_XP_UNIT_BUILD, 'defense');
    expect(r.success).toBe(true);
    expect(updateChain.set.mock.calls[0][0]).toMatchObject({
      specialization: expect.objectContaining({ masteryXP: 20 }),
    });
  });

  it('pays nothing without a specialization', async () => {
    selectLimit.mockResolvedValue([{ specialization: null }]);
    const r = await awardBuildMasteryXP('p', 1, MASTERY_XP_UNIT_BUILD, 'strength');
    expect(r.success).toBe(false);
    expect(updateChain.set).not.toHaveBeenCalled();
  });
});
