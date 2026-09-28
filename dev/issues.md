# DarkFrame — Issues & Technical Debt

**Last Updated:** 2026-09-27 (session 006 — see `dev/session-summaries/SESSION-2026-09-27-006.md`)
**Open blockers:** **0** blocking. 1 open operator-side action (credential rotation).
**Status:** ✅ **BUILDING AND GREEN** — `tsc` exit 0 · `eslint` 0/0 · `test:ci` 1363/1363 · all 10 pre-push gates green on `ubuntu-latest` (CI run `36336484395`)

> Correction notice (2026-09-27): this file previously carried **"B1. 🔴 Build broken — 2,043
> TypeScript errors"** as its top blocker and described the project as *BLOCKED — build not passing*.
> `npx tsc --noEmit` exits 0. The 2,043 → 0 transition happened across the Postgres/Supabase pivot
> (2026-09-02 → 2026-09-25) and was never written back here. The 2026-09-02 claims are **preserved
> below as dated history** rather than deleted, matching the correction notices this file already
> carries. Per-claim measurements: FID-20260927-006 §3.
>
> Correction notice (2026-09-02): this file previously stated "Active Issues: 0 / NO KNOWN ISSUES"
> (last updated 2025-10-26). That was stale. The audited list from that session follows, struck where
> later work resolved it.

---

## ✅ Resolved blockers

### ~~B1. 🔴 Build broken — 2,043 TypeScript errors~~ → ✅ **RESOLVED 2026-09-25**
**Discovered:** 2026-09-01 (SESSION-2026-09-01-002) **Severity:** Critical (historical)

**Was:** `npx tsc --noEmit` exited 1 with 2,043 errors. The database migration was mid-pivot —
`lib/db/connection.ts` used the Postgres driver while all 14 files in `lib/db/schema/` were MySQL
dialect, so services type-checked MySQL columns against `PgTable`. Signature error:
`MySqlTableWithColumns` not assignable to `PgTable`. Top concentrations: friendService 119,
wmdAnalyticsService 117, moderationService 80.

**Resolution path taken:** the operator chose **Option A — finish the Postgres/Supabase pivot** on
2026-09-02. Executed across sessions 2026-09-02 onward: 15 schema files converted to pg-core, 17
raw-MySQL SQL fragments translated, `drizzle.config.ts` repointed to `dialect: 'pg'` +
`DATABASE_URL`, and the phantom WMD table imports retired.

**Now:** `npx tsc --noEmit` **exit 0**. Zero MySQL-dialect schema files remain; 57 tables are live
with 0 Law-17 violations. SCOPE row 7 closed. Related commits: `9708a38` (ledger host-independence),
`fe245aa` (`@types/pg` declared, which was the last thing keeping the typecheck honest on a clean
checkout), CI run `36336484395` — **all ten gates green on `ubuntu-latest` for the first time**.

### ~~B2. Lint script broken~~ → ✅ **RESOLVED 2026-09-02** (gate since cleared 2026-09-27)
**Discovered:** 2026-09-01 **Severity:** High
**Resolution:** `npm run lint` migrated from the removed `next lint` to `eslint .`; `.eslintrc.json`
gained `next/typescript`; `.eslintignore` added. Wired into the pre-push chain as Gate 8.
**Now:** the burn-down this file tracked for 25 days is complete — `npx eslint . --max-warnings 0`
**exit 0, 0 errors, 0 warnings**, gated at Gate 8 and re-verified in CI.

### ~~B3. Test suite does not complete~~ → ✅ **RESOLVED 2026-09-02**
**Discovered:** 2026-09-01 **Severity:** High
**Was:** full run hung past 300s and died in a JS heap OOM; friends suites failing.
**Root causes (SESSION-2026-09-02-006):** test-environment, not network — `IS_REACT_ACT_ENV_ENVIRONMENT`
never set under vitest; RTL `waitFor` freezing under vitest fake timers; dead per-worker in-memory
Mongo; missing fake-timer/user-event bridging; plus two real component bugs fixed en route.
**Now:** `npm run test:ci` = **141 files / 1363 tests, 0 failed**, wired as Gate 10 and green in CI.

---

## ⚠️ Open — operator-side

### B4. Credential rotation (repo half complete; provider half cannot be done in-repo)
**Discovered:** 2026-09-01 **Severity:** High (was Critical)

**Remediation done (2026-09-02):** plaintext credentials removed from `drizzle.config.ts`; the file
now reads a single `DATABASE_URL` and fails fast if it is absent. Repo-wide sweep: **0 plaintext
literals** outside the git-ignored `.env.local`.

**Still open:** rotating the SkySQL password **at the provider**. No repository change can do this —
it is an action on the hosting account. SCOPE row 6, narrowed 2026-09-27 to exactly this.

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
- Creds moved to git-ignored `.env.local`; `drizzle.config.ts` rewritten to fail-fast env resolution.
- Evidence: repo-wide secret sweep 0/0/0. Full record: `dev/session-summaries/SESSION-2026-09-02-001.md`.
- **Follow-up:** provider-side rotation still pending (see B4).

