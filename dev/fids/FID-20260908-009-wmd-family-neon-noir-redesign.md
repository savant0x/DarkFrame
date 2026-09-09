# FID-20260908-009: WMD hub + five panels — legacy UI kit (Card/Badge/Button) with zero HUD structure

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-009-wmd-family-neon-noir-redesign.md`
**ID:** FID-20260908-009
**Severity:** MEDIUM (operator-named Wave A surface; strategic systems rendered entirely in the legacy kit)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The WMD family (`app/wmd/page.tsx`, `WMDHub`, `WMDMissilePanel`, `WMDDefensePanel`, `WMDIntelligencePanel`, `WMDResearchPanel`, `WMDVotingPanel`, `WMDNotificationsPanel`, `WMDMiniStatus`) was color-tinted in the FID-012 early pass but is structurally the legacy design system: 6 files import `Button/Card/Badge/Input` from `@/components/ui`, cards are `Card` slabs (rounded, shadowed, non-HUD), badges are filled slabs, loaders are tailwind `animate-spin`, and there is no scanline section language, no `--nn-accent` parametrization, no `nn-num` HUD numerals. FID-006's ruling: "they simply updated the colors but didn't fully redesign." WMD is threat-domain UI — it must speak the signal language (magenta=hostile/destructive, amber=armed/attention, cyan=systems, green=safe/complete, violet=intel).

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Legacy kit imports, 6 files | headers | `WMDHub:23`, `WMDMissilePanel:24-27`, `WMDDefensePanel:24-29`, `WMDIntelligencePanel:24-27`, `WMDResearchPanel:24-26`, `WMDVotingPanel:23-25`, `WMDNotificationsPanel:24-28` |
| 2 | `Card` slabs as primary containers | all five panels | non-token rounded/shadow cards |
| 3 | `Badge` filled slabs | all five panels | status pills with gradient/legacy fills |
| 4 | `animate-spin` loader | `WMDMissilePanel` | tailwind spin |
| 5 | No scanline sections / no `--nn-accent` / no `nn-num` | all | zero `nn-panel`/`nn-sec`/`nn-num` usage in the family |
| 6 | `WMDMiniStatus` (right-rail widget) | file | legacy glass + `Button` kit |
| 7 | `app/wmd/page.tsx` shell | 61 lines | legacy page wrapper |

**Call-graph (Law 4):** `app/wmd/page.tsx` → `WMDHub` → 5 panels (tab-style switch, Hub-owned state). `WMDMiniStatus` is mounted independently by `app/game/page.tsx` (right rail). `confirmDialog` (shared, keep). Consumers of Hub callbacks are internal to the family. WebSocket status comes from `useWebSocket` (`isConnected`) — untouched.

## 3. Impact Analysis

- **Affected:** missiles, defense grid, intelligence, research, voting, notifications — the full strategic layer — plus the right-rail mini status.
- **Blast radius:** 9 files, all presentation. WebSocket hooks, API calls, voting/launch flows byte-preserved.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — hub shell, all 5 panels, mini status, page wrapper; every state (loading/error/empty/armed) |
| Scales? | Yes — token primitives cover all patterns found (tables→nn-table, meters→nn-meter, rows→nn-row, threat→nn-threat) |
| Hostile attacker? | N/A (presentation); launch confirm flows unchanged |
| Maintainable? | Yes — mechanical kit-swap per file, one family FID |
| Industry standard? | Yes — same rubric as shipped surfaces |

## 5. Proposed Fix (GREEN)

Per file, mechanical kit migration:
1. `Card` → `.nn-panel` (+ `--nn-accent` per panel domain: missile=amber, defense=cyan, intelligence=violet, research=green, voting=magenta... finalized at implementation by each panel's function); `Card` headers → scanline `.nn-panel__header` with `.nn-panel__icon`/`__title`/`__meta`.
2. `Badge` status → `.nn-chip` with semantic variant (armed/threat = magenta `nn-threat` where the semantics are "hostile/armed state"); destructive actions → `.nn-btn--danger`/`--magenta`.
3. Primary/secondary `Button` → `.nn-btn`/`.nn-btn--primary`/`.nn-btn--ghost`; `Input` → `.nn-input`.
4. Stat blocks → `.nn-stat` + `.nn-num`; lists → `.nn-row`/`.nn-table`; progress → `.nn-meter`.
5. `animate-spin` → gated `nn-spin`; `rounded-*` → token square; remove `transition-*` micro-motion.
6. `WMDMiniStatus` → compact `.nn-panel` with `.nn-row` rows + connection `nn-chip`.
7. Behavior byte-preserved; `confirmDialog` retained (already token-adjacent).

**Verification plan:** tsc 0; eslint 0 (files); vitest full; rubric greps (0 kit imports, 0 banned classes); re-read each panel for logic diff = 0.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | per-panel logic diff = 0; signal-color mapping review | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:** all 8 files migrated off the legacy kit per §5 — `Card`→`.nn-panel` with per-domain `--nn-accent` (missile=amber/armed, defense=cyan/grid, intelligence=violet/intel, research=green/progress, voting=cyan/council), `Badge`→`.nn-chip` semantics, `Button`→`.nn-btn`/`.nn-abtn` (destructive = magenta only), `Input`→`.nn-input`, stats→`nn-num` readouts, type selectors→`.nn-ptab`/`.nn-tab` text-rule tabs (emoji tab icons removed from Hub), assembly/health/vote progress→`.nn-meter`, `animate-spin`→gated `nn-spin`, `WMDMiniStatus` alert dot squared (was the family's only `rounded-full`), page wrapper on token void.
- **En-route #36 remediation (7 `any`s):** WS payload handlers typed against the real contracts in `types/websocket.ts` (`WMDMissileLaunchedPayload`, `WMDMissileInterceptedPayload`, `WMDResearchCompletePayload`, `WMDSpyMissionCompletePayload`, `WMDVoteUpdatePayload`) — which falsified the old handler fields (`isYourMissile`, `defenderUsername`, `launcherUsername` never existed in the payloads; the server sends pre-composed `message` strings, so interception toasts now relay them verbatim). Research tech-tree flattening typed against `ResearchTech`; `aria-selected` removed from non-tab buttons (a11y rule).
- **Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps: 0 kit imports (only `confirmDialog` retained by design), 0 banned classes.
- **Audit Method 2:** per-panel signal audit — destructive/armed = magenta only, attention = amber, systems = cyan, success = green, intel = violet; no decorative glow. Logic diff = 0.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric greps
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/wmd/page.tsx components/WMDHub.tsx components/WMDMissilePanel.tsx components/WMDDefensePanel.tsx components/WMDIntelligencePanel.tsx components/WMDResearchPanel.tsx components/WMDVotingPanel.tsx components/WMDNotificationsPanel.tsx components/WMDMiniStatus.tsx`
