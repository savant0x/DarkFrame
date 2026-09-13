/**
 * @file lib/tutorialDiagnostic.ts
 * @created 2026-09-13
 * @overview FID-20260912-091 — the tutorial diagnostic engine (pure, no DB).
 *
 * FID-090b proved the failure class: a tutorial step whose validator reads a
 * field NOTHING ever wrote is unconditionally false forever, and the player
 * just stalls. The quest panel says "ETA 20s"; the truth is "no writer exists".
 *
 * This module answers, for every step: WHO can complete it, and what evidence
 * exists that the wiring actually works. Classification is derived from the
 * real completion paths audited in FID-091:
 *
 *   auto         — server auto-completes on a timer (READ_INFO + autoComplete)
 *   server_hook  — a gameplay route completes it (move/harvest/combat hooks,
 *                  CUSTOM enrichment in completeStep)
 *   manual_click — the player's own click on Next/claim completes it via
 *                  POST /api/tutorial complete_step (Overlay/QuestPanel);
 *                  valid because the validator's optional checks all pass on {}
 *   unwired      — no path exists; the step can never complete
 *
 * Consumers: /api/admin/tutorial-diagnostic (route) and the admin modal.
 * The contract test imports TUTORIAL_QUESTS and fails CI if any step's
 * classification drifts from the audited writers.
 */

import type {
  TutorialQuest,
  TutorialProgress,
  TutorialStep,
} from '@/types/tutorial.types';

/** How a step can be completed. */
export type StepWiringKind = 'auto' | 'server_hook' | 'manual_click' | 'unwired';

export interface StepWiring {
  kind: StepWiringKind;
  /** Human-readable evidence: the writer/validator this verdict rests on. */
  source: string;
}

/** Light shape of a tutorial_action_tracking row (JSON contract decoded). */
export interface TrackingRow {
  stepId: string;
  currentCount: number;
  targetCount: number;
  targetX?: number;
  targetY?: number;
  lastUpdated: Date | string;
}

/** Per-step diagnostic row for the admin UI. */
export interface DiagnosticStep {
  stepId: string;
  order: number;
  title: string;
  action: TutorialStep['action'];
  /** requirementType for CUSTOM steps (else null). */
  requirementType: string | null;
  /** Compact target summary (coords / panel / target type). */
  target: string;
  wiring: StepWiring;
  completed: boolean;
  isCurrent: boolean;
  skipAllowed: boolean;
  /** null when no tracking row exists for this step. */
  tracking: { currentCount: number; targetCount: number; targetX?: number; targetY?: number; lastUpdated: Date | string } | null;
}

export interface DiagnosticQuest {
  questId: string;
  title: string;
  order: number;
  completed: boolean;
  skipped: boolean;
  /** The quest the player's currentStepIndex points at. */
  isCurrent: boolean;
  steps: DiagnosticStep[];
}

/** Player-level view consumed by the modal. */
export interface DiagnosticPlayer {
  username: string;
  level: number;
  isBot: boolean;
  hasProgress: boolean;
  tutorialComplete: boolean;
  tutorialSkipped: boolean;
  tutorialDeclined: boolean;
  currentQuestId: string | null;
  currentStepIndex: number;
  currentStepTitle: string | null;
  totalStepsCompleted: number;
  startedAt: Date | string | null;
  lastUpdated: Date | string | null;
  /** Progress exists AND player is neither complete/skipped/declined. */
  isActive: boolean;
}

export interface PlayerDiagnosticReport {
  player: DiagnosticPlayer;
  quests: DiagnosticQuest[];
  /** Steps on the current quest before the current index that are NOT completed. */
  holes: string[];
  /** Current-step wiring verdict — surfaced prominently by the UI. */
  currentWiring: StepWiring | null;
  /** True when the current step's wiring cannot ever complete it. */
  stuckUnwired: boolean;
}

// ---------------------------------------------------------------------------
// Wiring classification
// ---------------------------------------------------------------------------

