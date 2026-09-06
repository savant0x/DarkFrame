# FID-20260906-004: Battle-Log Pipeline & Attacker Notification

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-004-battle-log-notification-system.md`
**ID:** FID-20260906-004
**Severity:** HIGH (players must see battle results; operator directive)
**Status:** created (RED mostly complete; one live probe outstanding)

---

## 1. Summary

Operator directive: "audit the attack system and battle log system; ensure players get battle
log messages when attacked showing the result of the battle." RED evidence shows the writers,
readers, and UI for battle logs all exist — but the pipeline has never been proven
end-to-end, and there is **no push notification to a defender** when they are attacked.

## 2. Findings (RED — file:line, live-verified where noted)

### B1 — `battle_logs` is EMPTY (0 rows, live-checked)
- Writers exist: `lib/battleService.ts:557,732` (`resolveBattle` inserts via
  `battleLogToDbInsert`, :381), `lib/battleTrackingService.ts:36` (`recordBattle`).
- Consumers exist: `app/api/logs/battle`, `app/api/logs/player/[id]`, `app/api/stats/battles`,
  `app/api/combat/logs`, `components/battle-logs/*`.
- Attack routes that should write: `app/api/battle/attack` (PvP/base — exports verified earlier),
  `app/api/combat/attack` (Beer Base, calls `recordBattle` :121), `app/api/flag/attack`
  (writes NO battle log — separate decision below), `app/api/factory/attack`.
- **Not yet proven:** whether inserts fail (column contract) or no battle has run on this DB.
  FIRST implementation step: drive one live Beer-Base battle and one PvP battle, observe.

### B2 — Flag attacks bypass the battle-log system entirely
- `app/api/flag/attack/route.ts` (post-§7.2): updates HP/flags, returns a message; never
  inserts `battle_logs` nor notifies the (player) bearer.

### B3 — No defender notification on any attack
- `lib/wmd/notificationService.ts` exists for WMD only. For combat: no insert into
  `notifications` table (schema `lib/db/schema/notifications.ts` exists) from any attack route;
  no WebSocket emit for battle events (`context/WebSocketContext` has no battle channel).
  A player who is offline learns of an attack **never**.

### B4 — battleLogToDbInsert contract vs table (must verify in loop)
- `lib/battleService.ts:381-430` builds a very wide insert (rounds, units JSON, capture lists,
  XP fields). `battle_logs` schema: `lib/db/schema/battle.ts`. Column-by-column check is a
  loop step; any mismatch is the likely cause of B1.

## 3. Five Questions (RED)

1. **Do nothing?** Players fight blind — no history, no retaliation knowledge, no evidence for
   moderation. Operator-declared requirement fails.
2. **Why now?** Attack system is the core loop; logs are its memory.
3. **Who is affected?** Every combat participant; admins reading stats routes.
4. **Smallest correct change?** Prove/repair the insert path (B4 → B1), add a
   `notifyBattleParticipants` seam (one function, called from the four attack routes), keep
   flag attacks out of `battle_logs` (they're capture events — notify only) unless operator
   wants them logged.
5. **What must NOT change?** Battle math in `resolveBattle`; log retention/cleanup job;
   existing read contracts consumed by the UI.

## 4. GREEN Design (sketch)

- **S1:** live probe battle → diagnose insert (column contract fix if that's the failure).
- **S2:** `lib/battleNotification.ts`: `notify(defenderUsername, {attacker, outcome, loot, hp})`
  → row in `notifications` + WebSocket emit if online. Called from battle/attack,
  combat/attack, factory/attack (and flag/attack for player bearers).
- **S3:** unread-battle-notifications badge on the game HUD (existing notification UI surface,
  verified before wiring).
- **S4:** retro-verify stats routes return sensible aggregates once logs exist.

## 5. Verification plan (GREEN)

1. Live PvP + Beer-Base battle → `battle_logs` rows appear with full round detail.
2. Defender probe account, offline during attack → login shows unread battle notification with
   correct result; online probe → WebSocket toast.
3. `/game/battle-logs/[type]` + `/api/logs/player/[id]` return the new rows.
4. Gates: tsc 0, tests green, lint-delta 0, push, prod spot-check after a real battle.

## 6. Loop record

- **Pass 1:** writers/consumers/tables inventoried with citations; the B4 verification is
  deliberately FIRST in implementation (evidence before repair). Pass-2 after the live probe.

**Status:** created — loop continues.
