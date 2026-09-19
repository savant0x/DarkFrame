# Dead-UI archive — 2026-09-19 (FID-20260919-003)

Thirteen superseded UI components (~3,150 lines) plus one orphaned test file,
moved out of `components/` after a fresh importer census proved them unmounted:

- Census method: grep for each component name across `app/ components/ lib/
  hooks/ context/` (tests excluded), plus a dynamic-import (`next/dynamic`,
  `React.lazy`, `import(`) sweep. Only references found were the
  `components/index.ts` barrel lines, which were removed in the same batch.
- `HarvestStatus.tsx` note: live-looking grep hits ("HarvestStatus") belong to
  the `getHarvestStatus` service function and the separate live
  `TileHarvestStatus` component — not this file.
- `HarvestButton.test.tsx` traveled with its component.
- `StatsPanel.test.tsx` stayed live but lost two vestigial `vi.mock` blocks
  (`./BalanceIndicator`, `./XPProgressBar`) that mocked modules StatsPanel
  does not import. A negative assertion (`xp-progress-bar` absent) remains and
  is still true.

## Files

| File | Lines | Superseded by |
|---|---|---|
| AutoFarmStatsDisplay.tsx | 271 | AutoFarmPanel surfaces |
| BalanceIndicator.tsx | 124 | (mechanic UI decision open — survey P1) |
| BattleLogModal.tsx | 194 | newer battle panels |
| BattleLogViewer.tsx | 455 | BattleHistoryFeed / BattleLogLinks (both live) |
| BattleStatsPanel.tsx | 33 | newer battle panels |
| CombatAttackModal.tsx | 467 | newer attack flow |
| FactoryButton.tsx | 272 | unit-factory page |
| FundDistributionPanel.tsx | 464 | newer fund surfaces |
| HarvestButton.tsx | 169 | HarvestModal / TileRenderer |
| HarvestButton.test.tsx | — | orphaned with component |
| HarvestStatus.tsx | 133 | TileHarvestStatus (live) |
| LevelUpModal.tsx | 229 | StatsPanel level/XP HUD |
| PassiveIncomeDisplay.tsx | 295 | StatsPanel surfaces |
| XPProgressBar.tsx | 145 | StatsPanel XP HUD row |

## BalanceIndicator caveat

Archived here for hygiene, not as a product verdict: the STR/DEF balance
mechanic (`lib/balanceService.ts`) is live and load-bearing, and the survey's
P1 asks whether players need a visible balance surface. If that decision lands
"yes", design the new surface against current store/prop shapes instead of
resurrecting this file — GitHub history keeps it either way.

## Restoration

`git log --follow dev/archives/2026-09-19-dead-ui/<file>` for history; move
back and re-add the barrel export if ever needed.
