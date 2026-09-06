# FID-20260906-005: UI Modernization Audit ("bring it into 2026")

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-005-ui-modernization.md`
**ID:** FID-20260906-005
**Severity:** MEDIUM (product quality; large scope, no correctness exposure)
**Status:** created (evidence-gathering FID — explicitly NOT a reskin mandate)

---

## 1. Summary

Operator directive: the UI was built ~2 years ago and needs modernization. This FID keeps the
work honest: first a **structured audit** of what is actually bad (broken layouts, dead controls,
inconsistent states, accessibility, mobile), then a **modernization plan with priorities** —
approved before any visual rework. Aesthetics are the operator's call; this document supplies
the evidence and the menu.

## 2. Known evidence so far (RED — accumulating during this session's live work)

- **Viewport-hostile fixed overlays:** ChatPanel and FriendsPanel are `fixed` overlays pinned
  to `lg:left-[19rem] xl:left-[21rem]` (`components/GameLayout.tsx:190-208`) — on smaller
  windows they cover the map; mobile stacks them over controls.
- **Double-scroll + zoom-confusion on /map:** the map canvas lives inside a 4800×4800px div
  (`app/map/page.tsx:420-426`) with custom scroll-panning; screenshot review showed clipped
  axis labels and a scroll container fighting browser zoom.
- **NaN/0 statistics class (partially fixed this session):** StatsPanel showed `NaN%`
  when secondary stats were missing; root guards added, but the pattern (divide-by-absent)
  needs a repo-wide sweep in `StatsPanel`-like components.
- **Legend overflow:** map legend labels collide ("MetalEnergyCaveForest…" rendered as one
  run-on string in the live screenshot; `components/map/MapLegend.tsx`).
- **Alert fatigue:** the WMD/new-player "1 Issue" badges (Next.js dev overlay aside) have no
  unified toast/notification design system; several panels roll their own.
- **Design tokens absent:** colors are hardcoded per component (`#2196F3`, `#FFD700`, gray
  scale via arbitrary Tailwind classes) — no theme file, so dark-mode consistency relies on
  copy-paste. Verified across `components/map/*`, `StatsPanel`, `ChatPanel`.

## 3. Proposed audit method (loop step 1)

1. Drive every page in the preview at 1920×1080, 1366×768, and 390×844 (mobile), capturing
   screenshots; log layout breaks, dead controls, console errors per page.
2. Inventory: every page/component, its purpose, last-touched commit, broken states.
3. Classify: P0 usability blockers → P1 consistency/legibility → P2 visual modernization
   (tokens, typography, spacing scale, motion) → P3 accessibility (focus, contrast, aria).
4. Present the menu with effort estimates; operator picks scope.

## 4. GREEN Design (contingent — the menu the operator will see)

- **T1 Design tokens:** single `tailwind.config` theme extension (colors, radii, shadows,
  type scale) + swap hardcoded values progressively (no big-bang).
- **T2 Layout:** responsive overlay strategy for Chat/Friends (collapsible rails, mobile
  drawers); /map scroll-pan replaced with transform-based viewport (fixes zoom + labels).
- **T3 State polish:** skeleton loaders replacing "Loading player data…", empty-state designs,
  unified toast system.
- **T4 Accessibility pass:** focus rings, aria-labels on icon buttons, contrast fixes.
- **T5 Game HUD:** consolidate left/right rails' visual language (this is where "2026" shows).

## 5. Verification plan

1. Screenshot diff before/after per page at the three viewports.
2. Zero console errors on every audited page.
3. Interaction proofs: chat send/receive, movement, map pan/zoom, tutorial — all still pass
   their existing live checks after any layout change.
4. Gates: tsc 0, tests green, lint-delta 0.

## 6. Loop record

- **Pass 1:** evidence items are only those actually observed this session (no speculation);
  §3 defines how the rest of the RED evidence is gathered. No GREEN commitment until the
  audit menu is approved by the operator.

**Status:** created — audit phase begins when this FID enters the loop.
