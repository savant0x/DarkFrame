/**
 * @file lib/tutorialPollCadence.ts
 * @created 2026-09-11
 * @overview FID-20260911-053 — adaptive cadence for the tutorial status poll.
 *
 * The poll's job differs by step type:
 *  - Action steps (MOVE, HARVEST, ATTACK, …) can be completed server-side by
 *    ambient player actions (the move/harvest/combat routes call
 *    completeStep themselves). The poll is the completion *display*, so it
 *    stays at 3s to feel live.
 *  - READ_INFO steps auto-complete SERVER-side after autoCompleteDelay
 *    (4–7s). Polling every 3s during a reading window is pure waste — the
 *    earliest useful check is just after the auto-complete fires, so the
 *    cadence becomes autoCompleteDelay × 1.2 (clamped 5–30s): roughly one
 *    poll lands right when the next step is ready, then the cadence
 *    recomputes for the new step.
 *  - READ_INFO without autoComplete completes from an explicit client
 *    action; nothing on the server changes while the player reads — 15s.
 *
 * Pure function, no DOM/network — trivially testable and safe on any runtime.
 */

import type { TutorialStep } from '@/types/tutorial.types';

/** Cadence while a step's completion may arrive from ambient gameplay. */
export const TUTORIAL_POLL_ACTION_MS = 3000;

/** Cadence for read-only steps with no server-side completion clock. */
export const TUTORIAL_POLL_PASSIVE_MS = 15000;

/** Clamp bounds for the auto-complete-derived cadence. */
export const TUTORIAL_POLL_MIN_MS = 5000;
export const TUTORIAL_POLL_MAX_MS = 30000;

/** How soon after the server's auto-complete delay the first check lands. */
const AUTO_COMPLETE_FACTOR = 1.2;

export function getTutorialPollInterval(step: TutorialStep | null | undefined): number {
  if (!step) return TUTORIAL_POLL_ACTION_MS; // transitional window — stay responsive

  if (step.action === 'READ_INFO') {
    if (step.autoComplete) {
      const derived = Math.round((step.autoCompleteDelay ?? 5000) * AUTO_COMPLETE_FACTOR);
      return Math.min(Math.max(derived, TUTORIAL_POLL_MIN_MS), TUTORIAL_POLL_MAX_MS);
    }
    return TUTORIAL_POLL_PASSIVE_MS;
  }

  return TUTORIAL_POLL_ACTION_MS;
}
