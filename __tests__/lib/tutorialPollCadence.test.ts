/**
 * @file __tests__/lib/tutorialPollCadence.test.ts
 * @overview FID-20260911-053 — cadence contract. Pins: action steps stay at
 * the live 3s cadence; READ_INFO derives from autoCompleteDelay (clamped);
 * passive READ_INFO settles at 15s; null/undefined stays responsive.
 */
import { describe, it, expect } from 'vitest';
import {
  getTutorialPollInterval,
  TUTORIAL_POLL_ACTION_MS,
  TUTORIAL_POLL_PASSIVE_MS,
  TUTORIAL_POLL_MIN_MS,
  TUTORIAL_POLL_MAX_MS,
} from '@/lib/tutorialPollCadence';
import type { TutorialStep } from '@/types/tutorial.types';

function step(overrides: Partial<TutorialStep>): TutorialStep {
  return {
    id: 's1',
    order: 0,
    title: 't',
    instruction: 'i',
    action: 'MOVE',
    difficulty: 'EASY',
    ...overrides,
  } as TutorialStep;
}

describe('getTutorialPollInterval', () => {
  it('keeps the live 3s cadence for gameplay-action steps', () => {
    for (const action of ['MOVE', 'MOVE_TO_COORDS', 'HARVEST', 'ATTACK', 'OPEN_PANEL', 'CUSTOM'] as const) {
      expect(getTutorialPollInterval(step({ action }))).toBe(TUTORIAL_POLL_ACTION_MS);
    }
  });

  it('derives READ_INFO cadence from autoCompleteDelay, clamped to the 5s floor', () => {
    // 4000 × 1.2 = 4800 → below the 5s floor, clamps up to 5000
    expect(getTutorialPollInterval(step({ action: 'READ_INFO', autoComplete: true, autoCompleteDelay: 4000 })))
      .toBe(TUTORIAL_POLL_MIN_MS);
    expect(getTutorialPollInterval(step({ action: 'READ_INFO', autoComplete: true, autoCompleteDelay: 7000 })))
      .toBe(8400);
  });

  it('clamps the derived cadence to 5–30s', () => {
    expect(getTutorialPollInterval(step({ action: 'READ_INFO', autoComplete: true, autoCompleteDelay: 1000 })))
      .toBe(TUTORIAL_POLL_MIN_MS);
    expect(getTutorialPollInterval(step({ action: 'READ_INFO', autoComplete: true, autoCompleteDelay: 60000 })))
      .toBe(TUTORIAL_POLL_MAX_MS);
  });

  it('uses the passive 15s cadence for READ_INFO without auto-complete', () => {
    expect(getTutorialPollInterval(step({ action: 'READ_INFO' }))).toBe(TUTORIAL_POLL_PASSIVE_MS);
    expect(getTutorialPollInterval(step({ action: 'READ_INFO', autoComplete: false }))).toBe(TUTORIAL_POLL_PASSIVE_MS);
  });

  it('stays responsive (3s) when there is no step — transitional windows', () => {
    expect(getTutorialPollInterval(null)).toBe(TUTORIAL_POLL_ACTION_MS);
    expect(getTutorialPollInterval(undefined)).toBe(TUTORIAL_POLL_ACTION_MS);
  });
});
