# FID-20260913-001: vitest jsdom suite dead

**Filename:** `FID-20260913-001-vitest-jsdom-collection-failure.md`
**ID:** FID-20260913-001
**Severity:** critical
**Status:** verified
**Created:** 2026-09-13 22:17

---

## Summary

Every vitest suite using the jsdom environment (75 of 76 test files) died at
collection with `Error: No such built-in module: node:`. Root cause: vite
8.0.3's browser-external stub is reverse-mapped by vitest 4.1.2's
`toBuiltin()` via `id.slice(24)` into empty string `""`, producing literal
`node:` which Node rejects. Under jsdom, all node-builtin imports hit this
path and crash.

**Before:** 75 failed files / 2 passing tests.

**After:** 75 passing files / 734 tests / 0 failures / 1 env-gated skip.

## Environment

- **OS:** Windows 11 (NTFS)
- **Node:** v25.2.1 (non-LTS)
- **Tool Versions:** vitest 4.1.2, vite 8.0.3, jsdom 27.4.0
- **Commit/State:** Working tree (uncommitted; operator retracted commit request)

---

## Detailed Description

### Problem

`npx vitest run` produced 75 failed / 1 passed (76) test files. Only 2 tests
executed. All failures occurred at suite import/collection time:

```text
Error: No such built-in module: node:
```

The single passing file
(`__tests__/lib/websocketBroadcast.test.ts`) carried
`// @vitest-environment node`.

### Root Cause

#### Layer 1: vite 8.0.3 x vitest 4.1.2 `toBuiltin()` contract break

Under jsdom vite externalizes node builtins to a stub id. vitest 4.1.2's
module-runner reverse-maps that stub back via `toBuiltin()`:

```js
// node_modules/vitest/dist/chunks/modules.BJuCwlRJ.js
const browserExternalId = "__vite-browser-external";
function toBuiltin(id) {
  if (id.startsWith(browserExternalId))
    id = id.slice(24); // "" when bare
  // namespace guards don't match ""
  return `node:${id}`; // literal "node:" -> rejected
}
```

When the stub id is the bare `__vite-browser-external` (no `:module`
suffix), `slice(24)` yields `""` -> `node:` -> Node rejects with
`ERR_UNKNOWN_BUILTIN_MODULE`. The `node:` prefix does **not** bypass
externalization (confirmed: warning names it either way).

#### Layer 2: dead polyfill in `vitest.setup.ts`

Line 12 imported `TextEncoder`/`TextDecoder` from bare `'util'`. Under
Node 11+ both are globals; jsdom does not remove them. The
`if (!globalThis.TextEncoder)` guard could never fire. The import's
presence in the setup graph poisoned every jsdom worker while the
polyfill itself was provably dead code.

#### Layer 3: 25 server-side test files lacked per-file pragma

Once the setup polyfill was removed, 25 server-side test files (api
routes, lib services, websocket, tutorial) still died because their
import chains pull in `pg`, `drizzle`, `mongodb`, `socket.io` -- all
node builtins hitting the same `toBuiltin()` crash. None used DOM
APIs (verified by grep). Fix: `// @vitest-environment node` as
line 1, matching `websocketBroadcast.test.ts`.

#### Layer 4: hardcoded ISO week in scheduler test

`beerBaseScheduler.test.ts` hardcoded `const week = 37`. After 8pm ET
UTC rolls to week 38. `getISOWeek(new Date()) !== 37` so dedup never
matches and `spawn` fires. Exported `getISOWeek` from the manager
and compute the week at test time.

### Evidence

**Baseline (BEFORE):**

```text
 Test Files  75 failed | 1 passed (76)
      Tests  2 passed (2)
```

**After setup polyfill removal:**

```text
 Test Files  25 failed | 51 passed | 1 skipped (76)
      Tests  530 passed (530)
```

**After 25 per-file pragmas:**

```text
 Test Files   1 failed | 74 passed | 1 skipped (76)
      Tests  733 passed | 1 failed (734)
```

**After beerBaseScheduler time-fix:**

```text
 Test Files  75 passed | 1 skipped (76)
      Tests  734 passed | 1 skipped (735)
```

**tsc:** exit 0, 0 errors.
**eslint:** exit 0, 0 findings.

### `toBuiltin()` empty-string crash

