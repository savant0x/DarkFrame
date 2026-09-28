# FID-20260928-002: `dev/tmp/` is invisible to `git status` but not to the Law-3 gates

**Filename:** `FID-20260928-002-devtmp-invisible-to-gates.md`
**ID:** FID-20260928-002
**Severity:** MEDIUM
**Status:** closed (2026-09-28, commit `1cf13ff`)
**Created:** 2026-09-28

---

## 1. Summary

`dev/tmp/` is the repository's designated scratch area — gitignored (`​.gitignore:72`), so the working tree always reports clean no matter what is dumped there. But `tsconfig.json`'s `**/*.ts` include, `eslint.config.mjs`'s global-ignores block, and `vitest.config.ts`'s discovery all scan it, so a scratch artifact breaks the gates **with no visible cause**: `git status --porcelain` shows nothing, and the only signal is a red gate pointing at a file the tree claims not to have. SCOPE row 128 recorded this class after it cost two wasted gate cycles on 2026-09-25 and left it open as a config decision. It happened again on 2026-09-28 (the parked FID-20260927-007 drill file needed a `.disabled` suffix to stay inert — a per-file workaround for a directory-level contract). This FID closes row 128 the way the row framed it: `dev/tmp/` becomes truly invisible to every gate, with a config pin so the exclusion cannot silently regress.

## 2. Evidence (RED)

