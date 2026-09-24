# FID-20260924-004 — All three Law-3 verification commands are gated: typecheck and the suite join the chain, and CI runs the identical chain

**Filename:** `FID-20260924-004-law3-verification-commands-gated.md`
**ID:** FID-20260924-004
**Severity:** MEDIUM
**Status:** closed (2026-09-24, commit `7ad976a`)
**Created:** 2026-09-24
**Trigger:** operator directive, 2026-09-24 ("wire typecheck and the test suite into the pre-push chain (or a CI
workflow) so all three Law-3 verification commands are actually gated, and record the decision"), following the
open item FID-20260924-003 §5 recorded deliberately rather than silently.

---

## 1. Summary

FID-20260924-003 installed lint as Gate 8 and recorded in its §5 that the other two Law-3 commands —
`npx tsc --noEmit` and `npm run test:ci`, both named by `protocol.config.yaml` → `verification` — were still
unwired. That made the chain's coverage a half-truth in the other direction, so this FID closes it: **Gates 9
(typecheck) and 10 (the suite) join the chain, and the same chain now runs on GitHub.** The design decision, made
explicit because it is the part that outlives the change: **the chain is one definition with two callers.** A new
`.github/workflows/gate-chain.yml` does not re-list the gates — it executes `.githooks/pre-push` itself with a
synthesized ref line, so what runs on a local push and what runs in CI cannot drift apart. The repo had already
stated the philosophy in `attribution-guard.yml` ("local hooks protect this clone; CI protects EVERY clone") and
already knew the trap this avoids: `core.hooksPath` is per-clone and does not travel, which is why
`scripts/ensure-hooks.js` exists at all. Cost is measured rather than guessed — the full chain is ~75s on this
Windows host at the current 126-commit range, ~50s of which is the two commands this FID adds — and that number is
recorded with the same honesty the six-errors finding got, because a slow gate nobody is told about is a gate
nobody keeps.

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | The chain omitted two of the three commands its own protocol declares | `.githooks/pre-push` at `ef163af` | `grep -nE "npm run\|eslint\|vitest\|test:ci\|tsc"` → only Gate 3's file-list arguments; gate list `1, 3, 4, 5, 6, 7, 8, 2`. `protocol.config.yaml` → `verification: { typecheck: npx tsc --noEmit, lint: npm run lint, tests: npm run test:ci }`. |
| 2 | The omission had already had consequences, not merely a theoretical one | `CHANGELOG.md` at `dc0e04b` | FID-20260924-003: six eslint errors live on `main`, 18 `eslint clean` + 16 `eslint 0` claims in the ledger, five of the six errors introduced inside the cycle that claimed lint was clean. Nothing ran the command locally, so nothing could contradict the claim. |
| 3 | **CI can run the suite with no database and no secrets — documented in-tree, not assumed** | `vitest.setup.ts:38`, `__tests__/lib/battleStatsService.test.ts:8`, `__tests__/api/chatReportBlock.test.ts:29`, `__tests__/api/p0MissingEndpoints.test.ts:51` | setup stubs the connection string itself: `process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'`; the db-touching tests mock the seam (`vi.mock('@/lib/db', …)`); and the driver's own header says it outright — *"CI is DB-less: db.execute is scripted per case."* Confirmed empirically: `printenv DATABASE_URL` → unset, and the suite still passes **1313/1313**. |
| 4 | Measured cost of each part, so the decision rests on numbers | this host | `invertedRouteCensus 242ms · schemaConsumerCensus 1096ms · timestampConventionCensus 155ms · hostTimezoneCensus 213ms · ledgerIntegrityCensus 385ms` (**2.09s** total) · Gate 3 grep **227ms** · `npm run lint` **21 470ms** · `npx tsc --noEmit` **3 638ms** · `npm run test:ci` **21 698ms** · Gate 2 attribution scan over 126 commits **10 005ms** for the `git log` calls alone (each commit spawns `git log` *and* `grep`, ~130ms/commit on Windows). Full chain, three runs, at range `25e8078..4b037d6` (126 commits): **74.5s / 74.6s / 74.8s**. |
| 5 | The range is the unusual part, not the chain | `git for-each-ref` | `origin/main` is still `25e8078` (2026-09-17), so a push today would carry 126 commits and pay Gate 2's per-commit cost in full (~16s). A typical push of a few commits pays ~1s there, putting a normal chain near **50–60s**. |
| 6 | Capturing gate output does not slow the chain (a suspicion worth killing) | this host | `npm run lint >/dev/null` = 21 921ms vs `lint_out="$(npm run lint 2>&1)"` = 21 927ms; `npm run test:ci >/dev/null` = 22 127ms vs captured = 21 597ms. The capture pattern the chain uses is therefore not the cost. |
| 7 | The suite emits ANSI escapes even when not a TTY, so a naive count extraction silently degrades to a fallback string | `.githooks/pre-push` (Gate 10, first draft) | `printf '%s' "$test_out" \| grep "Tests " \| cat -v` → `^[[2m      Tests ^[[22m ^[[1m^[[32m1313 passed^[[39m^[[22m^[[90m (1313)^[[39m` — the first draft printed `all suites passed` instead of the count; fixed by stripping escapes before matching. Cosmetic, recorded because a gate that reports less than it knows is the class this session keeps finding. |
| 8 | The CI mirror's one unverifiable-in-place element | `.github/workflows/gate-chain.yml` | The workflow parses (`js-yaml`: `name=gate-chain · on=push,pull_request,workflow_dispatch · jobs=gates · steps=5`) and its single chain-invocation line was executed verbatim locally (exit 0, 10 gates), but **GitHub Actions itself cannot be executed from this machine** — see §5's recorded limitations. |

