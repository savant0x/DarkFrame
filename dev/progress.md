# DarkFrame — Progress

**Last Updated:** 2026-09-27 (session 006 — see `dev/session-summaries/SESSION-2026-09-27-006.md`)
**Active work:** Gate hardening and evidence integrity (FID-20260927-001, -004, -005, -006). The migration that blocked this project is finished; see the decision queue.
**Build health:** ✅ `npx tsc --noEmit` — **0 errors, exit 0**
**Lint gate:** ✅ `npx eslint . --max-warnings 0` — **0 errors, 0 warnings, exit 0** (baseline cleared 2026-09-27; the 1,836-finding burn-down that this file tracked for 25 days is complete)
**Test gate:** ✅ `npm run test:ci` — **141 files / 1363 tests passed, 0 failed**
**CI:** ✅ `.github/workflows/gate-chain.yml` runs the same 10-gate chain on `ubuntu-latest`; **all ten gates green** (run `36336484395`, 2026-09-27 — the first green CI run in project history). `attribution-guard.yml` enforces the no-attribution rule.

> **Correction notice (2026-09-27):** this file previously led with *"Build health:
> ❌ NOT BUILDABLE — `npx tsc --noEmit` = 2,039 errors (exit 1)"*, described 14 MySQL-dialect
> schema files, a `drizzle.config.ts` reading `DB_*` from `.env.local`, ~5 months of uncommitted
> work, and a decision queue whose top two items had both been decided. All of it was overtaken
> by work that shipped in the 25 days since the 2026-09-02 refresh. The claims are corrected
> below and **preserved as dated history**, exactly as the 2026-09-02 refresh corrected the
> April claims before it — deleting them would destroy the record of *why* the numbers moved.
> Per-claim measurements: FID-20260927-006 §3.

> **Correction notice (2026-09-02):** the FID-20260403-002 record below previously claimed
> "TypeScript: 0 errors ✅" and "ESLint: 0 errors, 0 warnings ✅". Those claims were true at the time of
> the April migration work but were **no longer true** then: a Postgres/Supabase pivot was mid-flight
> (`lib/db/connection.ts` → `drizzle-orm/node-postgres` + `pg`, while the files in `lib/db/schema/`
> were still MySQL dialect) and had broken the type surface. Corrected in place rather than deleted.

---

## Where the project actually is

The database migration that defined this project's last quarter is **finished and gated**.

- **Schema:** 14 pg-core Drizzle schema files, `0` MySQL-dialect. The schema-consumer census
  (Gate 4, Law 17) reports **57 tables — 57 live, 0 ticketed, 0 violations**: every table has a
  writer and a reader outside its defining file, or a removal ticket.
- **Connection:** `drizzle.config.ts` reads a single `DATABASE_URL` (`:33`); there is no `DB_HOST` /
  `DB_USER` / `DB_PASSWORD` reference left in the repo.
- **Legacy:** `lib/mongodb.ts` (a 1,554-line Mongo-over-pg emulation shim) was **deleted outright**
  on 2026-09-19. The `mongodb` and `mongodb-memory-server` packages are gone.
- **Escapes:** `@ts-nocheck` appears in **0** files (this file previously claimed 10 admin routes).
- **Gates are wired, not declared.** `protocol.config.yaml` names three verification commands and
  all three run in the pre-push chain and in CI: typecheck (Gate 9), lint (Gate 8), suite (Gate 10),
  plus four censuses and the attribution scan.

**Messaging is the one subsystem still on its original transport:** `socket.io` (`lib/websocket/`,
≥5 importers). No `ably` import exists anywhere in the tree, despite SCOPE row 13 recording that
messaging had moved to Ably. Recorded here as an observation, not a decision — see FID-20260927-006 §3.

---

## 🟢 FID-20260403-002: MongoDB → MariaDB Migration (April 2026) — and everything since

**Status:** ✅ COMPLETED (as scoped in April) → ⚠️ superseded by a later pivot → ✅ **that pivot is also finished**

The April migration to MariaDB was itself superseded by the Postgres/Supabase pivot, which was
executed 2026-09-02 (operator chose Option A) and completed 2026-09-25. The 2026-09-02 state was a
build with 2,039 type errors mid-migration; the current state is a clean build with the whole gate
chain green on both Windows and Linux.

| Claim (April 2026) | Reality then (audited 2026-09-02) | Reality now (2026-09-27) |
| ------------- | ---------------------------- | ------------------------ |
| TypeScript: 0 errors ✅ | ❌ 2,039 errors | ✅ **0 errors, exit 0** |
| ESLint: 0 errors, 0 warnings ✅ | ❌ lint script broken → repaired, baseline 2,010 | ✅ **0 errors, 0 warnings** |
| Dev server: starts and serves correctly ✅ | not re-verified | not re-verified this session |
| Database: MariaDB (SkySQL) via Drizzle ✅ | ⚠️ direction split (pg driver vs MySQL schema) | ✅ **Postgres throughout; `DATABASE_URL` only** |
| All 40+ collections mapped ✅ | ✅ 14 schema files, MySQL dialect | ✅ **14 pg-core files, 57 tables, all live** |
| 10 admin routes use `@ts-nocheck` | ✅ confirmed: exactly 10 | ✅ **0 files** |

**Architecture as of 2026-09-27 (measured):**

- Schema layer: 14 pg-core Drizzle files (`lib/db/schema/`)
- Connection layer: `drizzle-orm/node-postgres` + `pg`, single `DATABASE_URL`
- Messaging: `socket.io` (live) · Cache/rate-limit: `ioredis` (declared, env-gated)
- Gates: 10 pre-push gates + 2 GitHub Actions workflows, all green on `ubuntu-latest`
- Version: `VERSION` 0.0.44

---

## 🎯 Decision queue

Re-measured 2026-09-27. **One item is genuinely open; three are resolved.**

1. ⏳ **Rotate DB credentials at the provider (SkySQL).** Still open, and still operator-side — no
   repository change can rotate a live password. The repo half is long done: `drizzle.config.ts` no
   longer contains a credential, and a repo-wide sweep finds zero plaintext literals. What remains is
   only whether whatever that credential could reach while it sat in the file needs rotating.
   SCOPE row 6, narrowed 2026-09-27.
2. ✅ **DB direction** — decided 2026-09-02 (Option A: finish the Postgres/Supabase pivot) and executed.
   SCOPE row 7 closed.
3. ✅ **Lint-finding burn-down** — the repo-wide lint gate passes outright. Closed 2026-09-27.
4. ✅ **Commit strategy** — `main` carries 455 commits; the working tree is no longer the only copy of
   the work. SCOPE row 14 closed.

---

**See:**
- `dev/issues.md` — blocker list
- `dev/QUICK_START.md` — session recovery
- `SCOPE.md` — approved scope and decision queue
- `dev/lessons-learned.md` — lessons corpus
- `dev/session-summaries/` — audit trail
