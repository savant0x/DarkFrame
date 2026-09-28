# FID-20260927-004: the ledger census test's six-subprocess loop — SCOPE row 134's flake, identified

**Filename:** `FID-20260927-004-ledger-census-test-timeout-flake.md`
**ID:** FID-20260927-004
**Severity:** MEDIUM
**Status:** implemented
**Created:** 2026-09-27

---

## 1. Summary

SCOPE row 134 recorded an `[OPEN-OUT-OF-SCOPE]` finding — "one unreproduced single-test failure in a full-suite run" — observed twice, on two platforms, and never captured mid-failure, because the grep patterns used to extract the failing test matched intentional error-path log text instead of a failure banner.

This FID identifies that failure and fixes its cause.

The flake is `__tests__/lib/ledgerIntegrityCensus.test.ts` → `'passes a lawful live status'`: a single `it()` that looped six statuses and, for each, spawned the census as a real `node` subprocess against a freshly materialized fixture tree. Six sequential subprocess spawns cost roughly six seconds against vitest's 5,000 ms default budget. The test therefore passed in isolation and failed under full-suite parallel load — exactly the intermittent, environment-dependent signature row 134 could not pin down across two occurrences.

The fix gives each status its own `it.each` case, so each carries its own timeout budget and a failure names the status that broke instead of condemning the whole loop. No assertion logic changed; only the test's granularity.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | The failing test is nameable in a full-suite run | `__tests__/lib/ledgerIntegrityCensus.test.ts:168` | `npx vitest run` → `Test Files 1 failed \| 140 passed (141)`; `Tests 1 failed \| 1348 passed (1349)`; block reads `FAIL __tests__/lib/ledgerIntegrityCensus.test.ts > ledger-integrity census > passes a lawful live status` with frame `❯ __tests__/lib/ledgerIntegrityCensus.test.ts:168:3` |
| 2 | **It is a timeout, not an assertion failure** — which is why no expected/received text ever appeared in the captured window | same | Failure body is `Error: Test timed out in 5000ms. If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".` No assertion diff is printed. |
| 3 | The test passes in isolation — so the defect is load-sensitivity, not a wrong assertion | `__tests__/lib/ledgerIntegrityCensus.test.ts` | `npx vitest run __tests__/lib/ledgerIntegrityCensus.test.ts` → `Test Files 1 passed (1)`, `Duration 7.44s` (`tests 6.61s`) — the file alone already exceeds the default per-test budget |
| 4 | **The cause is six sequential subprocess spawns inside one test** | `__tests__/lib/ledgerIntegrityCensus.test.ts:169-176` | The loop body is `const root = fixture({ 'FID-20990101-001-fixture.md': fid(status) }); const { code, out } = runLedgerCensus(root);` iterated over `['created','analyzed','fixed','verified','loop-complete','implemented']`; `runLedgerCensus` execs the census script, and the file's `tests 6.61s` across ~19 cases is dominated by this single case |
| 5 | The flake is independent of the terrain work landing in the same session | — | The census test imports nothing from `types/game.types.ts`; its inputs are fixture trees written under `dev/tmp/`. The failure appeared on the session's first full-suite run, before any census-adjacent change |

## 3. Impact Analysis

- **Who/what is affected:** the reliability of the suite's own signal. A test that passes alone and fails under load teaches the reader to dismiss a red suite as noise — which is how row 134 survived two observed occurrences on two platforms without ever acquiring a name.

## 5. Plan (GREEN)

| File | Action | Description |
| ---- | ------ | ----------- |
| `__tests__/lib/ledgerIntegrityCensus.test.ts` | modify | Replace the single `it('passes a lawful live status')` loop with `it.each([...])('passes a lawful live status: %s', (status) => { ... })`, keeping the body byte-identical: fixture → `runLedgerCensus` → exit-code assertion → non-vacuity assertion (`out` contains `1 live FID(s)`) |

