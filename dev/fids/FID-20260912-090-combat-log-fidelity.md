# FID-20260912-090 — Combat pipeline fidelity: real raids, real logs, readable history

**Date:** 2026-09-13 · **Type:** fix (combat + logging) · **Surfaces:** /api/combat/attack, /api/beer-bases/list, /api/battle-logs, game page readout, battle-logs pages

## The four bugs behind the report

**1. Attacking a beer base 403ed (no battle, no log, nothing).** The raid route verified
presence against `players.currentPosition` — bot-agent state that drifts. The tile the
player sees comes from `tiles.base_owner`. Three beer bases had drifted (e.g.
Blackened_Garrison's tile at 114,105 vs currentPosition 109,105), so standing ON the
visible base and attacking was rejected with no visible battle. The boot heal found the
drift was **endemic: 32 of 57 bot rows** had diverged position columns.

**2. On-tile result showed all 0s.** The readout mapped `data.battle.attackerDamageDealt`
— a flat field that doesn't exist (real shape: `battle.attacker.damageDealt`). Every
victory rendered zeros.

**3. Raid logs could never show resources.** The route persisted the battle log BEFORE
crediting loot and never set `battleLog.resourcesStolen` — so every PvE raid row read
"No resources gained/lost" forever. Fixed ordering: loot + XP computed and stamped on
the log → persist → credit → bookkeep.

**4. History page lied three ways.** Only the viewer's casualties rendered (a 1.34M-vs-
143K victory legitimately costs 0 — but the defender lost 1,376, which was hidden);
bot battles with no recorded location rendered fake "(0, 0)"; and cards were not
clickable, so the full report (rounds, HP curves, damage, XP, captures) was unreachable.

## Fixes

- **`lib/baseTilePosition.ts`** — the single seam for "where is this base?": resolves
  from `tiles.base_owner` (one query, batch helper for lists) with players-row fallback.
  Wired into `/api/combat/attack` presence + battle location, and `/api/beer-bases/list`
  distance + scan gating.
- **`lib/migrations/basePositionResync.ts`** (`0031_base_position_resync`) — boot
  self-heal pinning every tile-owning bot's `currentPosition/baseX/baseY` to its tile.
  Live result: **32 of 57 rows healed; drift re-check = 0**.
- **`/api/combat/attack`** — loot (3× beer multiplier, FID-038 resource selection) and
  doc-faithful XP now stamped onto `battleLog.resourcesStolen` / `attackerXP` **before**
  `persistBattleLog`; the post-victory block only credits + bookkeeps.
- **Readout mapping** — `battle.attacker?.damageDealt` / `defender?.damageDealt`,
  XP from rewards or the log.
- **`/api/battle-logs`** — ships the full-report fields (battleType, rounds, HP
  start→end, damage both ways, XP both sides, captures).
- **battle-logs page** — cards are **click-to-expand full battle reports** (keyboard
  accessible, aria-expanded); casualties show **both sides** ("you X · enemy Y");
  missing locations render "—", never "(0, 0)".

## Follow-up (090b): the tutorial combat quest could never finish

Same report, deeper layer: quest 3 ("First Battle") stalled at step 2/3 even after a real
raid, because **neither beer-base step had a writer anywhere**:

- `Find a Beer Base` (CUSTOM/`find_beer_base`) validated `validationData.requirementMet === true` —
  but the field was **set by nothing**: no enrichment case in `completeStep`'s CUSTOM
  switch, no client signal, no tracking row. Unconditionally false forever.
- `Attack the Base` (ATTACK/`targetType: beer_base`) validated fine — but
  `/api/combat/attack` (the only endpoint that resolves that attack) was **tutorial-blind**;
  only MOVE and HARVEST routes feed steps today.

Fix: two server-side hooks in tutorialService (same contract as `recordTutorialHarvest`,
non-throwing, replay-guarded by completeStep's already-completed no-op):

- `recordTutorialBeerBaseFound(playerId)` — presence at a base completes the find step.
- `recordTutorialBaseAttack(playerId, victory)` — a resolved raid completes the attack
  step (the step declares no `requireSuccess`; the tutorial teaches the action, not a win).

Both wired into `/api/combat/attack` after battle resolution. Tests (5) pin the validator
contracts and the step shapes that make the hooks correct.

## Gates

tsc 0 · eslint 0 · vitest **683** (11 + 5 new: heal classification on the live drift
fixture, presence-vs-tile contract, raid loot stamping, route resource mapping,
tutorial validator contracts) · build clean · heal verified live (32 rows, 0 remaining
drift).
