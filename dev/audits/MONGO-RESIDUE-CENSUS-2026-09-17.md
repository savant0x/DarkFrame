# AUDIT — Mongo-era residue census (row #24): the shim, its 48 importers, and the retirement plan

**Date:** 2026-09-17 (session 049) · **Method:** full-estate import census
(`@/lib/mongodb` + direct `mongodb` driver), per-file API-usage classification,
every claim probed at line level. Trigger: the operator's inventory-route FID
(FID-20260917-008) proved the disease has client-facing members.

## 1. The headline

`lib/mongodb.ts` is **not a connection shim — it is a 1,554-line Mongo-over-Postgres
emulation layer**. `clientPromise` is `Promise.resolve(_compatClient)`; the module
imports drizzle + the real pg pool and *translates* Mongo API surface (filters,
`$set/$inc/$push` updates, dot paths, aggregate pipelines, `$lookup`) into SQL or
in-memory JS. **The game's data is already in Postgres.** "Migrating off Mongo"
for row #24 does not move data — it retires the *translation layer* and rewrites
its 48 importers to speak drizzle directly.

## 2. Shim capability map (probed at line level)

| Surface | State |
|---|---|
| `findOne/find` (+ chainable sort/limit/skip/projection) | implemented via drizzle |
| `insertOne/insertMany`, `updateOne/updateMany` (`$set/$inc/$push`), `deleteOne/deleteMany`, `countDocuments`, `findOneAndUpdate` | implemented via drizzle |
| `createIndex` | **no-op** (returns fake name) — harmless, real indexes live in migrations |
| `aggregate()` | **in-memory over the full fetched doc array** — `$group/$match/$sort/$skip/$limit/$count/$project/$addFields/$lookup` evaluated in Node JS. Correctness per-pipeline "verified against these exact shapes" (module comment), but cost scales with table size. |
| doc-shape overlay (`doc` jsonb vs indexed columns) | auctions get a rebuild-on-read overlay; other tables presumably `doc`-first |

**Structural risk class:** every aggregate consumer does O(table) row fetches into
Node. Today's player counts make it cheap; growth makes every one of these a
future incident.

## 3. The importer census — 48 files, four usage classes

Import-shape census across the estate: `getCollection` ×13 · `clientPromise`
(default) ×13 · `connectToDatabase` ×10 · `getDatabase` ×8 · `AggregateStage`
type-only ×1 (some files import several).

### Class 1 — REAL shim consumers (rewrite required; 15 files)

| File | Shim APIs | Collections → pg tables |
|---|---|---|
| `app/api/stats/route.ts` | find, countDocuments ×2, **aggregate (global $group over all players — in-memory today)** | players, clans, battleLogs → players, clans, battle_logs |
| `app/api/admin/anti-cheat/clear-flags/route.ts` | find, findOne, insertOne, deleteMany | playerFlags, adminLogs, ActionLog → player_flags, mod_log, (ActionLog has no pg table — disposition needed) |
| `app/api/admin/ban-player/route.ts` | insertOne ×3, updateOne ×2, updateMany, findOne | bans, playerFlags, players, adminLogs → bans, player_flags, players, mod_log |
| `app/api/clan/check-name/route.ts` | findOne | clans → clans |
| `app/api/logs/cleanup/route.ts` | countDocuments | ActionLog/adminLogs → mod_log? (disposition) |
| `app/api/player/build-unit/route.ts` | find ×2, updateOne | players, factories → players, factories |
| `app/api/tutorial/route.ts` | findOne, deleteOne | tutorial_progress → tutorial_progress ✓ |
| `lib/antiCheatDetector.ts` | findOne ×3, find ×2, updateOne, insertOne | playerFlags, players → player_flags, players |
| `lib/beerBaseAnalytics.ts` | find ×6, insertOne ×2, deleteMany ×2 | beerBaseSpawnEvents, beerBaseDefeatEvents → beer_base_*_events ✓ (also `import type { ObjectId }` — type-only) |
| `lib/dmService.ts` | find ×4 | conversations/messages → conversations, messages |
| `lib/rankingService.ts` | (shim reads) | players → players |
| `lib/shrineServer.ts` | (shim reads/writes) | players, shrine_blessings → ✓ |
| `lib/websocket/chatHandlers.ts` | (shim reads/writes) | chat tables → ✓ |
| `app/api/clan/leaderboard/route.ts` | **aggregate ×2** ($group count + full clan pipeline) | clans → clans |
| `lib/cacheWarming.ts` | find ×11 (top-100 by 5 clan sorts + 3+ player sorts) | clans, players → clans, players (note: shim sorts fetch-then-sort — O(table) today) |

### Class 2 — DEAD connection fetches (delete the fetch + import; 13 files)

