# FID-20260902-001: DB Direction — Finish Postgres/Supabase Pivot vs Revert to MariaDB

<!--
  ECHO Protocol v0.1.2 (single-agent). See templates/FID-TEMPLATE.md for field rules.
  This FID is DECISION-BOUND: implementation (Section 7) starts only after the operator
  picks Option A or Option B. The FID specifies both completely for that reason.
-->

**Filename:** `FID-20260902-001-db-direction-postgres-pivot-vs-mariadb-revert.md`
**ID:** FID-20260902-001
**Severity:** CRITICAL
**Status:** created
**Created:** 2026-09-02

---

## 1. Summary

The codebase is stranded mid-pivot between two database dialects: the connection layer and environment
speak Postgres (`drizzle-orm/node-postgres`, `DATABASE_URL=postgresql…`, an initialized `supabase/` CLI
project), while every table definition (14 schema files + 1 migration helper, 57 `mysqlTable` definitions)
and the drizzle-kit config speak MySQL/MariaDB (`dialect: 'mysql'`, SkySQL credentials). Every service that
queries a table therefore type-checks MySQL columns against pg builder overloads — 2,043 TypeScript errors,
a `blocked` compat-layer seam (`lib/mongodb.ts`), and no runnable migrations. No code can be written for
either direction until the operator picks one; this FID makes that choice informed by specifying both
completely.

## 2. Evidence (RED)

All findings cataloged before any fix is designed. Every claim reproducible (commands recorded in
`dev/session-summaries/SESSION-2026-09-02-005.md`).

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | 2,043 type errors; signature: `MySqlTableWithColumns<…>` not assignable to `PgTable`/pg overloads | whole tree | `npx tsc --noEmit` → exit 2, `2043` error lines (2026-09-02) |
| 2 | Connection layer is Postgres: `drizzle( DATABASE_URL , { schema })` | `lib/db/connection.ts:1-7` | file read: `import { drizzle } from "drizzle-orm/node-postgres"` |
| 3 | All 14 schema files MySQL-dialect: 57 `mysqlTable` defs, 68 `json(`, 0 `bigint(` | `lib/db/schema/*.ts` | grep counts (14 files) |
| 4 | 15th MySQL-dialect file outside schema dir | `lib/migrations/factorySlots.ts:20` | grep `mysql-core` |
| 5 | drizzle-kit targets MariaDB (SkySQL `DB_*` creds; post-SESSION-2026-09-02-001 env-based) | `drizzle.config.ts` | file read: `dialect: 'mysql'`, out `./lib/db/migrations` |
| 6 | Postgres runtime config exists: `DATABASE_URL=postgresql…` | `.env.local` (name+scheme only) | grep `DATABASE_URL=[a-zA-Z0-9_]+` → `postgresql` |
| 7 | Supabase pivot INITIALIZED: `project_id = "DarkFrame"`, local Postgres stack (ports 54321/54322), CLI `.temp` state | `supabase/config.toml` | `find supabase -type f` + config key grep |
| 8 | No `@supabase/supabase-js` client anywhere (CLI only, in devDependencies) | repo | grep → 0 src matches |
| 9 | Zero runtime mysql2 driver imports (only doc-comment mention) | `lib/dmService.ts:827` (comment) | grep `drizzle-orm/mysql2` → 1 hit, comment |
| 10 | Raw MySQL-dialect SQL in 7 files, 17 executable fragments (+4 doc-comment mentions): `JSON_CONTAINS` ×14 code (authMiddleware:269, territoryService:137/336/477, dmService:129/208/420/751, clanAllianceService:166/167/178/179/605/606), `ON DUPLICATE KEY UPDATE` ×1 (researchPointService:364), `DATE_FORMAT` ×2 (clanActivityService:290 + 1 more) | 7 files | grep counts + code-vs-comment filter (SESSION-2026-09-02-005) |
| 11 | Consumer surface: 117 files import `@/lib/db`; 77 files consume the `lib/mongodb` compat layer | repo | `grep -rl` counts |
| 12 | No migrations exist for either dialect — `lib/db/migrations` is empty (drizzle `out` dir never populated) | `lib/db/migrations/` | `ls` → empty |
| 13 | `mongodb` package still in dependencies; 5 scripts/seeds import `from 'mongodb'` (wmd.seed, cleanup-duplicate-users, createIndexes, initialize-wmd-players, cleanup-beer-bases) | `package.json`, 5 files | grep list |
| 14 | April MariaDB state was genuinely green before the second pivot began | `dev/fids/FID-20260403-001.md` | "0 TypeScript errors" recorded post-migration |

