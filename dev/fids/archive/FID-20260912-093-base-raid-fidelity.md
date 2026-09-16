# FID-20260912-093 — Base-raid combat fidelity, correct labeling, and the once-per-reset rule

**Filename:** `FID-20260912-093-base-raid-fidelity.md`
**ID:** FID-20260912-093
**Severity:** HIGH
**Status:** closed
**Created:** 2026-09-13

**Date:** 2026-09-13 · **Type:** fix/feature (combat pipeline) · **Follows:** FID-090 (base-tile seam), FID-038 D4 (raid resource choice)

## Problem

Base attacks were a fake battle wearing a factory's uniform. The user's report, each root-caused:

1. **"Factory under control" on a base hit.** `/api/combat/attack` resolved raids as `BattleType.Factory`, so every readout, notification, feed row, and log headline called base raids FACTORY. The TileRenderer's shared readout compounded it with "FACTORY NOW UNDER YOUR CONTROL" copy and a "Factory defense" label for what was actually garrison damage.
2. **No real battle.** Casualties were cosmetic — `resolveBattle` counted losses into the log, but nothing ever decremented the attacker's army. Worse, `applyBattleResults` (the PvP seam) picked casualties by slicing the units array front-to-back (order-dependent, type-blind), and PvE raids granted a 10–15% unit-capture lottery — the dead garrison would have teleported into the attacker's army if results had been applied.
3. **Unlimited re-raids.** Nothing stopped hammering the same base every 300 ms — the loot payout had no per-period gate.
4. **Flag bearer could attack players.** The §5.5 restricted list covered economy actions only; nothing blocked the bearer from initiating PvP.
5. **Admin nav vanished.** `getPlayerSlim` (the FID-043 slim read used by every move response) hardcoded `isAdmin: false` — the TopNavBar Admin item disappeared the moment moves went slim. The DB had `fame.is_admin = 1` the whole time.
6. **Base greetings never written.** Neither spawn path (`claimBotBaseTile` nor the beer-base reclaim) ever set `tiles.base_greeting` — every base on the map rendered the "Base message" well empty. Live check: all occupied tiles silent.
7. **Recent Raids mislabeled.** The feed parsed the notification headline (which said FACTORY) — base hits displayed as 🏆 FACTORY rows.
8. **Battle reports crushed in chat.** The 70% message bubble squeezed the round-by-round table and forces-committed columns into an unreadable sliver (user screenshot).

## Fixes

### Combat fidelity (the "real battle")
- `BattleType.BaseRaid = 'BASE_RAID'` — a distinct enum value so the whole pipeline can label raids honestly. The raid route resolves with it.
- `resolveBattle` now takes an options object (`{ attackerLevel, defenderLevel, applyCasualties }`) — both built-in callers (`executeInfantryAttack`, `executeBaseAttack`) pass levels properly, so **level-gap damage protection is wired for base raids** (both sides previously always fought at level 1 = no protection).
- `casualtiesByType` on both battle participants — per-unit-type loss tallies, derived from the same casualty sets the HP loop built (sum = `unitsLost`, CI-pinned).
- `applyAttackerCasualties` (new export): decrements the attacker's inventory **per type** after a raid and recomputes totalStrength/totalDefense. Raid casualties now come off your army. `applyBattleResults` (PvP) also switched to the per-type decrement with a legacy-log fallback.
- `applyCasualties: false` for raids: no unit capture in PvE — loot is the reward, no garrison teleportation.

### Once per reset
- Raid route queries `battle_logs` for ANY prior raid by this attacker on this defender within the current reset period (mirrors `getCurrentResetPeriod`: tiles x≤75 reset midnight "AM", others noon "PM"). Found → 429 with an explicit message. Win or lose, the garrison knows who came.

### Flag bearer
- `/api/combat/infantry` blocks a holder from initiating a PvP attack (defense via challenge/steal channel unaffected). Non-fatal on flag-service failure.

