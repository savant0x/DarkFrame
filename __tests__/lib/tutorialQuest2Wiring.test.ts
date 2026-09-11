/**
 * @file __tests__/lib/tutorialQuest2Wiring.test.ts
 * @overview FID-20260909-025 §6 regression tests — tutorial quest-2 completion
 * wiring (the structurally-uncompletable quest).
 *
 * Covers:
 * - Quest-2 step definitions are completable (cave step copy honesty,
 *   harvest step hookability, CUSTOM steps with evaluatable requirementTypes)
 * - resolveNearestCaveTile (was: hardcoded (20,40) that is usually not a cave)
 * - recordTutorialHarvest completing the active HARVEST step (was: no hook)
 * - sanitize allowlist ships balanceEffects (balance-pill data source)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted so the tutorialService module mock can reference them
// before initialization (vi.mock calls are hoisted above const declarations).
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    __rows: [] as unknown[],
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    orderBy: () => mockDb,
    limit: () => Promise.resolve(mockDb.__rows),
    insert: () => mockDb,
    update: () => mockDb,
    set: () => mockDb,
    delete: () => mockDb,
    values: () => Promise.resolve(mockDb),
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', () => ({
  tutorialProgress: { playerId: 'player_id' },
  tutorialActionTracking: { playerId: 'player_id', stepId: 'step_id' },
  players: { username: 'username' },
  factories: {},
  tiles: { terrain: 'terrain', x: 'x', y: 'y' },
}));

// caveItemService imported by tutorialService at module load
vi.mock('@/lib/caveItemService', () => ({
  awardTutorialDiggerToPlayer: vi.fn(async () => undefined),
}));

import {
  resolveNearestCaveTile,
  recordTutorialHarvest,
  getTutorialQuest,
} from '@/lib/tutorialService';

beforeEach(() => {
  mockDb.__rows = [];
});

describe('FID-025 §4.3a — quest definitions are completable', () => {
  it('the cave step declares a coordinate target and no longer hardcodes (20,40) as the contract', () => {
    const quest = getTutorialQuest('quest_resource_army_building');
    expect(quest).not.toBeNull();

    const caveStep = quest!.steps.find((s) => s.id === 'resource_find_cave');
    expect(caveStep).toBeDefined();
    expect(caveStep!.action).toBe('MOVE');
    expect(caveStep!.targetCoordinates).toBeDefined();
    // Instruction copy no longer names hardcoded coordinates as the contract
    expect(caveStep!.instruction).not.toMatch(/\(20,\s*40\)/);
  });

  it('the harvest step is a HARVEST action with a reward (reachable via recordTutorialHarvest)', () => {
    const quest = getTutorialQuest('quest_resource_army_building');
    const harvestStep = quest!.steps.find((s) => s.id === 'resource_harvest_cave');
    expect(harvestStep).toBeDefined();
    expect(harvestStep!.action).toBe('HARVEST');
    expect(harvestStep!.reward).toBeDefined();
  });

  it('every CUSTOM step in the quest has a requirementType that completeStep evaluates', () => {
    const quest = getTutorialQuest('quest_resource_army_building');
    const customSteps = quest!.steps.filter((s) => s.action === 'CUSTOM');
    expect(customSteps.length).toBeGreaterThan(0);
    for (const step of customSteps) {
      expect(['metal_balance', 'energy_balance', 'factory_capture', 'build_unit'])
        .toContain(step.validationData?.requirementType);
    }
  });
});

describe('FID-025 §4.3a — resolveNearestCaveTile', () => {
  it('returns the nearest cave by squared distance', async () => {
    mockDb.__rows = [{ x: 25, y: 38 }, { x: 60, y: 60 }];
    const result = await resolveNearestCaveTile(24, 40);
    // (25,38): d²=1+4=5 — closer than (60,60)
    expect(result).toEqual({ x: 25, y: 38 });
  });

  it('returns null when no caves exist (route falls back to declared coordinates)', async () => {
    mockDb.__rows = [];
    const result = await resolveNearestCaveTile(20, 40);
    expect(result).toBeNull();
  });
});

describe('FID-025 §4.3b — recordTutorialHarvest (harvest route hook)', () => {
  it('is non-throwing when the player has declined the tutorial (Law 14)', async () => {
    // getTutorialProgress maps the raw row; declined short-circuits everything
    mockDb.__rows = [
      {
        playerId: 'p1',
        currentQuestId: null,
        currentStepIndex: 0,
        completedQuests: [],
        completedSteps: [],
        skippedQuests: [],
        claimedRewards: [],
        tutorialSkipped: false,
        tutorialDeclined: true,
        tutorialComplete: false,
        startedAt: new Date(),
        lastUpdated: new Date(),
        totalStepsCompleted: 0,
      },
    ];
    await expect(recordTutorialHarvest('p1', 'Cave')).resolves.toBeUndefined();
  });

  it('is non-throwing when the player has no progress row at all', async () => {
    mockDb.__rows = []; // no progress row → fresh-player path → progress write on mocked db
    await expect(recordTutorialHarvest('p1', 'Forest')).resolves.toBeUndefined();
  });
});

describe('FID-025 §4.1 — sanitize allowlist ships balanceEffects', () => {
  it('the derived balance readout survives sanitization', async () => {
    const { sanitizePlayer } = await import('@/lib/playerSanitize');
    const sanitized = sanitizePlayer({
      username: 'c',
      totalStrength: 900,
      totalDefense: 300,
      balanceEffects: {
        ratio: 3,
        status: 'CRITICAL_OFFENSE',
        powerMultiplier: 0.7,
        damageTakenMultiplier: 1.1,
        damageDealtMultiplier: 0.9,
        gatheringMultiplier: 0.85,
        slotRegenMultiplier: 0.9,
        effectivePower: 840,
        warnings: ['Army heavily skewed toward offense'],
        bonuses: [],
        recommendation: 'Build more defensive units',
      },
    } as unknown as Parameters<typeof sanitizePlayer>[0]);

    expect(sanitized).not.toBeNull();
    expect(sanitized!.balanceEffects).toBeDefined();
    expect(sanitized!.balanceEffects!.powerMultiplier).toBe(0.7);
    expect(sanitized!.balanceEffects!.recommendation).toBe('Build more defensive units');
  });
});
