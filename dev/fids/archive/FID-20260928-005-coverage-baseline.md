# FID-20260928-005: Test coverage was never measured — the "~15%" figure was unverifiable folklore

**Filename:** `FID-20260928-005-coverage-baseline.md`
**ID:** FID-20260928-005
**Severity:** LOW
**Status:** closed (2026-09-28, commit `7e13ece`)
**Created:** 2026-09-28

---

## 1. Summary

`dev/issues.md` honestly recorded that "Test coverage is not measured": an old claim of "~15% (target 60%)" could not be reproduced because no coverage tooling was configured, so the item was marked **unverifiable** rather than restated as fact — and closing it was flagged as a real decision, not a doc fix. This FID makes that decision: measure the real number, publish it, and retire the debt. Coverage is now measured by `npx vitest run --coverage` (v8 provider, `@vitest/coverage-v8@4.1.11` matched to vitest 4.1.11) over the production surface — `lib/`, `app/api/`, `utils/` — with tests, configs, and type declarations excluded. **Baseline (2026-09-28): 23.64% statements / 19.01% branches / 27.39% functions / 23.78% lines across 478 files (24,444 statements / 23,364 lines).**

## 2. Evidence (RED)

| # | Finding | Location | Evidence |
| - | ------- | -------- | -------- |
| 1 | No coverage tooling was configured before this FID | `package.json`, `vitest.config.ts` (before-state) | The debt line itself (dev/issues.md, standing since 2026-09-02): "No coverage tooling is configured, so the figure cannot be reproduced" |
| 2 | First install grabbed the wrong major: `npm install --save-dev @vitest/coverage-v8` crashed twice with the npm 10.9.2 arborist bug (`TypeError: Cannot read properties of null (reading 'edgesOut')`); the workaround `--legacy-peer-deps` bypassed peer checking and pulled `@vitest/coverage-v8@5.0.2`, whose peer range is exactly `vitest@5.0.2` — against installed vitest 4.1.11 | install transcript + `npm ls` (mismatch run) | `npm ls vitest @vitest/coverage-v8` flagged both packages `invalid` against each other's ranges |
| 3 | The mismatch failed coverage takeover in every worker: 144 unhandled `AssertionError: coverageFilesDirectory is required` (one per test file) from `@vitest/coverage-v8/dist/index.js:71 takeCoverage`, run exited 1 | /tmp/cov.txt (run 1) | "Vitest caught 144 unhandled errors during the test run"; `× no file hand-rolls its own farmability list 16034ms` (timeout) |
| 4 | Downgrade to the matching `@vitest/coverage-v8@4.1.11` (exact pin) — `npm install --save-dev --save-exact @vitest/coverage-v8@4.1.11` — resolved cleanly with no arborist crash and no legacy flag | `package.json` | dependency now `"@vitest/coverage-v8": "4.1.11"`; `npm ls` shows no invalid marks |
| 5 | vitest 4 requires an explicit `coverage.include` to instrument anything — an unscoped run reported 0% for every file | /tmp/cov0.txt (unscoped run) | "All files | 0" across the board before `include: ['lib/**','app/api/**','utils/**']` was configured |
| 6 | Under the matched provider the terrainTruth file-scan census (O(n²) statement scan, FID-20260927-001 pin) runs 4.7s under instrumentation — still above the 5s-default danger zone, so it carries an explicit 30s per-test timeout | /tmp/cov3.txt, `__tests__/terrainTruth.test.ts` | run 1 `× …16034ms` → run 3 `✓ …4665ms` |
| 7 | vitest 4's `json` reporter does not emit `coverage-summary.json`; `json-summary` was added so the baseline is machine-readable for future censuses | coverage/ | `coverage/` held only `coverage-final.json` after run 2; `coverage-summary.json` present after run 3 |
| 8 | The measured surface is 478 files / 24,444 statements / 23,364 lines (totals from `coverage/coverage-summary.json`) | dev/tmp/cov-groups.cjs (scratch probe, deleted after use) | `total: {statements:{total:24444,covered:5779,pct:23.64}, branches:{pct:19.01}, functions:{pct:27.39}, lines:{total:23364,covered:5558,pct:23.78}}` |

## 3. Impact Analysis

- **Who/what is affected:** the project's ability to reason about its own tests. No runtime behavior changes — the only code touch is a per-test timeout on an already-slow census pin (a no-op without `--coverage`).
- **Failure modes if unfixed:** coverage stays folklore; the "~15%" claim can neither be confirmed nor refuted; any "coverage improved/regressed" statement remains unverifiable; target-setting (the old 60% goal) is meaningless without a real baseline.
- **Blast radius of the fix:** devDependencies (+1 exact-pinned provider), vitest.config.ts (coverage block + `json-summary`), one per-test timeout constant. No production code, no API surface, no schema.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** The include list covers the whole production surface (lib, app/api, utils); everything else is excluded deliberately (tests, config, .d.ts), not ignored by accident. Degraded runs (a test file timing out under instrumentation) are surfaced as test failures, not silently skipped. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** Instrumentation adds ~7s to a 41.5s suite; new lib/app/api/utils files are instrumented automatically by the include globs. New sweep-style tests with scan loops should carry explicit timeouts (convention now recorded in issues.md). |
| Survives a hostile attacker, not just an honest user? | **Yes.** This is tooling, not a trust boundary. The coverage numbers are computed from the same files tsc/eslint/vitest already read; nothing about the attack surface changes. |
| Maintainable in 2 years? | **Yes.** One command (`npx vitest run --coverage`) reproduces the number; `json-summary` makes it machine-checkable; the baseline is dated and attributed in CHANGELOG and issues.md. The exact pin documents *why* (major-match rule). |
| Sets the standard for the industry? | **Yes.** "Mark it unverifiable, then measure it" is the honest path the debt line itself demanded — the old number was folklore, the new one is reproducible. |