Call-graph notes (Law 4): no runtime path. The chain's callers are `.githooks/pre-push` (invoked by git on push) and
`.github/workflows/gate-chain.yml` (invoked by GitHub), and the hook now documents its stdin contract as an
interface because CI depends on it.

## 3. Impact Analysis

- **Who/what is affected:** every push and every PR. Locally, pushes now take ~50–75s instead of ~22s; on GitHub,
  the first CI run of this chain happens on the next push or PR.
- **Failure modes if unfixed:** (1) *claims outrun checks* — "tsc 0 / suite green" appears in the ledger while the
  commands run only when someone remembers; (2) *unarmed clones* — a fresh clone has `.githooks/` on disk but
  unprotected until `npm install` runs, and nothing on the server checks anything (except attribution), so a
  clone that never installs could push anything; (3) *`--no-verify` as the norm* — with no server-side backstop,
  the slow hook's only incentive is to be bypassed, which is worse than no hook because it manufactures
  confidence.
- **Blast radius of the fix:** `.githooks/pre-push` (+56 lines: two gates and the interface note) and one new
  workflow file (+~110 lines). No application code, no schema, no runtime path, no new dependency.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — the gates run the protocol's own commands with no substitution; the hook covers a local push of any size, and the CI job covers push, PR and manual dispatch, with a range fallback for new branches and for `workflow_dispatch` (parent-tip rather than an invented range). |
| Scales? | Yes on the parts that matter: the chain's cost is dominated by two fixed-cost commands (lint, suite) and scales with commit count only in Gate 2, whose per-commit cost is now measured (finding 4/5) rather than discovered later. |
| Survives a hostile attacker, not just an honest user? | Yes, and this is the actual gain: the chain is now unbypassable for anything that reaches the default branch, because the check runs where the author has no local `--no-verify`. Both enforcement surfaces (`.githooks/`, `.github/workflows/`) are owner-owned in CODEOWNERS, so weakening the chain requires a reviewed diff. |
| Maintainable in 2 years? | Yes — one gate list, not two. The cost is stated honestly (§5): weakening the hook weakens CI too. That is the deliberate trade for eliminating the drift class that Gate 7 and Gate 8 exist to catch. |
| Sets the standard? | Yes — "make the chain the single definition and give it an unbypassable caller" is the generalizable rule; the alternative (a second, hand-copied list of gates in CI) is how two definitions silently disagree. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