### Labels everywhere
- Notification headline maps `BASE_RAID → 'BASE RAID'`.
- Recent Raids feed: BASE_RAID rows read "BASE RAID" (FACTORY rows stay FACTORY).
- Battle-logs page: BASE_RAID renders "base raid".
- TileRenderer readout on enemy-base tiles: "Damage dealt / Garrison damage / Your losses / Enemy losses / LOOT: …" and "BASE DEFEATED — LOOT SECURED" (factory tiles keep the capture copy). Game page feeds the readout real casualty counts and loot from the battle log.

### Admin nav regression
- `getPlayerSlim` selects `players.isAdmin` and maps `row.isAdmin === 1` (was hardcoded `false`). Verified live: Admin back in the nav.

### Randomized greetings
- `lib/baseGreetings.ts`: 15 beer-base lines (🍺 brewery-crew voice) + specialist warband pools (Hoarder 🪙 / Fortress 🛡 / Raider ⚔️ / Ghost 👻 / Balanced ⚖️ / Boss 👑) + 5 generic fallback lines. Written at claim time in `claimBotBaseTile` (beer flag + specialization passed from both spawn paths).
- Migration `0032_base_greeting_resync` (boot, drift-guarded): backfills every occupied-but-silent tile. Live result: **0 silent tiles**.

### Full-width battle reports
- `MessageThread` bubbles render `w-full` for `battle_result`/`war_result` system messages (70% for normal chat). Live-verified: report cards render 669px in a 709px column vs the old ~496px sliver.

## Tests

`__tests__/lib/baseRaidFidelity.test.ts` (18): per-type tallies sum to totals; no-capture on `applyCasualties:false`; default capture still 10–15% for PvP; `applyAttackerCasualties` per-type decrements / group removal / total recompute; BASE RAID headline (real formatter via `importActual`); period-math boundaries (AM midnight, PM noon-today, PM-before-noon = yesterday-noon, block/allow comparisons); greeting voice pools + 500-char column bound.

## Verification

- Gates: tsc 0 · eslint 0 · vitest **723 passed** (18 new) · build clean.
- Live: server restarted on the new build; heal reports 0 silent tiles; Admin nav present for `fame`; battle report cards measured full-width in the messages preview.

## Follow-up: FID-093b — old rows still said FACTORY, reports still half-width

Post-merge verification caught two residues:

1. **Stored data, not rendering, was wrong.** The 11 historical battle_logs rows + 9
   system messages were written before the relabel — labels render from stored
   values. And the real factory-capture path (`/api/factory/attack`) never writes
   battle_logs rows at all, so **every** FACTORY row whose defender is a bot base
   is provably a mislabeled raid. Migration `0033_base_raid_label_backfill`
   relabels them (`is_bot = 1` OR the bot-name fingerprint — destroyed beer bases
   have no players row to join, but the compact `b<tier><ts12>` / themed name is
   unambiguous), rewrites the message headlines, AND the third cache:
   `conversations.last_message_content` inbox previews. Live result: 18 logs, 9
   messages, 4 previews relabeled; **0 FACTORY rows or headlines remain**.
2. **The card had its own cap.** `.nn-battle-report { max-width: 420px }` fought
   the bubble fix; now `max-width: 100%`. The messages PAGE also centered a
   `max-w-7xl` (1280px) island — now full window width. Also fixed: the feed
   matched only `'BASE_RAID'` but parsed headlines say `'BASE RAID'` — both map
   to the label now.

Tests: `baseRaidLabelBackfill.test.ts` (6) pins the backfill classifiers, the
feed spelling map, the CSS uncapping, and the page-width contract.

## Notes for the future

- Historical rows keep `battle_type='FACTORY'` — they render as FACTORY (honest: that's what the code called them then); new raids are BASE_RAID.
- A counting-ATTACK tutorial step must never be added without a writer — see FID-091's diagnostic + contract tests for the trap.
