# FID-20260908-007: Register page is full legacy design (gradients, emoji cards, uncontrolled strength meter)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-007-register-neon-noir-redesign.md`
**ID:** FID-20260908-007
**Severity:** MEDIUM (public-facing first-touch surface completely outside the design system)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

`app/register/page.tsx` never received any NEON NOIR pass. It is the sibling of the login page fixed in FID-006 §9.5 but retained the entire legacy vocabulary: full-page `bg-gradient-to-br from-gray-900 via-black to-gray-800`, gradient-clipped wordmark (`bg-clip-text`), hand-rolled input shells (raw `<input>` + focus:ring-2 arbitrary classes), a `rounded-full` pill strength bar with tailwind `bg-[color-mix...]` fills and `animate-spin` SVG loader, `transition-all`/`transition-colors` micro-motion, and a `🎮 What is DarkFrame?` emoji-titled info card. The operator's screenshot showed the login form as low-quality; register is the same era and worse.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Legacy gradient page background | `app/register/page.tsx:88` | `bg-gradient-to-br from-gray-900 via-black to-gray-800` |
| 2 | Gradient-clipped wordmark (banned treatment) | `app/register/page.tsx:92` | `bg-clip-text bg-gradient-to-r` |
| 3 | Raw input shells ×4 | lines 108–205 | `focus:ring-2 focus:ring-[...]` on every input, no token component |
| 4 | Pill strength meter (rounded-full, not HUD) | lines 141–150 | `rounded-full h-2` bar with tailwind mix fills |
| 5 | Banned loader | lines 225–243 | inline SVG `animate-spin` |
| 6 | Emoji-titled info card + legacy glass | lines 269–277 | `🎮 What is DarkFrame?`, `bg-[color-mix...65%] backdrop-blur-sm` |
| 7 | Gradient-filled submit button | lines 210–218 | `bg-gradient-to-r from-cyan to-violet shadow-lg hover:shadow-[...]` |

**Call-graph (Law 4):** standalone route (`/register`), linked from `/login` (`Register here` link in FID-006 §9.5 output). Submits to `/api/auth/register` (already fixed in session: 7d cookie/JWT match). Pure presentation file; no consumers.

## 3. Impact Analysis

- **Affected:** every new player's first impression; the one public surface besides login.
- **Blast radius:** one file. No logic changes (validation + submit flow preserved byte-for-byte).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — all four inputs, strength meter, match indicator, error, submit, info block |
| Scales? | Yes — reuses the exact token set proven on login (§9.5) |
| Hostile attacker? | N/A (static presentation) |
| Maintainable? | Yes — single file, token components |
| Industry standard? | Yes — login/register pairing is standard; consistency here is the point |

## 5. Proposed Fix (GREEN)

Rebuild presentation only, mirroring login §9.5 exactly:
1. Page: token void background, centered `max-w-md` column.
2. Wordmark: same `nn-sec__title` treatment as login (no gradient clip).
3. Form: `.nn-panel` + scanline `Enlistment` header; four `.nn-input` fields (username/email/password/confirm) with inset icons; labels as `.nn-lab`.
4. Strength meter → `.nn-meter` with semantic fills: magenta=weak, amber=fair, cyan=good, green=strong (glow only on strong, per glow discipline); match indicator as `.nn-lab` with green/magenta semantic color.
5. Error → `.nn-note`; submit → `.nn-btn nn-btn--primary` full-width with gated `nn-spin`; loader text "Enlisting…".
6. Info card → `.nn-brief` block, `.nn-lab` rows, emoji slab removed; footer `.nn-lab`.
7. Logic untouched: validation ladder, fetch, redirect, error extraction.

**Verification plan:** tsc 0; eslint 0 (file); vitest full; rubric greps (banned classes = 0); side-by-side read vs login page for treatment parity.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | treatment parity vs login; logic diff = 0 | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied (`app/register/page.tsx`):** full presentational rebuild per §5 — token void page, `.nn-panel`/`Enlistment` scanline header, 4 × `.nn-input` with inset icons, `.nn-meter` strength (semantic magenta/amber/cyan/green, glow on strong only), `.nn-lab` match indicator, `.nn-note` error, `.nn-btn--primary` + gated `nn-spin`, `.nn-brief` info block (emoji removed), footer `.nn-lab`. Validation ladder, fetch payload, redirect, and error extraction byte-identical to the prior logic (re-read diff confirmed).
- **Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps 0 (`from-gray-900|bg-clip-text|rounded-full|animate-spin|transition-all|bg-gradient`).
- **Audit Method 2:** side-by-side vs `app/login/page.tsx` — same wordmark treatment, panel structure, input treatment, loader pattern; register adds meter/brief only where login has none.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric greps
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/register/page.tsx`
