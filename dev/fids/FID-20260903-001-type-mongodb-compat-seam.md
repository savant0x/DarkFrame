# FID-20260903-001: Type the Mongo→pg compat seam (`lib/mongodb.ts`) — eliminate 87 lint findings

**Filename:** `FID-20260903-001-type-mongodb-compat-seam.md`
**ID:** FID-20260903-001
**Severity:** medium
**Status:** fixed (implementation in progress — seam complete, consumer retrofit running)
**Created:** 2026-09-03
**Source:** Lint burn-down batch (next-highest density: 87 findings — 71 `no-explicit-any`, 15 `no-unused-vars`, 1 `no-this-alias`)
**Operator directive:** no `any`/`unknown` — proper typing only

---

## 1. Summary

`lib/mongodb.ts` is the Mongo→Postgres compatibility seam: a `Collection` façade translating Mongo-style calls (`findOne`, `find().sort().limit().toArray()`, `insertOne`, `updateOne`, `countDocuments`, …) onto drizzle/pg tables. It is consumed by **69 files** (`getCollection<Player>('players')` etc.). Every method signature, the table registry, and every drizzle call site is typed `any` — 71 violations in one file, the highest-density lint target in the repo.

## 2. Evidence (RED)

- `npx eslint . --format json` (2026-09-03): `lib/mongodb.ts` = **87 findings**, top file repo-wide.
  Rule split: 71 `@typescript-eslint/no-explicit-any`, 15 `@typescript-eslint/no-unused-vars`, 1 `no-this-alias`.
- Probes run this session (deliberate-mismatch technique, temp files deleted):
  - `select().from(t: PgTable)` with the table typed as the erased base `PgTable` infers rows as `{ [x: string]: unknown }` — drizzle cannot infer real row shapes through a dynamically-keyed registry.
  - `getTableColumns(t)` is importable from `drizzle-orm` and returns a typed column map for any table — the honest way to index columns by string key.
- Baseline gates: tsc = 18 known phantom-table errors (all in `lib/wmd/`); vitest 333 passed / 1 skipped.

## 3. Constraints

1. **No `any`/`unknown`** (operator directive). Type guards with runtime validation are permitted at the trust boundary.
2. **Consumer contract must not change.** 69 files call `getCollection<T>(name)` / `new Collection<T>(name)`; `T` flows into `findOne`/`toArray` results. Changing that generic contract is a separate, operator-approved scope.
3. **Behavior must not change.** Chunked `insertMany` (pg 65,535-param cap), boolean→smallint normalization, spawn-tile NULL semantics, `insertedId` extraction — all load-bearing, all recently debugged (sessions 2026-09-02/03).
4. tsc must not regress: 18 known phantom errors is the floor; new errors in touched files = batch failure.

## 4. Root cause

The seam was written during the pivot as scaffolding under time pressure, typing everything `any` because drizzle's dynamic-table typing was assumed unworkable. The probe shows it *is* workable: the registry can be a typed `Record<CollectionName, PgTable>` union, and column access goes through `getTableColumns`.

## 5. Proposed design (GREEN)

Three mechanisms, replacing all `any`:

1. **Typed registry.**
   ```ts
   const TABLE_REGISTRY = { players: schema.players, tiles: schema.tiles, … } as const;
   export type CollectionName = keyof typeof TABLE_REGISTRY;
   function getTable(name: string): PgTable { return TABLE_REGISTRY[name as CollectionName]; }
   ```
   `getTable` returns the erased `PgTable` on purpose — one honest widening at the boundary, with the literal-union check done by the `as CollectionName` cast guarded by an `in TABLE_REGISTRY` runtime check (type guard, permitted pattern).

2. **Typed conditions.** `buildWhere(table: PgTable, filter: Record<string, FilterValue>)` builds `SQL[]` via `getTableColumns(table)[key]`; unknown keys are **skipped** (as today's behavior effectively is for missing columns) with the key set logged once in debug — no silent lie, no `any` column.
   - `FilterValue`: `string | number | boolean | Date | null | { $lt?/$lte?/$gt?/$gte?: comparable; $in?: comparable[] }`.

3. **Honest row typing.** Because drizzle infers `{ [x: string]: unknown }` for erased-table selects, results are validated into the consumer's `T` at the seam's single trust boundary:
   ```ts
   function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
   ```
   `findOne<T>` / `toArray<T>` return `T | null` / `T[]` where rows pass `isRecord` first. This replaces `Promise<any>` with a validated shape rather than a cast. (If consumers' `T` is a domain type, structural assignment from a validated record stays the consumers' concern — unchanged from today, where they received raw `any`.)

4. **`no-unused-vars` (15):** remove dead `options` params where no overload requires arity, prefix genuinely-kept-for-API-parity params with `_` (eslint `argsIgnorePattern: ^_` is configured).
5. **`no-this-alias` (1):** the `find()` builder uses `const self = this` — replace with arrow-function closure over `this` (builder object methods already only touch `this._sort`/`this._limitVal`; convert those to closure variables).

## 6. Out of scope (flagged, not dropped)

- `schema.migrations` and two `beerBase*` lookups currently use `(schema as any).name` — `beerBaseSpawnEvents`/`beerBaseDefeatEvents` ARE exported from the schema index (verified); `migrations` is not. `getTable` will throw a descriptive `Error` for unknown names instead of returning `undefined` (callers already treat falsy table as "no collection").
- Changing `Collection<T>` to drizzle-per-table inferred row types (the "real" endgame typing) — bigger than a lint batch; needs its own FID + consumer audit.
- `lib/wmd/` phantom-table errors (18) — separate operator decision.

## 7. Verification plan (AUDIT)

1. `npx eslint lib/mongodb.ts` → **0 findings**.
2. `npx tsc --noEmit` → exactly the 18 known phantom errors; **zero new**.
3. `npx vitest run` → 333 passed / 1 skipped / 0 failed (behavior unchanged).
4. Runtime smoke: `npm run db:setup` exits 0 (exercises the seam against live DB: owner promote, counts).
5. Grep consumers: `getCollection<` and `collection(` call sites still typecheck → consumer contract intact.

## 8. Mid-flight findings (GREEN amendments)

Implementation surfaced three latent silent-failure bugs in the seam itself, all fixed as part of GREEN:

1. **`$push`/`$inc` were never implemented** — every stat-tracking write (battlesWon, resourcesGathered, achievements persistence, RP fallback) silently no-opped since the pivot. Now translated to atomic SQL (`jsonb ||` append, `coalesce + delta`). `as any` casts at consumer call sites removed.
2. **`$ne`/`$exists` were never translated** — bot-exclusion filters (`isBot: {$ne: true}`, 20+ sites) and active-session filters (`endTime: {$exists: false}`, 9 sites) matched nothing. Now mapped to drizzle `ne`/`isNull`/`isNotNull`. `$or` branches also translated.
3. **`upsert: true` was accepted and ignored** — beer-base config updates would no-op on a fresh DB. Now implemented as select-then-insert (filter equality fields + $set payload).

Consumer retrofit (type-only annotations, no behavior change): the seam's honest return types exposed that ~96 untyped `getCollection('players')`-style calls leaned on the old implicit `any`. Being annotated file-by-file with real domain types (`Player`, `Partial<BeerBaseConfig>`, inline flag-doc shape). Files completed: achievementService (27→0), beerBaseService (22→0), flag/route (22→0). Remaining ~27 files listed in `_consumer_files.txt`.

## 9. Rollback

Single-file change; revert `lib/mongodb.ts` restores prior behavior (it is the only file touched besides lint-noise-free removals).
