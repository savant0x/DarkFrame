# FID-20260919-016 — Consolidate the WMD alert tables onto `wmd_alerts` (retire `wmd_admin_alerts`)

**Status:** `created`
**Session:** 2026-09-19 (operator directive: "give the table a real writer path and close the last sharp ticketed table")
**Origin:** FID-20260919-014's Law-17 census (`wmdAlerts` — no-consumer) plus the
operator's choice of **consolidate** when grounding overturned the premise of the
original "add a writer" directive.

---

## 1. Evidence chain (ground truth, all probed this session)

**The premise of the original directive was wrong.** The prior report claimed
`wmd_alerts` "has a live reader (the admin health surface) but no writer at all."
That is false:

- `app/api/admin/health/route.ts:166` reads **`wmd_admin_alerts`**, not `wmd_alerts`.
- The census agrees: `wmdAlerts` — **no-consumer** (no writer *and* no reader);
  `wmdAdminAlerts` — **live (w:2 r:2)**.
- Live DB: `wmd_alerts` exists, `id varchar(50)` PK, **0 rows — never written once**;
  `wmd_admin_alerts` exists with **8 rows**.

**The two tables are near-twins for the same event class.** `wmd_admin_alerts`
(`lib/db/schema/wmd.ts:180`) is a slim alert row (`id varchar(24)`, type, severity,
status, title, message, `details` jsonb, createdAt, resolvedAt). `wmd_alerts`
(`lib/db/schema/wmd.ts:379`) is the richer original design: full `AlertType` /
`AlertSeverity` / `AlertStatus` typings, incident references (`playerId`, `clanId`,
`targetClanId`, `missileId`, `voteId`, `operationId`), a channel/delivery model,
and an acknowledge/resolve lifecycle. It was designed alongside the FID-20260903-002
alert-delivery stack (`alert.types.ts` still names a `lib/wmd/admin/alertService.ts`
that was never written).

**How the orphan survived:** FID-20260919-011's removal migration
(`0035_notification_stack_removal.sql`) dropped `player_notifications`,
`admin_dashboard_notifications`, and `email_queue`, and explicitly kept `wmd_alerts`
with the comment *"The wmd_alerts SOURCE table REMAINS (live reader: admin health
endpoint)."* That reader claim was false then and is false now — the health endpoint
read `wmd_admin_alerts` all along. The orphan was kept on a mistake.

**Why "add a writer" would have been wrong:** writing the same missile events into
`wmd_alerts` while `wmd_admin_alerts` stays live would create a second parallel alert
table for identical data — precisely the unwritten-adjacent / parallel-stack class
Law 17 exists to outlaw.

## 2. Decision (operator-owned)

Operator chose **consolidate onto `wmd_alerts`**: redirect both writers and both
readers to the richer table, migrate the 8 existing rows, and drop `wmd_admin_alerts`.
One alert table; the ticketed table gains real consumers; the duplication class dies.

## 3. Implementation plan

- **Migration `0037_consolidate_alert_tables.sql`** (idempotent): `INSERT INTO wmd_alerts
  SELECT … FROM wmd_admin_alerts` mapping `status 'OPEN' → 'ACTIVE'`, `details → data`,
  `channels = '[]'`, `delivery_status = '{}'`, `ON CONFLICT (id) DO NOTHING`; then
  `DROP TABLE IF EXISTS wmd_admin_alerts`.
- **Writers → `wmd_alerts`:**
  - `createAdminAlert` (`lib/wmd/admin/wmdAdminService.ts`): `id` = `generateId()`
    (23 ≤ 50), `status = 'ACTIVE'`, `data` = details, `title` = message[:200].
  - `recordAdminAlert` (`lib/wmd/jobs/missileTracker.ts`): `status = 'ACTIVE'` (was
    `'OPEN'`), `missileId` populated from the reference field the old slim table lacked.
- **Readers → `wmd_alerts`:**
  - `app/api/admin/health/route.ts`: `where status = 'ACTIVE'` (unacknowledged = not yet
    acknowledged; RESOLVED/ARCHIVED no longer count).
  - `getWMDSystemStatus` (`wmdAdminService.ts`): read `wmd_alerts`, map `data → details`,
    `acknowledged = status === 'ACKNOWLEDGED'`.
- **Schema:** delete the `wmdAdminAlerts` export from `lib/db/schema/wmd.ts` and its
  entry in `lib/db/schema/index.ts`.

## 4. Gates
Pins: both writers target `wmd_alerts` (table name asserted via `getTableName`), status
mapping (`OPEN`→`ACTIVE`), the health reader's ACTIVE semantics, and a migration-content
pin (moves then drops, `ON CONFLICT` guard). Live probe: `flagSuspiciousActivity` (a
reachable writer) lands a row in `wmd_alerts`; the twin table no longer exists; the
health reader sees it. Full suite / tsc / eslint / Law-17 census.

## 8. Closure

_(filled at closure)_
