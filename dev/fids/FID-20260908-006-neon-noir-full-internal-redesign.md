# FID-20260908-006: Full NEON NOIR redesign of all internal pages (FID-012 scope amendment — operator directive)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-006-neon-noir-full-internal-redesign.md`
**ID:** FID-20260908-006
**Severity:** HIGH (operator-directed program; product-defining visual quality bar)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

Operator directive (2026-09-08): "All of the internal pages need a full neon noir pass including stats, tech tree, wmd, clans, etc. All of them were not re-designed, they simply updated the colors but didn't fully redesign all the internal pages." This FID amends FID-20260906-012 (NEON NOIR, converged, Phases 0–1 shipped) with that ruling: **token adoption ≠ redesign**. It defines "fully redesigned" as a mechanical audit rubric, enumerates every internal surface against it, and sequences the remaining FID-012 phases (2–6) page-by-page so each surface ships complete — layout structure, HUD components, function-driven glow, motion — not just recolored.

## 2. Evidence (RED)

| # | Finding | Evidence |
| - | ------- | -------- |
| 1 | Token adoption is broad but shallow: 150 files reference `nn-*` utilities, but adoption is class-sprinkling on unchanged layouts (color swap), not the §5 structural design | grep census: 150 files with `nn-`; e.g. `app/clans/page.tsx`, `app/clan/page.tsx` use tokens inside the old card grids |
| 2 | Game shell core IS structurally reskinned (Phase 1/2 partial): StatsPanel (119 nn- uses incl. HUD components), TileRenderer (153), GameLayout (15) | grep counts, this audit |
| 3 | Deepest adoption is incidentally in legacy-monolith files (AdminView 765, ClanInspectorModal 190) — recolors, not redesigns | grep counts |
| 4 | Zero structural HeroUI adoption so far (Phase 3 not started) | `git grep -l "@heroui" -- app components` → 0 files |
| 5 | FID-012's own phase table already planned exactly this (Phases 2–4: shell, HeroUI flows, 29 secondary routes) — it is CONVERGED with direction "approved by operator"; this FID records the sharper operator ruling and freezes the audit bar | FID-012 §7 phase table + Pass-3 status |
| 6 | Functional defects in these surfaces are FID'd separately and sequence FIRST (power display, factory count, unit factory wiring — FID-003/004; tutorial; websocket) | FID-20260908-001..005 |

## 3. The Audit Rubric — what "fully redesigned" means (mechanical, per surface)

A surface passes ONLY when ALL of the following hold (derived from FID-012 §3 art direction):

1. **Structure:** layout rebuilt to the HUD pattern — glass panels with corner-bracket framing (`nn-panel` family), scanline headers on module titles, `nn-num` Orbitron tabular readouts for ALL data — not token-sprinkled legacy grids.
2. **Function-driven glow:** every glow answers "what does this tell me?" (semantic state: danger/amber resources/violet RP/cyan interactive); zero decorative glows.
3. **Depth ladder:** void → panel(1) → raised(2) → overlay(3); no competing legacy gray/glass surfaces in the file.
4. **Motion:** 120/220/400ms machine-precise transitions, gated by `prefers-reduced-motion`; no framer-motion in the file (Phase 5 removal).
5. **Contrast:** text pairs ≥ WCAG AA on panel surfaces (Phase 6 automated check).
6. **No regression:** file eslint 0, tsc 0, tests green, interactive behavior preserved (drive-through).

## 4. Surface Census & Sequence (29 routes + shell components)

Wave A — command surfaces (operator-named): `app/stats` (+StatsViewWrapper), `app/tech-tree`, `app/wmd` (+5 WMD panels), clans (`app/clans`, `app/clan`, ClanPanel, ClanManagementView, JoinClanModal), `app/game/unit-factory` + FactoryManagementPanel (includes the redesign the operator requested alongside FID-003/004 wiring fixes).
Wave B — economy/social: leaderboard, profile, inventory, shop (create page — nav currently 404s, FID-012 finding), messages, battle-logs, referral dashboard, shrine, beer-base, auction surfaces.
Wave C — admin un-islanding (AdminView + modals) — last, highest blast radius, data-density preserved.
Cross-cutting: Phase 3 HeroUI adoption lands inside waves (Modal/Tabs/Tooltip/Table/Progress/Toast slots reskinned via `heroui-noir.css`), Phase 5 motion polish + framer-motion removal rides Wave B/C, Phase 6 audit (contrast, bundle, reduced-motion, tile-uniformity assertion) closes the program.

