# FID-20260906-012: NEON NOIR — Full UI/UX Redesign (AAA Art Direction + Stack Modernization)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-012-neon-noir-ui-redesign.md`
**ID:** FID-20260906-012
**Severity:** HIGH (full product redesign; unreleased game = zero-migration-cost window)
**Status:** DRAFT — pending operator approval of design direction
**Created:** 2026-09-06

---

## 1. Summary

The UI was built by a weak agent ~2 years ago and reads as generic glassmorphism with inconsistent surface treatment. This FID defines the complete redesign: **NEON NOIR**, a purpose-built cyberpunk design language, delivered on a modernized stack (React 19 + Tailwind 4 + HeroUI v3 as the foundation-component layer, fully skinned to our identity). Core requirement preserved: **the full-window terrain background behind the center tile stays** — and is upgraded, not removed.

## 2. RED — Current-State Evidence (file:line)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | **Stack is 1 generation behind on 3 axes**: React 18.3.1 (v19 current), Tailwind 3.4.19 (v4 CSS-first current), no component foundation layer; framer-motion 12.x still in 12 files (FID-005 flagged for removal, never executed) | package.json; FID-005 loop record |
| F2 | **Tile sizing non-uniformity (operator-reported)**: TileRenderer root is `w-full max-w-2xl` inside GameLayout's `<main className="flex-1 flex">` — as a flex child whose width derives from content+container rather than a stable rule, the rendered square shifts with surrounding content (factory panels, action cards), breaking consistency across terrain types | `components/TileRenderer.tsx:327` + `components/GameLayout.tsx:174` |
| F3 | **Full-window background exists and works** (KEEP): `getTerrainBackgroundImage()` maps terrain→asset with per-(x,y) variation; GameLayout renders it fixed inset-0 at opacity 0.35, blur 2px, brightness 0.6 | `app/game/page.tsx:40-75`, `components/GameLayout.tsx:136-146` |
| F4 | **Design tokens are a patchwork, not a system**: tailwind.config.ts carries sci-fi glass tokens (bg-space/void/nebula, neon palette, glass-dark/…, text-primary) BUT globals.css separately re-defines legacy aliases (--bg-primary etc.) AND components mostly hardcode `bg-gray-800/40`, `text-white`, `border-cyan-500/30` literals instead of consuming tokens — FID-005 A2 codemodded 110 files to "glass theme tokens" that are themselves ad-hoc | tailwind.config.ts:1-100, globals.css:80-108, FID-005 record |
| F5 | **Two competing fonts, one loaded wrong historically**: Orbitron (display) + Inter (body) now self-hosted via next/font (FID-005 Phase C fixed loading) but hierarchy is unmanaged — font-display used decoratively, no scale | app/layout.tsx:8-26 |
| F6 | **Surfaces**: 29 page routes; primary game shell = 3 fixed panels (w-72/80) + fluid center; secondary pages use ad-hoc cards; admin is its own legacy gray island (AdminView) | find app -name page.tsx \| wc -l = 29; GameLayout.tsx:152-189 |
| F7 | **Glow architecture is decoration-driven, not function-driven**: identical cyan glow on stats, borders, tiles regardless of semantic state (danger/success/info) | TileRenderer.tsx:329, GameLayout.tsx:152,156 |
| F8 | **FID-005 T5 (deep art direction) was explicitly gated on operator direction** — this FID is that direction, superseding T5's placeholder scope | FID-005 loop record Pass 4 |

## 3. Art Direction — "NEON NOIR"

### 3.1 Design thesis
DarkFrame is a surveillance-grade strategic command interface from a decaying neon city. Every surface is **glass over void**; every glow is **information** (state, threat, resource); every motion is **machine-precise**. The player is a commander reading an instrument, not browsing a website.

### 3.2 Color system (OKLCH, perceptually uniform)

**Surfaces (void → glass):**
| Token | Value | Use |
|---|---|---|
| `--surface-void` | oklch(0.13 0.03 265) | page void (near-black blue) |
| `--surface-deep` | oklch(0.17 0.035 265) | well/inset areas |
| `--surface-panel` | oklch(0.21 0.04 265 / 0.72) | glass panels (backdrop-blur) |
| `--surface-raised` | oklch(0.26 0.045 265 / 0.8) | cards, modals |
| `--surface-overlay` | oklch(0.31 0.05 265 / 0.9) | dropdowns, tooltips |

