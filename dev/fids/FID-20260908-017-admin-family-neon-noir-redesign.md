# FID-20260908-017: Admin family — neon noir rubric remediation

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-017-admin-family-neon-noir-redesign.md`
**ID:** FID-20260908-017
**Severity:** MEDIUM (display-debt; Phase 6 estimated ~40 across the family)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The admin family (18 files, ~11k lines) was largely migrated by FID-013's kit pass —
`app/admin/AdminView.tsx` (3,550 lines) and `components/admin/ModerationPanel.tsx` (1,008) already
census at **0**. The remaining residue across 14 files is 26 core banned-class instances plus ~40
wider chrome defects the core pattern misses. Per operator mandate: **hand migration only —
absolutely no scripts** (reaffirmed explicitly this session). Each file is edited by hand with
per-file tsc/census verification.

## 2. Evidence (RED)

### 2.1 Corrected census (core pattern + wider chrome)

| File | Core | Wider defects |
| ---- | ---- | ------------- |
| app/admin/referrals/page.tsx | 3 | `from-gray-900 via-violet to-gray-900` shell; gradient `bg-clip-text` hero; un-gated spin; `focus:border-cyan-500` stray; doubled bg in filter-button inactive ternary; status badges pill-styled |
| app/admin/vip/page.tsx | 7 | 2 × `from-gray-900 to-black` shells; 5 gradient revenue cards (**4 are same-color no-ops** green→green/cyan→cyan/amber→amber/magenta→magenta); doubled backgrounds ×3 (dashboard btn, pkg toggle pair, webhook copy) |
| components/admin/ClanInspectorModal.tsx | 3 | gradient cyan→violet header strip; 2 un-gated spins (RefreshCw + Loader2); HealthTab 4 × `rounded-full` meters; TabButton inactive doubled bg |
| components/admin/BattleLogsModal.tsx | 1 | un-gated spin; 4 × `focus:border-purple-500` (text/select/date inputs) |
| components/admin/FactoryInspectorModal.tsx | 1 | un-gated spin; 5 × `focus:border-purple-500` |
| components/admin/PlayerDetailModal.tsx | 1 | un-gated spin (border-t variant) |
| components/admin/TileInspectorModal.tsx | 1 | un-gated spin |
| components/admin/AchievementStatsModal.tsx | 1 | un-gated spin |
| components/admin/charts/ActivityTimeline.tsx | 1 | un-gated spin; 2 rounded-full legend dots |
| components/admin/charts/BotPopulationTrends.tsx | 1 | un-gated spin; 7 rounded-full legend/status dots |
| components/admin/charts/FlagBreakdown.tsx | 1 | un-gated spin; 4 rounded-full legend dots |
| components/admin/charts/ResourceGains.tsx | 1 | un-gated spin; 2 rounded-full legend dots |
| components/admin/charts/SessionDistribution.tsx | 1 | un-gated spin |
| components/admin/WebSocketConsoleModal.tsx | 0 | clean |
| **Totals** | **26 core** | **~40 wider** |

Already clean (FID-013): AdminView, ModerationPanel, SystemResetModal, app/admin/page.tsx.

### 2.2 Migration targets (token primitives, established idioms)

- Spinner → `Loader2`/`RefreshCw` + gated `nn-spin-icon` (FID-010/015 idiom).
- Gradient shells → flat `var(--nn-void)`; gradient hero → flat `nn-num nn-text-magenta` Orbitron
  title (referrals page matches admin-family priority chrome).
- Revenue gradient cards → `nn-stat` instruments with glow numerals (kills 4 same-color no-ops).
- `nn-input` replaces hand-rolled inputs → kills all `focus:border-*` raw-Tailwind strays.
- `nn-tabchip` for filter rows; `nn-meter` + `nn-meter__seg--green/amber/cyan/vio` for HealthTab
  meters; square token dots for chart legends (HUD is squared; legend keys follow).
- Status pills → `nn-chip` variants; doubled backgrounds → single token surface.
- Logic byte-preserved: fetch, confirm flows (confirmDialog retention), flag/validate/invalidate
  handlers, CSV/JSON export, tab switching, package/price local state.

## 3. Impact Analysis

- **Affected:** 14 files restyled; zero logic changes. Admin-only surfaces — no player-facing
  blast radius.
- **Blast radius:** none server-side; no token additions needed (all required primitives exist).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — post-migration census of all 18 admin files must be 0 core / 0 wider defects |
| Scales? | Yes — established primitives only |
| Hostile attacker? | N/A (display); admin confirm flows untouched |
| Maintainable? | Yes — same token system; hand-edited per operator mandate |
| Industry standard? | Yes — FID-006 rubric |

## 5. Proposed Fix (GREEN)

Hand-migrate in per-file passes (tsc + census after each): (1) app/admin/referrals; (2)
app/admin/vip; (3) ClanInspectorModal; (4) the five inspector/log modals (BattleLogs, Factory,
PlayerDetail, TileInspector, AchievementStats — spins + purple focus via nn-input); (5) the five
chart panels (spins + square legend dots). Then gates: tsc 0 · eslint 0 (family) · vitest ·
census 0.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint (family) / vitest / rubric greps | tsc 0 · family eslint 0 · vitest 362/0/1 · census 0 (pasted in §7) | pass |
| Method 2: manual re-read | per-file tsc+census between each edit; handler census HEAD↔working (className/type-level edits only) | all identical | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete — hand-migrated file by file (no scripts), per-file verification between each.
- **Changes applied:**
  1. `app/admin/referrals/page.tsx` — `gray-900` gradient shell → `var(--nn-void)`; gradient `bg-clip-text` hero → Orbitron token title; 5 gradient stat cards (4 same-color no-ops) → `nn-stat` instruments; table → `nn-table`; `focus:border-purple-500` → `nn-input`; spinners → `Loader2` + gated `nn-spin-icon`.
  2. `app/admin/vip/page.tsx` — same shell/hero treatment; form controls → `nn-input`/`nn-btn`; status → `nn-chip`.
  3. `components/admin/ClanInspectorModal.tsx` — gradient header → token strip; 2 spins gated; 4 `rounded-full` meters → `nn-meter` (added `nn-meter__seg--amber` to `app/neon-noir.css`, following the documented seg-variant pattern); TabButton doubled bg fixed.
  4. Files 4–8 — AchievementStatsModal, BattleLogsModal, FactoryInspectorModal, PlayerDetailModal, TileInspectorModal: all un-gated `animate-spin` → `Loader2` + `nn-spin-icon`; `focus:border-purple-500` inputs → `nn-input` (imports hand-added).
  5. Files 9–13 — the five chart panels: spins → `Loader2`; `rounded-full` legend dots → `rounded-none`.
  6. In-scope lint remediation (family zero-error gate): 5 recharts tooltip/label `any`s typed honestly against their datum shapes (`TooltipEntry` interfaces; FlagBreakdown label aligned to recharts' `PieLabelRenderProps` contract); WebSocketConsoleModal `LogEntry.data`/`addLog` `any` → `unknown` with an explicit null/undefined render gate.
- **Gate-caught defects during the loop (all fixed by hand):**
  - My spin replacements in 4 charts used `Loader2` **without adding the import** — `react/jsx-no-undef` (runtime crash class) caught by family eslint; imports added.
  - My ResourceGains tooltip-typing replacement accidentally **swallowed the null-guard and datum lines** — caught as unused-args errors; restored.
  - FlagBreakdown label typing initially violated recharts' `PieLabelRenderProps` (TS2769) — retyped structurally.
  - `data?: unknown` broke the `log.data && (...)` render (TS2322 `unknown` → `ReactNode`) — explicit gate added.
- **Gates:** tsc 0 · eslint (app/admin/ + components/admin/) 0 · vitest **362 passed / 0 failed / 1 skipped** · rubric census **0** across app/admin/ + components/admin/ (was 26 core + ~40 wider chrome defects).
- **Audit Method 2:** handler census identical HEAD↔working on all touched files; the only non-class changes are honest type narrowings.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 (family) · [x] tests pass · [x] rubric census 0
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/admin/referrals/page.tsx app/admin/vip/page.tsx components/admin/ dev/fids/FID-20260908-017-admin-family-neon-noir-redesign.md dev/fids/FID-20260908-006-neon-noir-full-internal-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** remaining Wave B long tail (leaderboard 27, shop 16,
  map family 35) then the Phase 7 re-audit.
