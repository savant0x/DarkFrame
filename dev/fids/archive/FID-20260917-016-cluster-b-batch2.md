# FID-20260917-016 — Cluster B batch 2: friends/DM family + ban-player, clear-flags, logs-cleanup, build-unit → pg

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-17 (058)
**Origin:** Operator directive: "Implement Cluster B batch 2: migrate the friends, DM, ban-player, clear-flags, logs-cleanup, and build-unit clientPromise routes to pg."
**Census basis:** dev/audits/MONGO-RESIDUE-CENSUS-2026-09-17.md, re-sized by the session-056 live sweep (15 direct `clientPromise` users); batch 1 landed as `81a4d02` (FID-20260917-015).

## 1. Goal

Remove every remaining `clientPromise`/`lib/mongodb` import from the nine batch-2 route files. Two shapes of work:

- **Theater removal** (6 files): friends, friends/search, dm, dm/[id], dm/[id]/read assign `_db` from the shim client and never use it — the real work already rides pg-native services (`friendService`, `dmService`). Delete the import + connection block; zero behavior change.
- **Real rewrites** (4 files): ban-player, clear-flags, logs/cleanup, player/build-unit execute genuine reads/writes through the shim's Mongo API and move to typed drizzle.

## 2. Ground-truth findings (every premise probed before writing)

- **Live sweep (this session):** `grep clientPromise|lib/mongodb app/api` → 9 in-scope files with live hits. player/inventory's remaining hit is a history comment (excluded; FID-20260917-008).
- **The shim maps the domain dot-paths:** `lib/mongodb.ts:173` `PLAYER_DOT_PATH_COLUMNS` maps `'resources.metal' → resourcesMetal` / `'resources.energy' → resourcesEnergy`, so player/build-unit's `$inc` **does** charge real flat columns today. The rewrite must preserve this semantics exactly (SQL `sql`${players.resourcesMetal} - ${x}``), not "invent" charging.
- **Schema truth vs the Mongo writes:**
  - `bans.id` = varchar(24) PK with **no default** — a drizzle insert must generate the 24-char id itself (mod_log has `.$defaultFn`; bans does not).
  - `player_flags` has **no `resolvedBy`/`resolvedAt`/`adminNotes` columns** — ban-player's `autoResolveFlags` `$set` mapped those keys to **nothing**; only `resolved` flipped. The rewrite resolves `resolved = 1` and carries the resolver/timestamp inside `metadata` (jsonb) — no schema change in this batch.
  - `players` has no `unbannedAt`/`unbannedBy` columns — the unban `$set` mapped to nothing; the unban rewrite clears the real columns (`banned`, `bannedAt`, `bannedBy`, `banReason`, `banExpiresAt`) and records the unban actor in the mod_log audit row only.
  - `player_activity` has **no `category` column** — the Mongo `ActionLog` activity/admin retention split cannot survive. `cleanupOldLogs` (the real deleter, `activityLogService:308`) deletes **all** `player_activity` rows older than the activity cutoff, ignoring the admin cutoff.
- **Silent-no-op class (the census's D1, resolved by evidence):** `adminLogs` is not a pg table; both admin routes' audit `insertOne`s and cleanup's `ActionLog` count/delete ride the shim's unmapped-collection behavior. `mod_log` (moderation.ts:34) is the real, already-shaped audit home (`moderatorId`, `action`, `targetId`, `reason`, `details`, `createdAt` — all NOT NULL except reason/details).
- **build-unit GET+POST** read `factories` via the shim: `{ owner: username }` filter, `sort({ x: 1, y: 1 })`, slots math `(factory.slots || 20) - (factory.usedSlots || 0)`. pg factories: composite PK (x, y), owner varchar(20), slots/usedSlots NOT NULL default 0 — **note the shim's `|| 20` fallback for `slots` is dead on pg** (NOT NULL); the rewrite uses the real value. Factories schema comment says `investedMetal/investedEnergy` are "maintained at write time by build-unit" — **the Mongo path never did this** (loop decision D3: add it, matching the factory variant's FID-20260909-032 contract).
- **Post-pivot defects already swept here (FID-20260914-004):** ban/unban/clear-flags audit rows carry mod_log keys; bans carry `username`/`bannedBy`/`bannedAt`/`isPermanent`/`active` per the shared-table contract; `bans.createdAt`/`mod_log.createdAt` are NOT NULL with **no** default — must be supplied.
- **Units shape:** `players.units` = jsonb `PlayerUnit[]` NOT NULL default `[]`; build POST appends per-unit entries with `quantity: 1` (`$each` semantics, probe-verified per the in-code comment). pg append = `sql`(coalesce(${players.units}, '[]'::jsonb) || ${JSON.stringify(newUnits)}::jsonb)``.
- **Rate limiters/logging:** all four real-rewrite handlers are wrapped `withRequestLogging(rateLimiter(...))`; the `withRequestLogging` RouteHandler type requires a second `context` param at call sites (learned in FID-20260917-015).
- **Client contracts:** `player/build-unit` is fetched by `components/UnitBuildPanel` (unit-factory page); friends/DM/dm-by-id panels call their routes with the existing response shapes; stats consumers unaffected. No wire-shape changes anywhere in this batch.

