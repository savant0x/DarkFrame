# FID-20260911-045 — RP Source Live Verification, HUD Battle Feed & Admin Toast Audit

**Date:** 2026-09-11 · **Trigger:** three user requests — (1) play harvest milestones + a
battle in the running game and confirm every RP source credits with a correct `source`
label and the daily cap holds; (2) compact HUD battle-history feed from `battle_result`
messages; (3) "Spawn 10 bases" toasts `[object Object]`.

## Task 1 — RP economy live verification (the headline result)

**The harvest-milestone RP source was completely dead.** Three stacked defects:

1. **Table never existed.** `checkDailyHarvestMilestone` (raw SQL) targeted
   `dailyHarvestProgress` — a Mongo/MySQL-era name with **no Postgres table**. Every
   harvest's milestone check threw "relation does not exist".
2. **Swallowed by design.** `harvestService` wraps the call in a non-fatal catch, so
   the error vanished — matching fame's rp_history showing zero `harvest_milestone`
   rows despite millions harvested.
3. **Two more bugs lurked behind it** (found during the fix): the upsert was MySQL
   syntax (`ON DUPLICATE KEY UPDATE … VALUES()` — dead on Postgres), and the row reads
   used the camelCase keys the SQL *writes* instead of the lower-case names Postgres
   *folds* them to — counts would have reset to 1 on every harvest.

**Fix:** migration **0024** creates `dailyharvestprogress` (lower-case physical names,
UNIQUE (playerusername, date, resetperiod)); service rewritten to `ON CONFLICT … DO
UPDATE` with folded-key reads.

**Live verification** (`scripts/verify-rp-sources.ts`, drives the real server + DB):

| Source | Evidence (live row) | Verdict |
|---|---|---|
| `harvest_milestone` | +1500 "Daily harvest milestone: 1,000 harvests" after 2 real API harvests crossing 1,000 — exactly **500 base × 1.5 VIP × 2 flag-bearer** (FID-20260906-001 §5.4 stack) | PASS |
| daily cap | with all six thresholds completed, a *real successful harvest* (fresh tile, verified HTTP 200 `success:true`) awards **zero** milestone RP | PASS |
| `battle` | +1200 "Victory against Titan_Gamma (Base Raid)" — live raid through `/api/combat/attack` | PASS |
| `daily_login` | +300 "Daily login reward (1 day streak)" — live from FID-043's session wiring | PASS |

(Verification-script note: the first cap attempt was a false PASS — the harvest
soft-failed on per-tile cooldown, so the cap was never exercised. The script now
relocates to a fresh Metal/Energy tile and asserts `success:true` before the cap
claim. Every threshold crossed re-awards once per AM/PM period — that is the
documented 6–12k/day envelope, not a bug.)

## Task 2 — HUD battle-history feed

- **`app/api/player/battle-history/route.ts`** (new): session-auth'd; joins
  `messages × conversations` on `metadata_system_type='battle_result'` within the
  caller's SYSTEM 1:1 threads; parses headline+meta **server-side** and returns slim
  summaries (battleType, location, outcome, rounds, battleId, reportedAt) — no report
  bodies on the wire (egress rule: ~40 bytes/row, not 39 KB rows).
- **`components/BattleHistoryFeed.tsx`** (new): "Recent Raids" HUD panel in the
  bottom-left `battleLogs` slot alongside BattleLogLinks. Outcome-tinted NEON NOIR
  rows (green/magenta/amber). 60s poll, paused on hidden tabs, silent failure
  (advisory-poll contract).
- Live-verified on :3001 — fame's two real raids summarize correctly (VICTORY at
  145,21; DEFEAT at 44,2). Feed keys are `reportedAt-battleId` because live data
  showed battle IDs repeating across separate battles.
- `.nn-battlefeed*` styles appended to `app/neon-noir.css` (tokens only).

## Task 3 — AdminView toast audit (the `[object Object]` class)

FID-041's census covered components/ but missed **app/admin/AdminView.tsx: 16 raw
`data.error` / `data.message` template sites** rendering `[object Object]` on every
structured rejection. The user's "Spawn 10 bases" toast was exactly this: the
bot-spawn/beer-respawn routes return `createErrorResponse` → `{error:{code,message}}`.

**Fix:** all sites now go through `extractApiError(data, res.status)`; the bot-spawn
success toast (which read a nonexistent `data.spawned` → "Successfully spawned
undefined bots!") now derives the count from `data.bots.length`.

## Perfection loop

Gates re-run after every batch: targeted tests → full suite → tsc → eslint → build →
live :3001 verification. Parser regex surrogate-pair bug and the cap-check false
positive were both caught and corrected *by the loop itself* before sign-off.

## Gates

- tsc 0 · eslint 0 · vitest **499 passed / 1 skipped** · build exit 0
- Live: milestone crossing, cap hold, battle RP, and the feed endpoint all verified
  against the production build on :3001
