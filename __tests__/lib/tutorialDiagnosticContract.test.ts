/**
 * FID-20260912-091 — tutorial diagnostic wiring contract tests.
 *
 * The diagnostic's whole value rests on one claim: its wiring verdicts match
 * reality. These tests bind lib/tutorialDiagnostic's classification to the
 * REAL quest definitions (TUTORIAL_QUESTS) and the audited writer inventory,
 * so any future step added with the FID-090b failure class (validated but
 * never written) fails CI here instead of stranding players silently.
 *
 * The audited writer inventory (FID-091):
 *   READ_INFO+autoComplete        → GET /api/tutorial auto-completion
 *   READ_INFO / COLLECT_REWARD    → manual complete_step (validator passes on {})
 *   MOVE (requiredMoves)          → move route counting hook
 *   MOVE (targetCoordinates)      → move route nearest-tile hook (FID-20260909-025)
 *   MOVE (neither)                → manual complete_step (no requirements)
 *   MOVE_TO_COORDS (vd)           → move route MOVE_TO_COORDS handler
 *   HARVEST                       → harvest route recordTutorialHarvest
 *   ATTACK targetType beer_base   → combat/attack recordTutorialBaseAttack (FID-090b)
 *   ATTACK requiredAttacks w/o targetType → UNWIRED (track-action has no caller)
 *   OPEN_PANEL                    → manual complete_step (passes on {})
 *   CUSTOM enriched types         → completeStep enrichment switch
 *   CUSTOM find_beer_base         → recordTutorialBeerBaseFound (FID-090b)
 *   RESEARCH / CLICK_BUTTON       → UNWIRED (no validator case, no hook)
 */
import { describe, it, expect } from 'vitest';
import { TUTORIAL_QUESTS } from '@/lib/tutorialService';
import {
  describeStepWiring,
  buildPlayerDiagnostics,
  type TrackingRow,
} from '@/lib/tutorialDiagnostic';
import type { TutorialProgress, TutorialStep } from '@/types/tutorial.types';

/** Every step in the live definitions, flattened with its quest. */
function allSteps(): Array<{ questId: string; step: TutorialStep }> {
  return TUTORIAL_QUESTS.flatMap(q => q.steps.map(s => ({ questId: q._id!, step: s })));
}

describe('wiring registry vs real quest definitions', () => {
  it('classifies every step in TUTORIAL_QUESTS as a known kind', () => {
    const kinds = new Set(['auto', 'server_hook', 'manual_click', 'unwired']);
    for (const { step } of allSteps()) {
      const wiring = describeStepWiring(step);
      expect(kinds.has(wiring.kind), `${step.id} → ${wiring.kind}`).toBe(true);
      expect(wiring.source.length, `${step.id} must cite its writer`).toBeGreaterThan(0);
    }
  });

  it('the audited current definitions contain ZERO unwired steps', () => {
    const unwired = allSteps().filter(({ step }) => describeStepWiring(step).kind === 'unwired');
    // If this fails, a step was added with no completion path — wire it or the
    // tutorial strands every player who reaches it (FID-090b precedent).
    expect(
      unwired.map(u => u.step.id),
      'unwired steps found — no completion path exists for them'
    ).toEqual([]);
  });

  it('every READ_INFO step auto-completes (the only auto kind)', () => {
    for (const { step } of allSteps()) {
      const wiring = describeStepWiring(step);
      if (step.action === 'READ_INFO') {
        expect(wiring.kind, step.id).toBe('auto');
        expect(step.autoComplete, step.id).toBe(true);
      } else {
        expect(wiring.kind, `${step.id} must not be auto`).not.toBe('auto');
      }
    }
  });

  it('find_beer_base and beer-base ATTACK steps are server hooks (FID-090b writers)', () => {
    const byId = new Map(allSteps().map(({ step }) => [step.id, step]));
    const found = byId.get('combat_find_target');
    const attack = byId.get('combat_attack');
    expect(found).toBeDefined();
    expect(attack).toBeDefined();
    expect(found!.action).toBe('CUSTOM');
    expect(found!.validationData?.requirementType).toBe('find_beer_base');
    expect(describeStepWiring(found!).kind).toBe('server_hook');
    expect(describeStepWiring(attack!).kind).toBe('server_hook');
    expect(attack!.action).toBe('ATTACK');
    expect(attack!.validationData?.targetType).toBe('beer_base');
  });

  it('HARVEST and counting-MOVE steps are server hooks; MOVE_TO_COORDS too', () => {
    const kinds = new Map(allSteps().map(({ step }) => [step.id, describeStepWiring(step).kind]));
    expect(kinds.get('resource_harvest_cave')).toBe('server_hook');
    expect(kinds.get('movement_free_exploration')).toBe('server_hook'); // requiredMoves
    expect(kinds.get('movement_navigate_to_shrine')).toBe('server_hook'); // MOVE_TO_COORDS
  });

  it('OPEN_PANEL / COLLECT_REWARD steps are manual clicks (validator passes on {})', () => {
    const kinds = new Map(allSteps().map(({ step }) => [step.id, describeStepWiring(step).kind]));
    expect(kinds.get('social_open_clan_panel')).toBe('manual_click');
    expect(kinds.get('tech_open_panel')).toBe('manual_click');
    expect(kinds.get('tutorial_complete_celebration')).toBe('manual_click');
  });
});

