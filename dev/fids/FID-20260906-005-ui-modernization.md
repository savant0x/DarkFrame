# FID-20260906-005: UI Modernization Audit ("bring it into 2026")

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-005-ui-modernization.md`
**ID:** FID-20260906-005
**Severity:** MEDIUM (product quality; three live correctness bugs found and fixed during the audit)
**Status:** CONVERGED (loop pass 3) — **audit complete; modernization menu below awaits operator approval. NO visual rework has been done.**

---

## 1. Summary

Operator directive: the UI was built ~2 years ago and needs modernization. This FID keeps the
work honest: a **structured audit** of what is actually bad (layout, dead controls, broken
states, consistency, accessibility, performance), then a **prioritized modernization menu** for
the operator to approve. During the audit, three live correctness bugs were found and fixed
immediately (they are not "visual" work): the /map crash, a 21-route error-text leak, and the
leaderboard double-rank render.

## 1a. Design-doc grounding

Two design sources exist and disagree with each other and with the shipped UI:

1. `dev/archive/DESIGN-SYSTEM-GUIDE.md` (1501 lines): full token spec (grayscale, brand,
   semantic, rarity colors; type scale; spacing; shadows; radii; transitions) + a 10-component
   library spec (Button, Card, Badge, Panel, StatCard, ProgressBar, Modal, Tabs, Select).
2. `tailwind.config.ts`: a **complete, unshipped sci-fi glassmorphism theme** — `neon-*`
   accents, `bg-space/void/nebula`, `glass-*` panels, `glow-*` shadows, 7 keyframe animations,
   Orbitron display font. **Only 3 files use any of it; 110 files use default Tailwind grays.**
3. `app/globals.css`: 53 `:root` CSS custom properties duplicating the tailwind theme values.

The `components/ui/` kit (17 components, imported by 17–31 consumers each) was built for a
`primary-*` palette **that is not defined in tailwind.config.ts** — see R1.

## 2. Findings (RED — verified)

### R1 — The UI kit's primary palette is undefined; primary buttons render invisible (P0, live-verified)
`components/ui/Button.tsx` (and Badge, IconButton, Input, ProgressBar, StatCard, LoadingSpinner)
style primaries with `bg-primary-600`, `border-primary-500`, etc. No `primary` color scale
exists in `tailwind.config.ts` (only `text-primary`, a different token). Verified live: an
element with `bg-primary-600` computes `backgroundColor: rgba(0, 0, 0, 0)`, and the compiled
CSS contains no `.bg-primary-600` rule. **Every primary Button in the kit is a ghost button.**
7 files affected.

### R2 — Two competing dark themes ship simultaneously (P1)
The game page and its panels use arbitrary copy-pasted glassmorphism (`bg-gray-800/40
backdrop-blur-sm border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.2)]` in
GameLayout) — hand-inlined duplicates of the unshipped theme tokens — while secondary pages
(/leaderboard, /messages, /stats) use flat gray-800 cards with zero glass/neon. The result is
two visual languages navigating between each other.

### R3 — 93 `alert()` + 34 `confirm()` blocking dialogs (P1)
Admin flows and several panels use native blocking dialogs (`AdminView.tsx:495,501,505,…`),
including an `alert('Stripe integration coming soon!…')`. No toast system exists — four
one-off notification components (Achievement/CaveItem/Discovery/WMD) roll their own.

### R4 — Game HUD overlay collision (P1, screenshot-verified)
ChatPanel (fixed, `lg:left-[19rem]`) and the Tutorial Quest panel overlap and cover the
Factory Status card at 1331×1248 (screenshots saved this session). The tutorial is permanently
on screen while the chat overlaps the map's lower-left.

### R5 — /map legend collision (P2, screenshot-verified)
`MapLegend` renders "MetalEnergyCaveForestFactoryWastelandYou" as a run-on single line under
swatches (visible in the /map screenshot).

### R6 — Loading states are text-only; skeletons exist but are unused on the heavy pages (P2)
`components/ui/Skeleton.tsx` ships (17 consumers) while the game page still shows
"Loading player data…" text; admin panel shows "Loading admin data...".

### R7 — Accessibility gaps (P2)
- No `prefers-reduced-motion` handling anywhere despite 7 infinite/entry animations + framer-motion in 12 files.
- No global `focus-visible` styling in globals.css (keyboard nav is invisible on dark bg).
- Icon-only buttons individually pass (0 missing aria-labels found), but contrast of
  `text-gray-500`-class hints on gray-800 is at/below 4.5:1 in several panels.

### R8 — Performance: render-blocking font + heavy pages (P2)
- Orbitron loads via CSS `@import` from Google Fonts CDN (render-blocking, FOUT, no
  `next/font` self-hosting); Inter uses `next/font` correctly.
- `framer-motion` imported in 12 files including the 2191-line ChatPanel; game page has 23
  component imports in one client bundle.
- Raw `<img>` count is 0 (next/image already used) — good; tile/factory images optimized
  earlier (81% reduction, `2c22f1f`).

### R9 — Error text leaked to clients (P0, FIXED during audit — commit `c927eff`)
21 DB-backed API routes returned `error: error.message`; drizzle embeds the full SQL + pg
cause in that message. Observed live: /messages sidebar rendered `Failed query: select "id",
"participants", … from "conversations"`. All 21 routes now return a generic retry message;
the underlying /messages load failure was Supavisor pool exhaustion (EMAXCONNSESSION), the
same transient documented in FID-003 R6.

### R10 — /map world view crashed entirely (P0, FIXED during audit — commit `22d6466`)
`app/map/page.tsx` still read the pre-FID-20260905-001 envelope (`data.data` instead of
`data.data.bearer`), producing a truthy flagMarker with `position: undefined`;
`CanvasMapRenderer:135` dereferenced `.x` → the whole page showed the error boundary.
Fixed + regression-guarded (`flagMarker?.position`), live-verified by screenshot.

### R11 — Leaderboard rank rendered twice for ranks 4+ (P1, FIXED during audit — commit `4ea109c`)
`getRankDisplay` already returns `#N` past the medals; the cell appended `#N` again → "#4 #4".

