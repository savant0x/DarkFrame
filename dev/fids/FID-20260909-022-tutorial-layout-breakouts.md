# FID-20260909-022: Tutorial layout breakouts — step-well row/col misuse + raw help template in joyride windows

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-022-tutorial-layout-breakouts.md`
**ID:** FID-20260909-022
**Severity:** MEDIUM (two layout breakouts on the tutorial surfaces; no logic/data impact — move tracking itself is correct)
**Status:** converged
**Created:** 2026-09-09

---

## 1. Summary

Operator-reported, both visual:

1. **Quest panel breakout** — in the docked Tutorial Quest panel, the
   "Progress 13/15 moves" row is not contained by the panel and breaks out of
   the div.
2. **Step-window breakout** — on step completion (Free Exploration,
   "Movement Basics"), the joyride window breaks the layout: a single
   unbroken wall of text (the full detailedHelp template with 🎯 WHY / 🕐
   WHEN TO USE / ⚡ HOW TO EXPLORE / 💡 PRO TIP mashed into one paragraph)
   plus the reward line.

## 2. Evidence (RED)

- `components/tutorial/TutorialQuestPanel.tsx`: the Current Step container was
  `className="nn-well mb-3 …"`. `.nn-well` (neon-noir.css:513) is the HUD's
  flex-**row** primitive: `display:flex; justify-content:space-between;
  margin: 0 12px 8px`. The step container stacks THREE children —
  (a) icon + step header/instruction, (b) the action-progress row
  (`Progress | 13/15 moves` + meter), (c) the STEP footer. As row siblings
  under `justify-content:space-between`, they rendered side-by-side and the
  row was crushed/pushed outside the panel's box (the 19rem dock + `p-3`
  leave no slack). The WHY/WHEN/HOW wells had already been hand-patched with
  inline `style={{ flexDirection:'column', margin:0, … }}` workarounds —
  evidence the primitive was misused rather than a one-off slip.
- `components/tutorial/TutorialOverlay.tsx`: `convertToJoyrideStep` rendered
  `💡 Tip: {step.detailedHelp}` raw. `detailedHelp` is authored as a
  newline-structured template; HTML collapses newlines, producing the
  reported wall of text. joyride 3.2.0's default tooltip `width: 380` plus
  no height containment let the long content overflow.

## 3. Root cause

Two independent layering bugs sharing one theme: **container primitives
stretched past their contract**. `.nn-well` is a one-row label/value device;
using it as a vertical stack panel breaks every child laid inside it. The
joyride window had neither width headroom nor height containment for the
content the tutorial puts in it.

## 4. Five Questions

1. **Root cause?** Row-primitive misuse in the quest panel; uncontained,
   unformatted template text in the joyride window.
2. **Reproduce?** Open any move-counting tutorial step (13/15 state) and any
   step with structured `detailedHelp` (Free Exploration).
3. **Smallest correct fix?** Quest panel: plain token container (div, column
   flow) instead of `.nn-well`; retire the three inline well workarounds.
   Joyride: shared help-section renderer + `width: 420` + CSS
   `max-height/overflow-y` on `.react-joyride__tooltip`.
4. **Verify?** tsc 0 · eslint 0 · vitest 362/0/1 · census 0 · hand review of
   both containers.
5. **Side effects?** Help parsing is now shared (`lib/tutorialHelpParser.ts`);
   the fallback path (`parseDetailedHelp` → null → plain text) is retained in
   the quest panel. No behavior/data changes.

## 5. Proposed Fix (GREEN)

1. `lib/tutorialHelpParser.ts` (new): extract the WHY/WHEN/HOW/TIP parser as
   the single source of truth (was inlined in TutorialQuestPanel).
2. `TutorialQuestPanel.tsx`: Current Step container → token div
   (`rounded-none border bg-void p-3`); help wells → token divs; parser
   imported from lib.
3. `TutorialOverlay.tsx`: `renderHelpSections()` renders parsed sections
   compactly; joyride `options.width: 420`.
4. `neon-noir.css`: `.react-joyride__tooltip { max-height: min(62vh, 520px);
   overflow-y: auto; overscroll-behavior: contain; }` (joyride 3.x renders
   the arrow as a SIBLING of the tooltip, so the box's height containment
   cannot clip it) + defensive `max-height/overflow-y` on
   `.nn-tutorial-dock .nn-panel--tut`.

## 6. Audit Record

- **Scope guard:** move tracking (FID-001 family) untouched — this is layout
  only; the 13/15 counter is correct and was merely being displayed outside
  its box.
- **Dead-workaround retirement:** the three inline
  `flexDirection:'column'` patches on `.nn-well` instances are gone; no
  remaining `nn-well` misuse in the tutorial family.
- **Library verification:** `overlayPadding` does not exist in joyride
  3.2.0's options (checked `index.d.mts`) — rejected in favor of documented
  `width` + CSS containment.

## 7. Implementation Record

- RED read of both components + `.nn-well`/`.nn-tutorial-dock`/`.nn-panel--tut`
  CSS; joyride 3.2.0 dist inspected for tooltip/arrow DOM order and default
  width (380).
- One transient self-error during the overlay edit (placeholder expression
  included) — caught and removed in the next edit before gating.
- Gates: `tsc --noEmit` 0 · `eslint components/tutorial lib/tutorialHelpParser.ts`
  0 · full `eslint .` 0 errors (3 pre-existing warnings, out of scope) ·
  vitest 362/0/1.

## 8. Closure

- **Gates:** [x] tsc 0 · [x] eslint 0 · [x] vitest 362/0/1 · [x] 0 suppressions
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/tutorialHelpParser.ts components/tutorial/TutorialQuestPanel.tsx components/tutorial/TutorialOverlay.tsx app/neon-noir.css dev/fids/FID-20260909-022-tutorial-layout-breakouts.md`
- **Follow-through:** none — both breakouts closed at the container layer.