**Signal colors (glow = meaning):**
| Token | Value | Semantic |
|---|---|---|
| `--signal-cyan` | oklch(0.82 0.15 195) | primary accent: interactive, focus, brand |
| `--signal-magenta` | oklch(0.70 0.24 340) | danger, combat, WMD, alerts |
| `--signal-amber` | oklch(0.82 0.15 85) | resources (metal/energy), economy, warning |
| `--signal-green` | oklch(0.80 0.17 155) | success, confirm, harvest complete |
| `--signal-violet` | oklch(0.68 0.2 300) | research/RP, premium/VIP |

**Text:** `--text-primary` oklch(0.95 0.01 250) · `--text-secondary` oklch(0.72 0.02 255) · `--text-tertiary` oklch(0.55 0.02 255). All combinations ≥ WCAG AA over panel surfaces (verified in Phase 6 contrast audit).

### 3.3 Glow architecture (function-driven)
- `--glow-ambient`: soft 1px edge on every glass panel (constant, subtle)
- `--glow-focus`: cyan ring on interactive focus (replaces FID-005's ad-hoc ring)
- `--glow-state-{color}`: only semantic states glow in their color (danger panel edge pulses magenta at 2s ONLY when actionable threat)
- Glow intensity tokens sm/md/lg via `color-mix(in oklab, var(--signal-*) N%, transparent)`
- **Rule: a glow must always answer "what does this tell me?" — zero decorative glows**

### 3.4 Typography
- **Orbitron** — display: numerals, headings, HUD labels (uppercase, tracking +0.05em, weights 600-800)
- **Inter** — body: prose, descriptions, chat (400/500/600)
- Fluid scale via clamp(): `--text-hud: clamp(0.6875rem, 0.65rem + 0.15vw, 0.8125rem)` etc.; tabular-nums on all data readouts

### 3.5 Texture & depth
- Scanline overlay: 2px repeating-linear-gradient at 3% opacity on HUD module headers only (never over body text)
- Grid coordinates: corner-bracket framing (`⌜ ⌟ ⌞ ⌝` rendered via borders) on the tile viewport and critical readouts — the HUD signature
- Glass depth ladder: void → panel(1) → raised(2) → overlay(3); nothing exceeds depth 3
- Optional CRT vignette on the game shell only (toggle in settings, default on, respects reduced-motion)

### 3.6 Motion (machine-precise)
- Durations: 120ms (state) / 220ms (panel) / 400ms (scene); easing `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out)
- Tile crossfade on move (background + tile swap as one scene transition)
- Number tickers on resource changes (400ms count)
- Panel content: fade+slide 8px; modals: scale 0.96→1 + fade
- ALL motion gated behind `prefers-reduced-motion` (single global suppressor already exists from FID-005 T4.1)
- framer-motion removed entirely; HeroUI built-ins + CSS keyframes cover all needs (FID-005 R7/R8 finally executed)

## 4. Stack Modernization (Phase 0)

| From | To | Notes |
|---|---|---|
| React 18.3.1 | React 19.x | Next 16 supports; game is unreleased (no compat window cost); HeroUI v3 requires ≥19 |
| Tailwind 3.4.19 | Tailwind 4.x | CSS-first `@theme` config replaces tailwind.config.ts; OKLCH tokens native; HeroUI v3 requires v4 |
| — | @heroui/react v3 | **stable `3.2.4` on npm** (Pass-4 audit; the operator-saved docs' `@alpha` tags are stale). Foundation layer: Modal, Dropdown, Tabs, Tooltip, Table, Select/Autocomplete, Toast, Progress, Skeleton, Breadcrumbs. **Every slot reskinned via HeroUI's CSS variables to NEON NOIR** — zero default HeroUI visuals ship |
| framer-motion 12 | removed (Phase 5) | React-19-compatible, so removal is deliberately OUT of Phase 0 to shrink its blast radius; executed with the motion-polish phase |
| Next 16.1.7 | stays | webpack build (exFAT constraint documented in next.config.js) preserved |

**Customization contract (from operator-saved HeroUI v3 docs):** "Use Tailwind utilities, CSS variables, BEM modifiers, or compose component parts differently. Every slot is customizable." We override HeroUI's OKLCH semantic variables (--accent, --surface, --overlay, --danger…) with NEON NOIR values in globals.css `@theme` + `@layer components` skin file. Default HeroUI appearance must not survive anywhere.

## 5. GREEN — Design by Surface

### 5.1 Game shell (fully custom — the signature)
- **TopNav (56px)**: void bar, bottom edge = 1px cyan at 20%; nav items text-secondary → active item cyan with 2px underline glow; WMD alert slot pulses magenta when armed missiles exist; resource readouts right-aligned in Orbitron tabular-nums with ticker animation
- **Left panel (Stats)**: glass panel(1); PLAYER INFO header gets corner brackets + scanline strip; military power = segmented vertical power meters (neon noir revision of the current NaN-prone module) with STR cyan / DEF magenta split and total in Orbitron; resource rows with 2px semantic glow edges on gain
- **Center (tile viewport)**: 
  - **Uniformity fix (F2)**: tile square sized by `width: min(100%, calc(100dvh - 56px - 4rem))` inside a fixed aspect-ratio(1/1) frame, centered in main — identical px on every terrain, no max-w-2xl content-driven sizing; action cards render BELOW in their own scroll region with stable reserved min-height so the tile never reflows
  - Tile frame = HUD viewport: corner brackets, bottom status strip (terrain name · coordinates · state chip), 1px cyan ambient edge
  - Crossfade scene transition on move
  - **Full-window background (F3) — KEPT + UPGRADED**: same getTerrainBackgroundImage mechanic, plus: per-terrain color-grade overlay (cyan-teal for energy, rust for metal, violet for cave, emerald for forest), vignette, and a subtle 6s Ken-drift (scale 1.0→1.04) honoring reduced-motion
- **Right panel (Controls)**: movement D-pad as HUD cluster with pressed-state glow; harvest/action buttons as bracket-framed modules with cooldown = conic-gradient sweep in signal color
- **Chat (bottom-right overlay)**: glass overlay(3), collapsed to header strip by default, expand on activity (already functionally similar; reskin only)
- **Bottom-left (Battle logs + Discovery)**: feed items with 2px left rule in semantic color, timestamps in Orbitron

### 5.2 HeroUI-skinned foundation (Phase 3)
Adopt HeroUI v3 for: Modal/Dialog (confirm flows, factory mgmt, WMD panels), Dropdown (nav, context menus), Tabs (chat, admin sections), Tooltip (HUD icons), Table (leaderboard, admin), Select/Autocomplete (filters), Progress (XP, cooldowns, build queues), Skeleton (all loading), Toast (replace sonner — one motion/a11y system), Breadcrumbs (profile/battle-log hierarchy).
**Skin:** single `heroui-noir.css` overriding HeroUI's semantic variables + slot classes; every component renders in NEON NOIR with zero visual default leakage. Our 17-component kit (components/ui) keeps its public API, delegates internals to HeroUI where adopted (no mass call-site refactor).

### 5.3 Secondary pages (Phase 4)
All 29 routes on the token system: leaderboard (Table + row hover + clickable profiles), messages, clans, shop, profile, map (full-bleed variant of the viewport treatment), admin (admin keeps data-density but inherits tokens — ends the gray-island divergence).

## 6. Five Questions

1. **What's broken?** A 2-year-old decorative-glass UI with token patchwork, inconsistent tile sizing, decoration-driven glow, and a legacy stack.
2. **Why now?** Game unreleased — the zero-cost migration window; FID-005 T5 gated on exactly this direction; HeroUI v3 + React 19 + TW4 are current-gen.
3. **Blast radius?** Every visual surface; zero API/data changes; risk concentrated in Phase 0 stack migration (verifiable before any design work).
4. **Minimal correct path?** Phase 0 proves the stack (build green, all tests) BEFORE design tokens land; each subsequent phase ships behind a green build so the game is never broken mid-redesign.
5. **Proof?** Per-phase: tsc/eslint/tests green + live preview drive + screenshot review; Phase 6 adds WCAG AA contrast audit + bundle-size budget + reduced-motion verification.

## 7. Phasing (each phase = separate verification gate + commit)

| Phase | Scope | Gate |
|---|---|---|
| 0 | React 19 + TW4 + HeroUI v3 install, @theme migration, joyride 3.x, dead-dep removal | build+tests green, visual parity (no design change yet) |
| 1 | NEON NOIR token system in globals.css @theme + heroui-noir.css skin | tokens consumed by kit, no hardcoded grays in shell |
| 2 | Game shell redesign (TopNav, panels, TileRenderer + uniformity fix + bg upgrade, controls, chat, logs) | live UI drive + screenshots |
| 3 | HeroUI adoption across flows + kit internals | interaction parity (confirm, modals, tabs, toasts) |
| 4 | Secondary pages sweep (29 routes) + admin un-islanding | page-by-page drive |
| 5 | Motion polish (tickers, scene transitions) + framer-motion removal (12 files) | reduced-motion honored |
| 6 | WCAG AA contrast audit, bundle budget, closure sweep across all phases | full gates + archive |

## 8. Verification Plan (per-phase, repeated)

1. `tsc --noEmit` = 0; eslint = no new errors; full test suite pass.
2. Live preview drive (port 3002): each redesigned surface clicked through, screenshots captured.
3. Tile uniformity assertion: computed width identical across ≥4 terrain types (probe reads getBoundingClientRect).
4. Contrast: automated check of token pairs ≥ 4.5:1 (text), ≥ 3:1 (large/UI).
5. FID loop record per phase; master archive at Phase 6.

## 9. Loop Record

- **Pass 1 (RED verification):** F1 stack census via package.json (React 18.3.1, TW 3.4.19, framer-motion 12 present, HeroUI absent) — confirmed. F2 sizing: TileRenderer.tsx:327 `w-full max-w-2xl` + GameLayout.tsx:174 flex parent confirmed; root cause = content-derived sizing in flex context, fix designed in §5.1. F3 background mechanic confirmed live-wired (app/game/page.tsx:897). F4 token patchwork confirmed (globals.css:80-108 legacy aliases coexist with tailwind.config tokens; components hardcode gray literals). F8: FID-005 record confirms T5 was gated on operator direction — this FID supersedes it.
- **Pass 2 (HeroUI v3 fit audit):** operator-saved docs (docs/design/llms-full.txt) confirm: CSS-first OKLCH theming, "every slot is customizable" (L133), accent/surface/overlay semantic system, React Aria a11y, no provider required, 75+ components, React 19 + TW4 required — matches §4 migration table exactly.
- **Pass 3 (design self-audit):** glow-everywhere trap avoided (§3.3 rule); gray-on-glass contrast flagged as Phase 6 gate, not assumed; tile uniformity gets a computed assertion, not eyeball check; exFAT/webpack build constraint honored (next.config.js note re-read).
- **Status: CONVERGED — awaiting operator approval of direction + phases before Phase 0.**
- **Pass 4 (ecosystem/peer audit, live npm):** @heroui/react latest = **3.2.4 stable** (docs' @alpha stale); peers `react >=19, tailwindcss >=4, react-aria-components ^1.20` — migration table exact. **react-joyride 2.9.3 peers React 15–18 → hard blocker** for Phase 0; upgrade path = react-joyride **3.2.0** (peers 16.8–19 ✓, proper dual CJS/MJS exports — the next.config.js exFAT alias hack becomes a REMOVAL CANDIDATE, verified during Phase 0). react-hot-toast: installed, **zero imports** → dead dep, removed in Phase 0. sonner peers `^18 \|\| ^19` ✓. socket.io-client: no react peer ✓. recharts 3.x: React 19 supported ✓. 155 client components will ride the @types/react 19 wave (expected error sweep budgeted into Phase 0).
- **Pass 5 (sequence/dependency re-audit):** framer-motion 12 supports React 19 — its removal moved from Phase 0 to Phase 5 (blast-radius reduction; FID-005 R7/R8 still honored, timing only). TW4-in-webpack via `@tailwindcss/postcss` is the supported path for this repo's exFAT/Turbopack-broken constraint (next.config.js re-read). TW4 browser floor (Chrome 111+/Safari 16.4+) acceptable for a 2026 title — noted as a conscious cut. Config-token classes (bg-space, glass-dark, …, 119 references) survive TW4 via `@theme` translation — no consumer mass-edit needed for parity. FID-005's font variables (--font-orbitron/--font-inter) confirmed exposed at layout root ✓ (theme consumes them). No remaining contradictions — FID stands converged.