**The decision, stated once:** *the pre-push chain is the single definition of what "the gates pass" means for this
project; it runs in two places — invoked by git locally for fast feedback, and by CI for enforcement — and both
callers execute the same file rather than a re-listing of it.*

1. **Gate 9 — `npx tsc --noEmit`** (the protocol's declared typecheck, unchanged), placed after Gate 8 so the cheap
   gates fail first; refuses the push on non-zero, refuses with exit 2 if `npx` is absent rather than printing a
   green line for a check that never ran.
2. **Gate 10 — `npm run test:ci`** (the protocol's declared test command), the slowest gate and last on purpose. It
   is DB-less by construction (finding 3), which is what lets the same chain run in CI.
3. **`.github/workflows/gate-chain.yml`** — `push` / `pull_request` / `workflow_dispatch`, `actions/checkout@v4`
   (`fetch-depth: 0`, the git-range gate needs the pushed commits), `actions/setup-node@v4` with npm caching,
   `npm ci` (the lockfile is the install contract), a range step mirroring `attribution-guard.yml`'s established
   logic, and **one step that pipes a synthesized ref line into `.githooks/pre-push`**.
4. **The stdin contract is promoted to an interface** and documented in the hook's header, so the coupling CI
   relies on is stated where someone editing the hook will see it.

**Rejected alternatives (each with the reason):**

| Alternative | Why rejected |
| ----------- | ------------ |
| CI only; leave the hook fast | The ledger's local verification records would keep citing commands nobody runs, which is the exact defect FID-20260924-003 found. Fast feedback also matters: a suite failure discovered after the push is discovered by CI, not by the author. |
| Hook only; no CI | Bypassable with `--no-verify`, and a clone that never runs `npm install` has no hook at all — `core.hooksPath` does not travel with the repository, which is why `scripts/ensure-hooks.js` exists. A local-only chain cannot be an enforcement boundary. |
| Duplicate the gate list as explicit CI steps | Two definitions that drift: add a gate to the hook and CI silently stops checking it. This is the class Gate 7 (ledger integrity) and Gate 8 (lint) exist to refuse. The trade accepted instead (a weakened hook also weakens CI) is real but visible and review-gated by CODEOWNERS. |
| A shared `scripts/gateChain.cjs` runner invoked by both | Also single-definition, and more CI-idiomatic (per-gate status in the GitHub UI). Rejected for **scope**, not for merit: it would lift eight gate blocks carrying their own rationale out of the hook, a larger and riskier change than the directive asked for. **Recorded as the natural next step** if CI wants per-gate step granularity. |
| Run the suite only in CI (hook gets tsc + lint) | The directive is to gate all three; and the observable evidence (six errors surviving a release cycle) argues for local feedback. Cost accepted and recorded: ~75s at the current range. |
| Also wire `npm run test:zones` (the three-zone DST audit) | Triples the suite (≈65s more). It is a genuine gate with a real catch history (FID-20260923-002), so it deserves its own decision, not a ride-along on this one. **Recorded as open.** |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `.githooks/pre-push` | modify | Gates 9 + 10; the stdin contract documented as an interface (+56 lines) |
| `.github/workflows/gate-chain.yml` | create | CI caller of the identical chain (~110 lines) |

**Verification plan:** `npx tsc --noEmit` / `npm run lint` / `npm run test:ci` each exit 0; the full chain exits 0
with ten green gates; the workflow's exact chain-invocation line runs locally to exit 0; and **two negative
drills** — a type-invalid but lint-clean file must pass Gate 8 and be refused by Gate 9; a lint-clean, type-clean
failing test must pass Gates 8–9 and be refused by Gate 10.

**Call-graph reachability plan:** the chain's own output (ten `✅` lines including the two new gates) plus the
drills; for CI, the workflow file's parse and its step command executed verbatim — §7, with the limitation in §5's
last row stated in the closure records.

**Recorded limitations (not hidden in a footnote):**

1. **The workflow has never run on GitHub.** Actions cannot be executed from this machine. Its YAML parses, and its
   one chain-invocation line was run verbatim locally (exit 0, 10 gates), but `ubuntu-latest` behavior is
   unverified — the first real push or PR is the actual test.
2. **`node-version: lts/*` diverges from the development host** (Node 25.2.1; `package.json` declares no `engines`
   and there is no `.nvmrc`). Pinning CI to an odd-numbered non-LTS release was rejected as inventing a floor the
   project never declared; a mismatch fails loudly on the first run.
3. **Gate 2 costs ~16s of the ~75s at this range** (two process spawns per commit, 126 commits). Measured and
   recorded, not optimized here: its attribution semantics are mirrored in `attribution-guard.yml` and changing
   them is its own change with its own drill.
4. **The npm-missing branches of Gates 8–9** were verified by exercising their condition with PATH stripped (the
   condition fires, exit 2), not end-to-end inside a live chain run — stripping PATH also removes `node`/`git`,
   which the earlier gates need. Carried forward from FID-20260924-003.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | `npx tsc --noEmit` · `npm run lint` · `npm run test:ci` · full chain | §7: tsc exit 0; lint exit 0 (no output); suite **1313/1313**; chain exit 0 with **10** green gates in 74.8s | pass |
| Method 2: manual re-read against this FID | Each new gate traced to its refusal branch; the workflow's range logic re-read against `attribution-guard.yml`'s (the established pattern) and against the hook's stdin contract; the DB-less claim checked at four call sites rather than one | §2 findings 3, 4; §5 | pass |
| Negative drill — Gate 9 | `scripts/typeGateDrill.ts` (`export const drillFlag: number = 'not a number'`) + the real hook | §7: `✅ eslint clean` first, then `error TS2322: Type 'string' is not assignable to type 'number'`, `CHAIN EXIT=1` | pass |
| Negative drill — Gate 10 | `__tests__/gateChainDrill.test.ts` (asserts `expect(1).toBe(2)`) + the real hook | §7: `✅ eslint` + `✅ typecheck` first, then `FAIL … > gate-chain drill > fails on purpose` / `AssertionError: expected 1 to be 2`, `CHAIN EXIT=1` (50.5s) | pass |
| CI-shape check | The workflow's chain-invocation step, executed verbatim locally with the same range arguments | §7: `CHAIN EXIT=0`, 10 gates — the closest available approximation of the CI step | pass, scoped |

- Audit outcome: **PASS** → `closed` on `7ad976a` (§8).
- Circuit breakers: three passes (add the gates; measure and attribute the cost; fix the ANSI-degraded summary),
  each small, no oscillation.

## 7. Implementation Record

- **Status:** done (2026-09-24). `.githooks/pre-push` +56 lines (Gates 9/10, interface note), CRLF preserved
  (317 CRs = 317 lines); `.github/workflows/gate-chain.yml` new.
- **Verification evidence (run at `7ad976a`, pasted):**
  - `npx tsc --noEmit` → `TSC EXIT=0` (3 638ms) · `npm run lint` → exit 0, no output (21 470ms) ·
    `npm run test:ci` → `Test Files 136 passed (136)` · `Tests 1313 passed (1313)` (21 698ms)
  - **green chain, the workflow's exact command, 3 runs:** `CHAIN EXIT=0 (74500ms / 74606ms / 74797ms)`, ending:
    ```
    ✅ pre-push: eslint clean (0 errors, 0 warnings)
    ✅ pre-push: typecheck clean (0 errors)
    ✅ pre-push: test suite clean (1313 passed (1313))
    ✅ pre-push: attribution scan clean
    ```
  - **drill 9 (typecheck):**
    ```
    ✅ pre-push: eslint clean (0 errors, 0 warnings)
    🔍 pre-push: typecheck (Law 3 gate — npx tsc --noEmit, zero errors)...
    scripts/typeGateDrill.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.
    ❌ pre-push: typecheck refused the push (exit 2) — fix the errors above
    CHAIN EXIT=1
    ```
  - **drill 10 (suite):**
    ```
    ✅ pre-push: eslint clean (0 errors, 0 warnings)
    ✅ pre-push: typecheck clean (0 errors)
    FAIL  __tests__/gateChainDrill.test.ts > gate-chain drill > fails on purpose
    AssertionError: expected 1 to be 2 // Object.is equality
    ❌ pre-push: the test suite refused the push (exit 1) — fix the failures above
    CHAIN EXIT=1  (50500 ms)
    ```
    (both drill files deleted in the same command; `git status --porcelain` after them shows only the two intended
    paths)
  - **workflow parses** (`js-yaml`, probe only — not a committed dependency):
    `.github/workflows/gate-chain.yml -> parsed OK · name=gate-chain · on=push,pull_request,workflow_dispatch · jobs=gates · steps=5`
  - `bash -n .githooks/pre-push` → clean after every edit.
- **Call-graph reachability evidence:** the chain prints ten `✅` lines including
  `✅ pre-push: typecheck clean (0 errors)` and `✅ pre-push: test suite clean (1313 passed (1313))`, and the drills
  show the two new gates refusing on the real hook. The CI caller is reachable by construction (`on: push,
  pull_request, workflow_dispatch`) and its step was executed locally.

## 8. Closure

- **Gates:** [x] typecheck 0 (Gated) · [x] lint 0/0 (Gated) · [x] tests 1313/1313 (Gated) · [x] chain exit 0 with
  10 gates · [x] both new gates proven to refuse · [x] workflow parses · [ ] **workflow verified on GitHub —
  impossible from here, recorded in §5.**
- **Commit hash (G2):** `7ad976a` — *feat(gates): pre-push Gates 9 (typecheck) and 10 (test suite), plus a CI
  workflow that runs the identical chain — all three Law-3 verification commands are now actually gated
  (FID-20260924-004)*, 2 files changed (+163) → `.githooks/pre-push`, `.github/workflows/gate-chain.yml`.
- **Fresh closure probe at `7ad976a` (Law 16, 2026-09-24):** chain run over the real range with the workflow's own
  command → exit 0, 10 gates, 74.8s; drills 9 and 10 re-run on the same content → exit 1 each; suite 1313/1313;
  tsc 0; lint 0/0. All pasted in §7.
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260924-004-law3-verification-commands-gated.md
  SCOPE.md CHANGELOG.md VERSION` (filed and closed in one pass, the FID-20260924-002/-003 shape, since the
  directive named the work).
- **Commit message (G8):** `docs(ledger): FID-20260924-004 closed on 7ad976a — typecheck and the test suite gated
  (Gates 9-10) and CI runs the identical chain; SCOPE row 122, CHANGELOG/VERSION 0.0.35 (FID-20260924-004)`
- **SCOPE row:** 122.
- **Still open, recorded and NOT implied fixed:** `npm run test:zones` (three-zone DST audit) is not in the chain;
  Gate 2's ~16s per-commit cost at long ranges; the workflow's first real run on GitHub; and the npm-missing branch
  drill carried over from FID-20260924-003.
- **Archive:** `dev/fids/archive/FID-20260924-004-law3-verification-commands-gated.md`; CHANGELOG entry under
  `0.0.35`; `VERSION` → `0.0.35`.

---

**Final status:** `closed` (2026-09-24, commit `7ad976a`). After this, "the gates pass" means the three Law-3
commands ran — on the author's machine and, unbypassably, wherever the branch lands — and no longer means only that
the checks somebody remembered to install came back green.