/** CUSTOM requirementTypes the enrichment switch in completeStep actually serves. */
const ENRICHED_CUSTOM_REQUIREMENTS = new Set([
  'metal_balance',
  'energy_balance',
  'factory_capture',
  'build_unit',
]);

/** CUSTOM requirementTypes completed by dedicated server hooks. */
const HOOKED_CUSTOM_REQUIREMENTS: Record<string, string> = {
  find_beer_base: 'combat/attack route calls recordTutorialBeerBaseFound (FID-090b)',
};

/**
 * Classify how a step can complete. Pure — every verdict cites its writer.
 */
export function describeStepWiring(step: TutorialStep): StepWiring {
  const vd = step.validationData;

  switch (step.action) {
    case 'READ_INFO':
      if (step.autoComplete) {
        return { kind: 'auto', source: `server GET /api/tutorial auto-completes after ${step.autoCompleteDelay ?? 5000}ms` };
      }
      return { kind: 'manual_click', source: 'overlay/panel Next button posts complete_step (READ_INFO validates true)' };

    case 'COLLECT_REWARD':
      return { kind: 'manual_click', source: 'overlay/panel claim button posts complete_step (COLLECT_REWARD validates true)' };

    case 'MOVE': {
      if (vd?.requiredMoves) {
        return { kind: 'server_hook', source: 'move route counts moves via tracking + auto-completes (FID-20260908-001 contract)' };
      }
      if (step.targetCoordinates || vd?.targetCoordinates) {
        return { kind: 'server_hook', source: 'move route resolves nearest tile + completes on arrival (FID-20260909-025 §4.3)' };
      }
      // Plain MOVE with no counter and no coords: only the manual Next can
      // finish it — validateMoveAction({}, {}) with no requirements returns true.
      return { kind: 'manual_click', source: 'overlay Next button posts complete_step (no counter/coords to satisfy)' };
    }

    case 'MOVE_TO_COORDS':
      if (vd) {
        return { kind: 'server_hook', source: 'move route MOVE_TO_COORDS handler: target persisted, arrival auto-completes' };
      }
      return { kind: 'unwired', source: 'MOVE_TO_COORDS without validationData — move route handler never engages' };

    case 'HARVEST':
      return { kind: 'server_hook', source: 'harvest route calls recordTutorialHarvest on cave/forest (FID-20260909-025)' };

    case 'ATTACK':
      if (vd?.targetType === 'beer_base') {
        return { kind: 'server_hook', source: 'combat/attack route calls recordTutorialBaseAttack (FID-090b)' };
      }
      if (vd?.requiredAttacks) {
        // Counting ATTACKs require the track-action endpoint, which has no
        // client callers (verified FID-091) — the count can never increment.
        return { kind: 'unwired', source: 'needs attackCount from /api/tutorial/track-action, which no client calls' };
      }
      return { kind: 'manual_click', source: 'overlay Next button posts complete_step (validator passes on empty payload)' };

    case 'OPEN_PANEL':
      return { kind: 'manual_click', source: 'overlay Next button posts complete_step (panelName check passes on empty payload)' };

    case 'CUSTOM': {
      const req = vd?.requirementType;
      if (req && ENRICHED_CUSTOM_REQUIREMENTS.has(req)) {
        return { kind: 'server_hook', source: `completeStep enriches game state for ${req} before validating` };
      }
      if (req && HOOKED_CUSTOM_REQUIREMENTS[req]) {
        return { kind: 'server_hook', source: HOOKED_CUSTOM_REQUIREMENTS[req] };
      }
      return { kind: 'unwired', source: `requirementType ${String(req)} has no enrichment case and no server hook` };
    }

    case 'RESEARCH':
    case 'CLICK_BUTTON':
      // No validator case (validateStepAction default → false) and no hook.
      return { kind: 'unwired', source: `validateStepAction has no case for ${step.action} — default false, no hook` };

    default:
      return { kind: 'unwired', source: `unknown action ${String(step.action)}` };
  }
}