## 5. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — every route enumerated; rubric applies uniformly; no page exempt |
| Scales? | Yes — wave structure + per-page gates make 29 routes tractable; future pages inherit the rubric |
| Hostile attacker? | Yes — no new data surfaces; sanitize contracts untouched; visual-only |
| Maintainable? | Yes — one token system, one component kit, documented rubric in this FID |
| Industry standard? | Yes — this IS the FID-012 art direction, now enforced mechanically |

## 6. GREEN — Approach

1. **Order:** defect FIDs 001–005 first (they touch Wave-A surfaces; redesign then builds on correct wiring).
2. **Per-surface loop:** audit against §3 rubric → redesign → per-file eslint 0 + tsc 0 → drive-through + screenshot → next surface. Batch commits are path-scoped per surface (G3/G4).
3. **No parallel token forks:** all work consumes `app/neon-noir.css` exclusively; rubric violations found in shared components get fixed once at the component.
4. **Verification plan:** per surface — the six rubric checks with pasted evidence; program-level — Phase 6 suite (contrast audit, tile-uniformity probe, reduced-motion, bundle budget) per FID-012 §8.
5. **Call-graph reachability:** unchanged routes; each wave's drive-through proves live rendering (Law 4 for UI = visible surface + no dead imports).

## 7. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: census tooling | nn- adoption grep, page count, HeroUI absence | §2 table | pass |
| Method 2: manual re-read | rubric traceability to FID-012 §3; wave ordering vs defect-FID touch surfaces | this document | pass |

- Audit outcome: PASS → `converged`. This FID is a program umbrella; individual surfaces' implementation records append here as §9 entries (per-page).

## 8. Implementation Record

- **Status:** in-progress (Wave A executing)
- **2026-09-08:** defect FIDs 001–005 landed (precondition met). Wave A started: token primitives added to
  `app/neon-noir.css` (`.nn-unit` family, `.nn-ptab`, `.nn-stepper`, `.nn-overlay`, `.nn-range`, `nn-spin` keyframes
  + reduced-motion closure); unit-factory page, BackButton, FactoryManagementPanel, and stats page fully
  redesigned per §3 rubric — records in §9.1–9.4.

## 9. Per-Surface Records

### §9.1 — Wave A · unit-factory (`app/game/unit-factory/page.tsx`) — DONE 2026-09-08

**Before (audit):** token-sprinkled legacy layout — `bg-gradient-to-b from-gray-900 to-black` void, emoji rarity stars, filled-slab tab buttons, raw `<h1>` header, `bg-opacity-75` modal, amber stat on every unit regardless of STR/DEF, `transition-colors`/`transition-all` tailwind timings. Zero `nn-panel`/`nn-num` structure.

**Redesign:**
- **Structure:** `.nn-sec` instrument header (Orbitron title + `▸` note + back link); resources as four `.nn-stat` blocks with per-block `--nn-accent`; production tabs as text-rule `.nn-ptab` (STR=magenta, DEF=cyan, underline active state — never filled slabs); unit grid rebuilt on new `.nn-unit` HUD card (corner brackets, rarity→accent parametrization, `★`/`·` rarity dots, `nn-num` tabular stat + costs, `nn-lab` micro-labels); confirmation modal as `.nn-overlay` > `.nn-panel` with scanline header, `.nn-stepper` quantity + Max, `.nn-well` cost/output rows, `.nn-btn` outline actions.
- **Function-driven glow:** amber=metal, cyan=energy/DEF, magenta=STR, green=slots/owned, rarity sets card accent (common→text-secondary, uncommon→green, rare→cyan, epic→violet, legendary→amber); zero decorative glows.
- **Depth ladder:** void page → panel cards → raised unit hover → overlay modal (`.nn-overlay` blur). No legacy gray/glass surface remains (grep: 0).
- **Motion:** all transitions via `--nn-dur-state`/`--nn-dur-panel` + `--nn-ease`; hover lift 1px; reduced-motion gate extended to the new primitives; loader spin replaced `animate-spin` with gated `nn-spin` keyframes.
- **Behavior preserved:** fetch/build/refresh flow, three-factor Max math, error messaging, lock states, owned counts — untouched logic, visual layer only.

**Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps (framer-motion 0, legacy utility classes 0).

### §9.2 — Wave A · BackButton (`components/BackButton.tsx`) — DONE 2026-09-08

**Before:** `bg-glass-light` slate hex glass (pre-noir skin), tailwind `duration-200`.
**Redesign:** `.nn-btn .nn-btn--ghost` outline instrument, token timing; shared by all secondary pages, so this is a Wave-B multiplier.
**Gates:** tsc 0 · eslint 0.

### §9.3 — Wave A · FactoryManagementPanel (`components/FactoryManagementPanel.tsx`) — DONE 2026-09-08

**Before (audit):** the game-shell modal still spoke the pre-noir design system wholesale — `bg-bg-primary`/`bg-bg-secondary`/`border-border-*`/`text-text-*` utilities, `StatCard`/`Button`/`Badge`/`Card`/`Divider` UI-kit components (framer-motion `motion` imports, `bg-primary-*` palette, opacity-modifier classes forbidden on var() colors), `StaggerChildren` framer animation, emoji `⭐ MAX LEVEL ⭐` badge slab, RangeInput unstyled.

**Redesign:**
- **Structure:** `.nn-overlay` > full `.nn-panel` command surface: scanline `.nn-panel__header` with icon + title; three `.nn-stat` blocks (owned/limit, invested metal, invested energy) replacing StatCards; `.nn-row` resource ledger; batch controls in `.nn-brief` with `.nn-range` HUD slider + `.nn-chip--amber` threshold readout; factory cards as `.nn-panel`s with scanline headers (location as `nn-panel__meta`), `.nn-row` ledgers for slots/available/regen/next-slot, `.nn-brief--cyan` upgrade cost block, `.nn-note--caution` MAX LEVEL advisory (no emoji), `.nn-btn` outline actions with semantic accents (jump=cyan, upgrade=green when affordable, abandon=magenta).
- **Function-driven glow:** magenta only on destructive paths (batch release, abandon confirm); amber on invested metal/threshold; green on availability/upgrade-affordable; cyan interactive default.
- **Depth ladder:** overlay(3) > panel(1) cards; abandon confirm is a second overlay at depth 3 with magenta accent.
- **Motion:** `StaggerChildren`/`StaggerItem` framer wrappers **removed** (Phase 5 direction lands early here) — static grid; all hover/transition motion via token durations, gated by reduced-motion.
- **Behavior preserved:** fetch/sort/upgrade/abandon/batch-release logic, confirmDialog, toasts, `useCountUp` totals now rendered directly (hook removed with its only consumers).

**Gates:** tsc 0 · file eslint 0 (framer-motion imports gone) · rubric greps 0 legacy classes.

