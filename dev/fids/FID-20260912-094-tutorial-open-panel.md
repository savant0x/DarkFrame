# FID-20260912-094 — OPEN_PANEL tutorial steps were unwirable (stuck "Join the Community")

**Date:** 2026-09-13 · **Type:** fix (tutorial) · **Follows:** FID-090b (beer-base hooks), FID-091 (diagnostic), FID-092 (highlight registry)

## Problem

The "Join the Community → Open Clan Panel" step froze after the player did
exactly what it asked. Root cause — the same dead-end class as FID-090b's
`find_beer_base`, but failing validation instead of never being written:

- `validateOpenPanelAction` requires `validationData.panelName === 'clans'`.
- The overlay's complete button sends `validationData: {}` — a literal `TODO`
  comment in the code.
- **Nothing anywhere reported that a panel had opened.** Unlike MOVE/HARVEST
  steps there was no server hook, and unlike CUSTOM steps there was no game-state
  enrichment. A match could never occur: every player who reached quest 4
  stalled forever, modal unclosable.

Live evidence: `fame` at `quest_social_intro` step index 1 with
`social_open_clan_panel` incomplete. The tech-tree twin (`tech_open_panel`,
panelName `'tech-tree'`) had the identical defect.

## Fix

- **`recordTutorialPanelOpen(playerId, panelName)`** in tutorialService — same
  pattern as the FID-090b combat hooks: reads the current step, no-ops unless
  it's an OPEN_PANEL step whose `validationData.panelName` matches the opened
  panel (case/separator-insensitive so `TECH_TREE` ≡ `tech-tree`), then calls
  the real `completeStep`. Non-throwing (Law 14).
- **`panel_open` action on `/api/tutorial/track-action`** — the client reports
  panel opens through the existing session-scoped endpoint (username from the
  JWT, never the body). tutorialService is server-only (drizzle/pg): importing
  it into the game page broke the production build with `pg → fs` in the client
  bundle, so the page fires a fetch to the endpoint instead.
- **Game page wiring** — the `onClansClick` / `onTechTreeClick` `setCurrentView`
  seam is the single place those panels genuinely open; each click now also
  reports `panel_open` (fire-and-forget, failure-logged, never blocking).

## Tests

`__tests__/lib/tutorialPanelOpen.test.ts` (5) — hook completes matching steps,
no-ops on mismatched panels / missing progress; both live OPEN_PANEL steps
declare `panelName` AND a FID-092 registry `targetElement`.

## Verification

- Gates: tsc 0 · eslint 0 · vitest **734** (5 new) · build clean (after moving
  the call server-bound — the direct import had broken `npm run build`).
- **Live end-to-end on fame's stuck account:** clicked Clans → server logged
  `🖥 Panel opened: clans — step social_open_clan_panel completed for fame`;
  DB row advanced; next reload shows quest 5 "Research & Development" with the
  tech-tree step (which the same fix now covers). The stuck quest is gone.

## Notes

- The tutorial diagnostic (FID-091) classified these steps via overlay
  completion — its wiring verdict stays accurate because the hook flows through
  the same `completeStep` seam.
- The overlay's `validationData: {}` TODO remains (now harmless — the hook
  supplies validation server-side) and could be cleaned up with the overlay's
  next touch.
