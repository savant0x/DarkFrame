# FID-20260908-016: No-regression import guard — ESLint `no-restricted-imports` for framer-motion and the retired kit

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-016-no-regression-import-guard.md`
**ID:** FID-20260908-016
**Severity:** LOW (guardrail; prevents reintroduction of retired dependencies/design-system paths)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

FID-20260908-013 §8 proposed (not executed) an ESLint `no-restricted-imports` guard so the retired
design system cannot silently return: framer-motion, `components/transitions`, the 11 deleted
`components/ui` styling slabs, and the three deleted framer-coupled `lib/` modules. This FID
implements it. The project runs ESLint 8 with `.eslintrc.json` (eslintrc, not flat config), so the
guard is a new override block scoped to TS/TSX app code.

## 2. Evidence (RED)

- `package.json`: `eslint ^8`, `lint` script = `eslint .` — eslintrc-style config required
  (`eslint.config.*` would be ignored by this version pairing).
- `.eslintrc.json` currently: `next/core-web-vitals` + `next/typescript`, one `no-unused-vars`
  tuning, an overrides block for `scripts/**` (require/any relaxed), `ignorePatterns` for build
  output and legacy fix scripts.
- Deletion surface to guard (from FID-013 §2.3): `framer-motion`; `@/components/transitions`
  (barrel) and its 3 modules; `@/components/ui` re-exports of the 11 styling slabs
  (`Button, Card, Panel, Badge, Input, Divider, IconButton, StatCard, ProgressBar, Skeleton,
  Alert`); `@/lib/animations`, `@/lib/designTokens`, `@/lib/microInteractions`.
- Deliberate retentions that MUST keep importing `@/components/ui`:
  `confirmDialog`/`ConfirmDialogHost` (app/layout.tsx + 15 consumers) and `RichTextEditor`
  (ProfileView, ClanManagementView). The guard therefore bans specific *named* ui imports, not the
  whole barrel path.

## 3. Impact Analysis

- **Affected:** `.eslintrc.json` only. No runtime code. `next lint`/`eslint .` output unchanged on
  a clean tree (verified by negative + positive tests below).
- **Blast radius:** false positive would block `npm run lint` for the offender only, with a
  self-documenting message pointing to the token primitives in `app/neon-noir.css`.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — patterns cover barrel, deep, and relative import spellings of the retired paths; named-import lists cover the ui slab barrel |
| Scales? | Yes — new retirements append one pattern line; message strings carry the migration pointer |
| Hostile attacker? | Guard is advisory-only (lint); a determined bypass (`// eslint-disable-line`) is visible in review and ci grep-auditable |
| Maintainable? | Yes — single overrides block in the existing config, commented per group |
| Industry standard? | Yes — `no-restricted-imports` is the canonical ESLint mechanism for banned modules |

## 5. Proposed Fix (GREEN)

1. Add an override in `.eslintrc.json` for `**/*.{ts,tsx}` applying
   `no-restricted-imports: [error, { patterns: [...] }]` with:
   - `framer-motion` (+ `framer-motion/*`) — message: retired with FID-013; use CSS tokens/gated
     `nn-*` animations.
   - `**/components/transitions`, `@/components/transitions/**`, `**/transitions/StaggerChildren`,
     `**/transitions/PageTransition`, `**/transitions/LoadingSpinner` — deleted FID-013.
   - `@/lib/animations`, `@/lib/designTokens`, `@/lib/microInteractions` (+ deep paths) — deleted
     FID-013; tokens live in `app/neon-noir.css`.
   - `@/components/ui` with `importNames` = the 11 slab symbols (barrel), plus deep slab paths
     (`@/components/ui/Button` etc.) — so `confirmDialog`/`RichTextEditor` imports stay legal.
   - Relative spellings (`../../components/ui/Button`, `../transitions/...`) covered by generic
     patterns.
2. Scope: `**/*.{ts,tsx}`; do NOT relax inside `app/`, `components/`, `lib/`, `hooks/`, `context/`
   — the ban is universal for app code (there is no legitimate consumer left).
3. Keep messages actionable: each pattern names the replacing primitive.
4. Negative test: create `components/__guard_probe__.tsx` importing framer-motion + a ui slab +
   `@/lib/animations`; `npx eslint` must report exactly the expected `no-restricted-imports`
   errors; delete the probe file afterwards.
5. Positive test: repo-wide `npx eslint .` reports 0 hits (no false positives on the retentions);
   tsc + vitest unchanged.

**Verification plan:** probe trip + repo-wide lint + tsc + vitest; grep that no
`eslint-disable.*no-restricted-imports` suppression exists in the tree afterwards.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | probe file trips guard; repo-wide eslint 0; tsc 0; vitest green | *(pasted at implementation)* | pass |
| Method 2: manual re-read | retentions (confirmDialog, RichTextEditor) still lint-clean; config JSON valid; no suppressions added | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:**
  - **.eslintrc.json** — new overrides block scoped to `**/*.{ts,tsx}` with `no-restricted-imports:
    [error, { patterns }]`. Seven pattern groups, each with an actionable message naming the
    replacement: (1) `framer-motion` + deep paths → gated `nn-*` CSS animations; (2)
    `components/transitions` barrel + `**/transitions/{StaggerChildren,PageTransition,LoadingSpinner}`
    (barrel, alias, and relative spellings) → plain nodes + `nn-fade`/`nn-spin-icon`; (3–5)
    `@/lib/animations` / `@/lib/designTokens` / `@/lib/microInteractions` → `app/neon-noir.css`
    tokens; (6) `@/components/ui` **named-import ban** on the 11 slab symbols (Button, Card, Panel,
    Badge, Input, Divider, IconButton, StatCard, ProgressBar, Skeleton, Alert) — deliberate
    retentions (`confirmDialog`/`ConfirmDialogHost`, `RichTextEditor`) remain legal; (7) deep slab
    paths (`@/components/ui/Button` etc., alias + relative) → token primitives.
  - Config remains valid JSON (node parse check); existing rules/overrides untouched.
- **Gates:** negative test — probe file importing all seven banned groups produced exactly **9
  `no-restricted-imports` errors** (framer-motion; transitions barrel; relative deep module;
  3 lib modules; Button + Card named-import pair; deep Badge path), all with self-documenting
  messages; probe deleted, no leftovers. Positive test — repo-wide `npx eslint .`: **0
  no-restricted-imports hits** (zero false positives; retentions lint-clean). tsc 0 · vitest
  **362/0/1**. No `eslint-disable.*no-restricted-imports` suppressions in the tree.
- **Pre-existing lint debt discovered (out of scope, recorded):** a full `eslint .` run surfaced
  **325 pre-existing errors** unrelated to this guard — 323 `@typescript-eslint/no-explicit-any`
  (mostly legacy `scripts/*.ts` ops files, which the existing override relaxes only for
  `.js`/`.cjs`, plus `lib/websocket/**` and test files) and 2 `no-unused-vars`. Verified **none are
  in any file touched this session**. The project's `npm run lint` evidently was not previously
  run repo-wide; remediation belongs to its own FID, not this guardrail change.
- **Audit Method 2:** re-read of the final config (JSON valid, scoping correct, retentions legal);
  suppression grep clean; probe file confirmed deleted.

## 8. Closure

- **Gates:** [x] probe trips guard · [x] repo lint 0 · [x] typecheck 0 · [x] tests pass · [x] no suppressions in tree
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add .eslintrc.json dev/fids/FID-20260908-016-no-regression-import-guard.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** wire `npm run lint` into CI; when Wave C retires the
  remaining legacy *classes*, add the matching `no-restricted-syntax`/class-census guard from the
  FID-012 help-vs-hotkeys follow-through family.