## 5. Proposed Fix (GREEN)

- **Approach:** install the vitest-major-matched v8 provider (exact pin), scope `coverage.include` to the production surface, emit `json-summary` alongside text/json/html, and raise the one census test's timeout explicitly (30s) because scan-style tests are the known instrumentation hot spot.
- **Alternatives considered:**
  1. *Upgrade vitest to 5.x to match the newest provider* — rejected: an upgrade of the whole test stack is out of scope for a measurement task and risks unrelated breakage; the 4.1.11 provider is identical in lineage and registry-published.
  2. *Raise `testTimeout` globally* — rejected: masks real hangs in every other test; the slow census is the known exception and gets the exception.
  3. *Exclude terrainTruth.test.ts from the census surface or the coverage run* — rejected: hiding the slowest honest test from coverage would rot the pin it carries.
  4. *Report istanbul provider instead* — rejected: adds a second instrumentation stack; v8 is the vitest-native default and was the operator-directed choice.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `package.json` / `package-lock.json` | modify | devDependency `@vitest/coverage-v8@4.1.11` (exact). Note: the first successful install (5.0.2 via `--legacy-peer-deps`) also pruned 40 stale lockfile packages (webpack-era drift: @webassemblyjs/*, ajv-formats, schema-utils, react-is, jest-worker, …). Verified benign: next 16.3.5 vendors webpack in `node_modules/next/dist/compiled/webpack`; removed packages appear nowhere else in the lockfile; tsc exit 0 after. |
| `vitest.config.ts` | modify | `coverage` block: `provider: 'v8'`, `reporter: ['text','json','json-summary','html']`, `include: ['lib/**','app/api/**','utils/**']`, excludes for tests/config/.d.ts. |
| `__tests__/terrainTruth.test.ts` | modify | the consumer-census `it(...)` gains an explicit 30s timeout (comment explains why: O(n²) statement scan + v8 instrumentation). |
| `dev/issues.md` | modify | the unverifiable limitation rewritten as measured fact; the outstanding item retired with the number; one new note records the instrumentation-timeout gotcha. |

- **Verification plan:** `npx tsc --noEmit` → 0; `npx eslint . --max-warnings 0` → 0/0; census exit 0; `npx vitest run` (bare) → full suite green; `npx vitest run --coverage` → 144/144 files green with the baseline table above.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: command re-execution | Peer-major match (`npm ls` clean); coverage run twice to green (runs 2 and 3, both exit 0, 144/144 files); baseline numbers re-derived twice independently — once from the text table (`All files` row) and once from `coverage-summary.json` totals via the scratch probe — agreeing to rounding | §2 findings 4, 8; /tmp/cov2.txt + /tmp/cov3.txt | pass |
| Method 2: manual re-read | vitest.config.ts coverage block re-read in full after edits; issues.md rewrites re-read against the original complaint text (the "~15%" claim is addressed, not papered over); Five Questions re-checked against the actual blast radius | this document §1/§5 | pass |

- **Honest limitations recorded:** (1) v8-provider line/statement counts differ slightly from istanbul's would-be numbers; the baseline is only comparable to future runs with the same provider and include list. (2) The baseline reflects unit/integration-test execution only — no e2e suite contributes. (3) `branchesTrue` is a v8 artifact and reported as 100% by the provider; the meaningful branch figure is 19.01%. (4) The census-style static tests (terrainTruth family) exercise file *reads*, not their subjects' behavior, so some lib code is "executed" only by tests that read it as text — the number is a floor, honestly so.
- **Audit outcome: PASS → status `loop-complete`.** Circuit breakers: 2 green coverage runs, two-method audit, delta n/a (new measurement, not a behavior change).

## 7. Implementation Record

- **Status:** done (implemented 2026-09-28 under the session's standing operator approval; the operator directive established this task)
- **Files changed:** as §5 table; verification evidence executed this session: `npx tsc --noEmit` → 0 (post-lockfile-change) · `npx eslint . --max-warnings 0` → 0/0 · census exit 0 · bare suite + coverage suite both 144/144 files · baseline table reproduced twice
- **Call-graph reachability evidence:** not applicable — no production call graph touched; the only executable change is a timeout argument on one test.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (144 files) · [x] census exit 0 · [x] coverage run green twice with matching numbers
- **Commit hash (G2):** `7e13ece` — *test(coverage): establish v8 coverage measurement — provider matched to vitest 4.1.11, surface scoped to lib+app/api+utils (FID-20260928-005)*; the ledger-closure commit follows.
- **Staging plan (path-scoped, G3/G4):** commit 1 (tooling): `git add package.json package-lock.json vitest.config.ts __tests__/terrainTruth.test.ts`; commit 2 (ledger): `git add dev/issues.md CHANGELOG.md VERSION dev/fids/FID-20260928-005-coverage-baseline.md dev/session-summaries/SESSION-2026-09-28-007.md` — never `git add -A`.
- **Commit message (G8):** `test(coverage): establish v8 coverage measurement — 23.64% statements / 23.78% lines baseline recorded, unverifiable debt retired (FID-20260928-005)`
- **Archive:** move to `dev/fids/archive/` at `closed`; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** closed