### R12 — Dead/placeholder UI fragments (P3)
`app/game/page.tsx:1117-1121` Bank panel placeholder ("Coming soon!"); `app/admin/vip/page.tsx`
Stripe section is an alert stub; admin bot-panel "Historical Trends — Coming soon".
Also: admin VIP page has `TODO: Save to API` on two settings handlers (silent no-op saves).

## 3. Five Questions

1. **Do nothing?** Two visual languages, invisible primary buttons (R1), overlay collisions,
   blocking alerts, and 2021-era loading states erode trust in a live product.
2. **Why now?** Operator directive; the game is live and the token debt compounds with every new panel.
3. **Who is affected?** All players (consistency, overlays, loading); admins (alerts); keyboard/AT users (R7).
4. **Smallest correct change?** The menu below is opt-in per tier; T0 (already done) fixed the
   correctness bugs; T1 defines the missing palette and unblocks the existing kit without
   touching page layouts.
5. **What must NOT change?** Any game logic, hotkey bindings, panel data contracts, or the
   FID-approved flag/WMD behaviors; the audit fixes are behavior-preserving.

## 4. GREEN Design — the modernization menu (operator picks scope)

### T0 — Correctness fixes found by the audit — ✅ DONE (this session, pushed)
- `22d6466` /map crash regression fix + canvas guard.
- `c927eff` 21-route error-text leak closed.
- `4ea109c` leaderboard double-rank.
- (Earlier this session: factory image format/optimization `2c22f1f`.)

### T1 — Token foundation + kit repair (small, high leverage; ~half day)
1. Define `primary` as an alias of the neon-blue scale (or operator's pick) in
   `tailwind.config.ts` → the 17-component kit instantly renders correctly (R1).
2. Map the 53 `:root` vars in globals.css onto the tailwind theme (single source, no duplication).
3. Delete dead theme tokens or adopt them — decision recorded in the FID.

### T2 — Component modernization (medium; 1–2 days)
1. Replace the 93 `alert()`/34 `confirm()` with a small toast + confirm-dialog pair built on
   the existing ui/Panel (R3), migrated per-panel starting with admin.
2. Skeletons on the three slow pages (game, admin, messages) using ui/Skeleton (R6).
3. Unified empty states (leaderboard already has one; messages/clans get the same pattern).

### T3 — Layout/overlay repair (medium; 1–2 days)
1. Game HUD: chat + tutorial become collapsible rails/drawers on <lg, no card overlap (R4).
2. /map legend layout fix (R5) + axis-label clipping.
3. Secondary pages get the game's glass language via shared Panel props (kills the
   two-theme split, R2) — done page-by-page behind no visual risk (pure class swaps).

### T4 — A11y + motion pass (small; ~half day)
1. `prefers-reduced-motion` global rule; 2. `focus-visible` ring tokens; 3. contrast fixes
   for hint text; 4. framer-motion `LazyMotion` cut (bundle) (R7, R8).

### T5 — Deep visual refresh "2026" (large; operator-directed art direction)
Only after T1–T3: Orbitron via `next/font`, glass unification, motion language, HUD redesign.
**Requires operator art-direction input — not self-approved.**

## 5. Verification plan

- T0: done — probes + screenshots + 341 tests green.
- T1: compiled CSS contains `.bg-primary-600`; probe a kit Button's computed background ≠ transparent.
- T2: zero `alert(` remaining in migrated panels; screenshot each.
- T3: /game at 1331×1248 and 390×844 — no overlap (screenshot diff); /map legend wraps.
- T4: `prefers-reduced-motion` honored (evaluate `matchMedia` path); tab focus visible.
- All: tsc 0, tests green, lint clean; every page drive shows zero new console errors.

## 6. Loop record

- **Pass 1:** FID created with session-observed evidence only; §3 method defined.
- **Pass 2 (audit execution):** live drives of /game, /leaderboard, /map, /messages (+admin in
  FID-003) with screenshots; static sweeps (hex counts, alert counts, palette usage census,
  a11y greps, font/bundle checks). Found R1 (live-verified invisible buttons), R10 (/map crash
  — fixed immediately as FID-001 debt), R9 (error leak — fixed), R11 (double rank — fixed),
  R2 theme split quantified (3 vs 110 files), R3/R6/R7/R8/R12 censused. RED corrected the
  original sketch: no "NaN stats" sweep needed (already fixed in an earlier session; guards
  verified present), icon-only buttons are actually fine.
- **Pass 3 (GREEN self-audit):** the menu tiers are ordered by leverage/risk; T1 is the
  smallest change that repairs the existing kit (one palette definition, no layout churn);
  T5 explicitly gated on operator art direction per protocol. No open findings.
  **CONVERGED — presented for approval; no visual rework performed.**

**Status:** CONVERGED — awaiting operator scope decision (T1 alone? T1–T4? include T5 direction?).
