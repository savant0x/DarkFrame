# DarkFrame — Progress

**Last Updated:** 2026-09-02 (clan analytics backend, session 010 — see `dev/session-summaries/SESSION-2026-09-02-010.md`)
**Active work:** None — pending operator decisions (see decision queue below)
**Build health:** ❌ NOT BUILDABLE — `npx tsc --noEmit` = 2,039 errors (exit 1)
**Lint gate:** ✅ functional — `npm run lint` = `eslint .`; baseline burned down 2,010 → 1,961 → 1,905 → 1,869 → **1,836** (2026-09-02, sessions 004/007/008/009 — admin/page.tsx, ClanInspectorModal, territoryService fully cleaned); next: queryOptimization 29, HarvestButton.test 28, ChatPanel 28, mongodb.ts 83 (blocked on DB decision)
**Test gate:** ✅ functional — full `vitest run` green: 333 passed + 1 env-gated skip in ~34s (2026-09-02, SESSION-2026-09-02-006; was heap-OOM past 300s; count re-verified in session 010)

> **Correction notice (2026-09-02):** The FID-20260403-002 record below previously claimed
> "TypeScript: 0 errors ✅" and "ESLint: 0 errors, 0 warnings ✅". Those claims were true at the time of
> the April migration work but are **no longer true**: a subsequent, uncommitted Postgres/Supabase pivot
> (`lib/db/connection.ts` → `drizzle-orm/node-postgres` + `pg`, while the 14 files in `lib/db/schema/`
> remain MySQL dialect) broke the type surface. The claims are corrected in place below rather than
> deleted, so the history stays auditable. Current audited numbers live in the claim-vs-reality table and
> the **Architecture as of 2026-09-02 (audited)** block below.

---

## 🔴 FID-20260403-002: MongoDB → MariaDB Migration (April 2026) — status corrected

**Status:** ✅ COMPLETED (as scoped in April) → ⚠️ **SUPERSEDED by a later unfinished pivot**
**Priority:** CRITICAL **Complexity:** 5/5
**Created:** 2026-04-04 **Completed:** 2026-04-04T23:30:00

**Description:** Full database migration from MongoDB to MariaDB (SkySQL) using Drizzle ORM.

**Claimed results (April 2026) vs audited reality (2026-09-02):**

| Claim (April) | Reality (audited 2026-09-02) |
| ------------- | ---------------------------- |
| TypeScript: 0 errors ✅ | ❌ 2,039 errors (`npx tsc --noEmit`, exit 1) |
| ESLint: 0 errors, 0 warnings ✅ | ❌ lint script broken (`next lint` removed in Next 16) → ✅ REPAIRED 2026-09-02: `eslint .` gate runs; baseline 2,010 findings |
| Dev server: starts and serves correctly ✅ | Not re-verified this session |
| Database: MariaDB (SkySQL) via Drizzle ORM ✅ | ⚠️ `drizzle.config.ts` targets MariaDB, but `lib/db/connection.ts` uses the Postgres driver — direction is split |
| All 40+ collections mapped to relational tables ✅ | ✅ 14 schema files exist in `lib/db/schema/` (MySQL dialect) |
| 10 admin routes use `@ts-nocheck` | ✅ Confirmed: exactly 10 files |

**Architecture as of 2026-09-02 (audited):**

- Schema layer: 14 MySQL-dialect Drizzle schema files (`lib/db/schema/`)
- Connection layer: **Postgres** driver (`drizzle-orm/node-postgres` + `pg`) — the mismatch source
- `drizzle.config.ts`: MariaDB/SkySQL target, now env-based credentials (`DB_*` vars in git-ignored
  `.env.local`, remediated 2026-09-02; **rotation still pending at provider**)
- Messaging: socket.io ^4.8.1 remains the installed dependency; `ABLY_*` env vars are prepared but no
  `ably` SDK is installed
- Top error concentrations: friendService 119, wmdAnalyticsService 117, moderationService 80
  (signature pattern: `MySqlTableWithColumns` not assignable to `PgTable`)

---

## 📋 No active approved work

Build remediation requires an operator decision first: **finish the Postgres/Supabase pivot** (convert the
14 schema files) or **revert to the MariaDB path**. Everything downstream (2,039 errors, lint, tests,
commit strategy) cascades from that choice.

---

## 🎯 Decision queue (authoritative list: `SCOPE.md`)

1. **Rotate DB credentials** at SkySQL (repo leak closed 2026-09-02; old password still valid)
2. **DB direction** — finish Postgres/Supabase pivot vs revert to MariaDB (unblocks the 2,039 errors)
3. Lint-finding burn-down (test stabilization **done** 2026-09-02 — B3 resolved; lint gate repaired)
4. Commit strategy for ~5 months of uncommitted work (284 files, +17,553/−30,761)

---

**See:**
- `dev/issues.md` — blocker list
- `dev/QUICK_START.md` — session recovery
- `SCOPE.md` — approved scope and decision queue
- `dev/session-summaries/` — audit trail