- **Verification plan:** `npx vitest run` on the full suite; the census test's case count rises by five (one case becomes six) and no case exceeds its budget. Gates: `npx tsc --noEmit` 0; `npx eslint .` 0/0; `node scripts/ledgerIntegrityCensus.cjs` exit 0.
- **Red drill obligation:** satisfied by §2 finding 1 — the failure was observed live in a full-suite run **before** the fix, with the test name and the `Test timed out in 5000ms` cause both captured.
- **Call-graph reachability (Law 4):** not applicable — no new symbol and no production code path. The edit is confined to a test's structure.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: command re-execution | §2 rows 1–4 re-executed this session against the current tree; the post-fix full suite re-run | Pre-fix full run → `1 failed \| 1348 passed (1349)` naming `passes a lawful live status` with `Test timed out in 5000ms`; isolated run → `1 passed (1)`, `Duration 7.44s (tests 6.61s)` | pass |
| Method 2: manual re-read against this FID | The edited region re-read in full; assertion bodies compared against `git diff` to confirm no assertion was weakened or dropped; sibling tests in the same file checked for the same loop-per-test pattern | `git diff __tests__/lib/ledgerIntegrityCensus.test.ts` shows only the `it(` → `it.each(` restructure; `Select-String 'for \(const status of'` over the file → **0 matches** | pass |

- **Audit outcome: PASS.** Granularity-only change; no assertion weakened. Post-fix evidence: `npx tsc --noEmit` → exit 0; `npx eslint .` → exit 0; `npx vitest run` → **Test Files 141 passed (141), Tests 1354 passed (1354)**, `Failed Tests` marker count 0; `node scripts/ledgerIntegrityCensus.cjs` → exit 0, `ledger census clean`.
- **Honest limitations:** (1) the fix removes the *observed* timeout but does not prove no other load-sensitive test remains — two green full-suite runs on this host are two data points, not a guarantee on a slower machine; (2) the 5,000 ms default is unchanged repo-wide, so if other subprocess-spawning tests grow, the same class can recur and the honest remedy would be a suite-level `testTimeout`, which is a separate operator decision this FID does not pre-empt; (3) no CI run has exercised this yet — the Linux verdict comes from the operator's push.

## 7. Implementation Record

- **Status:** implemented (G2 commit outstanding — the agent does not execute git).

Implemented as specified: the loop became `it.each` over the same six statuses with an unchanged body. Full suite green at 1354/1354 across 141 files with zero failures; typecheck 0; lint 0/0; ledger census exit 0.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven (not applicable — no new symbol)
- **Commit hash (G2 — required for `closed`):** *(pending — the operator executes the staging plan below)*
- **Staging plan (path-scoped, G3/G4):** commit 1 (code): `git add types/game.types.ts lib/harvestService.ts lib/harvestService.test.ts app/api/harvest/route.ts utils/autoFarmEngine.ts components/TileRenderer.tsx components/TileHarvestStatus.tsx app/help/page.tsx __tests__/terrainTruth.test.ts __tests__/lib/ledgerIntegrityCensus.test.ts`; commit 2 (ledger): `git add dev/fids/ SCOPE.md CHANGELOG.md VERSION dev/session-summaries/` — never `git add -A`.
- **Commit message (G8):** `fix(tests): each lawful census status is its own case — the six-subprocess loop was row 134's flake (FID-20260927-004)`
- **Archive:** move to `dev/fids/archive/` on `closed` only; CHANGELOG entry; archival logged in the session summary. Never at `implemented`.

---

**Final status:** implemented
- **Failure modes if unfixed:** intermittent red suites on host and CI, each consuming an investigation cycle, and the real hazard that a genuine intermittent failure gets dismissed as "the flake again".
- **Blast radius of the fix:** one test file, granularity only. No assertion, no census script, no production code, no gate semantics.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** Every status keeps its own assertions; the change removes a shared 5s budget from six units of work rather than weakening any check. |
| Scales (design tolerates growth)? | **Yes.** A seventh status adds a case instead of another ~1s onto an already-over-budget test. |
| Survives a hostile attacker, not just an honest user? | **Yes — unchanged.** This is a harness budget, not a trust boundary; the census and its fail-closed behavior are untouched. |
| Maintainable in 2 years? | **Yes.** `it.each` states the intent ("each lawful status passes") more directly than a hand-rolled loop, and a future failure names the status that broke. |
| What is the cost of being wrong? | **Low and bounded.** The worst case is that a genuinely slow test is now six tests, each of which can still time out and be diagnosed individually. |