**Call-graph notes (Law 4):** all runtime DB access funnels through `lib/db/index.ts` → `lib/db/connection.ts`
(`db` singleton) → drizzle builder over the schema barrel (`lib/db/schema/index.ts`, 14 files). The compat
layer (`lib/mongodb.ts`, `Collection`/`db`/`ObjectId` shims) sits *on top of* `db` for 77 consumer files —
its `any` seam exists to straddle the dialect split. Entry points: Next.js routes (`app/api/**/route.ts`,
184 files), custom `server.ts` (socket.io + jobs), cron/scripts. Nothing in either option changes the
`lib/db` import surface — 117 consumers are insulated from the driver swap; the 77 compat-layer consumers
are insulated from the seam retype by keeping its signatures.

## 3. Impact Analysis

- **Who/what is affected:** every DB-touching route/service (117 direct consumers + 77 compat consumers),
  local dev setup, deployment target (SkySQL MariaDB vs Supabase Postgres), seed/cleanup scripts, and the
  10 `@ts-nocheck` admin routes whose debt depends on the settled schema types.
- **Failure modes if unfixed:** typecheck stays red (no trustworthy gate), no migrations can be generated
  (config dialect ≠ schema dialect ≠ connection driver), runtime is one latent dialect mismatch away from
  query failures (e.g. `JSON_CONTAINS` is MySQL-only; on Postgres it throws), and the compat layer stays
  `any`-typed (lint baseline floor ~1,204 `no-explicit-any`).
- **Blast radius:** Option A touches 15 schema files, 1 connection file, 1 config file, 6 raw-SQL files,
  env vars, and deletes the SkySQL config path. Option B touches 1 connection file, 1 config file, env
  vars, and leaves 15 schema files untouched. Neither option changes consumer import surfaces. Transitively
  both settle the type surface for the 10 `@ts-nocheck` routes and unblock the `lib/mongodb.ts` seam retype
  (separate follow-up FID either way).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | YES — the FID specifies both directions end-to-end; the chosen option must handle dev, test, and prod envs plus seeds/scripts before `closed`. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | YES — both options are single-postgres/mysql instances with pooled drivers; table count (57) and connection pooling are unchanged by direction. JSON-in-column patterns (players.members, territories) remain the scale risk either way — flagged, not introduced, by this decision. |
| Survives a hostile attacker, not just an honest user? | YES — both options keep credentials env-based and fail-fast (established SESSION-2026-09-02-001); both keep parameterized queries; raw-SQL rewrites (A) and raw-SQL retention (B) use bound parameters, never string interpolation of user input (verified in the 6 flagged files). |
| Maintainable in 2 years? | YES — either direction ends with ONE dialect everywhere, typed schema, generated migrations, and a deletable `mongodb` package + compat layer. The alternative (status quo) fails this question. |
| Sets the standard for the industry? | YES — typed schema-as-code + migration discipline + env-based secrets is the standard either way; Option A additionally aligns with the managed-Postgres platform direction the tree's newest artifacts point to. |

## 5. Proposed Fix (GREEN)

Both options are specified completely. **Recommendation: Option A**, per the decision matrix in §5.3.

### 5.1 Option A — Finish the Postgres/Supabase pivot (RECOMMENDED)

