# DarkFrame — Issues & Technical Debt

**Last Updated:** 2026-09-02 (audited reality refresh — see `dev/session-summaries/SESSION-2026-09-02-002.md`)
**Open blockers:** 2 + 1 open security half (B2 lint resolved 2026-09-02)
**Status:** ❌ BLOCKED — build not passing; decision queue in `SCOPE.md`

> Correction notice (2026-09-02): this file previously stated "Active Issues: 0 / NO KNOWN ISSUES"
> (last updated 2025-10-26). That was stale. The audited list is below.

---

## 🐛 Active blockers

### B1. 🔴 Build broken — 2,043 TypeScript errors
**Discovered:** 2026-09-01 (SESSION-2026-09-01-002) **Severity:** Critical
`npx tsc --noEmit` exits 1 with 2,043 errors. Root cause: DB migration mid-pivot —
`lib/db/connection.ts` uses the Postgres driver (`drizzle-orm/node-postgres` + `pg`) while all 14 files in
`lib/db/schema/` are MySQL dialect (`drizzle-orm/mysql-core`), so services type-check MySQL columns
against `PgTable` types. Signature error: `MySqlTableWithColumns` not assignable to `PgTable`.
Top concentrations: friendService 119, wmdAnalyticsService 117, moderationService 80.
**Resolution path:** operator decides — finish the Postgres/Supabase pivot (convert the 14 schema files)
or revert to MariaDB. (SCOPE item #7)

### ~~B2. Lint script broken~~ → ✅ RESOLVED 2026-09-02 (see Resolved issues)
**Discovered:** 2026-09-01 **Severity:** High
**Resolution:** `npm run lint` migrated from the removed `next lint` to `eslint .`; `.eslintrc.json` gained
`next/typescript` (restores the TS checking `next lint` auto-injected); `.eslintignore` added. Gate verified
two ways: fresh run (exit 1, 2,010 findings — a red gate that *runs*) + negative test (controlled probe
exited 1 naming the rule). Evidence: `dev/session-summaries/SESSION-2026-09-02-003.md`.

### B3. ✅ [RESOLVED 2026-09-02] Test suite does not complete
**Discovered:** 2026-09-01 **Severity:** High
**Was:** full run hung past 300s (per-test 5s timeouts) and died in a JS heap OOM; friends suites failing.
**Root causes (SESSION-2026-09-02-006):** test-environment, not network — `IS_REACT_ACT_ENVIRONMENT`
never set under vitest; RTL `waitFor` freezes under vitest fake timers (jest-only detection, fixed via
minimal `jest` timer shim in `vitest.setup.ts`); dead per-worker in-memory Mongo (OOM kindling, now
gated behind `TEST_MONGO_MEMORY=1`); missing fake-timer/user-event bridging in the friends suites; plus
two real component bugs fixed en route (FriendsList interval churn on every status update;
AddFriendModal stale state on prop-driven close).
**Now:** full `vitest run` = 336 passed + 1 skipped (live-DB suite behind `RUN_LIVE_DB_TESTS=1`), 33.6s.
`test:ci` is a meaningful gate again.

### ⚠️ B4 (half-open). Credential rotation
**Remediation done (2026-09-02):** plaintext creds moved from `drizzle.config.ts` to git-ignored
`.env.local` (`DB_*` vars); config is now env-based and fail-fast; repo-wide sweep found 0 plaintext
literals outside `.env.local`.
**Still open:** rotate the SkySQL password at the provider — the old one is still valid and lived in
plaintext/logs. Operator action. (SCOPE item #6)

---

## 🧾 Uncommitted work (risk, not a bug)

~5 months of work sits uncommitted on `main`: 284 files, +17,553/−30,761 (318 porcelain entries). The
working tree is the only copy of the migration work. Commit strategy awaits operator decision (SCOPE item
#14); per the version-control laws the agent prepares path-scoped staging plans and the operator executes.

---

## ✅ Resolved issues

### [RESOLVED] Edge Runtime Middleware Compatibility (FID-20251017-005)
**Date:** 2025-10-17 **Severity:** Critical
- `jsonwebtoken` (via `node-gyp-build`) pulled native modules into Edge Runtime middleware → crash on boot.
- Fix: migrated `lib/authMiddleware.ts` to `jose` (pure JS, Web Crypto), `verifyToken()` made async;
  `lib/authService.ts` unchanged (Node runtime).
- Lessons: Edge Runtime middleware must use pure-JS libraries; native-module deps are API-routes-only.

### [RESOLVED 2026-09-02] Plaintext DB credentials in `drizzle.config.ts`
**Severity:** Critical (public repo, untracked file one `git add .` from exposure)
- Creds moved to git-ignored `.env.local` as `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_SSL_REJECT_UNAUTHORIZED`;
  `drizzle.config.ts` rewritten to fail-fast env resolution via `@next/env` with `DB_PORT` range validation.
- Evidence: tsc delta 2,043→2,043 with 0 attributable; runtime config load verified via `tsx`; repo-wide
  secret sweep 0/0/0. Full record: `dev/session-summaries/SESSION-2026-09-02-001.md`.
- **Follow-up:** provider-side rotation still pending (see B4).

---

## ⚠️ Known limitations (audited 2026-09-02)

- `@ts-nocheck` on exactly 10 admin routes (field-name mismatches from the schema change) — admitted
  migration debt, still present
- No CI/CD pipeline configured
- Tracking docs other than the four refreshed this session may contain pre-pivot claims
  (`dev/completed.md`, `dev/roadmap.md` are historical records, intentionally not rewritten)
- Test coverage ~15% (target 60% per Jan 2026 baseline docs)
- Legacy debt noted Jan 2026: barrel-export usage incomplete (ECHO compliance 85%, 18/26)

---

## 🔧 Technical debt

- Convert or revert the 14 MySQL-dialect schema files (depends on B1 decision)
- Burn down the lint baseline: 1,836 findings (1,833 errors / 3 warnings) — 2,010 → 1,961 (session-004:
  auto-fixes + clanWarfareService) → 1,905 (session-007: admin/page.tsx cleaned, 3 field-name display bugs
  fixed against route ground truth) → 1,869 (session-008: ClanInspectorModal cleaned, dead date-range
  scaffolding removed) → 1,836 (session-009: territoryService cleaned — honest row types replaced the
  $type<any[]> casts, and 4 runtime-dead QueryResult errors resolved → tsc 2,043 → 2,039); next density
  targets: queryOptimization 29, HarvestButton.test 28, ChatPanel 28,
  mongodb.ts 83 (blocked on DB-direction decision — compat-layer seam)
- ~~Stabilize/mocked test environment; re-enable `test:ci` as a meaningful gate (B3)~~ **Done 2026-09-02** (session-006: full run green; 333 passed + 1 skip / ~34s, re-verified session-010)
- 10 `@ts-nocheck` admin routes to be typed properly once the schema direction settles
- Commit the working tree in logical chunks (SCOPE item #14)
- Housekeeping (SCOPE item #15): 8 stray migration artifacts in root
  (`fix_alliance.js`, `fix_wmd_files.js`, `_temp_write.py`, `_write_research.py`, `convert-schemas.ps1`,
  `DdevDarkFramefix_sub.ps1`, `nul`, `lib/clanAllianceService.ts.bak`) — removal is destructive, awaiting operator call

---

**Decision queue authority:** `SCOPE.md` · **Session audit trail:** `dev/session-summaries/`