### [RESOLVED 2026-09-19] MongoDB shim deleted
`lib/mongodb.ts` — a 1,554-line Mongo-over-pg emulation layer — was deleted outright along with the
`mongodb` and `mongodb-memory-server` packages and its regression harnesses. SCOPE row 97.

---

## ⚠️ Known limitations (re-measured 2026-09-27)

- **~~`@ts-nocheck` on 10 admin routes~~ → 0.** `grep -rl @ts-nocheck app/ lib/` returns nothing.
  The escape hatches are gone; the field-name mismatches they papered over were fixed against route
  ground truth during the 2026-09-07 component/lib batch.
- **~~No CI/CD pipeline configured~~ → there is one.** `.github/workflows/gate-chain.yml` runs the
  identical 10-gate chain on every push, and `attribution-guard.yml` scans the same range for agent
  attribution. Both green. This limitation was written on 2026-09-02, the same day Gate 1 was
  discovered to be Windows-only and CI failed on its first ever run.
- **~~Test coverage is not measured~~ → it is, as of 2026-09-28 (FID-20260928-005).** This file
  previously claimed "~15% (target 60% per Jan 2026 baseline docs)". No coverage tooling was
  configured, so the figure could not be reproduced — the item was marked unverifiable rather than
  restated as fact. Coverage is now measured (`npx vitest run --coverage`, v8 provider over
  `lib/` + `app/api/` + `utils/`): the real baseline is **23.64% statements / 19.01% branches /
  27.39% functions / 23.78% lines** across 478 files (lib 25.59 / app/api 20.27 / utils 25.93
  statements). The old ~15% claim was never validated; the number above is reproducible.
- **~~Messaging is still on `socket.io`~~ → RESOLVED 2026-09-28 (FID-20260928-001).** Socket.io IS
  the live transport (20 direct-import files, mounted at `server.ts:34`); SCOPE row 13's Ably
  clause was false and is corrected in place. There was never a migration to reconcile.
- `dev/completed.md`, `dev/roadmap.md` and `dev/metrics.md` are historical records and are
  intentionally not rewritten — they describe what was true when they were written.

---

## 🔧 Technical debt

**Outstanding:**

- Provider-side credential rotation (B4 above) — operator action, no repo work available.
- ~~Establish or retire a test-coverage measurement; the current state is *unknown*, not *good*.~~ →
  **Established 2026-09-28 (FID-20260928-005).** Baseline: 23.64% statements / 23.78% lines on
  lib/ + app/api/ + utils/ (478 files). Measurement now exists; *good* remains a separate question.
- **Coverage baselines drift silently.** The v8 instrumentation roughly doubles some census tests'
  runtime (the terrainTruth file-scan census needed a 30s timeout to survive `--coverage` runs);
  if a future scan-style test times out only under coverage, suspect instrumentation cost before
  suspecting a real regression.
- Operator decision (FID-20260928-001): the `ABLY_API_KEY`/`ABLY_SUBSCRIBE_KEY` vars in `.env.local` have zero code readers — remove or rotate them (untracked file; no repo action available).
- Limiter keying is architecture-wide (FID-20260928-003): one shared per-IP bucket across all routes (`getUserId` always returns null, so `trackByUser` is decorative). Revisit per-endpoint keys / real user tracking only with production 429 telemetry. Auto-farm's duplicate tile fetch (move response carries `currentTile`; engine and page each re-fetch) is a separate future performance item.
- ~~`dev/lessons-learned.md` carries a merged duplicate H1 and a U+FFFD in a section heading~~ → the
  U+FFFD was fixed 2026-09-28 (row 29 sweep; the heading now matches the corpus's severity-emoji
  pattern); the merged duplicate H1 remains — historical text deliberately preserved on the row-29
  precedent that archives/records keep their damage.

**Retired (superseded claims kept for the record):**

- ~~Convert or revert the 14 MySQL-dialect schema files~~ **Done** — 14 pg-core files, 57 live tables.
- ~~Burn down the lint baseline: 1,836 findings~~ **Done** — 0 errors, 0 warnings, gated at Gate 8.
- ~~10 `@ts-nocheck` admin routes~~ **Done** — 0 files.
- ~~Commit the working tree in logical chunks~~ **Done** — `main` carries 455 commits (SCOPE row 14).
- ~~Housekeeping: 8 stray migration artifacts in root~~ **Done** — `fix_alliance.js`, `nul`,
  `convert-schemas.ps1`, `lib/clanAllianceService.ts.bak` and the rest are all gone (SCOPE row 15).
- ~~Stabilize the test environment~~ **Done 2026-09-02** (session-006).
- ~~`mongodb.ts` lint target~~ **Moot 2026-09-19** — the shim was deleted outright (SCOPE row 97).

---

**Decision queue authority:** `SCOPE.md` · **Session audit trail:** `dev/session-summaries/`