- **Approach:** convert the schema layer to `pg-core`, keep the already-Postgres connection layer, repoint
  drizzle-kit to Postgres/Supabase, translate the raw MySQL SQL fragments to Postgres equivalents, and
  retire the MariaDB-specific env/credentials path.

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/db/schema/*.ts` (14 files) | modify | `mysqlTable`→`pgTable`; `varchar(n)`→`varchar({length:n})` or `text`; `int`/`tinyint`/`smallint`→`integer`/`smallint`; `datetime`→`timestamp({withTimezone:true})`; `decimal`→`numeric({precision,scale})`; `json`→`jsonb`; `index()`/`uniqueIndex()` table-callback syntax per pg-core 0.45 API |
| `lib/migrations/factorySlots.ts` | modify | same dialect conversion (15th file) |
| `lib/db/connection.ts` | keep + harden | already node-postgres; switch `DATABASE_URL` fallback `""` → fail-fast required-env (Law 14 pattern from drizzle.config) |
| `drizzle.config.ts` | modify | `dialect: 'pg'`, `dbCredentials: { url: requireEnv('DATABASE_URL') }`; drop the six `DB_*` SkySQL vars |
| `.env.local` | modify (names only) | `DATABASE_URL` authoritative (already present, `postgresql…`); `DB_*` SkySQL vars retired after cutover confirmed |
| `lib/authMiddleware.ts` | modify | `JSON_CONTAINS(clans.members, JSON_ARRAY(x))` → `sql\`(clans.members \\@> JSONB_BUILD_ARRAY(x))\`` (or `jsonb_path_exists`) — parameterized identically |
| `lib/territoryService.ts` | modify | 3× `JSON_CONTAINS(territories, JSON_OBJECT(...))` → `jsonb` containment (`@>`) equivalents |
| `lib/dmService.ts` | modify | 4× `JSON_CONTAINS(participants, JSON_ARRAY(x))` → `participants @> to_jsonb(ARRAY[x])`-style parameterized containment |
| `lib/clanAllianceService.ts` | modify | 6× `JSON_CONTAINS` (lines 166/167/178/179/605/606) → `jsonb` containment equivalents (found by audit — initially missed) |
| `lib/researchPointService.ts` | modify | `ON DUPLICATE KEY UPDATE` → `ON CONFLICT (cols) DO UPDATE` (index must exist — create via migration) |
| `lib/clanActivityService.ts` | modify | `DATE_FORMAT(timestamp, fmt)` → `TO_CHAR(timestamp, fmt)` (translate format string tokens) |
| `package.json` | modify | drop `mysql2` (+ `mongodb` when the compat-layer FID closes); keep `pg` |
| `lib/db/migrations/` | create | first `drizzle-kit generate` against a real Postgres DB; apply with `drizzle-kit push`/`migrate` before first run |
| Seeds/scripts importing `from 'mongodb'` (5 files) | modify or defer | re-point to compat layer (`lib/mongodb.ts`) or rewrite; may ride the follow-up compat FID if unchanged today |

- **Conversion mechanics:** schema conversion is mechanical (per-column mapping table above) and scriptable
  in batches with per-file verification; raw-SQL rewrites are hand-verified one-by-one (17 executable
  fragments across 7 files total). The `supabase/` CLI project (`project_id = "DarkFrame"`) becomes the
  local-dev Postgres (`supabase start`, port 54321) and, on the operator's account choice, the hosted target.
- **Alternatives considered:** reverting (Option B — see below); keeping both dialects behind adapter
  tables — rejected, it perpetuates the split and fails Five-Q #4.

### 5.2 Option B — Revert to MariaDB (SkySQL)

- **Approach:** keep all 15 MySQL-dialect schema files untouched; flip the two Postgres-side artifacts back
  to MariaDB and restore the SkySQL credential path.

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/db/connection.ts` | modify | `drizzle-orm/node-postgres` → `mysql2` driver: `drizzle(process.env.DB_URL or DB_* vars, { schema, mode: 'default' })` |
| `drizzle.config.ts` | modify | already `dialect: 'mysql'` + `DB_*` env — keep as-is (the SESSION-2026-09-02-001 fail-fast version) |
| `.env.local` | modify (names only) | restore/keep `DB_*` SkySQL vars; remove `DATABASE_URL` |
| `supabase/` | delete | abandon the initialized Supabase CLI project (or leave inert — operator call) |
| `lib/authMiddleware.ts`, `lib/territoryService.ts`, `lib/dmService.ts`, `lib/clanAllianceService.ts`, `lib/researchPointService.ts`, `lib/clanActivityService.ts` | none | raw `JSON_CONTAINS`/`ON DUPLICATE KEY`/`DATE_FORMAT` are MySQL-valid — stay |
| `package.json` | modify | drop `pg` + `node-postgres` (both currently installed; only `pg` is imported); keep `mysql2` |
| `lib/db/migrations/` | create | `drizzle-kit generate` against SkySQL MariaDB; apply before first run |
| Seeds/scripts (5 `mongodb`-importing files) | same disposition as Option A | unchanged either way |

- **Schema conversion:** zero files changed. **Risk concentrated in runtime:** the April FIDs record
  MariaDB as genuinely working (0 errors, dev server serving) — the known-good state — but the MySQL
  wire path must be re-verified end-to-end because the interim Postgres pivot touched the tree since.

### 5.3 Decision matrix (why Option A is recommended)

| Criterion | A: finish Postgres/Supabase | B: revert to MariaDB |
| --------- | --------------------------- | -------------------- |
| Code churn | 15 schema files + 7 SQL files + config | 2 files (connection + package.json) |
| Schema-file risk | mechanical column-mapping, per-file verifiable | zero |
| Where risk lives | type-level (caught by tsc) + 17 raw-SQL fragments | runtime-level (wire path, connection semantics) |
| Artifact momentum | driver/env/supabase-init/`DATABASE_URL` already Postgres — newest tree state | must undo 4 newest artifacts |
| Raw MySQL SQL | 17 executable fragments in 7 files must translate (`JSON_CONTAINS` ×14 → `@>`; `ON DUPLICATE KEY` → `ON CONFLICT`; `DATE_FORMAT` → `TO_CHAR`) | stays valid |
| Deps | drop `mysql2`+`mongodb` (2) | drop `pg`+`node-postgres` (2, incl. a non-imported oddity `node-postgres@0.6.2`) |
| Known-good precedent | none recorded on Postgres | April FIDs: MariaDB ran green |
| 2-year path | Supabase-managed Postgres + migrations from day one | SkySQL MariaDB continues |
| Hidden coupling | `Date`/`bigint`/JSON-mode semantics differ slightly (jsonb vs json; `datetime`→`timestamp` tz) | JSON-in-column stays `json` (no GIN indexing), bigint handling stays MySQL-flavored |

Honest reading: **B is the smaller, safer change today** (2 files, schema untouched, known-good April
precedent). **A is the better 2-year endpoint** (newest artifacts all point Postgres; typed jsonb; managed
platform; and the interim Postgres pivot already happened once — B must be re-verified anyway, so A's
"mechanical" churn is the price of not re-doing this decision in year 1). **Recommendation: A**, with B
as the fully-specified fallback if the operator weights near-term risk over endpoint quality. Either way
this decision closes item #7 and unblocks the compat-layer FID.

- **Verification plan (both options, per `protocol.config.yaml`):**
  1. `npx tsc --noEmit` → **0 errors** (the 2,043 burn to zero; this is the primary gate)
  2. `npm run lint` → ≤ current 1,961 baseline, trending down (schema conversions must not add findings)
  3. `npx drizzle-kit generate` produces a first migration; `drizzle-kit push` succeeds against a live DB
     (A: Supabase local 54321; B: SkySQL MariaDB) — connection + schema accepted by the real engine
  4. `npm run test:ci` completes (may still show pre-existing failures — hang sources are out of this
     FID's scope, but the run must terminate)
  5. Runtime smoke: `npm run dev` boots; `/api/health` 200; one read + one write through the new dialect
- **Call-graph reachability plan:** post-implementation greps proving the chosen dialect is the only one
  reachable: `grep -rn "mysql-core\|node-postgres" lib app scripts server.ts` shows exactly the expected
  set for the chosen option; `grep -rln "from '@/lib/db'"` unchanged at 117 (import surface untouched);
  compat-layer consumers unchanged at 77 until the follow-up FID.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | FID's factual claims re-verified against the tree (dialect counts, consumer counts, SQL fragment inventory, Supabase init, empty migrations dir) | commands re-run 2026-09-02, outputs in SESSION-2026-09-02-005 §Facts; all rows reproduce | pass |
| Method 2: manual re-read + claim re-verification | Full re-read 0-EOF; RED rows re-run against the tree. **First audit found a RED error: `JSON_CONTAINS` undercounted (12 est. → 18 actual; 14 executable, 4 comments) and `lib/clanAllianceService.ts` (6 fragments) was missing entirely** → SELF-CORRECT applied (RED row 10, both GREEN tables, decision matrix, mechanics note updated), claims re-run → 0 remaining discrepancies. No attribution fields; template conformance checked field-by-field | audit commands 2026-09-02 (see session record §Evidence) | pass |

- Audit outcome: **PASS → status `converged`** (after operator-facing presentation, below).
- Circuit breakers: single authoring pass, no oscillation, change delta 0% post-convergence.
- DECISION GATE: implementation (§7) does not start until the operator picks **A** or **B**. Presented as
  a blocking step per the Scope Boundary rules; until answered, no code is written.

## 7. Implementation Record (only after status reaches `converged` AND operator picks a direction)

- **Status:** IMPLEMENTING (near-complete) — **operator picked Option A (finish Postgres/Supabase) on 2026-09-02**
  (structured decision prompt; recorded in SESSION-2026-09-02-011). §5.1 is the implementation plan.
- **Files changed (session 011–012):** all 15 schema files → pg-core (59 tables, 41 index callbacks, 0
  residual mysql-core); `connection.ts` fail-fast on `DATABASE_URL`; raw-MySQL fragments translated
  (JSON_CONTAINS→jsonb containment, ON DUPLICATE KEY→ON CONFLICT, DATE_FORMAT→TO_CHAR, several converted
  to typed drizzle-builder queries outright); ~35 `QueryResult`/`affectedRows` runtime-crasher sites →
  real `.rows`/`rowCount`; all fixes properly typed (operator directive: no `any`/`unknown`) — schema
  `$type<>` retrofits, id-column defaults, domain-type corrections.
- **Verification evidence:** `npx tsc --noEmit` → **2,039 → 18**; full `vitest run` → **333 passed /
  1 skipped / 0 failed** (~32 s, terminates); lint 1,778 (≤ baseline, trending down).
- **Residual (blocks the typecheck-0 gate, operator decision):** 18 TS2305 phantom-table imports across
  5 WMD files (`wmdSpies`, `wmdIntelligenceReports`, `wmdSecurityStatus`, `wmdCounterIntelOperations`,
  `wmdInterceptions`×2, `wmdSabotageOperations`×2, `wmdAlerts`, `playerNotifications`, `emailQueue`,
  `adminDashboardNotifications`, `clanRelations`, `wmdRetaliationRights`, `wmdConsequenceEvents`,
  `wmdLaunchAuthorizations`, `wmdResourcePools`, `wmdDefenseGrids`) — tables never defined in any commit;
  consuming features need design-or-removal (data-model design is out of agent scope). Latent bugs fixed
  en route are itemized in SESSION-2026-09-02-012.
- **Call-graph reachability evidence:** to be pasted after implementation (grep set per §5 verification plan)

## 8. Closure (planned)

- **Gates:** [ ] typecheck 0 errors · [ ] lint ≤ 1,961 and trending down · [ ] tests terminate · [ ] call-graph proven
- **Commit hash (G2):** to be prepared post-implementation (operator commits)
- **Staging plan (G3/G4):** path-scoped per the chosen option's table — schema + connection + config + SQL
  files in one logical commit; compat-layer/deps cleanup as follow-up commits
- **Commit message (G8):** prepared at implementation time as `<type>(db): <desc> (FID-20260902-001)`
- **Archive:** to `dev/fids/archive/` on close + CHANGELOG entry + session-summary log

---

**Final status:** converged