All findings re-executed 2026-09-28 against the working tree. The drill replanted row 128's two historical incident shapes plus a third (a scratch test); every command was run with the artifacts present and `git status --porcelain` captured in the same window.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **The directory is gitignored — the tree cannot see it** | `.gitignore:72` | `grep -n "tmp" .gitignore` → `72:dev/tmp/` |
| 2 | **tsconfig scans it**: `include` carries `**/*.ts`/`**/*.tsx`; `exclude` names only `node_modules` and `dev/archives` | `tsconfig.json` (parsed) | `node -e 'const j=require("./tsconfig.json")'` → `include: ["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts",…]` · `exclude: ["node_modules","dev/archives"]` |
| 3 | **eslint scans it**: the flat config's only global-ignores block omits `dev/tmp` | `eslint.config.mjs:102` | `ignores: ['node_modules/**', '.next/**', 'out/**', 'dev/archives/**'],` |
| 4 | **vitest discovers tests in it**: `include` is `**/*.{test,spec}.*` and `exclude` omits `dev/tmp` | `vitest.config.ts` (test block) | `include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']` · `exclude: ['node_modules', 'dist', '.next', 'out']` |
| 5 | **GATE 9 goes red on a scratch file, tree clean** | drill artifact `dev/tmp/drill-broken.ts` | planted a scratch `.ts` with a nonexistent relative import → `npx tsc --noEmit` → **exit 2**: `dev/tmp/drill-broken.ts(4,25): error TS2307: Cannot find module './module-that-does-not-exist'…` — captured with `git status --porcelain` showing only the pre-existing untracked FID |
| 6 | **GATE 8 goes red on the historical incident shape** (a `.cjs` simulation shim — the exact rule that fired in row 128's incident) | drill artifact `dev/tmp/drill-shim.cjs` | `npx eslint dev/tmp/drill-shim.cjs` → **exit 1**: `2:14 error A require() style import is forbidden @typescript-eslint/no-require-imports` |
| 7 | **GATE 10 discovers and fails a scratch test** | drill artifact `dev/tmp/drill-suite.test.ts` | `npx vitest run dev/tmp` → **exit 1**: `dev/tmp/drill-suite.test.ts (1 test \| 1 failed)` — a scratch `expect(1).toBe(2)` becomes a suite failure |
| 8 | **The class already fired twice** — row 128's original incidents (a drill backup of `lib/harvestService.ts` failing tsc with four `TS2307`s; a `.cjs` shim failing eslint) | `SCOPE.md` row 128 | row text: *"found the hard way, twice in one session … in both cases `git status --porcelain` showed nothing, so the only signal was a red gate whose cause was not in the diff"* |
| 9 | **It recurred this week**: the parked FID-007 red-drill artifact had to be suffixed `.disabled` to stay out of vitest's discovery — a per-file workaround for what is a directory contract | `dev/tmp/pending-viewportCooldownTruth.test.tsx.disabled` | `ls dev/tmp/` shows the file; its inertness depends on the suffix, not on any config |
| 10 | **Ignoring the directory is safe**: nothing outside `dev/tmp` references it | repo-wide grep | `grep -rn "dev/tmp\|from ['\"].*tmp/" --include=*.ts --include=*.tsx --include=*.cjs --include=*.js dev/ scripts/` (excluding `dev/archives`, `dev/tmp` itself) → **exit 1, zero matches** — no gate script, config, or source imports from the scratch area |

**Call-graph notes (Law 4).** The defect's "call graph" is the gate chain itself: `.githooks/pre-push` gates 8/9/10 invoke `eslint .`, `npx tsc --noEmit`, and `npm run test:ci` — all three resolve files from the **working tree**, not from git's index, which is exactly why gitignored-but-present files are scanned. No production code path reaches `dev/tmp/` (finding 10), so excluding it from tooling cannot orphan a live import.

## 3. Impact Analysis

- **Who/what is affected:** any session that uses `dev/tmp/` as intended — drills, scratch probes, backup copies before an experiment. Each one risks a red gate whose cause `git status` cannot show; the natural misdiagnosis is to hunt the *staged* diff for a bug that is not there.
- **Failure modes if unfixed:** wasted gate cycles (row 128's recorded cost, paid again on 2026-09-28 finding 9); scratch `.test.ts` files silently entering the suite count; worst case, a session *deletes legitimate work* while hunting an invisible failure; and the workaround pattern (`.disabled` suffixes) proliferates per-file instead of fixing the contract once.
- **Blast radius of the fix:** three config files gain one ignore entry each; one new pin test. No source, route, schema, or script changes. Nothing can regress: the safety grep (finding 10) proves no live code reads the directory, and the entries are additive to existing ignore lists.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** All three gate surfaces are closed together — tsc (any `.ts/.tsx` shape), eslint (including the `.cjs` shim shape that the first incident used), vitest (scratch tests) — not just the one shape that last hurt. The pin fails if any of the three loses its entry. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** The exclusion is per-directory and permanent: every future scratch artifact of any shape is covered with zero marginal config. One entry, not a waiver list to maintain. |
| Survives a hostile attacker, not just an honest user? | **Yes.** The gates remain fail-closed everywhere else; a file the developer *means* to gate can still be gated by putting it outside `dev/tmp/`. The pin test means the exclusion itself cannot be silently reverted — a regression re-exposes the directory and the suite goes red, which is the correct direction of failure. |
| Maintainable in 2 years? | **Yes.** The contract becomes mechanical ("scratch lives in `dev/tmp/`, gates ignore `dev/tmp/`") instead of tribal knowledge plus per-file suffix conventions; the pin documents and enforces it in one place. |
| Sets the standard for the industry? | **Yes.** "A tooling surface and a VCS view must agree" is the same class as the census gates: every layer of the repo should give the same answer about what exists. |

## 5. Proposed Fix (GREEN)

Three one-line config exclusions and one pin test. No behavior outside `dev/tmp/` changes.

- **Approach:** add `'dev/tmp'` to `tsconfig.json`'s `exclude`; add `'dev/tmp/**'` to `eslint.config.mjs`'s global-ignores block (line 102); append `'dev/tmp/**'` to `vitest.config.ts`'s `test.exclude` array; and pin all three (plus the gitignore rule that defines the directory's purpose) with a config-parsing test so the contract cannot regress silently.
- **Alternatives considered:**
  1. *Stop treating `dev/tmp/` as a scratch area (the row's other offered option)* — rejected: the directory is gitignored by intent and in active use (finding 9); removing it would push scratch files into tracked space or into untracked ad-hoc paths, which is strictly worse.
  2. *Rename the directory into an already-ignored parent* — rejected: churn across scripts/docs for zero behavioral gain over a one-line exclude.
  3. *Leave it and rely on the `.disabled`-suffix convention* — rejected: that is the per-file workaround this FID exists to delete; it only covers the vitest surface, not tsc/eslint, and nothing enforces it.
  4. *Also exclude `dev/` wholesale* — rejected: `dev/fids/`, `dev/session-summaries/`, and the lessons corpus are gated surfaces (census check D reads them) and legitimate documentation lives there; the narrow directory is the correct scope.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `tsconfig.json` | modify | `exclude` becomes `["node_modules", "dev/archives", "dev/tmp"]` — one entry. |
| `eslint.config.mjs` | modify | Global-ignores block (the `:102` array) gains `'dev/tmp/**'`, with a short comment naming this FID and the row-128 incident class. |
| `vitest.config.ts` | modify | `test.exclude` array gains `'dev/tmp/**'` (append to the existing array — do not replace with `configDefaults`, keeping the change minimal and reviewable). |
| `__tests__/config/devTmpExcluded.test.ts` | create | The pin (below): parses all three configs and asserts the exclusion exists in each, and that `.gitignore` still carries `dev/tmp/`. Fails with a named fix on regression. |

- **The pin (`__tests__/config/devTmpExcluded.test.ts`):** four assertions — (1) `tsconfig.json` parsed after stripping comments contains `dev/tmp` in `exclude`; (2) `eslint.config.mjs`'s first `ignores:` array (the one containing `node_modules/**`) contains `dev/tmp/**`; (3) `vitest.config.ts`'s `test.exclude` array (the one containing `node_modules`) contains `dev/tmp/**`; (4) `.gitignore` contains the `dev/tmp/` rule. Textual by design (the census-pin precedent, `__tests__/terrainTruth.test.ts`): the behavioral proof is the GREEN re-drill executed and pasted at implementation, not re-run on every suite pass.
- **Verification plan:** with the drill artifacts still planted — `npx tsc --noEmit` → exit 0; `npx eslint . --max-warnings 0` → exit 0/0; `npm run test:ci` → full suite green (previously red via finding 7); the pin test green. Then remove the drill artifacts and re-run the Law-3 triad clean. `node scripts/ledgerIntegrityCensus.cjs` → exit 0.
- **Call-graph reachability plan (Law 4):** the exclusion's safety rests on finding 10 (nothing imports from `dev/tmp/`); the pin's reach is mechanical — it reads the three config files by path, so a rename of any config file fails the test loudly.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: command re-execution | All three gate surfaces exercised against planted artifacts (findings 5-7) with `git status` captured in the same window; configs parsed for exact current arrays (findings 2-4); safety grep for inbound references (finding 10) | §2 as pasted | pass |
| Method 2: manual re-read | Row 128's original incident description re-read to confirm the drill replanted the *actual* historical shapes (a `.ts` backup with broken relative imports; a `.cjs` require shim — the same rule that fired); vitest config re-read to confirm append-not-replace is viable; the FID-007 `.disabled` workaround inspected as the recurring instance; template conventions re-checked | This document §2/§5 as written | pass |

- **Audit outcome: PASS → status `loop-complete`.** Circuit breakers: 2 passes, delta < 2%; no oscillation; iteration 2 of 10.
- **Honest limitations recorded:** (1) the pin is textual — it verifies the configs carry the exclusion, not that every tool version honors it; the behavioral GREEN re-drill at implementation is the one-time proof, and any future tool upgrade that broke `exclude` semantics would surface as the pin passing while the incident recurs (accepted, recorded); (2) `vitest run <filtered-to-dev/tmp>` exits 1 ("No test files found") after the fix — that is vitest's no-match exit for a *filter*, not a gate failure; the gate is the unfiltered `npm run test:ci`, which is what the GREEN drill runs; (3) this FID does not touch the parked FID-007 drill file — its restoration to `__tests__/components/` happens in FID-007's own implementation turn, where it belongs.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** done (implemented 2026-09-28 under the session's standing operator approval; landed on commit `1cf13ff`)
- **Files changed:** `tsconfig.json` (+1 entry), `eslint.config.mjs` (+4 lines: comment + entry), `vitest.config.ts` (+4 lines: comment + entry), `__tests__/config/devTmpExcluded.test.ts` (new, 4 assertions)
- **Verification evidence (executed 2026-09-28, output pasted above in §2/§5 and in the session summary):** RED drill — tsc exit 2 / eslint exit 1 (`no-require-imports`) / vitest exit 1 (scratch test failed), `git status` clean in-window. Pin red 3 failed / 1 passed against pre-fix configs. Post-fix: pin **4/4**; GREEN re-drill with artifacts still planted — tsc **0**, eslint **0**, vitest `No test files found` for the directory; full suite **142 files / 1367 passed**; ledger census exit 0. One self-correct recorded: the pin's first JSONC stripper corrupted tsconfig (the `/*` inside `"paths": {"@/*": …}`) and was replaced by targeted array extraction.
- **Call-graph reachability evidence:** the safety grep stands (§2 finding 10 — nothing outside `dev/tmp/` references it); the pin reads all three configs by path, so a config rename fails loudly.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (142 files / 1367) · [x] call-graph proven (safety grep; pin reads configs by path)
- **Commit hash (G2 — required for `closed`):** `1cf13ff` — *fix(gates): make dev/tmp/ invisible to tsc, eslint and vitest…*; the ledger-closure commit (row 128's hash citation, CHANGELOG 0.0.46, VERSION, this archive move) follows as the session's second commit.
- **Staging plan (path-scoped, G3/G4):** commit 1 (config + pin): `git add tsconfig.json eslint.config.mjs vitest.config.ts __tests__/config/devTmpExcluded.test.ts`; commit 2 (ledger): `git add SCOPE.md CHANGELOG.md VERSION dev/fids/ dev/session-summaries/` — never `git add -A`.
- **Commit message (G8):** `fix(gates): make dev/tmp/ invisible to tsc, eslint and vitest — the scratch area can no longer break a gate invisibly (FID-20260928-002)`
- **Archive:** move to `dev/fids/archive/` at `closed`; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** closed
