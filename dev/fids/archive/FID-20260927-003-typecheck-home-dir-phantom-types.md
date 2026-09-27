# FID-20260927-003: Gate 9's typecheck resolved `pg` types from the user's home directory

**Filename:** `FID-20260927-003-typecheck-home-dir-phantom-types.md`
**ID:** FID-20260927-003
**Severity:** HIGH
**Status:** closed (2026-09-27, commit `fe245aa`; CI proof: gate-chain run `36336484395` — all ten gates green on ubuntu-latest, 2m55s)
**Created:** 2026-09-27

---

## 1. Summary

The first fully progressing Linux CI run (`36335490958`) passed Gates 1–8 — **Gate 7 green on a fresh clone, proving FID-20260927-002** — then Gate 9 refused with `TS7016: Could not find a declaration file for module 'pg'` across five files (plus four downstream `TS7006` implicit-anys). The host passed the same gate. Root cause: `pg` has no bundled types and `@types/pg` is declared **nowhere** in the repository — but `C:/Users/spenc/node_modules/@types/pg` (v8.11.0) exists in the user's home directory, and TypeScript's automatic `@types` inclusion walks ancestor `node_modules`. The host compiled against types that live outside the repository; CI, correctly, could not. This is the third instance of the FID-20260925-004 class — a gate's verdict a function of the machine — and the most extreme one: the phantom dependency is not even inside the repo.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output) |
| - | ------- | --------- | --------------------------- |
| 1 | **CI Gate 9 refusal** | run `36335490958` | `lib/db/connection.ts(3,22): error TS7016: Could not find a declaration file for module 'pg'. '/home/runner/work/DarkFrame/DarkFrame/node_modules/pg/esm/index.mjs' implicitly has an 'any' type` — same for `lib/clanAllianceService.ts`, `scripts/classifyTimestampColumns.ts`, `scripts/e2eHoarderJackpot.ts`, `scripts/verify-economy-agg.ts`, `scripts/verify-rp-sources.ts`; ❌ typecheck refused (exit 2) |
| 2 | **`@types/pg` is declared nowhere in the repo** | `package.json`, `package-lock.json` | `grep -c '"@types/pg"' package.json` → **0**; lockfile hits are only kysely's *optional peer* entries (`"optional": true`) — `npm ls @types/pg` → `└── (empty)` |
| 3 | **The types come from outside the repository** | `C:/Users/spenc/node_modules/@types/pg` (v8.11.0) | `node -e require.resolve('@types/pg/package.json', {paths:[cwd+'/lib']})` → `C:\Users\spenc\node_modules\@types\pg\package.json` — TypeScript's ancestor `@types` walk finds the home-directory copy |
| 4 | **`pg` itself ships no types** | `node_modules/pg/package.json` | `pg@8.23.0`: `types: undefined`, no `*.d.ts` in the package — an `@types` package is mandatory for tsc |
| 5 | **The host-resolved types are stale besides being out-of-repo** | item 3 | v8.11.0 against `pg@8.23.0` — even locally, the declared API surface lagged the runtime package |
| 6 | **The five importers are live production surface** | `lib/db/connection.ts:3` etc. | these are the DB layer and operational scripts — the import sites are the "callers" the Law-4 check requires |

**Call-graph notes (Law 4):** `lib/db/connection.ts` is imported by every DB-backed service; the five `pg`-importing files are reached from server startup and npm scripts. Nothing is unwired — the defect is purely that the types they compile against were never a declared dependency.

## 3. Impact Analysis

- **Affected:** Gate 9 on any machine without the home-directory phantom — CI first, any fresh clone next.
- **Failure modes if unfixed:** every push fails CI at Gate 9; contributors get errors the maintainer cannot reproduce.
- **Blast radius of the fix:** one devDependency declaration (+lockfile). No source change: the four `TS7006` callbacks receive contextual types from `QueryResult` once `@types/pg` exists, and the five `TS7016`s disappear by resolution. The declared surface (latest `@types/pg` 8.x) matches the runtime `pg@8.x`.

## 4. Five Questions

ALL cases — yes: types become a function of the lockfile, identical everywhere (the home-directory phantom becomes irrelevant; declaration order prefers the repo's own node_modules). Scales — yes: standard dependency hygiene. Hostile attacker — yes: type resolution is no longer environment-dependent (a supplied-types attack via ancestor directories stops compiling differently from CI). Maintainable — yes: the declared dependency is the industry-standard contract. Industry standard — yes: `@types/*` as devDependencies is the TypeScript ecosystem's baseline.

## 5. Proposed Fix (GREEN)

| File | Action | Description |
| ---- | ------ | ----------- |
| `package.json` / `package-lock.json` | modify | `npm install --save-dev @types/pg` — declares the types as a real devDependency; `npm ci` on CI then installs them. No version pin beyond the lockfile (house style: `pg` itself is caret-declared). |

- **Alternatives:** ambient `declare module 'pg'` shim — rejected (hand-maintained stub of a real, published surface; Law 13 violation). `types: []` in tsconfig — rejected (disables ALL auto-inclusion, breaks other @types). Bundling stub types in-repo — rejected (duplicate of a published package).
- **Verification plan:** host `npx tsc --noEmit` → 0; **CI simulation**: `npm ci` (pristine install from the new lockfile) then `npx tsc --noEmit` → 0 — reproducing CI's resolution locally, no home-dir reliance; full suite + 10-gate chain; push watched to green.
- **Reachability plan:** `npm ls @types/pg` → present under devDependencies; `grep -c '"@types/pg"' package.json` → ≥ 1.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1 | CI log fetched (`gh run view --log-failed`); resolution proven via `require.resolve` with explicit `paths`; absence proven via grep + `npm ls`; post-fix `npm ci` + tsc re-run | transcript | pass |
| Method 2 | `pg` package.json read (no types field); tsconfig auto-inclusion confirmed (no `types` restriction); the four TS7006 sites re-read — all are `.rows` callbacks that gain contextual types from `QueryResult` | transcript | pass |

- Circuit breakers: 1 pass, converged.
- Audit outcome: **PASS** — loop complete; fixed in-session under the operator's standing CI-contingency plan.

## 7. Implementation Record

- **Status:** done (2026-09-27) — `npm install --save-dev @types/pg` executed; verification: `npm ci` → `npx tsc --noEmit` → **0 errors** (CI-equivalent resolution, no ancestor reliance); suite green; chain exit 0. Commit: `fix(gates): declare @types/pg — the typecheck compiled against types from outside the repository (FID-20260927-003)`.

## 8. Closure

- **Staging plan:** commit 1 — `git add package.json package-lock.json`; commit 2 (ledger) — `git add SCOPE.md CHANGELOG.md VERSION dev/fids/ dev/session-summaries/`. G8 message as in §7; archive at `closed` with the CI-green run ID.

---

**Final status:** closed (2026-09-27, commit `fe245aa`. CI proof: run `36336484395` — Gate 9 printed `typecheck clean (0 errors)` on a fresh clone and the full chain passed on ubuntu-latest for the first time in the project's history.)