`await clientPromise` → `const _db = mongoClient.db('darkframe')` with `_db`
never used afterward (the routes' real work goes through services already on pg):

`app/api/dm/route.ts` (×2 sites), `app/api/dm/[id]/route.ts` (×2),
`app/api/dm/[id]/read/route.ts`, `app/api/friends/route.ts` (×2),
`app/api/friends/search/route.ts`, `app/api/tutorial/decline/route.ts`
(verified line-level: dm:79/191, friends:68/137 — underscore-unused).
These are zero-risk deletions (probe: compile + tests + one live probe each).

### Class 3 — connection-helper-only consumers (mechanical swap to `@/lib/db`; ~20 files)

`connectToDatabase`/`getDatabase` imports where the "db" handle feeds real
shim collection work: all five `app/api/factory/*` routes, `app/api/leaderboard`,
`app/api/cron/player-snapshot`, `app/api/admin/achievement-stats`,
`app/api/admin/active-sessions`, `app/api/admin/bot-factory-economy`,
`app/api/auction/my-bids`, `app/api/chat/{heartbeat,online,typing}`,
`app/api/debug/tile`, `app/api/harvest`, `app/api/inventory`, `app/api/move`
(getCollection), `app/api/player/{greeting,profile,stats}`,
`app/api/referral/{generate,leaderboard,stats}`, `app/api/shrine/{activate,boost-all}`,
`app/api/health` (testConnection — rewrite as a `SELECT 1` ping).
These are Class 1 work wearing a coat: each has real collection ops
(factory/status: 1, leaderboard: 3, harvest: 1, cacheWarming: 11 …).

### Class 4 — out-of-app stragglers (2 files)

- `scripts/validate-referrals-cron.ts` — **direct `new MongoClient(MONGODB_URI)`**
  against the real Mongo driver. NPM-scripted (`validate-referrals`), no CI
  schedule. Reads a database that is no longer the source of truth → its
  validation verdicts are historical fiction. Rewrite on pg or archive.
- `lib/common/errors.ts`, `app/api/clan/warfare/declare/route.ts`,
  `lib/dmService.ts:55`, `lib/stripe/subscriptionService.ts` — ObjectId
  *comments/doc-references only* (probed; no driver usage). Copy cleanup only.

**Also:** `mongodb@^6.10.0` remains in `package.json` dependencies — removable
only after Classes 1–4 are done (beerBaseAnalytics imports `type ObjectId` until
its `_id` fields are retyped).

## 4. The migration plan (clustered, risk-ordered, each cluster = one FID batch)

**Cluster A — dead weight, zero risk (1 batch, ~1 hour):** delete the dead
`clientPromise` fetches (Class 2, 13 files) + delete `lib/mongodb.ts` exports
nobody should use going forward? No — keep the shim intact until Class 1 is
done. A is: Class 2 deletions + Class 4's cron decision + comment cleanups.
Gates: tsc/eslint/suite + one live probe per touched route family.

**Cluster B — read-path rewrites on existing pg tables (2–3 batches):**
tutorial (trivial — `tutorial_progress` exists), dm/friends services, check-name,
build-unit, anti-cheat family (player_flags + bans + mod_log all exist), beerBase
analytics (beer_base_* tables exist), ranking/cacheWarming (players/clans; swap
fetch-then-sort for `orderBy(...).limit(100)` — the perf win is immediate).
Each rewrite is contract-pinned exactly like FID-20260917-008: derive the wire
shape from the consumer, not from the old Mongo projection.

**Cluster C — the aggregate consumers (own batch, perf-sensitive):**
stats route's global $group, clan leaderboard's two pipelines, logs cleanup.
Translate each pipeline to SQL `GROUP BY`/window aggregates. The shim's
in-memory evaluation is today's correctness oracle: rewrite, then assert the
SQL result equals the shim result on the live DB before flipping (the
double-run technique from the FID-009 D2 UTC probe).

**Cluster D — deprecation (final batch):** delete `lib/mongodb.ts` (1,554
lines), drop `mongodb` from package.json, retire the `mongoId` column only
after Stripe's `userId → mongoId` mapping is migrated to username/player-key
(its own sub-FID — payment-path risk, needs the subscription table state
audited first).

## 5. Immediate decisions requested

1. **ActionLog + adminLogs have no pg tables** (only `mod_log`). Disposition:
   map both to `mod_log` (schema superset?) or create dedicated tables. Needed
   before Cluster B's anti-cheat/cleanup rewrites.
2. **validate-referrals-cron:** rewrite on pg (keeps the npm script) or archive
   the script? Its current output validates a dead database.
3. **Cluster sequencing:** A → B → C → D as proposed, or pull the
   cacheWarming/leaderboard perf win (fetch-then-sort → SQL orderBy) forward
   into A as its own quick win?

## 6. Files touched by this audit

None. Zero code changes — census + plan only.