```js
// node_modules/vitest/dist/chunks/modules.BJuCwlRJ.js:20-33
const browserExternalId = "__vite-browser-external";
function toBuiltin(id) {
  if (id.startsWith(browserExternalId))
    id = id.slice(24);
  if (id.startsWith(NPM_BUILTIN_NAMESPACE) || ...)
    return id;
  if (isDeno || isBun) return id;
  return `node:${id}`; // bare id -> literal "node:" -> rejected
}
```

---

## Impact Assessment

### Affected Components

- Every vitest suite in the project (76 files)
- CI/test infrastructure reliability
- Developer confidence in committed gate claims

### Risk Level

- [x] Critical: test infrastructure non-functional under jsdom

---

## Proposed Solution

### Approach

1. Remove dead `TextEncoder`/`TextDecoder` polyfill from `vitest.setup.ts`.
2. Add `// @vitest-environment node` to 25 server-side test files.
3. Export `getISOWeek`, eliminate hardcoded ISO week.

### Steps

1. Remove `'util'` import + dead polyfill guard from `vitest.setup.ts`
2. Add `@vitest-environment node` pragma to 25 server-side test files
3. Export `getISOWeek`, rewrite scheduler test's hardcoded week
4. Full-suite verification: tsc 0, eslint 0, vitest 75 passed / 0 failures

---

## Verification Gates

- gate: tsc (full repo)
- gate: eslint (full repo)
- gate: vitest (full suite)

---

## Perfection Loop

### Loop 1 -- RED

- **RED:** `vitest.setup.ts:12` bare `'util'` import -> vite jsdom
  externalization -> `toBuiltin()` `slice(24)` -> empty `node:` ->
  crash. 25 server-side test files with no `@vitest-environment node`
  pragma. `beerBaseScheduler` hardcoded ISO week 37 stale at 8pm ET.
- **GREEN:** (a) Remove dead polyfill import + guard (13-line removal).
  (b) Add `// @vitest-environment node` to 25 files (25 one-line
  insertions). (c) Export `getISOWeek`, rewrite test to
  `getISOWeek(new Date())` (2-line change).
- **AUDIT:** Inline verification -- tsc 0, eslint 0, full vitest suite.
- **CHANGE DELTA:** ~100% of FID (written from scratch after convergence).

### Missed Questions

1. **Why didn't committed "vitest 729/734" gate claims catch this?**
   No CI workflow exists. All gate claims were local-only and
   unverifiable. The fix is confirmed only on this machine.
2. **Does polyfill removal break anything else?**
   No: TextEncoder/TextDecoder are globals since Node 11; jsdom does
   not remove them; the guard condition was always false.
3. **Why `--pool=forks` did not help?**
   The crash is in module-runner resolution, not worker isolation. Both
   `threads` and `forks` share the same `toBuiltin()` code path.

---

## Implementation Evidence

- **Files changed:** `vitest.setup.ts` (+13/-10),
  `lib/jobs/beerBaseManager.ts` (+3),
  `__tests__/lib/beerBaseScheduler.test.ts` (+9),
  25 test files (+1 each).
- **tsc:** exit 0 (re-verified 2026-09-13 23:17 EDT).
- **eslint:** exit 0 (re-verified 2026-09-13 23:17 EDT).
- **vitest:** 75 passed | 1 skipped (76), 734 passed | 1 skipped (735),
  0 failures, 15.10s (re-verified 2026-09-13 23:12 EDT)
- **Baseline was:** 75 failed / 1 passed (76), 2 passed (2), tsc 0,
  eslint 0.

---

## Resolution

- **Status:** verified
- **Fix Description:** Removed dead node-builtin polyfill from vitest
  setup, added `@vitest-environment node` to 25 test files, exported
  `getISOWeek` and eliminated time-dependent hardcoded week.
- **Tests Added:** No new test files. Existing suite now runs fully.
- **Verification Evidence:** tsc exit 0, eslint exit 0, vitest 75/76
  passed / 734/735 tests / 0 failures.

---

## Lessons Learned

1. Bare node-builtin imports in test setup files can kill entire suites
   under vite's jsdom environment.
2. Server-side test files need explicit `@vitest-environment node` when
   they import node builtins.
3. Hardcoded temporal values in tests are time-bombs.
4. Gate claims without CI are unverifiable.
