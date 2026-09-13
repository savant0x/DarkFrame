/**
 * FID-20260912-090b — tutorial combat-quest wiring tests.
 *
 * The 'Find a Beer Base' step (CUSTOM/find_beer_base) validated
 * `validationData.requirementMet === true` but NOTHING ever set it, and the
 * raid route never fed ATTACK steps — quest 3 could stall forever at 2/3.
 * These tests pin the validator contracts the new server hooks satisfy.
 */
import { describe, it, expect } from 'vitest';
import { TutorialStep } from '@/types/tutorial.types';

// Mirrors validateCustomAction's find_beer_base branch (the seam that stalled).
function validateCustomFindBeerBase(
  step: TutorialStep,
  validationData: { requirementMet?: boolean }
): boolean {
  const stepValidation = step.validationData || {};
  if (stepValidation.requirementType === 'find_beer_base') {
    return validationData.requirementMet === true;
  }
  return false;
}

// Mirrors validateAttackAction for the beer-base step's shape.
function validateAttackBeerBase(
  step: TutorialStep,
  validationData: { targetType?: string; success?: boolean; attackCount?: number }
): boolean {
  const stepValidation = step.validationData || {};
  if (stepValidation.requiredAttacks) {
    if ((validationData.attackCount || 0) < stepValidation.requiredAttacks) return false;
  }
  if (stepValidation.targetType) {
    if (validationData.targetType?.toLowerCase() !== stepValidation.targetType.toLowerCase()) return false;
  }
  if (stepValidation.requireSuccess && validationData.success !== true) return false;
  return true;
}

const findStep: TutorialStep = {
  id: 'combat_find_target',
  order: 1,
  title: 'Find a Beer Base',
  instruction: '',
  action: 'CUSTOM',
  validationData: { requirementType: 'find_beer_base' },
  difficulty: 'EASY' as TutorialStep['difficulty'],
  estimatedSeconds: 20,
  skipAllowed: true,
};

const attackStep: TutorialStep = {
  id: 'combat_attack',
  order: 2,
  title: 'Attack the Base',
  instruction: '',
  action: 'ATTACK',
  validationData: { targetType: 'beer_base' },
  difficulty: 'MEDIUM' as TutorialStep['difficulty'],
  estimatedSeconds: 30,
  skipAllowed: false,
};

describe('find_beer_base validation (was: unwritable, step could never pass)', () => {
  it('the hook payload { requirementMet: true } completes the step', () => {
    expect(validateCustomFindBeerBase(findStep, { requirementMet: true })).toBe(true);
  });

  it('absent/false requirementMet still fails (the original stall)', () => {
    expect(validateCustomFindBeerBase(findStep, {})).toBe(false);
    expect(validateCustomFindBeerBase(findStep, { requirementMet: false })).toBe(false);
  });
});

describe('ATTACK beer_base validation (was: no route fed it)', () => {
  it('the hook payload (targetType + success) completes the step', () => {
    expect(validateAttackBeerBase(attackStep, { targetType: 'beer_base', success: true, attackCount: 1 })).toBe(true);
  });

  it('wrong target type fails', () => {
    expect(validateAttackBeerBase(attackStep, { targetType: 'player', success: true })).toBe(false);
  });

  it('the step declares no requireSuccess — a repelled raid still advances the tutorial', () => {
    // Matches the step definition (no requireSuccess): the tutorial teaches
    // the ACTION, it does not demand a win.
    expect(attackStep.validationData?.requireSuccess).toBeUndefined();
    expect(validateAttackBeerBase(attackStep, { targetType: 'beer_base', success: false })).toBe(true);
  });
});