## 3. Loop decisions

- **D1 — audit home:** `adminLogs`/`ActionLog` are unmapped shim names (writes matched nothing real). Resolved: **`mod_log`** via drizzle `modLog` insert. No `admin_logs`/`action_log` table is created — the ledger already exists and every other admin surface (FID-20260914-004) already writes it.
- **D2 — cleanup retention split:** without a `category` column the activity/admin split is fiction. Resolved: the dry-run count mirrors the **actual deleter** (`cleanupOldLogs`: single activity cutoff over `player_activity`); `adminRetentionDays` is still echoed in `retentionPolicies` for wire compatibility but documented as inert for activity counting (moderation events live in `mod_log`, which this route does not prune).
- **D3 — investedMetal/investedEnergy:** the factories schema contract says build-unit maintains the lifetime-investment ledger, but the Mongo path never wrote it. Resolved: the pg rewrite adds the delta write (`+ totalMetalCost` / `+ totalEnergyCost`), matching the factory variant — the ledger becomes truthful at the moment of the rewrite.
- **D4 — unban truth:** `unbannedAt`/`unbannedBy` have no columns to land on; instead of schema-creep, the unban clears the five real ban columns and the mod_log UNBAN_PLAYER row (which already records the actor) carries the audit. The response's `unbannedAt` timestamp is generated server-side as before.
- **D5 — autoResolveFlags evidence:** resolution detail (resolver, timestamp, note) rides `player_flags.metadata` jsonb (`{ resolvedBy, resolvedAt, adminNotes }`) since no columns exist. Adds zero schema change; evidence is queryable.

## 4. Implementation

### 4.1 Theater removal (6 files, import + first-lines block deleted)
`app/api/friends/route.ts` · `app/api/friends/search/route.ts` · `app/api/dm/route.ts` · `app/api/dm/[id]/route.ts` · `app/api/dm/[id]/read/route.ts` — plus their "1. Get MongoDB connection" comment blocks. Response shapes untouched.

### 4.2 `app/api/admin/ban-player/route.ts` (POST + DELETE)
- POST: `players.findOne({username})` → `db.select().from(players).where(eq(players.username, username))`; admin check stays on the fetched row's `rank`; ban insert via `db.insert(bans).values({ id: genId24(), playerId: username, moderatorId: user.username, username, bannedBy: user.username, bannedAt, createdAt: bannedAt, expiresAt, reason, isPermanent: !durationDays, active: 1 })`; player update `db.update(players).set({ banned: 1, bannedAt, bannedBy, banReason, banExpiresAt })`; auto-resolve via `db.update(playerFlags).set({ resolved: 1, metadata: … D5 })` where `username = X and resolved = 0`; audit insert via `modLog` (D1), details JSON carries the legacy payload incl. tier/rank/resources.
- DELETE (unban): player row check, `db.update(players).set({ banned: 0, bannedAt: null, bannedBy: null, banReason: null, banExpiresAt: null })` (D4); `modifiedCount === 0` → 404 semantics preserved via rowCount; ban deactivate `db.update(bans).set({ active: 0 }).where(and(eq(bans.username, username), eq(bans.active, 1)))`; UNBAN_PLAYER mod_log row.
- `genId24()`: `crypto.randomUUID().replace(/-/g, '').slice(0, 24)` (matches the 24-char PK family).

