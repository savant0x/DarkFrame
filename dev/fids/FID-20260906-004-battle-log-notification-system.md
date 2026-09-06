# FID-20260906-004: Battle Log Persistence + Defender Battle-Result Notifications

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields (Document Signing rule wins).
-->

**Filename:** `FID-20260906-004-battle-log-notification-system.md`
**ID:** FID-20260906-004
**Severity:** HIGH (players currently have zero visibility into being attacked)
**Status:** converged
**Created:** 2026-09-06

---

## 1. Summary

`battle_logs` has **0 rows** despite writers existing. The routes a player actually
uses (`/api/battle/attack`, `/api/combat/attack`) persist only a **zero-filled shadow
row** via `battleTrackingService.recordBattle` — every unit/casualty/damage field is
hardcoded 0/empty — while the real `BattleLog` from `resolveBattle` is discarded.
`/api/combat/infantry` (via `executeInfantryAttack`) is the only full-data writer, and
no defender is ever notified that they were attacked. Operator requirement: "ensure
players get battle log messages when attacked showing the result of the battle."

## 2. Findings (RED evidence — file:line)

### B1 — Shadow persistence discards the real battle log
- `app/api/battle/attack/route.ts:79` and `app/api/combat/attack/route.ts:121` call
  `recordBattle({ attacker, defender, winner, attackerPower, defenderPower, ... })`
  after `resolveBattle(...)` returns a **complete `BattleLog`** (units, HP curves,
  casualties, rounds) which is then only echoed in the HTTP response.
- `lib/battleTrackingService.ts:36-77`: `recordBattle` inserts
  `attackerUnits: []`, `attackerTotalDEF: 0`, `attackerInitialHP: 0`, … all zeros —
  a row shape useless for the BattleLogViewer and for battle history.

### B2 — Persistence is not a seam
- `resolveBattle` (`lib/battleService.ts:237`) itself never persists; persistence
  lives inside `executeInfantryAttack` (:579) and `executeBaseAttack` (:754) only.
  Any future caller of `resolveBattle` silently produces no history (exactly the
  bug class that emptied this table).

### B3 — No defender notification exists
- No code path notifies a defender of an attack (grep: no notification writer in any
  battle route/service). The `messages`/`conversations` tables
  (`lib/db/schema/messages.ts`) already model system messages:
  `metadataSystemType varchar(20)`, `metadataRelatedEntityId`, per-recipient
  `unreadCount` jsonb — an unused seam.

### B4 — Live confirmation
- `SELECT COUNT(*) FROM battle_logs` → **0** on the production-shared DB.

## 3. Five Questions (RED)

1. **What breaks if we do nothing?** Players never learn they were attacked; the
   BattleLogViewer/`/api/logs/battle` UIs render empty forever; balance work
   (FID-006) has no combat data to measure.
2. **Why now?** The flag/battle loops need a working feedback loop; this is the last
   unbuilt leg of the combat UX.
3. **Who is affected?** Every attacker (no history), every defender (no warning),
   admins (no moderation evidence).
4. **Smallest correct change?** One persistence seam + route calls + one
   notification seam. No schema change (columns already exist).
5. **What must NOT change?** Battle resolution math, RP awards, analytics
   (`recordDefeatEvent`), existing read APIs.

## 4. GREEN Design

### D1 — `persistBattleLog(battleLog)` seam (lib/battleService.ts)
- Exported next to `resolveBattle`; wraps `battleLogToDbInsert` + insert;
  non-fatal on failure (log + swallow — a battle must never 500 because history
  failed to write).
- `resolveBattle` callers now persist:
  - `/api/battle/attack`: replace the `recordBattle({...})` shadow call with
    `await persistBattleLog(battleLog)`.
  - `/api/combat/attack`: same replacement.
- `recordBattle`'s battle_logs write is **removed** (it duplicates persistence with
  junk data); `getPlayerBattleStats` reads `battle_logs` and keeps working off the
  real rows. `executeInfantryAttack`/`executeBaseAttack` switch their inline inserts
  to the same seam (one write path, one fix point).

### D2 — `notifyBattleResult(battleLog)` seam (new lib/battleNotification.ts)
- On every persisted battle where the defender is a real player (not a bot/base),
  write a system message into the defender's inbox using the existing
  `conversations` + `messages` tables directly:
  - find-or-create a 1:1 conversation between `SYSTEM` and the defender;
  - insert a message with `senderId='SYSTEM'`, `contentType='system'`,
    `metadataSystemType='battle_result'`, `metadataRelatedEntityId=battleId`,
    `content` = compact result line (outcome, attacker, casualties, HP);
  - bump the defender's `unreadCount` jsonb for that conversation.
- Non-fatal (try/catch), called once per battle from `persistBattleLog` so every
  future caller inherits notifications for free.
- System conversations are hidden from the composer (recipient `SYSTEM` never
  matches a players row in search — verified) and render in the existing inbox UI.

### D3 — Outcome vocabulary
- `BattleOutcome` enum (`ATTACKER_WIN`/`DEFENDER_WIN`/`DRAW`) serializes into
  `battle_logs.outcome varchar(20)` — fits, unchanged.

## 5. Verification plan (GREEN)

1. Live probe: attacker + defender accounts; `/api/combat/infantry` attack →
   `battle_logs` row with real units/casualties (not zeros); defender's inbox has a
   `battle_result` system message with unread ≥ 1.
2. `/api/battle/attack` (base) → full-data row (no more shadow zeros).
3. Re-attack → second row + second message (idempotency not required — logs append).
4. `GET /api/logs/battle` returns the persisted rows (reader parity).
5. Gates: tsc 0, tests green, lint 0 on touched files.

## 6. Loop record

- **Pass 1 (RED):** B1–B4 verified live (0 rows; shadow-writer code read in full;
  message schema read in full — `metadataSystemType` confirmed absent from any
  writer today).
- **Pass 2 (GREEN convergence):** D1 seam placement audited — all four current
  resolveBattle call sites route through one of: executeInfantryAttack (own insert),
  executeBaseAttack (own insert), or the two attack routes (recordBattle). Moving
  all four to `persistBattleLog` leaves zero unpersisted paths. D2 notification
  rides the same seam; SYSTEM sender verified non-real (players search +
  foreign-surface check). No knob without a finding; no finding without a knob.
  **Status: converged.**
- **Pass 3 (IMPLEMENT + live verification, §5 executed):**
  - `persistBattleLog` seam shipped; both attack routes + both execute* paths use it;
    `recordBattle` battle_logs write retired (stats reader keeps working off real rows).
  - Live probe (owner army restored, probe defender adjacent): attack 200 → battle_logs
    0→2 rows across two runs with REAL data (attacker_units=40 stacks, HP curve
    400→395 vs 200→0, outcome ATTACKER_WIN — no shadow zeros).
  - Defender notification verified in the inbox: SYSTEM conversation created,
    unread_count bumped to 1, message `metadata_system_type='battle_result'`,
    `metadata_related_entity_id` = the battleId, human-readable result text.
  - Bug caught by the probe (loop working as intended): conversation/message ids were
    32-char UUID-hex vs varchar(24) — the insert failed non-fatal; fixed with
    `slice(0,24)`; re-run green 10/10.
  - Note: `getPlayerBattleStats`' zero-filled rows never existed on this DB (table was
    empty), so retiring the shadow writer breaks nothing.
  - Gates: tsc 0 · 341/341 tests · lint 0 on all touched files.

**Status:** converged
