# FID-20260919-011 — Hygiene micro-batch: ChatPanel doc truth + notifications-stack disposition

**Status:** `closed (2026-09-19, commit 6f08696)`
**Session:** 2026-09-19 (066)
**Origin:** Operator directive: rewrite ChatPanel's stale IMPLEMENTATION NOTES to
match shipped reality, and disposition the "unwritten" notifications schema block.

## 1. Ground truth

### 1.1 ChatPanel docblock (the false-premise generator)

The stale text had already misled three survey premises this week (BalanceIndicator,
ChatMessage corpse, item-links). Fresh probes against the file:

- **Real-time TODOs were false**: `chat:message`, `chat:typing_start/stop`,
  `chat:online_count`, `chat:message_deleted`, AND `chat:veteran_notification`
  subscriptions all live (ChatPanel.tsx:510-568) — shipped via FID-20260919-002
  and FID-20260919-005. "WebSocket placeholders (Task 10)" is fiction.
- **"ChatMessage component will be created in Task 6"**: ChatMessage was created,
  then superseded by ChatPanel's inline renderer and ARCHIVED as dead code
  (FID-20260919-006). Pointing at it again would resurrect the corpse myth.
- **"Item linking placeholder"**: shipped in FID-20260919-008 (bracket links,
  catalog-validated, market deep-links).
- **Edit/delete**: real (saveEdit → /api/chat/edit at 1049, deleteMessage →
  DELETE /api/chat/delete at 1154).
- **Rate limiting**: real server-side (chatService RATE_LIMIT_NORMAL/VIP 5/10
  per 10s window; bad-words filtering) — the docblock's "enforcement" wording
  stays with its true location noted.
- **Real remainders**: virtual scrolling genuinely absent (react-window never
  installed — kept as the one honest TODO, matching the survey's parked call);
  emoji picker basic (regex-based, not emoji-mart).

### 1.2 The notifications stack (premise overturned before disposition)

The survey called it "unwritten — zero writers/readers". The census found MORE:

- **Three tables** in lib/db/schema/notifications.ts (FID-20260903-002, designed
  from WMD alert call sites): `player_notifications`, `admin_dashboard_notifications`,
  `email_queue` — all EXIST in the live DB (migration 0001, drizzle-generated).
- **A writer exists**: lib/wmd/admin/alertService.ts inserts all three
  (deliverPlayerNotifications / deliverDashboardNotification / email queue rows).
- **The stack is dead one layer up**: NO call site ever invokes the alert trigger
  functions (alertMissileLaunch/Impact/Intercepted, alertVote*, alertSuspiciousActivity,
  alertEmergencyDisarm, alertSystemError, createAlert) — not the WMD launch/impact
  seams, not server.ts, not any route. grep census: zero callers outside the
  module itself (whose barrel is imported by nothing — comments only).
- **No readers**: getActiveAlerts / getAlertHistory / getAlertConfig — zero
  consumers. No admin UI queries these tables.
- **No email sender**: nothing consumes email_queue (no nodemailer, no send
  worker). Rows would queue forever.
- **Practice proof**: all four tables hold **0 rows** in the live DB — the stack
  has never fired once in production.
- **Blast radius checks**: `wmdAlerts` (the SOURCE table) STAYS — it has a live
  reader (admin health endpoint unacknowledged count). `WmdAlertData` /
  alert.types.ts STAY — schema/wmd.ts consumes the type. The wmd admin barrel
  loses its alertService line (the barrel itself has zero importers). Old probe
  scripts' `DELETE FROM player_notifications` sweeps are defensive boilerplate —
  unmodified (historical scripts, not part of the live surface).

## 2. Decision (recorded)

**Remove the dead stack**: the three tables' drizzle definitions, their re-exports,
and alertService.ts (the only writer, itself unreachable). Delete the DB tables
with a new idempotent migration (0035). Rationale: unreachable code + unreachable
writes + zero historical rows = pure false-advertising surface; the same class the
Mongo shim exit retired. If notification delivery is ever built for real, the
design lives in git history and the surviving `wmdAlerts` table already carries
the alert source-of-truth records.

**Correct, not delete, the ChatPanel notes**: rewrite the file's two docblocks
(top + bottom) to shipped reality with FID pointers; keep the one genuine TODO
(virtualization).

## 3. Scope

components/chat/ChatPanel.tsx (docs only); delete lib/wmd/admin/alertService.ts;
lib/wmd/admin/index.ts (drop barrel line); lib/db/schema/notifications.ts deleted;
lib/db/schema/index.ts re-exports removed; migration 0035 (DROP TABLE IF EXISTS ×3,
idempotent); FID + ledger closure. No behavior change possible (zero callers).

## 4. Acceptance

- tsc/eslint clean; full suite green (no test imports the removed modules).
- Migration idempotent and applied to the dev DB.
- Fresh doc census: no chat TODOs advertise unshipped real-time work.

## 8. Closure (2026-09-19)

- **Shipped:** ChatPanel top + bottom IMPLEMENTATION NOTES rewritten to shipped
  reality (live socket subscriptions listed with FID-20260919-002/-005 pointers,
  shipped item links via -008, real edit/delete paths, server-side rate limit +
  profanity noted where they actually live, virtualization kept as the single
  honest TODO, Task-N scaffold narrative removed). Dead notifications stack
  removed: lib/db/schema/notifications.ts deleted, re-exports dropped from
  schema/index.ts, lib/wmd/admin/alertService.ts deleted, barrel line dropped.
  Migration 0035_notification_stack_removal.sql (idempotent DROPs) applied to
  the dev DB.
- **Kept, with evidence:** wmdAlerts (live admin-health reader), WmdAlertData /
  alert.types.ts (schema/wmd.ts consumer), moderation schema family (live).
- **Gates at close:** suite 1215/1215, tsc 0, eslint clean. DB post-migration:
  player_notifications / admin_dashboard_notifications / email_queue no longer
  present; wmd_alerts untouched.
