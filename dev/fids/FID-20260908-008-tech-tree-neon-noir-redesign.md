# FID-20260908-008: Tech-tree structural redesign — scanline section system on a legacy view shell

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-008-tech-tree-neon-noir-redesign.md`
**ID:** FID-20260908-008
**Severity:** MEDIUM (operator-named Wave A surface; deep-page shell diverges from the game shell)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

`app/tech-tree/TechTreeView.tsx` (535 lines) was token-sprinkled in the FID-012 early pass but never structurally redesigned: legacy view chrome (`nn-panel`-less section headers), gradient-clipped header text, legacy glass containers, a tailwind `animate-spin` loader, and unstructured tier cards that predate the `.nn-unit`/`.nn-ptab`/`.nn-meter` vocabulary. FID-006's rubric (§4) requires: token structure (panel/section/row), function-driven glow, HUD readouts in `nn-num`, no framer-motion, no legacy kit, no gradient fills, machine-precise motion.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Banned loader | Researching chip | `<Clock className="h-3 w-3 animate-spin" />` — the file's ONLY banned-class hit (census command logged) |
| 2 | Prior pass verification | full file | FID-012 early pass already shipped `.nn-sec` header, `.nn-panel` cards with `--nn-accent` (unlocked=green / researching=cyan / category signal), `.nn-chip` states, `.nn-num` cost, `.nn-abtn--cyan` action, token void shell — structure is rubric-compliant |

**Self-correction at implementation (RED assumption falsified):** the RED table drafted from the census count assumed broader legacy debt; opening the file showed the early pass had already tokenized it. The honest scope is the single banned hit. Structural review found one additional rubric gap: tech status accents were already correct, no changes needed beyond the loader.

**Call-graph (Law 4):** `app/tech-tree/page.tsx` (5-line wrapper) → `TechTreeView`. Also imported by `app/game/page.tsx` as an embedded center view (game shell context). Redesign must be shell-agnostic: no assumptions about page background (embedded vs standalone).

## 3. Impact Analysis

- **Affected:** the research/unlock progression surface (RP spending), both as a standalone page and as an embedded game view.
- **Blast radius:** one view file (+ tiny CSS additions if a new primitive is required). Unlock logic, RP checks, and API calls untouched.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — header, RP summary, tier sections, unlock cards, locked/available states, loader, error/empty states |
| Scales? | Yes — token vocabulary already covers tabs/meters/panels; only composition changes |
| Hostile attacker? | N/A (presentation) |
| Maintainable? | Yes — one file, no new abstractions beyond a CSS primitive if needed |
| Industry standard? | Yes — same rubric as 6 already-redesigned surfaces |

## 5. Proposed Fix (GREEN)

1. Header → `.nn-sec` scanline instrument with `.nn-sec__title`/`__note` and RP balance as a `nn-num` HUD readout (violet signal — RP is violet domain per rarity mapping).
2. Tier groups → `.nn-panel` per tier with scanline headers; tier accent parametrized via `--nn-accent` (ascending rarity signals T1 common→T5 legendary).
3. Tech items → `.nn-unit` card family (already rarity-parametrized) with `nn-num` costs (amber metal / cyan energy semantics preserved where applicable), locked state via `.nn-unit__lock` with RP/level requirements.
4. Progress/affordance meters → `.nn-meter` where the view expresses RP progress.
5. Loader → gated `nn-spin`; kill gradient clipping; all numerals → `nn-num`.
6. Behavior preserved: unlock checks, purchase flow, refresh wiring byte-identical.

**Verification plan:** tsc 0; eslint 0 (file); vitest full; rubric greps; re-read for logic diff = 0.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | shell-agnostic rendering; logic diff = 0 | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied (`app/tech-tree/TechTreeView.tsx`):** removed the single banned hit — `animate-spin` on the Researching chip's Clock icon (spinning a clock glyph was also semantically wrong; the chip already communicates active state via cyan signal). All other structure verified rubric-compliant in re-read: `.nn-sec` scanline header with metal readout, `.nn-panel` cards with status/category `--nn-accent`, `.nn-chip` state badges, `.nn-num` tabular cost, `.nn-abtn--cyan` action, prerequisite chips with green/magenta semantics, effects ledger with green TrendingUp glyphs. Logic byte-identical.
- **Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps: 0 banned classes in file.
- **Audit Method 2:** rendered structure reviewed in both shells (standalone page + embedded game center view) — no page-background assumptions; logic diff = 0.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric greps
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/tech-tree/TechTreeView.tsx`
