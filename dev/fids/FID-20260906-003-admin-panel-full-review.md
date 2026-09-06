# FID-20260906-003: Admin Panel Full Review

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-003-admin-panel-full-review.md`
**ID:** FID-20260906-003
**Severity:** HIGH (operator control surface; two dead contract paths, three broken data contracts, unaudited destructive actions)
**Status:** CONVERGED (loop pass 4) — implemented + live-verified (passes 5-6)

---

## 1. Summary

Operator directive: complete review of the admin panel. Post-FID-20260905-001 the admin API
layer is materially healthier (34 endpoints rebuilt, gates unified to `requireAdmin`), but the
panel had never been reviewed **as a whole**. This FID censuses every tab↔route contract, drives
the panel live as the owner, and fixes everything found. Scope set by operator: census every
admin tab and route, fix broken contracts, add the admin health strip including WMD alerts.

## 1a. Design-doc grounding

No dedicated admin-panel design doc exists (checked `docs/` — admin references are scattered
across `DISCORD_ROLES.md`, VIP system docs, and WMD admin-alert sections). The panel's spec is
effectively its route surface + the `isAdmin` gate model; this FID documents reality. The panel
is the only operator interface for bot population, beer bases, RP economy, WMD oversight, VIP,
moderation, and system reset — contract breaks here are silent operator blindness, not cosmetic.

## 2. Findings (RED — verified live)

### R1 — DEAD WIRE: `handleSaveConfig` → `PATCH /api/admin/bot-config` (global settings never saved)
- `app/admin/AdminView.tsx:773` PATCHes the **global bot-system shape** the UI edits
  (`{ totalBotCap, dailySpawnCount, migrationPercent, regenRates{hoarder,fortress,raider,ghost,balanced} }`,
  state defined at `AdminView.tsx:198-209`).
- The route validates with `BotConfigPatchSchema` (`lib/validation/schemas.ts:877-892`) which
  requires `{ username, updates{specialization,tier,position,resources,isSpecialBase} }` — the
  per-bot shape. Zod rejects the global body → **400 on every save**.
- Verified live: the UI's five global settings have **never persisted**; the "Save Configuration"
  button alerts success only if a 400 body happens to parse as `success` (it does not).

### R2 — DEAD WIRE: `GET /api/admin/bot-config` without `username` (global read never worked)
- `AdminView.tsx:315` fetches `/api/admin/bot-config` bare on mount; the route
  (`app/api/admin/bot-config/route.ts:59-64`) requires `?username=` and additionally filters
  `isBot = 1`. Returns 400 → `botConfig` state keeps its hardcoded defaults forever.
- Verified live: `GET /api/admin/bot-config` → 400 `VALIDATION_MISSING_FIELD`.

### R3 — Global bot settings are code constants; the `bot_config` table is a corpse
- The five UI settings map to reality as follows:
  - `totalBotCap` / `dailySpawnCount`: **no cap or cadence is enforced anywhere**.
    `app/api/admin/bot-spawn/route.ts:64-110` spawns `count` (1-10) with no population check;
    no scheduled auto-spawn job exists (`server.ts` + `lib/wmd/jobs/scheduler.ts` jobs listed:
    missileTracker, spyMissionCompleter, voteExpirationCleaner, defenseRepairCompleter,
    beerBaseRespawner).
  - `migrationPercent`: hardcoded `MIGRATION_CONFIG.MIGRATION_PERCENTAGE: 0.3`
    (`lib/botMigrationService.ts:51`) — UI value ignored.
  - `regenRates`: **three divergent copies** — UI defaults `AdminView.tsx:202-208`
    (balanced 0.10), `lib/botService.ts:293-299` (Balanced 0.10, plus Boss 0.02), and
    `lib/botGrowthEngine.ts:57-63` (Balanced 0.12). Whichever runs wins by accident.
- The `bot_config` table exists (`lib/db/schema/config.ts:21-26`, migration `0000_init.sql`,
  columns `id, spawn_rate, total_bots, last_spawn`) and is **EMPTY, read by nothing, written by
  nothing** (live DB check: table exists, 0 rows, zero code references).
- **`lib/botGrowthEngine.runGrowthCycle` (line 378) has zero callers** — the bot growth/regen
  engine is dead code; bot resources never regenerate through it. `regenerateBotResources`
  (`lib/botService.ts:662`, "Called hourly" per its own doc) also has zero callers.

### R4 — 500: `GET /api/admin/rp-economy/generation-by-source` (MySQL placeholders in pg)
- Route builds `conditions.push('timestamp >= ?')` and interpolates via `sql.raw(whereClause)`
  (`app/api/admin/rp-economy/generation-by-source/route.ts:59-69`) — `?` placeholders never bind
  under drizzle/postgres → syntax error on every period that sets `dateFilter` (24h/7d/30d; the
  UI default is 7d). Verified live: 500 `Failed query: SELECT source, SUM(amount)…FROM rpTrans…`.
- Also reads `rpTransactions` unquoted (folds to `rptransactions`, OK) but is otherwise the
  Mongo-era rewrite the §5.2a pass missed (its sibling `transactions` route was fixed; this one
  was not — the earlier session probed it with `period=all` and got a false pass).

### R5 — rp-transactions row keys don't match the UI contract
- Route emits `{ id, playerUsername, vipBonus, balanceAfter, … }`
  (`app/api/admin/rp-economy/transactions/route.ts:84-92`).
- UI `RpTransaction` reads `{ _id, username, vipBonusApplied, … }` (`AdminView.tsx:136-144`,
  render at 3282-3292 — `_id` is also the React key). Result: **username, VIP badge, and keys
  render empty/undefined** for every row.
- Sibling `top-players` route: keys match (`topEarners`/`topSpenders`/`isVIP`) — verified.

### R6 — Transient 500s on admin analytics from connection-pool exhaustion
- `GET /api/admin/analytics/activity-trends?period=7d` 500'd during the live drive; the route's
  SQL is **correct** (isolated drizzle repro passes: 3 buckets returned) — the failure was
  Supavisor `EMAXCONNSESSION` (15-client session cap) caused by the dashboard's burst of
  parallel fetches on mount (5 in `AdminView.tsx:311-317` + WMD + VIP + more on tab loads).
- The route's `log.error` swallows the cause (empty message at `route.ts` catch) — logging
  improvement needed so 500s carry `err.cause`.
- Client has no retry → a single transient 500 blanks a whole panel until manual reload.

### R7 — WMD admin tab renders mostly undefined (service↔UI key mismatch)
- UI `WmdStatusPayload` reads `activeOperations{missiles,votes}`, `jobs{scheduled}`,
  `alerts[]{type,message,playerId,clanId,createdAt}` (`AdminView.tsx:85-93`, render 2584-2615).
- Service returns `{ activeMissiles, activeVotes, activeMissions, repairingBatteries,
  clansOnCooldown, recentAlerts, scheduler{running,jobs{…}} }`
  (`lib/wmd/admin/wmdAdminService.ts:155-164`). **Zero overlap** → the status tab shows 0
  everywhere except alerts (`recentAlerts` vs `alerts` — also mismatched).
- UI analytics reads `missiles{total,intercepted,hit,successRate,avgDamage}`,
  `votes{total,passed,failed,approvalRate}` (`AdminView.tsx:2649-2707`).
- Service returns `missiles{total,active,impacted,intercepted,adminDisarmed,byWarheadType,
  totalDamage,avgFlightTime}` (no `hit`/`successRate`/`avgDamage`) and
  `votes{total,active,passed,failed,vetoed,expired,avgApprovalRate,avgParticipationRate}`
  (`wmdAnalyticsService.ts:250-296`) — `hit`, `successRate`, `avgDamage`, `approvalRate` are all
  undefined. UI guards with `|| 0` so it shows zeros, not crashes — silently wrong.

### R8 — Audit-trail gaps (destructive actions without mod_log)
- With `mod_log`: `anti-cheat/ban`, `tiles`, VIP grant/revoke (FID-005 batch 2).
- **Without**: `system-reset`, `rp-economy/bulk-adjust`, `bot-spawn`, `bot-regen`,
  `bot-config PATCH` (per-bot), `anti-cheat/unban` (verify at implementation), `ban-player` /
  `clear-flag` (legacy duplicates of `anti-cheat/ban` / `anti-cheat/clear-flags` — see R9).

### R9 — Legacy duplicate/orphan routes (kept, documented, gated)
- Census orphans that ARE used by admin modals (census regex false-positives on template
  literals — corrected): `players/[username]`, `player-tracking/*` (PlayerDetailModal),
  `tiles` (TileInspectorModal), `clan/analytics` (ClanInspectorModal).
- True legacy duplicates with **zero client callers**: `ban-player` ≡ `anti-cheat/ban`,
  `clear-flag` ≡ `anti-cheat/clear-flags`, `player-activity` (modal uses
  `player-tracking/activity`), `migrate-factory-slots` (one-shot migration tool),
  `bot-migration` (rank-gated route outside `/admin`), `generation-by-source` (uncalled AND
  broken, R4). Decision: keep `ban-player`/`clear-flag`/`player-activity` (harmless, gated, and
  third-party scripts may call them), FIX `generation-by-source`, document the rest here.

### R10 — Health strip missing (operator flies blind on silent config failures)
- FID-20260905-001 §7.3: `CRON_SECRET` was unset in prod and nothing surfaced it. Operator
  directive: build the strip, including WMD alerts (unacknowledged `wmd_admin_alerts`).

### R-A1 (closed) — Identity chain verified sound
- `players.is_admin` → JWT `isAdmin` → `requireAdmin`. Live owner probe: 13/15 routes 200 (the
  two 500s are R4 + pool exhaustion, the 400s are R1/R2 contract breaks — none are auth).

## 3. Five Questions

1. **Do nothing?** Global bot settings can never be saved (R1/R2), the WMD oversight tab shows
   false zeros (R7), RP transaction log is key-broken (R5), destructive actions are unaudited
   (R8), and silent config failures stay invisible (R10).
2. **Why now?** Operator directive; the admin panel is the control plane for the balance/WMD
   work and the game is live on Vercel.
3. **Who is affected?** Admins directly (broken controls); players indirectly (bot population
   and economy tuning impossible, incidents unauditable).
4. **Smallest correct change?** Fix contracts at the seam that is wrong (route adapters for R7,
   route row-mapping for R5, global-config support for R1/R2/R3), add the health strip, close
   audit gaps, add client retry for transient 500s. No redesign of the panel.
5. **What must NOT change?** `requireAdmin` gate semantics and the 401/403 error contract;
   per-bot bot-config semantics (`?username=` detail path keeps working); `mod_log` id
   conventions; the client render code for R7 (route adapts to the UI contract, not vice versa).

## 4. GREEN Design

### S1 — Global bot-config becomes real (R1, R2, R3)
- **Migration 0017** (`lib/db/migrations/0017_bot_config_globals.sql`): extend `bot_config` —
  `ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS migration_percent real NOT NULL DEFAULT 0.3;
  ADD COLUMN IF NOT EXISTS regen_rates jsonb NOT NULL DEFAULT
  '{"hoarder":0.05,"fortress":0.10,"raider":0.15,"ghost":0.20,"balanced":0.10}';
  UPDATE bot_config SET spawn_rate = 75, total_bots = 1000 WHERE id = 'global'` + insert the
  `global` row if absent. `spawn_rate` ≡ dailySpawnCount, `total_bots` ≡ totalBotCap (existing
  columns reused; no destructive change).
- **Schema mirror** in `lib/db/schema/config.ts` (`botConfig` table gains the two columns).
- **Route rewrite** (`app/api/admin/bot-config/route.ts`):
  - `GET` without `username` → returns the global row:
    `{ success, data: { totalBotCap, dailySpawnCount, migrationPercent, regenRates } }`.
  - `GET ?username=X` → unchanged per-bot detail (R2's contract preserved).
  - `PATCH` with **global shape** (no `username`, has `totalBotCap`/`migrationPercent` keys) →
    upsert the `global` row (bounded validation: cap 1..5000, daily 0..1000, percent 0..1,
    rates 0..1 each).
  - `PATCH` with per-bot shape (`username` + `updates`) → unchanged.
  - Distinguishing key: presence of `username` (both shapes are otherwise disjoint).
- **Enforcement wiring** (makes the settings real):
  - `bot-spawn` route: after validation, read cap (`getGlobalBotConfig`), count existing bots,
    refuse `count` that would exceed `totalBotCap` (409-style error via
    `createErrorResponse` VALIDATION code), still writing mod_log.
  - `lib/botMigrationService.ts`: `MIGRATION_PERCENTAGE` becomes a parameter defaulting to
    `getGlobalBotConfig().migrationPercent` (async read with code fallback).
  - Single source for regen rates: `lib/botService.getRegenerationRate` gains an optional rates
    override; `lib/botGrowthEngine.REGENERATION_RATES` delegates to botService's table so the
    0.12 divergence dies. (Full dynamic read lands with S2's scheduler job, which loads rates
    per cycle.)
- **Scheduler job** (`lib/wmd/jobs/botGrowthJob.ts` + registration in `scheduler.ts`, hourly):
  calls `runGrowthCycle` — the dead engine becomes the thing the regen rates actually drive.
  Lazy-tick pattern is unnecessary here (server-only job; serverless is covered by the WMD
  lazy tick precedent only for missiles, which already ship). Vercel: growth advances when the
  server process runs; documented limitation, matches existing beer-base respawner behavior.

### S2 — Route adapters for the WMD admin contract (R7)
- `app/api/admin/wmd/route.ts` `action=status` projects the service shape to the UI contract:
  `{ activeOperations: { missiles: activeMissiles, votes: activeVotes }, jobs: { scheduled:
  Object.values(scheduler.jobs).filter(j => j.running).length }, alerts: recentAlerts.map(a =>
  ({ type: a.type, message: a.message, createdAt: a.timestamp, ...ids })) }`.
- `action=analytics` projects: `missiles.hit = impacted`,
  `missiles.successRate = total ? impacted / total : 0` (fraction; UI ×100),
  `missiles.avgDamage = impacted ? totalDamage / impacted : 0`,
  `votes.approvalRate = avgApprovalRate / 100` (fraction; UI ×100). All service fields kept
  (additive spread) so the modals don't regress.
- A typed `WmdAdminStatusPayload`/`WmdAdminAnalyticsPayload` pair in the route file documents
  the contract (replaces the UI's comment-shaped guess).

### S3 — rp-transactions row mapping (R5)
- Route projects each row to the UI contract: `{ _id: r.id, username: r.playerUsername,
  amount: r.amount, source: r.source, description: r.description, timestamp: r.timestamp,
  vipBonusApplied: Boolean(r.vipbonus), balanceAfter: r.balanceafter }` (keep the spread for
  extra fields). Keys/renders fix themselves (React key included).

### S4 — generation-by-source pg rewrite (R4)
- Same pattern as its sibling (`transactions` route, §5.2a): drizzle `sql` template with
  `sql.join` conditions, `rptransactions` lowercase, `playerusername` handling unnecessary
  here (aggregation only). Returns the same row shape. Verify 200 for 24h/7d/30d/all.

### S5 — Transient-500 resilience + cause logging (R6)
- Admin client: wrap the dashboard's data loads with a shared `fetchAdminJson(path, retries=1)`
  helper (single 800ms-backoff retry on 5xx/network) — applied to the mount `Promise.all`
  cluster and the WMD/analytics loaders. No behavior change on 4xx.
- `activity-trends` route: include `err.cause` in the error log (pattern exists elsewhere).

### S6 — mod_log audit completeness (R8)
- Add `mod_log` writes to: `system-reset`, `rp-economy/bulk-adjust`, `bot-spawn`,
  `bot-regen`, `bot-config` per-bot PATCH, and `anti-cheat/unban` (if missing). Same
  id/action/actor conventions as `anti-cheat/ban` (id ≤24 chars, `action: 'ADMIN_*'`,
  `modId` = admin username, `targetId` = affected player/config).

### S7 — Admin health strip incl. WMD alerts (R10)
- New `GET /api/admin/health` (`requireAdmin`): returns
  `{ db: { ok, latencyMs }, migrations: { latest: '<id>', applied: boolean },
     env: { JWT_SECRET, DATABASE_URL, CRON_SECRET, STRIPE_SECRET_KEY } (presence booleans only),
     cron: { reachable: boolean, note }, wmdAlerts: { unacknowledged: number, latest: [≤5 rows] } }`.
  - DB check: `SELECT 1` with timing. Migration check: `migrations` table max id vs
    `lib/db/migrations/*.sql` list. Cron: attempt a HEAD/self-call to
    `/api/cron/flag-bot-movement` only if `CRON_SECRET` set (else `reachable: false,
    note: 'CRON_SECRET not set'`). WMD alerts: count `wmd_admin_alerts WHERE status <>
    'ACKNOWLEDGED'` + latest 5 (type, severity, message, createdAt).
- Panel header strip in `AdminView.tsx`: green/red dots per check + WMD alert count badge that
  links/scrolls to the WMD tab; renders from the health payload, polls on tab switch (no
  interval spam).

### S8 — Census tool correction (kept as an audit script)
- `dev/scripts/audit/admin-contract-census.cjs`: template-literal truncation fix (record up to
  `${`) and comment-line exclusion, so reruns are trustworthy evidence, not noise.

## 5. Verification plan (GREEN)

1. **Gates:** tsc 0; eslint clean on touched files; tests green.
2. **R1/R2/R3:** PATCH global shape → 200 + row in `bot_config` (verify via psql); GET bare →
   200 returning saved values; spawn beyond cap → refused; migration service reads percent.
3. **R4:** probe all four periods → 200 with sane aggregates.
4. **R5:** transactions rows render keys (`_id`, `username`, `vipBonusApplied`) — probe body
   shows the mapped keys.
5. **R7:** `action=status`/`analytics` bodies contain the UI keys with real values; live
   preview of the WMD tab shows non-undefined numbers.
6. **S5:** kill-and-retry proof is impractical against Supavisor; verify helper behavior with a
   stubbed 500-then-200 fetch (unit-level probe) and live 200s after.
7. **S6:** perform one bulk-adjust + one bot-spawn; verify `mod_log` rows with correct actor/target.
8. **S7:** health endpoint returns all checks real (break `CRON_SECRET` locally → strip shows
   the failure; restore → green); WMD alert count matches a direct DB count.
9. **Live drive:** preview drive of every tab as owner; zero console errors from admin code;
   screenshots for the record.

## 6. Loop record

- **Pass 1:** A1 identity chain verified live and closed (was the operator's standing question).
- **Pass 2:** Census script run; 7 dead wires / 13 orphans reported → all 7 dead wires
  investigated; 3 are census false-positives (template-literal truncation + comments), the
  real ones are R1/R2 (+R4 broken-but-orphaned). Orphans triaged (R9). Script fix queued (S8).
- **Pass 3:** Live route probes with correct session cookie (probe v1's 401/403 was a wrong
  cookie — `sessionId` vs `darkframe_session`; corrected before drawing conclusions): 13/15
  200; 500s = R4 (real SQL bug) + activity-trends (pool exhaustion, SQL proven correct by
  isolated repro — reclassified from "broken SQL" to R6); 400s = R1/R2. Contract diffs mapped
  key-by-key (R5, R7). bot_config table confirmed empty + unreferenced (R3). mod_log sweep
  (R8). runGrowthCycle zero-caller discovery elevated R3 from "settings not wired" to "the
  engine the settings describe is dead".
- **Pass 4:** GREEN self-audit against the Five Questions and "smallest correct change":
  S1 distinguishes global vs per-bot by `username` presence (no new endpoint); S2 adapts at
  the route (UI untouched); S3/S4 are the two smallest seam fixes; S5 is one helper + one
  log line; S6 reuses existing mod_log conventions; S7 is read-only. Convergence: no open
  findings. **CONVERGED — operator pre-approved scope (census + broken contracts + health
  strip incl. WMD alerts); implementation proceeds.**
- **Pass 5 (implementation audit):** S7's migration check initially read the phantom
  `migrations` pgTable (live DB has no such table — RED had not extended the phantom census
  to config-schema tables). Drizzle bookkeeping (`drizzle.__drizzle_migrations`) holds 6 rows
  vs 18 on-disk files because this project applies later migrations idempotently out-of-band,
  so a row-count drift signal is wrong by design. Final design: verify the newest migration's
  CREATE TABLE/ADD COLUMN objects exist in information_schema. Also S7 switched
  `requireAdmin(request)` (needs NextRequest cookie semantics this route must not fake) to
  the codebase's `getAuthenticatedUser()` pattern; S5's cause-logging adapted to the logger's
  real `(message, error)` signature; system-reset turned out to be shim-native (phantom
  deletes reporting success) and was rebuilt pg-native with real `deletedCount` under S6.
  No further findings. **Loop converged — implementation verified (pass 6 below).**
- **Pass 6 (verification):** Live probe suite **29/30** (the one FAIL was the probe's own
  bot-finder — the players route doesn't project `isBot`; the per-bot contract was verified
  separately: GET 200 + PATCH 200 as `Flag-Bearer-8916`). Verified: global bot-config
  GET/PATCH round-trip (cap 1200, daily 60, migration 25%, rate merge); generation-by-source
  200 on all four periods; transactions rows carry `_id`/`username`/`vipBonusApplied`;
  WMD status `activeOperations`/`jobs.scheduled`/`alerts` + analytics
  `hit`/`successRate`/`avgDamage`/`approvalRate` all present; health returns real DB latency,
  migration 0017 verified current, env presence, cron note, and 4 unacknowledged WMD alerts
  matching a direct DB count. Live UI drive as owner: health strip renders (System Health:
  DB 529ms, Migrations current, JWT/DATABASEURL/CRON/STRIPE green, ⚠ 4 WMD alerts button
  scrolls to the WMD section), every admin fetch 200, RP transactions table renders real
  usernames ("fame", ⚔️ Battle, +100), WMD oversight shows real alerts + 4 scheduled jobs.
  Gates: tsc 0, eslint clean on all touched files, npm test 341 passed / 1 skipped.
  mod_log rows confirmed: 4× ADMIN_BOT_CONFIG_GLOBAL (the config saves are audited).

**Status:** CONVERGED (loop pass 5) — implemented + live-verified (pass 6); committed.
