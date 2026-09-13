# FID-20260912-092 — Tutorial highlight targets: verified selector registry + data-tutorial hooks

**Date:** 2026-09-13 · **Type:** fix (tutorial UX) · **Follows:** FID-091 (tutorial diagnostic)

## Problem

The audit prompt was right to be suspicious: **6 of the 7 `targetElement` selectors in the quest
definitions matched nothing in the DOM**. Joyride silently fell back to a centered spotlight on
`body`, so steps like "Harvest the Cave" or "Attack the Base" highlighted empty page center
while the text said "press F" / "click ATTACK".

Worse, two selectors were **structurally impossible**:
- `.cave-tile`, `.beer-base-tile` — these name *canvas-drawn tiles*. The game map is a
  `<canvas>`; tiles are pixels, not DOM nodes. No amount of CSS classifying could ever make
  them highlightable.

Full audit result (old → verdict):

| Selector | Verdict |
|---|---|
| `.movement-controls` | missing (real root is `MovementControls`' plain `<div>`) |
| `.cave-tile` | **impossible** — canvas tile |
| `.harvest-button` | missing (real button has `nn-btn--harvest` class, but the class list is style-owned, not a contract) |
| `.beer-base-tile` | **impossible** — canvas tile |
| `.attack-button` | missing (real CTAs are `ATTACK · METAL` / `ATTACK · ENERGY`) |
| `.clan-panel-button` | missing (real control is the `Clans` NavItem in TopNavBar, level ≥ 10 only) |
| `.tech-tree-button` | missing (same — `Tech Tree` NavItem) |

## The fix — a registry, not scattered literals

- **`lib/tutorialSelectors.ts`** — `TUTORIAL_TARGETS`: six selectors, each a `[data-tutorial=…]`
  hook on a real component, each carrying a description and (for state-dependent surfaces) a
  `conditional` caveat. `probeTarget()` checks the live DOM: missing unconditional hooks log a
  **loud warning** naming the registry; missing conditional hooks log an info (their absence is
  expected in some game states — e.g. HARVEST button only mounts on harvestable tiles).
  `resolveJoyrideTarget()` never lets a dead selector reach joyride — unmounted targets become
  `body` explicitly, with the warning trail already emitted.
- **Hooks added to real components:** `MovementControls` root, TileRenderer's HARVEST button
  and the enemy-base ATTACK CTA row, TopNavBar's Clans/Tech Tree NavItems (via a new
  `tutorialHook` prop), BeerBasePanel's root.
- **Quest definitions** now reference `TUTORIAL_TARGETS.*` constants — raw CSS literals are
  gone from `tutorialService`. The two impossible canvas-tile targets were replaced with the
  steps' *actual* DOM surfaces (HARVEST button; Beer Bases panel), with comments explaining why
  the originals could never work.
- **Overlay** resolves through the probe and logs a `logger.warn` when a step's target is
  missing — the silent no-op is now a visible, greppable event.

## Guard rails (the actual fix for the *class*)

`__tests__/lib/tutorialSelectors.test.ts` (9 tests) pins the chain:
1. Every `targetElement` in `TUTORIAL_QUESTS` is a registry selector — raw literals fail CI
   (this is exactly how the rot started).
2. Every quest-referenced hook exists in component source — renaming or deleting a
   `data-tutorial` attribute fails CI even if nothing else changes.
3. Conditional routing stays in lockstep: state-dependent targets must flow through the
   overlay's `stepConditional` switch, which compares registry constants (not literals).
4. Probe behavior: loud warn for missing unconditional targets, info-only for conditional
   ones, `body` passthrough, found-selector passthrough.

## Files

- `lib/tutorialSelectors.ts` — registry + probe (new)
- `lib/tutorialService.ts` — quest definitions use registry constants
- `components/tutorial/TutorialOverlay.tsx` — probe resolution + warn logging
- `components/MovementControls.tsx`, `components/TileRenderer.tsx`,
  `components/TopNavBar.tsx` (new `tutorialHook` prop), `components/BeerBasePanel.tsx` — hooks
- `__tests__/lib/tutorialSelectors.test.ts` — 9 contract tests (new)

## Verification

- Gates: tsc 0 · eslint 0 · vitest **705** (9 new) · build clean.
- Live in preview (game page, real session): `movement-controls`, `harvest-button`,
  `clans-nav-item`, `tech-tree-nav-item` all present (1 each); `attack-button` and
  `beer-base-panel` absent exactly as their conditionals dictate (standing on a CAVE tile with
  the panel closed). The "Open Clan Panel" joyride step now **anchors to the real Clans nav
  button** — tooltip arrow points at it, element spotlighted (screenshot) — previously this
  floated centered on the page. Zero probe warnings in console.

## Follow-ups

- The FID-091 diagnostic's wiring map could surface each step's highlight target + conditional
  caveat so ops can see "this spotlight only appears on harvestable tiles" without reading code.
- The beer-base find/attack steps highlight the panel; a map-level ping on the canvas (drawn
  marker at the base's tile) would give those steps a true map highlight — needs a small
  renderer hook, deferred as art/UX decision.