describe('describeStepWiring unit contract', () => {
  it('ATTACK with requiredAttacks but no beer_base target is UNWIRED (track-action has no caller)', () => {
    const step = {
      id: 'test_attack_count',
      order: 0,
      title: 'Attack twice',
      instruction: '',
      action: 'ATTACK',
      validationData: { requiredAttacks: 2 },
      difficulty: 'MEDIUM',
      estimatedSeconds: 30,
      skipAllowed: false,
    } as unknown as TutorialStep;
    expect(describeStepWiring(step).kind).toBe('unwired');
  });

  it('unknown CUSTOM requirementType is UNWIRED', () => {
    const step = {
      id: 'test_custom_unknown',
      order: 0,
      title: 'Mystery',
      instruction: '',
      action: 'CUSTOM',
      validationData: { requirementType: 'moon_alignment' as never },
      difficulty: 'MEDIUM',
      estimatedSeconds: 30,
      skipAllowed: false,
    } as unknown as TutorialStep;
    expect(describeStepWiring(step).kind).toBe('unwired');
  });

  it('enriched CUSTOM types are server hooks', () => {
    for (const requirementType of ['metal_balance', 'energy_balance', 'factory_capture', 'build_unit'] as const) {
      const step = {
        id: 'test_custom',
        order: 0,
        title: 'Balance',
        instruction: '',
        action: 'CUSTOM',
        validationData: { requirementType },
        difficulty: 'MEDIUM',
        estimatedSeconds: 30,
        skipAllowed: false,
      } as unknown as TutorialStep;
      expect(describeStepWiring(step).kind, requirementType).toBe('server_hook');
    }
  });
});

describe('buildPlayerDiagnostics', () => {
  const quests = TUTORIAL_QUESTS;

  function progressOf(over: Partial<TutorialProgress>): TutorialProgress {
    return {
      playerId: 'tester',
      currentQuestId: 'quest_movement_basics',
      currentStepIndex: 2,
      completedQuests: [],
      completedSteps: [],
      skippedQuests: [],
      claimedRewards: [],
      tutorialSkipped: false,
      tutorialDeclined: false,
      tutorialComplete: false,
      startedAt: new Date('2026-09-13T00:00:00Z'),
      lastUpdated: new Date('2026-09-13T01:00:00Z'),
      totalStepsCompleted: 0,
      totalTimeSpent: 0,
      ...over,
    };
  }

  it('marks exactly one step current, honors completedSteps, exposes tracking rows', () => {
    const progress = progressOf({
      completedSteps: ['movement_welcome', 'movement_navigate_to_shrine'],
    });
    const tracking: TrackingRow[] = [{
      stepId: 'movement_navigate_to_shrine',
      currentCount: 0,
      targetCount: 0,
      targetX: 42,
      targetY: 17,
      lastUpdated: new Date('2026-09-13T00:30:00Z'),
    }];

    const { quests: rows, holes, stuckUnwired } = buildPlayerDiagnostics(quests, progress, tracking);

    const marked = rows.flatMap(q => q.steps.filter(s => s.isCurrent));
    expect(marked).toHaveLength(1);
    expect(marked[0].stepId).toBe('movement_navigate_to_metal_bank'); // order 2 in quest 1

    const shrine = rows[0].steps.find(s => s.stepId === 'movement_navigate_to_shrine')!;
    expect(shrine.completed).toBe(true);
    expect(shrine.tracking?.targetX).toBe(42);

    expect(holes).toEqual([]);
    expect(stuckUnwired).toBe(false);
  });

  it('flags holes: index past an incomplete step on the current quest', () => {
    // Index 4 but step order 2 never completed.
    const progress = progressOf({
      currentStepIndex: 4,
      completedSteps: ['movement_welcome', 'movement_navigate_to_shrine', 'movement_navigate_to_exchange'], // order 2 (metal bank) deliberately missing
    });
    const { holes } = buildPlayerDiagnostics(quests, progress, []);
    expect(holes).toEqual(['quest_movement_basics · movement_navigate_to_metal_bank']);
  });

  it('current quest completed end-to-end → no current step, no stuck flag', () => {
    const progress = progressOf({
      currentQuestId: undefined,
      currentStepIndex: 0,
      completedSteps: ['movement_welcome'],
    });
    const { quests: rows, currentWiring } = buildPlayerDiagnostics(quests, progress, []);
    expect(rows.every(q => !q.isCurrent)).toBe(true);
    expect(currentWiring).toBeNull();
  });

  it('null progress yields all steps upcoming/locked with no tracking', () => {
    const { quests: rows, currentWiring, stuckUnwired } = buildPlayerDiagnostics(quests, null, []);
    expect(rows).toHaveLength(quests.length);
    expect(rows.every(q => !q.completed && !q.isCurrent)).toBe(true);
    expect(rows.every(q => q.steps.every(s => !s.completed && s.tracking === null))).toBe(true);
    expect(currentWiring).toBeNull();
    expect(stuckUnwired).toBe(false);
  });
});