### 4.3 `app/api/admin/anti-cheat/clear-flags/route.ts`
pg: player existence select; `currentFlags` select (for the audit's previous-flags payload); `db.delete(playerFlags).where(eq(playerFlags.username, username))` with honest `.returning({ id })` count (house FID-20260914-004 semantics); CLEAR_FLAGS mod_log row (D1).

### 4.4 `app/api/logs/cleanup/route.ts`
Delete the `clientPromise` import; `countOldActivityLogs` rewritten to `db.select({ id: playerActivity.id }).from(playerActivity).where(lt(playerActivity.timestamp, activityCutoff))` — single cutoff, mirroring `cleanupOldLogs` (D2). Battle count/cleanup already pg (FID-20260914-009) — untouched.

### 4.5 `app/api/player/build-unit/route.ts` (GET + POST)
- GET: `db.select().from(factories).where(eq(factories.owner, username)).orderBy(factories.x, factories.y)`; slots math over real values.
- POST: factories select (same, ordered); after all gates (unchanged), the money write becomes one drizzle update:
  `units: sql`(coalesce(${players.units}, '[]'::jsonb) || ${newUnitsJson}::jsonb)`` (N per-unit entries, quantity: 1 — preserved shape),
  `resourcesMetal: sql`${players.resourcesMetal} - ${totalMetalCost}``, same for energy,
  `totalStrength`/`totalDefense` computed values, and (D3) the factories updates loop gains `investedMetal: sql`${factories.investedMetal} + ${cost share}`` / energy.
  Factory slot writes: `db.update(factories).set({ usedSlots: newUsedSlots, investedMetal, investedEnergy }).where(and(eq(factories.x, X), eq(factories.y, Y)))` per tracked factory (small N; matches the composite-PK contract).
- Wire shapes unchanged (GET payload, POST `newStats`/`costPaid`/`unitsBuilt`/`statsGained`).

## 5. Gates

1. `npx tsc --noEmit` — 0 errors.
2. `npx eslint` on touched files — 0 errors.
3. `__tests__/api/clusterB2PgRewrites.test.ts` — pins: (a) source pins asserting the `clientPromise` import and `client.db(` usage are GONE from all 9 files; (b) behavioral pins: ban-player POST inserts a bans row with generated 24-char id + `createdAt` (NOT NULL) and writes mod_log; auto-resolve sets `resolved` and metadata (D5); unban clears real columns (D4); clear-flags uses `.returning()` for its count and writes mod_log; cleanup count mirrors `cleanupOldLogs` (single cutoff); build-unit resources update uses SQL deltas on the real columns (shim-parity charge), units append jsonb, factories update carries invested deltas (D3).
4. Live probe (`scripts/e2eClusterB2Live.ts`, direct-handler pattern): real admin session → ban a seeded probe player → assert bans row + players.banned + mod_log row; auto-resolve a seeded flag; unban → columns cleared + UNBAN row; clear-flags on seeded flags → count + audit; cleanup dryRun count ≥ 0; build-unit GET shape. Snapshot/restore, guaranteed cleanup, explicit exit.
5. Full suite green.

## 6. Explicit non-goals

- No schema migrations (D4/D5 avoid columns by design).
- Batch 3 (the `getCollection`/`getDatabase`/`connectToDatabase` importers — shrine, harvest, move, referral, chat presence, factory ×6, etc.) is out of scope; this batch kills the `clientPromise` class only.
- The factory family's `connectToDatabase` routes (incl. the factory/build-unit sibling's `$inc` on invested) remain for batch 3.

## 7. Verification record

Filled post-implementation (§8).

## 8. Closure

**Commit:** `5496fbf`
**Gates:** 20 pins green (`__tests__/api/clusterB2PgRewrites.test.ts` — source pins assert the clientPromise class is gone from all 9 files; behavioral pins on all four rewrites incl. the D1–D5 semantics and real-blueprint cost math); live probe **26/26, exit 0** (`scripts/e2eClusterB2Live.ts`, real handlers + real DB: ban → bans-row shape → players.banned → mod_log → auto-resolve metadata evidence → unban clears the five columns → bans deactivated → clear-flags honest count 3=3 + rows gone + audit → cleanup dry-run reads player_activity → build-unit via a fresh register-route session on its own factory with exact deltas on resources/totals/slots/invested ledger; probe-owned cleanup, residue zero); tsc 0 · eslint 0 · census 0 live `clientPromise` under `app/api` · suite 1068 (+20) at the batch. SCOPE row 95 Closed; CHANGELOG 0.0.11.