**§9.3a Operator corrections (2026-09-08, same session):**
- **Close button moved to the right corner** of the header (magenta × instrument with `nn-panel__meta` owned-count beside it).
- **"Progress to next level" row relabeled to "Lifetime investment …% TO MAX"** — operator ruling: factories upgrade on demand, never over time, so "progress to next level" was false framing. (The API's `upgradeProgress.percentage` was already *cumulative investment toward max level* per `getUpgradeProgress` — the UI label was the lie, not the math.)
- **Jump button REMOVED entirely** — operator ruling: on-page teleport-to-factory is a game violation. `onNavigate` prop deleted from the component interface and the `app/game/page.tsx` call site (which was itself only a placeholder that never moved the player); `MapPin` import dropped. Upgrade/Abandon remain the only factory actions.

**Gates after corrections:** tsc 0 · file eslint 0 · full vitest 362/0/1.

**§9.1a/§9.4a Operator layout corrections (2026-09-08, from live screenshot):**
- **Left-hugging center column:** the header strip's inner content was capped `max-w-7xl` while the stats grid
  and unit grid ran the full center-column width — ragged, left-biased presentation on wide monitors. Fix:
  the tile-view root is now `flex flex-col`, and header content + body share ONE `max-w-7xl mx-auto`
  container (`flex-none`), so every block sits on the same centered axis with the header aligned to the grid.
- **Header overlapping the page:** the page header strip scrolled under the fixed translucent TopNav and
  content collided with it. Fix: header strip is `sticky top-0 z-20` INSIDE the scroll container with
  token backdrop-blur — it pins below the TopNav and page content scrolls beneath it cleanly. Applied to
  both unit-factory (§9.1) and stats (§9.4).
- **Missing sidebar modules on secondary pages:** chat overlay (bottom-left), battle-log links (left rail
  bottom), DM-unread badge wiring, and TopNav metal/energy readouts were only passed to `GameLayout` by
  `/game`. `app/game/unit-factory/page.tsx` and `app/stats/page.tsx` now pass `chatUser`, `battleLogs`,
  `initialChatTab/onChatTabChange/onDMUnreadCountChange`, and the TopNav props — the secondary pages carry
  the same right/left-rail furniture as the game view.

**Gates after layout corrections:** tsc 0 · file eslint 0 · full vitest 362/0/1.

### §9.5 — login (`app/login/page.tsx`) — DONE 2026-09-08

**Before (audit):** gradient-slate void (`from-gray-900 via-black to-gray-800`), raw inputs with tailwind
`focus:ring-*` styling (opaque white in the operator's screenshot — browser defaults winning over the
utility classes), a bare checkbox the operator read as a "radio", a filled cyan→violet gradient slab button
(banned by the art direction), `animate-spin` svg, `shadow-2xl`.

**Redesign:** `.nn-panel--x-pad` with scanline `Authentication` header; `nn-input` fields (token hairline,
cyuan focus glow) with lucide Mail/Lock icons inset; the remember checkbox replaced by the token
**`.nn-switch`** square HUD toggle (`role="switch"`, aria-checked) labeled "Stay logged in for 30 days";
error as `nn-note` advisory strip; submit as `nn-btn--primary` outline instrument with gated `nn-spin` loader;
register link as an `nn-row`. Void background per depth ladder.

**Persistence audit (operator: "review the persistence system"):**
- The login route's remember-me wiring was verified end-to-end and is CORRECT:
  client `rememberMe` → `LoginSchema` → `generateToken(rememberMe)` (JWT `expiresIn`) →
  `setAuthCookie(token, rememberMe)` (`maxAge` matched). The checkbox state was never the defect.
- **REAL DEFECT #1 (register route):** fresh accounts minted `generateToken(…, rememberMe=false)` →
  **1-hour JWT** inside a **7-day cookie**. Every new player was silently logged out after an hour with a
  stale cookie still present — read by operators as "persistence doesn't work". FIXED: register mints one
  token with an explicit 7-day `expiresInSeconds` (new optional param on `generateToken`) matching the
  cookie's `maxAge`; the stray `token` field in the JSON response was dropped.
- **REAL DEFECT #2 (plain-session length):** non-remember sessions lasted **1 hour** — mid-play logouts
  that read as broken persistence. Raised to **12 hours**; remember-me stays 30 days as labeled.
- **DEFECT #3 (aux-cookie drift):** `sessionId`/`playerId` cookies used their own 24h/30d policy,
  outliving the auth cookie. Now share `getSessionDuration(rememberMe)` (new exported accessor).
- **App-wide root cause also fixed en route (§9.1a addendum):** the unlayered `* { margin:0; padding:0 }`
  reset in globals.css out-ranked Tailwind v4's `@layer utilities` — killing every m*/p* utility
  (`mx-auto` included) across the whole app. Moved into `@layer base`; utilities now win.

**Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1.

### §9.4 — Wave A · stats (`app/stats/page.tsx`) — DONE 2026-09-08

**Before (audit):** already partially tokenized (FID-012 early pass) but with legacy residue: `animate-spin` tailwind loader, top-player list as stacked `nn-well` cards with `!border-*` overrides + `transition-colors`, `nn-msg__time` used outside chat, error panel with unstructured body.

**Redesign:**
- **Structure:** leaderboard body as `.nn-panel__body` ledger of `.nn-row` rows — rank numeral in `nn-num` Orbitron, username semibold, `nn-lab` level tag, value column switches icon+number by sort key; top-3 rows tinted by rank accent (amber/cyan/violet) via 5% color-mix backgrounds instead of `!border-*` overrides; error state as a magenta `.nn-panel` with proper header; loader as gated `nn-spin` square.
- **Function-driven glow:** global stats keep their semantic glows (violet=players, amber=metal, cyan=energy, green=avg level); rank colors are placement semantics, not decoration.
- **Motion:** `transition-colors` removed; sort re-render is instant (data already client-side), hover via `.nn-sz` token timing.
- **Behavior preserved:** fetch/sort/error flow untouched.

**Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps 0 legacy classes.

### §9.7 — Wave A batch 2 (register · tech-tree · WMD family · clans family) — DONE 2026-09-08

Four follow-on FIDs executed through the full perfection loop (RED → GREEN → AUDIT), details in each:

- **FID-007 — register (`app/register/page.tsx`)**: full legacy rebuild → login-parity NN treatment (`.nn-panel` Enlistment console, `nn-input` ×4 with inset icons, `nn-meter` strength gauge with semantic magenta/amber/cyan/green + glow-on-strong-only, `nn-brief` info block, gated `nn-spin`). Validation ladder byte-preserved.
- **FID-008 — tech-tree (`app/tech-tree/TechTreeView.tsx`)**: RED self-correction — the early FID-012 pass had already tokenized it; the only banned hit was `animate-spin` on the Researching chip. Removed. Structure verified rubric-compliant in re-read.
- **FID-009 — WMD family (9 files)**: kit imports eliminated; `Card`→`.nn-panel` per-domain accents, `Badge`→`.nn-chip`, `Button`→`.nn-btn/.nn-abtn`, type selectors→`.nn-ptab/.nn-tab` (emoji tab icons removed), progress→`.nn-meter`, `WMDMiniStatus` alert dot squared. **En-route typed-WS fix (7 `any`s)**: handlers now use the real `types/websocket.ts` payloads — falsified handler fields (`isYourMissile`, `defenderUsername`, `launcherUsername`) that never existed; interception toasts relay the server's pre-composed `message`.
- **FID-010 — clans family (15 files, ~6.8k lines)**: the app's heaviest legacy debt (415 banned-class instances, 12 kit-importing files, 68 framer Stagger wrappers) eliminated. Tag rewrites via verify-gated codemod (v1–v3 splicing bugs caught by the tsc syntax gate and reverted; v4 streaming stack rewrite passed); dynamic variant ternaries hand-migrated; 5 en-route `any`s fixed. Only `RichTextEditor` + `confirmDialog` remain (functional, not styling slabs).

**Gates (all four):** tsc 0 · eslint 0 (all touched files) · full vitest 362/0/1 · rubric greps: 0 kit imports, 0 banned classes.

**Wave A status:** unit-factory + stats + BackButton (§9.1–9.4), register/tech-tree/WMD/clans (§9.7) — **all operator-named Wave A surfaces complete.** Remaining for next session: Waves B/C long tail + Phase 6 program audit.

### §9.6 — Movement-closes-factory rule — DONE 2026-09-08

**Operator ruling:** "when the unit factory is open, if the user moves, it should always show the actual tile and close the overlay." Factory surfaces are location-bound; they must never float free of the map position.

**Implementation (two surfaces):**
- `app/game/page.tsx`: position-watch effect — when `player.currentPosition` changes while `showUnitBuildPanel` or `showFactoryManagement` is open, both close so the view shows the actual tile moved to. Coordinates are primitives, so data refreshes (same position) no-op; auto-farm moves count (they are real moves).
- `app/game/unit-factory/page.tsx`: same watch — a real move while the standalone page is open routes back to `/game`, landing the operator on the live tile view.

**Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1.

### §9.9 — Wave B: help page (FID-20260908-012)

Census's worst single file (97 banned instances) rebuilt on token primitives: nn-panel sections
with domain-accent scanline headers, all keycaps → new `.nn-kbd` primitive (added to neon-noir.css),
key tables → nn-table ledger rows, tips/terrain → nn-well cells, flat var(--nn-void) shell, both
decorative gradients removed; terrain glyphs retained (match TileRenderer in-world icons).
Substantive: keyboard reference was factually stale — corrected against DEFAULT_HOTKEYS,
page.tsx handlers, MovementControls, and panel-local handlers (Q/Z/C compass fix, phantom
Shift+H removed, V/H/N/Shift+D/Shift+P/Shift+F corrections, 8 missing bindings added); provenance
header + Method-2 binding diff (0 mismatches) recorded in the FID. Gates: tsc 0 · eslint 0 ·
vitest 362/0/1.

### §9.10 — Dead-kit retirement (FID-20260908-013, program-closing)

The dual design system is gone. All remaining styling-kit consumers hand-migrated
(BankPanel, ErrorBoundary, leaderboard pair, chat pair, ModerationPanel,
ClanInspectorModal) — including restoring dynamic variant ternaries an interim automated
pass had silently dropped (active tab/page/badge highlight states), caught by per-file
diff re-reads against HEAD. Clan modals de-framer'd by hand. Deleted:
`components/transitions/` (4), the 11 `components/ui` styling slabs, and the three
framer-coupled `lib/` modules; the `components/ui` barrel now re-exports only the audited
retentions (ConfirmDialog, RichTextEditor). **framer-motion uninstalled** — 0 source
imports, 0 package.json/lockfile references. Gates: tsc 0 · eslint 0 · vitest 362/0/1 ·
deletion census 0. The neon-noir token system is the app's sole design system.

### §9.11 — Wave B: referrals family (FID-20260908-014)

101 banned-class instances across 3 files (page+guide 42, dashboard 36, leaderboard 23) eliminated
by hand migration: token void shell + nn-tab navigation + nn-panel scanline sections on the page,
nn-stat/nn-meter/nn-chip instruments on the dashboard, nn-table ledger on the leaderboard; 13
decorative gradients (5 same-color no-ops) removed; 2 un-gated spins → gated Loader2 idiom; doubled
class fragments fixed. Content diligence: GuideTab milestone table re-verified 8/8 against
REFERRAL_MILESTONES (figures unchanged — the 750k→625k→150k non-monotonic curve is intentional).
Companion fix: FID-011's empty-span nn-spin-icon loaders (Achievement/Inventory) rendered nothing —
now proper Loader2 glyphs. Handler census HEAD↔working identical. Gates: tsc 0 · eslint 0 ·
vitest 362/0/1.

### §9.12 — Wave B: profile + messages family (FID-20260908-015)

RED corrected the census: the real scope was ~184 instances across **5 files** — the Phase 6 scan
missed components/messaging (MessageInbox 24, MessageThread 15) and under-counted gradient stops.
All eliminated by hand: ProfileView (nn-panel/nn-stat/nn-well + **lost-stat fix** — Base Defenses
"breached" rendered .won, now .lost), public [username] profile (void shell, nn-brief bot banner),
messages page (void shells, nn-chip unread counter, gated nn-pulse on the connection dot,
nn-btn--danger retry replacing a non-token white/magenta button), MessageInbox (nn-input/
nn-tabchip, blue-500 strays → token rules), MessageThread (nn-msg/nn-msg--own bubbles,
undefined --nn-glass-darker token → nn-surface--dark, blue focus rings → cyan). Two `payload as
any` casts → a tuple-narrowing adapter (fail-loud). New gated `.nn-pulse` utility. Handler census
HEAD↔working identical (2/2, 3/3, 13/13, 8/8, 14/14). Gates: tsc 0 · eslint 0 · vitest 362/0/1.

### §9.13 — No-regression import guard (FID-20260908-016, FID-013 §8 follow-through)

ESLint `no-restricted-imports` guard added in `.eslintrc.json` (`**/*.{ts,tsx}`): framer-motion,
`components/transitions` (barrel + deep + relative), the three deleted `lib/` framer modules, and
the 11 ui styling slabs (as a **named-import ban** on the `@/components/ui` barrel plus deep paths,
keeping the audited confirmDialog/RichTextEditor retentions legal). Verified by a probe file that
tripped 9/9 expected errors with actionable messages (then deleted), and a repo-wide lint with 0
guard hits. Side finding recorded: full `eslint .` exposes 325 pre-existing errors (323
`no-explicit-any` — mostly legacy `scripts/*.ts` ops files the existing override doesn't cover —
+ 2 unused vars), none in session-touched files; remediation deferred to its own FID. Gates:
probe 9/9 · repo lint guard-hits 0 · tsc 0 · vitest 362/0/1.

### §9.14 — Wave B: admin family (FID-20260908-017)

Admin family fully remediated per FID-20260908-017 (hand-migrated, no scripts): `app/admin/referrals`
+ `app/admin/vip` shells (gray-900 gradients, gradient hero, gradient stat cards → nn-stat/nn-table),
ClanInspectorModal (gradient header, rounded-full meters → nn-meter, new `nn-meter__seg--amber`),
the five inspector/log modals and five chart panels (11 un-gated spins → Loader2 + gated
nn-spin-icon; purple focus strays → nn-input). Family lint gate surfaced and fixed 4 missing
Loader2 imports (a runtime-crash class from an interim pass), a swallowed null-guard in
ResourceGains, and in-scope honest typing: 5 recharts tooltip/label `any`s + 2 WebSocketConsoleModal
`any`s → `unknown`. Gates: tsc 0 · eslint (family) 0 · vitest 362/0/1 · rubric census 0.

### §9.15 — Wave B: map family (FID-20260908-018)

Map family fully remediated per FID-20260908-018 (hand-migrated, no scripts): the RED census
undercounted again — MapLegend + ZoomControls still styled on the **legacy token layer**
(`bg-glass-light`, `text-text-*`, `border-glass-border`, invisible to the old census pattern).
`app/map/page.tsx` shells/panels/cards → nn-panel family + token text + Loader2 spinner;
ZoomControls' self-canceling hover (`bg-glass-light hover:bg-glass-light`) → real token hover;
TileRenderer's 7 un-gated `animate-pulse` → gated `nn-pulse`, the flag glyph's inline
`animation:` shorthand (which bypassed gating) → new gated composite `.nn-fx-flag`, Metal terrain
stops de-grayed to tokens (FID-011 terrain-art exception preserved ×3); TileHarvestStatus →
gated fade/pulse. Family lint gate also surfaced 13 pre-existing PixiJS `(g as any).prop` sites
→ intersection-type aliases (TileGraphics/HighlightGraphics/MarkerGraphics/AnimatedMarkerGraphics)
+ Pixi `Ticker`/`Container` types — no casts, no disables. Canvas 2D paints documented as
outside the CSS rubric. Gates: tsc 0 · eslint (family) 0 · vitest 362/0/1 · census 0.

### §9.16 — Wave B: leaderboard + shop (FID-20260908-019)

Leaderboard and shop remediated per FID-20260908-019 (hand-migrated): leaderboard page → void
shells + nn-table ledger + nn-input/nn-btn + gated Loader2 (un-gated emoji spin retired);
shop → void shells, package-data gradients re-modeled to single accent tokens rendered as flat
color-mix header bands (3 same-color gradient no-ops + 2 two-stop combos collapsed — recorded
call), nn-surface--dark cards, nn-btn--amber/--primary (doubled class fixed), nn-panel--violet
VIP CTA (same-color-hover gradient button retired); ClanLeaderboardPanel/View FID-013 residues
closed — gray-950 modal shells → token void, gradient bg-clip-text heroes → Orbitron tokens,
un-gated spins gated, and the **corrupted CategoryButton inactive branch** (six merged classes
from an earlier automated pass) repaired to a clean two-state ternary. Purchase handler, VIP
math, and result ternary untouched. Gates: tsc 0 · eslint (family) 0 · vitest 362/0/1 ·
census 0. Handler census 4/4 files identical.

## 10. Closure

- **Gates:** per-surface rubric + Phase 6 program audit
- **Commit hashes (G2):** per-surface path-scoped commits; hashes appended in §9
- **Staging plan:** path-scoped per surface/wave
