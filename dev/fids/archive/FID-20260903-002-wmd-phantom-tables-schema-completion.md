# FID-20260903-002: WMD Schema Completion — 16 Phantom Tables

**ID:** FID-20260903-002
**Severity:** CRITICAL
**Status:** IMPLEMENTED (schema + migration + service typing complete; lint burn-down verified)
**Date:** 2026-09-03
**Rule basis:** Operator directive "no shortcuts — design tables from usage, migrate to live DB, then type the services." Operator directive: no `any`/`unknown`; only proper typing.

---

## 1. Problem Statement

Six WMD service files import **16 drizzle table exports that do not exist** in `lib/db/schema/`, producing 18 permanent TS2305 errors (the "phantom-table baseline"). The broken imports cascade: every insert/update against these tables is untyped, which is why ~30 `as any` casts spread across the WMD subsystem, violating the operator's no-`any` directive.

Import sites:
- `lib/wmd/spyService.ts` → `wmdSpies`, `wmdSabotageOperations`, `wmdIntelligenceReports`, `wmdSecurityStatus`, `wmdCounterIntelOperations`, `wmdInterceptions`
- `lib/wmd/defenseService.ts` → `wmdInterceptions`
- `lib/wmd/sabotageEngine.ts` → `wmdSabotageOperations`
- `lib/wmd/clanVotingService.ts` → `wmdLaunchAuthorizations`, `wmdResourcePools`, `wmdDefenseGrids`
- `lib/wmd/clanConsequencesService.ts` → `clanRelations`, `wmdRetaliationRights`, `wmdConsequenceEvents`
- `lib/wmd/admin/alertService.ts` → `wmdAlerts`, `playerNotifications`, `adminDashboardNotifications`, `emailQueue`

## 2. Evidence (RED phase — file:line)

| # | Table | Call-site evidence (columns observed) |
|---|---|---|
| 1 | `wmdSpies` | spyService:109-134 `mapDrizzleSpyToAgent` consumes: `id, spyId, ownerId, ownerUsername, clanId, codename, rank, experience, specialization, status, currentMissionId, missionHistory (jsonb str[]), skillsStealth/Hacking/Sabotage/Intelligence (int), lastMissionAt, recruitedAt, createdAt, updatedAt`. Insert spyService:187-206. Updates by `spyId`. |
| 2 | `wmdSabotageOperations` | spyService:552-568 + sabotageEngine:175-188 insert: `id, sabotageId, spyId, spyCodename, operatorId, operatorUsername, targetType, targetId, targetPlayerId, targetUsername, success (0/1), detected (0/1), damageDealt (jsonb SabotageDamage), executedAt, createdAt`. Query: by `targetPlayerId`, order `executedAt desc`. |
| 3 | `wmdIntelligenceReports` | spyService:984-1003 insert: `id, reportId, classification, gatheredBy, gatheredFrom, gatheredAt, missionId, targetId, targetUsername, targetLevel (int), targetPower (int), targetClanId, targetClanName, wmdCapabilities (jsonb), vulnerabilities (jsonb str[]), threats (jsonb str[]), recommendations (jsonb str[]), expiresAt, createdAt`. |
| 4 | `wmdSecurityStatus` | spyService:1127-1143: select `alertLevel` (string numeric), upsert `id, playerId, alertLevel, lastIncident, updatedAt`. |
| 5 | `wmdCounterIntelOperations` | spyService:1471-1485 insert: `id, operationId, operatorId, targetArea, spiesDetected (int), detectedSpies (jsonb array), executedAt, createdAt`. |
| 6 | `wmdInterceptions` | defenseService:148-156 insert: `id, interceptionId, missileId, defenderId, batteryId, result (InterceptionResult), timestamp`. |
| 7 | `wmdLaunchAuthorizations` | clanVotingService:314-324 insert: `id, authId, playerId, clanId, warheadType?, targetId?, grantedAt, expiresAt`. Query :395-400 by `playerId`+`warheadType`+`expiresAt > now`. |
| 8 | `wmdResourcePools` | clanVotingService:327-334 insert: `id, poolId, clanId, resourceAmount (int), contributorsAllowed (int), createdAt`. |
| 9 | `wmdDefenseGrids` | clanVotingService:338-344 insert: `id, gridId, clanId, isActive (0/1), activatedAt`. |
| 10 | `clanRelations` | clanConsequencesService:220-240: symmetric-pair lookup via raw SQL on `clanId1/clanId2`, upsert `id, clanId1, clanId2, relation (ClanRelation enum str), reason, lastUpdated`. |
| 11 | `wmdRetaliationRights` | clanConsequencesService:275 grant (bulk), :335-368 check/consume: `id, playerId, playerClanId, canRetaliateAgainstClan, grantedAt, expiresAt, used (0/1)`. |
| 12 | `wmdConsequenceEvents` | clanConsequencesService:299-303 insert spread: `id, eventId, launcherClanId, targetClanId, warheadType, severity (ConsequenceSeverity), reputationLoss (int), cooldownDays (int), timestamp`. |
| 13 | `wmdAlerts` | alertService:169-190 insert + :232-611 update/query: `id, type (AlertType), severity (AlertSeverity), status (AlertStatus), title, message, playerId?, playerName?, clanId?, clanName?, targetClanId?, targetClanName?, missileId?, voteId?, operationId?, data (jsonb), channels (jsonb str[]), deliveryStatus (jsonb), acknowledgedAt?, acknowledgedBy?, resolvedAt?, resolvedBy?, createdAt`. |
| 14 | `playerNotifications` | alertService:285-294 bulk insert: `id, playerId, type, alertId?, title, message, severity, read (0/1), createdAt`. |
| 15 | `adminDashboardNotifications` | alertService:302-312 insert: `id, alertId?, type, severity, title, message, data (jsonb), read (0/1), createdAt`. |
| 16 | `emailQueue` | alertService:345-353 insert: `id, to, subject, body, alertId?, status, createdAt`. |

