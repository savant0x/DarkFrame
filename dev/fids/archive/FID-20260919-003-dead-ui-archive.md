# FID-20260919-003 — Dead-UI generation archived: 13 superseded components + orphaned tests

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (hygiene batch)
**Origin:** Operator directive executing the disposition recorded in
`dev/audits/PRODUCT-SURVEY-2026-09-19.md` §P2 ("archive-or-delete batch,
BalanceIndicator exempt pending P1"). No behavior change — dead code leaves
`components/`.

## 1. Premise (re-probed fresh, Law 16)

The survey's census was re-run today rather than trusted: each of the 13 named
components was grepped across `app/ components/ lib/ hooks/ context/` (tests
excluded). Results:

- 11 components: only reference is the `components/index.ts` barrel line.
- `BattleStatsPanel`: zero references anywhere.
- `HarvestStatus`: apparent "live" hits are false friends — the harvest service
  function `getHarvestStatus` and the separate live `TileHarvestStatus`
  component. The component file itself is barrel-only.
- The only `StatsPanel` references in `components/StatsPanel.tsx` — none; the
  `vi.mock('./BalanceIndicator')` / `vi.mock('./XPProgressBar')` entries in
  `StatsPanel.test.tsx` mock modules StatsPanel does not import (vestigial
  guards from an older StatsPanel generation).

All 13 are superseded UI (harvest moved to `HarvestModal`/`TileRenderer`;
battle flow moved to newer panels; XP/level HUD lives inside `StatsPanel`).

## 2. Scope

Move to `dev/archives/2026-09-19-dead-ui/` (project archive convention:
dated folders, manifest.json, README):

- 13 components: AutoFarmStatsDisplay, BalanceIndicator, BattleLogModal,
  BattleLogViewer, BattleStatsPanel, CombatAttackModal, FactoryButton,
  FundDistributionPanel, HarvestButton, HarvestStatus, LevelUpModal,
  PassiveIncomeDisplay, XPProgressBar (~3,151 lines).
- `components/HarvestButton.test.tsx` — orphaned with its component.
- Barrel: drop the 12 `components/index.ts` export lines (BattleStatsPanel was
  never exported).
- `StatsPanel.test.tsx`: delete the two vestigial `vi.mock` blocks (the mocked
  modules no longer resolve once archived).

**BalanceIndicator included:** the survey's P1 (STR/DEF balance effects are
invisible) is about the *mechanic* having no mounted surface. The mechanical
data layer (`balanceService`) is untouched — if the P1 decision later calls
for a balance surface, it will be designed against live store shapes, not
resurrected from a stale unmounted file. GitHub history preserves everything
regardless.

## 3. Not scope

- Any new UI (P1 mount decision belongs to the operator).
- `BattleResultModal.test.tsx`, `InventoryPanel.test.tsx`,
  `MovementControls.test.tsx`, `TileRenderer.protection.test.tsx` — their
  subjects are live; untouched.
- `lib/balanceService.ts` and every live consumer.

## 4. Pins / verification

Pure code movement: no unit pins added (nothing observable changed by design).
Verification is the gate set:

1. Fresh census: zero references to any moved name outside the archive dir.
2. Full vitest suite — pinning that the two `StatsPanel.test.tsx` mock blocks
   were truly vestigial (suite must stay green with them deleted).
3. `tsc --noEmit` 0 (barrel edits and mock deletions typecheck).
4. eslint clean on touched files (`components/index.ts`,
   `StatsPanel.test.tsx`).
5. Dev-server boot check is unnecessary (no runtime surface touched) —
   suite + tsc cover the graph.

## 5. Risks

- Lazy imports (`next/dynamic`, `React.lazy`) bypassing grep — checked: no
  dynamic import references any moved name.
- Barrel re-export consumers elsewhere (`from '@/components'`) — covered by
  tsc + suite after barrel edit.

## 6. Rollback

`git revert` of the batch commit; or move files back and restore barrel lines.

## 7. Notes

- Archive README carries the census date, method, and per-file line counts.
- manifest.json follows `dev/archives/2026-09-15-*/manifest.json` shape.

## 8. Execution

**Batch commit:** `9a46891` — 20 files changed (14 renames at 100% similarity,
README + manifest + this FID added, barrel + 2 test files edited).

**Gate results:**
- Fresh census post-move: zero references to any moved name outside the
  archive dir. Two residual strings are name-collisions only — the
  `HarvestStatusAPI` logger string (harvest/status route) and the unrelated
  `HarvestStatus` interface in `types/game.types.ts`.
- Full suite: 116 files / 1163 tests green. One failure surfaced mid-batch and
  was real: the slice-2 pin "harvest route has a live client caller" read
  `components/HarvestButton.tsx` — the *superseded* component — as evidence.
  The pin had been green only because it read a dead file. Corrected to cite
  the actual live callers (`HarvestModal.tsx`, `app/game/page.tsx`); suite
  green after correction.
- `tsc --noEmit` 0; eslint clean on touched files; tree clean at close.