// ---------------------------------------------------------------------------
// Per-player diagnostics
// ---------------------------------------------------------------------------

function stepTarget(step: TutorialStep): string {
  const vd = step.validationData;
  if (step.targetCoordinates) {
    const r = step.targetCoordinates.radius ?? 0;
    return `(${step.targetCoordinates.x}, ${step.targetCoordinates.y})${r ? ` ±${r}` : ''}`;
  }
  if (vd?.panelName) return vd.panelName;
  if (vd?.targetType) return vd.targetType;
  if (vd?.targetAmount) return `${vd.targetAmount.toLocaleString()}`;
  if (vd?.unitType) return `${vd.unitType} ×${vd.count ?? 1}`;
  if (vd?.tier) return vd.tier;
  return '—';
}

/** Status of one step relative to the player's progress. */
export type StepStatus = 'completed' | 'current' | 'upcoming' | 'locked';

export function stepStatus(step: DiagnosticStep, quest: DiagnosticQuest): StepStatus {
  if (step.completed) return 'completed';
  if (quest.isCurrent && step.isCurrent) return 'current';
  if (quest.isCurrent) return 'upcoming';
  return 'locked';
}

/**
 * Build the per-quest diagnostic rows for one player.
 *
 * @param quests quest definitions (pass TUTORIAL_QUESTS)
 * @param progress the player's TutorialProgress row (or null)
 * @param trackingRows the player's tutorial_action_tracking rows
 */
export function buildPlayerDiagnostics(
  quests: TutorialQuest[],
  progress: TutorialProgress | null,
  trackingRows: TrackingRow[]
): { quests: DiagnosticQuest[]; holes: string[]; currentWiring: StepWiring | null; stuckUnwired: boolean } {
  const trackingByStep = new Map(trackingRows.map(r => [r.stepId, r]));
  const completed = new Set(progress?.completedSteps ?? []);
  const ordered = [...quests].sort((a, b) => a.order - b.order);

  const result: DiagnosticQuest[] = [];
  const holes: string[] = [];
  let currentWiring: StepWiring | null = null;
  let stuckUnwired = false;

  for (const quest of ordered) {
    const isCurrentQuest = progress?.currentQuestId === quest._id;
    const steps: DiagnosticStep[] = [];

    for (const step of quest.steps) {
      const wiring = describeStepWiring(step);
      const isCompleted = completed.has(step.id);
      const row = trackingByStep.get(step.id);
      const isCurrent = isCurrentQuest && (progress?.currentStepIndex ?? 0) === step.order;

      steps.push({
        stepId: step.id,
        order: step.order,
        title: step.title,
        action: step.action,
        requirementType: step.action === 'CUSTOM' ? (step.validationData?.requirementType ?? null) : null,
        target: stepTarget(step),
        wiring,
        completed: isCompleted,
        isCurrent,
        skipAllowed: step.skipAllowed,
        tracking: row
          ? {
              currentCount: row.currentCount,
              targetCount: row.targetCount,
              targetX: row.targetX,
              targetY: row.targetY,
              lastUpdated: row.lastUpdated,
            }
          : null,
      });

      // A hole: this quest is the active one, the step sits before/at the
      // current index, and it is not completed — progress skipped over it
      // (skip button) or the index advanced without it. The current quest's
      // earlier steps must all be completed for the index to be honest.
      if (isCurrentQuest && !isCompleted && step.order < (progress?.currentStepIndex ?? 0)) {
        holes.push(`${quest._id} · ${step.id}`);
      }

      if (isCurrent) {
        currentWiring = wiring;
        if (wiring.kind === 'unwired') stuckUnwired = true;
      }
    }

    result.push({
      questId: quest._id!,
      title: quest.title,
      order: quest.order,
      completed: progress?.completedQuests.includes(quest._id!) ?? false,
      skipped: progress?.skippedQuests.includes(quest._id!) ?? false,
      isCurrent: isCurrentQuest,
      steps,
    });
  }

  return { quests: result, holes, currentWiring, stuckUnwired };
}