## 3. Design (GREEN phase)

### 3.1 Conventions (match existing schema files)
- PK: `varchar('id', { length: 24 })` — callers generate `xxx_` + timestamp + random ≤ 24 chars. Lengthen to 50 where callers exceed 24 (verified per column below).
- Foreign-key-ish columns: `varchar(20/24/50)` matching the referenced domain (`players.username` = 20, clan ids = 24, `batteryId`/`spyId` = 50).
- Booleans that callers write as 0/1 → `smallint` with `.default(0)` (project convention; matches `successful/detected` on `wmdSpyMissions`).
- jsonb columns typed with `.$type<T>()` using domain types from `@/types/wmd` — no `any`.
- Timestamps: `timestamp(...)` (with tz, consistent with existing wmd tables); `.notNull()` where every call site supplies a value; nullable where callers pass `null`/omit.
- Indexes on every column used in a `where`/`orderBy` per evidence above.

### 3.2 Table placement
- WMD-family tables (1-9, 11-13): appended to `lib/db/schema/wmd.ts`, re-exported from the barrel `lib/db/schema/index.ts`.
- Cross-cutting tables: `clanRelations` → `lib/db/schema/clans.ts`; `playerNotifications`, `adminDashboardNotifications`, `emailQueue` → new `lib/db/schema/notifications.ts`; all re-exported from the barrel.

### 3.3 Column-type decisions requiring care
- `wmdAlerts.channels`: jsonb `$type<string[]>`; `deliveryStatus`: jsonb `$type<Record<string, { sent: boolean; sentAt?: Date; error?: string }>>` — eliminates the `as any` at alertService:181/:237/:245.
- `wmdSabotageOperations.damageDealt`: jsonb `$type<SabotageDamage | null>` (mirrors `missiles.damageDealt` pattern) — eliminates `damage as any` (spyService:560).
- `wmdSpyMissions.id` lookups: spyService uses `(mission as any).id` — the mission row's PK is the DB `id` column (`varchar 24`); callers generate `wsm_...` (15 chars) so 24 is safe.
- `clanRelations`: `uniqueIndex` on `(clanId1, clanId2)`; canonical orientation (sorted pair) documented; raw-SQL symmetric lookup preserved via canonical ordering at write time.
- `emailQueue.to`: `varchar(255)`; `body`: `text` (no length limit in pg).
- `wmdConsequenceEvents`: insert uses object spread of a typed event — column set matches the event interface exactly (all 8 fields + id/eventId).

### 3.4 Migration
- `npx drizzle-kit generate` → one SQL migration adding 16 tables + indexes (all `CREATE TABLE IF NOT EXISTS`-style guarded per drizzle default; additive only, no destructive statements).
- Applied to the live Supabase DB via `npx drizzle-kit migrate` (operator-approved access; DB is dev).
- Post-migration verification: `\dt`-equivalent count check via `db:setup` verify step (43 → 59 tables expected).

## 4. Audit Gates (double audit)

1. **Static:** `npx tsc --noEmit` — the 18 TS2305 phantom errors go to **zero**; no new errors anywhere.
2. **Runtime:** boot dev server, hit `/api/wmd/status` as fame (admin) → 200; run one spy insert through `npx tsx -e` smoke (recruit → then clean up) OR verify via `drizzle-kit push --dry-run`-equivalent diff showing no drift.
3. **Lint:** the five WMD service files reach **0 eslint findings** (fixing casts with the now-typed `$inferInsert`/`$inferSelect` shapes).
4. **Call-graph:** every new export grep-verified as imported by the consuming files listed in §1.

## 5. Explicit Non-Goals
- No behavior changes to any service (pure typing + persistence enablement).
- No game-logic redesign of the WMD subsystem (e.g., `mission.targetId` shape mismatch is recorded as a known limitation for a follow-up FID, not silently changed here).
- `getSabotageHistory`'s `Promise<any[]>` becomes the honest `$inferSelect[]` of `wmdSabotageOperations`.

## 6. Self-Correct Log
- (empty)

## 7. Operator Approval
- Directive received in-session: "you have direct access ... make the tables, do not take shortcuts ... according to echo standards" — approval for schema creation + live-DB migration granted.
