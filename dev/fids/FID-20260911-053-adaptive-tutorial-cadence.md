# FID-20260911-053 — Adaptive Tutorial Poll Cadence

**Date:** 2026-09-11 · **Follows:** FID-20260911-051 (terminal gate) · **Trigger:**
the last active egress loop — the 3s tutorial poll runs while a player
*reads*, not just while a step can complete.

## Design

The poll's job differs by step type, so its cadence now does too
(`lib/tutorialPollCadence.ts`, pure + unit-tested):

| Situation | Cadence | Rationale |
|---|---|---|
| Action steps (MOVE, MOVE_TO_COORDS, HARVEST, ATTACK, OPEN_PANEL, CUSTOM) | **3s** (unchanged) | ambient gameplay (move/harvest/combat routes) can complete the step server-side at any moment; the poll is the completion *display* |
| READ_INFO with `autoComplete` | **autoCompleteDelay × 1.2, clamped 5–30s** | the server auto-completes after 4–7s; the earliest useful check lands just after that clock — earlier polls are pure waste |
| READ_INFO without `autoComplete` | **15s** | nothing server-side changes while the player reads; completion arrives from an explicit client action |
| no step (transitional) | **3s** | stay responsive |

Error backoff (×2 up to 5s) and the terminal stop (`pollTerminal` +
FID-051's server gate) are unchanged — this only reshapes the *active*
tutorial's steady-state loop.

## Implementation notes

- `stepRef` carries the current step into the tick loop, so cadence changes
  on step transitions never resubscribe the polling effect (in-flight timing
  preserved). The ref is cleared in the terminal branch alongside the other
  step state.
- During the tutorial's READ_INFO windows the loop drops from 20 req/min to
  ~5–8 req/min; action windows are untouched. Over a full tutorial that is
  roughly a 40–50% reduction in tutorial-family traffic (5 of 22 steps are
  READ_INFO with 4–7s auto-complete delays, and reading time dominates).

## Gates

tsc 0 · eslint 0 · vitest **509 passed / 1 skipped** (5 new cadence tests,
including the 4s→5s floor clamp) · build exit 0. Landed via PR through the
FID-052 branch-protection gate (scan green before merge).
