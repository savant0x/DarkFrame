# FID-20260924-003 — The lint baseline is cleared and gated: six errors sat on `main` while the chain reported that the gates passed

**Filename:** `FID-20260924-003-lint-baseline-cleared-and-gated.md`
**ID:** FID-20260924-003
**Severity:** MEDIUM
**Status:** closed (2026-09-24, commits `d3ad827` + `ef163af`)
**Created:** 2026-09-24
**Trigger:** operator directive, 2026-09-24 ("clear the 6 pre-existing eslint errors and add a lint check to the
gate chain so a dirty baseline can't be recorded as clean again"), filed after FID-20260924-002 recorded the drift
as a limitation.

---

## 1. Summary

Six eslint errors were live on `main`, and the pre-push chain could not have told anyone: it ran **seven gates, not
one of which invoked a Law-3 verification command**. `protocol.config.yaml` declares three
(`npx tsc --noEmit`, `npm run lint`, `npm run test:ci`), the chain ran none of them, so "the gates pass" quietly
meant "the gates that exist pass" — and the CHANGELOG's `eslint clean` / `eslint 0` lines went on reading like
tree-wide verification. The six errors are all *byproducts of otherwise-good refactors*: five were introduced
2026-09-18/19 by the shim-exit and feature commits (`fb5b702`, `c9c3189`, `ba16ab4`, `08410d6`, `30f694e`) and one
on 2026-09-20 (`746b920`) — each left dead code behind, and with no push-time lint check nothing ever noticed.
One of the six is not cosmetic at all: `scripts/e2eSlice1AntiCheatLive.ts` defines an anti-cheat probe helper that
was never wired to an assertion, which is the kind of difference a reader assumes a gate would have caught. This
FID clears the baseline (by removing the dead thing, never by suppression) and installs **Gate 8** so the class
cannot return silently.

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | Six eslint errors on `main`, in six untouched-by-this-change files | `components/AuctionHousePanel.tsx`, `components/CreateListingModal.tsx`, `lib/movementService.ts`, `scripts/e2ePlayerNotificationLive.ts`, `scripts/e2eSlice1AntiCheatLive.ts`, `scripts/spawnBots.ts` | `npm run lint` → `✖ 6 problems (6 errors, 0 warnings)`: `AuctionHousePanel.tsx 35:36 'CatalogEntry' is defined but never used`; `CreateListingModal.tsx 384:25 '\`'\` can be escaped with \`&apos;\` … react/no-unescaped-entities`; `movementService.ts 17:35 'HarvestRecord' is defined but never used`; `e2ePlayerNotificationLive.ts 72:15 'sql' is assigned a value but never used`; `e2eSlice1AntiCheatLive.ts 62:16 'countFlags' is defined but never used`; `spawnBots.ts 20:37 'sql' is defined but never used`. Real time: `real 0m17.579s`. |
| 2 | **The chain never ran lint — nor the other two Law-3 commands** | `.githooks/pre-push` at `ef163af~1` | `git show ef163af~1:.githooks/pre-push \| grep -nE "npm run\|eslint\|vitest\|test:ci\|tsc"` matches only the file-list arguments of Gate 3 (`vitest.setup.ts`, `vitest.config.ts`); the gate list is `Gate 1 · Gate 3 · Gate 4 · Gate 5 · Gate 6 · Gate 7 · Gate 2` — seven gates, none a verification command. |
| 3 | So the chain's green run asserted less than it appeared to | same | A full chain run prints seven `✅` lines and exits 0 on a tree with six lint errors (observed directly: the chain was green at `c63d47b`, where `npm run lint` exits 1). |
| 4 | …and the written record inherited the ambiguity | `CHANGELOG.md` at `dc0e04b` | `grep -c "eslint clean"` → **18**, `grep -c "eslint 0"` → **16**. The wording is tree-scoped ("eslint clean") while the runs behind it were change-scoped. Recorded as *unverifiable*, not as a false claim: whether any particular entry was true when written cannot be established now, because nothing ran lint. |
| 5 | Every one of the six is a leftover from a real refactor, not a typo | per-file provenance (`git log -S`) | `HarvestRecord` introduced by `c9c3189` (2026-09-19, lib batch 4 off the shim) · `countFlags` by `fb5b702` (2026-09-18, anti-cheat rewritten on drizzle/pg) · `type CatalogEntry` by `ba16ab4` (2026-09-19, market/chat catalog links) · the apostrophe by `08410d6` (2026-09-19, tradeable listings) · `sql` in `spawnBots` by `30f694e` (2026-09-19, spawnBots off the shim) · `sql` in the notification driver by `746b920` (2026-09-20, notification seam). Five of six landed in the same release cycle whose entries claim `eslint clean`. |
| 6 | One is a finding, not a tidy-up: a probe helper that was never called | `scripts/e2eSlice1AntiCheatLive.ts:62` | `countFlags(username)` reads `playerFlags` and returns a count; nothing calls it. The driver's equivalent checks are inline (step 8 `flags.length === 1 && flags[0].occurrenceCount === 2`; step 10 residual-flag count), so the helper is dead — but an anti-cheat probe with an unwired counter is exactly the shape a reader would assume a gate had verified. |

Call-graph notes (Law 4): there is no runtime path for the six fixes (dead bindings and one JSX escape). The gate's
path is by construction: `.githooks/pre-push` executes Gate 8 on every push, proved by running the hook (§7).

## 3. Impact Analysis

- **Who/what is affected:** every push, every future CHANGELOG claim about `eslint`, and the two `lib/`/`components/`
  files whose dead imports were removed (no behaviour change — the symbols are unused).
- **Failure modes if unfixed:** (1) *unfalsified claims* — "eslint clean" is recorded in the ledger while nothing
  checks it, so the claim's cost is a reader's trust rather than a gate's work; (2) *silent accumulation* — dead
  imports and never-wired helpers accrete one refactor at a time (five in a single cycle here) and the first person
  to notice is whoever runs lint by hand, possibly months later; (3) *unwired probes read as verified* — finding 6
  is the sharp end: an anti-cheat driver containing a counter nobody calls looks like coverage.
- **Blast radius of the fix:** six one-line removals/escapes across six files (5 insertions, 13 deletions) plus a
  36-line block in `.githooks/pre-push`. No route, no schema, no runtime path. The chain gains ~18s on push.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — the six errors cover every shape in the class (unused import, unused binding, unused function, unescaped entity), and the gate checks the exit code *and* the warning count, because `eslint .` exits 0 with warnings while the protocol's contract is 0 errors / 0 warnings. |
| Scales? | Yes — one repo-wide `eslint .` invocation, ~18s here, no per-file bookkeeping and no allowlist to maintain. A change-scoped variant would scale worse in the dimension that matters (it cannot see pre-existing drift). |
| Survives a hostile attacker? | Yes, in this project's sense: a lint error can no longer be *shipped quietly* because a green chain hid it, and suppressions are explicitly called out as not-a-fix in the gate's failure text. |
| Maintainable in 2 years? | Yes — the gate calls the project's own command (`npm run lint`) rather than a hand-rolled substitute, so the check follows `package.json` if that script changes; the only divergence is the explicit warning check, which is documented in the hook. |
| Sets the standard? | Yes — the general rule: **a gate chain that omits one of its own declared verification commands cannot notice the omission, and its green run is read as covering everything.** The chain now runs the Law-3 lint command; the remaining two omissions are recorded in §5 rather than implied fixed. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

1. **Clear the six errors by removing the dead thing** — never by `eslint-disable`, never by widening a rule:
   `AuctionHousePanel.tsx` drops `type CatalogEntry` (`resolveCatalogEntry` is the live symbol);
   `movementService.ts` drops `HarvestRecord` (`Tile`, `MovementDirection` are both used);
   `spawnBots.ts` and `e2ePlayerNotificationLive.ts` drop `sql` from their drizzle imports;
   `CreateListingModal.tsx` escapes the apostrophe as `&apos;` (house style: `StatsPanel`, `StatsViewWrapper`,
   `WMDResearchPanel`). `countFlags` is **deleted** rather than wired into a new assertion — inventing a probe
   assertion as a side effect of a lint fix would widen a live driver's scope under cover of a tidy-up.
2. **Gate 8: `npm run lint`, repo-wide, in `.githooks/pre-push`** — the project's own command, not a substitute.
   Repo-wide on purpose: the drift to catch is the error already in the tree, untouched by the commit being
   pushed, which is exactly what a changed-files-only check would miss. Warnings are refused as well as errors
   (the protocol's contract is 0/0). If `npm` is not on PATH the gate refuses with exit 2 instead of reporting a
   green chain it never ran.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| `eslint-disable` / `eslint-disable-next-line` per finding | Encodes the drift as policy. The six are dead code and one escape; suppression would have left the dead `countFlags` in a live anti-cheat driver *and* taught the next reader that the rule is negotiable. |
| Lint only changed files / only the pushed range | Misses precisely the drift class this exists for (pre-existing errors), and would also make the gate's meaning depend on the range being pushed. |
| Invoke `npx eslint . --max-warnings=0` instead of `npm run lint` | Stricter but divergent: the protocol names `npm run lint` as the project's gate command, and hard-coding flags here would silently stop following `package.json`. The warning check is done on the output instead, with the fallback failure mode written down (worst case a warning slips; an error cannot, being exit-gated). |
| Also wire the other two Law-3 commands into the chain now | Out of scope for this directive and not free: `npm run test:ci` is ~25s and `tsc` ~10s on this host, and the ordering/trigger question (what belongs on every push vs. on the change) is a real design call. **Recorded here as still open** — after this FID the chain runs lint only, and no record should read as if typecheck and tests were gated too. |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `components/AuctionHousePanel.tsx` | modify | drop unused `type CatalogEntry` import specifier |
| `components/CreateListingModal.tsx` | modify | `can't` → `can&apos;t` in JSX text |
| `lib/movementService.ts` | modify | drop unused `HarvestRecord` from the `@/types` import |
| `scripts/e2ePlayerNotificationLive.ts` | modify | drop unused `sql` from the dynamic drizzle import |
| `scripts/e2eSlice1AntiCheatLive.ts` | modify | delete the never-called `countFlags` helper |
| `scripts/spawnBots.ts` | modify | drop unused `sql` from the drizzle import |
| `.githooks/pre-push` | modify | Gate 8 (repo-wide `npm run lint`, warnings refused, npm-missing refusal) |

**Verification plan:** `npm run lint` → exit 0 with **no output at all** (0 problems, so no summary line);
`npx tsc --noEmit` → 0; `npm run test:ci` → all pass; full chain → exit 0 with eight green gates; and a **negative
drill**: a throwaway file with one unused binding must make the real hook refuse at Gate 8.

**Call-graph reachability plan:** not a runtime path. Reachability = the hook's own output line
`✅ pre-push: eslint clean (0 errors, 0 warnings)` inside a full chain run (§7), plus the drill.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | `npm run lint` · `npx tsc --noEmit` · `npm run test:ci` · full chain | §7 (pasted): lint exit 0 / no output; tsc exit 0; **1313/1313 across 136 files**; chain exit 0 with **8** green gates | pass |
| Method 2: manual re-read against this FID | Each of the six fixes re-read against its symbol's live usage (grep per file, not per recollection); the deleted helper checked against the driver's inline assertions; the gate block re-read for exit-code and warning handling | §2 row 5, §5, §7 | pass |
| Negative drill (Gate 8 must refuse) | `scripts/lintGateDrill.ts` with `const unusedByDesign = 42` + the real hook | §7: `HOOK EXIT=1`, `2:7 error 'unusedByDesign' is assigned a value but never used`; file removed, chain green | pass |
| Isolation check (the npm-missing branch) | The guard's condition, run with npm off PATH | §7: `with npm on PATH: npm found → guard would NOT fire` / `with npm stripped: npm MISSING → guard exits 2`. **Honest scope:** this exercises the condition, not the branch inside a live chain run (stripping PATH also removes `node`/`git`, which the earlier gates need) | pass, scoped |

- Audit outcome: **PASS** → `closed` on `d3ad827` + `ef163af` (§8).
- Circuit breakers: two passes (fix the six, then design the gate), both small; no oscillation.

## 7. Implementation Record

- **Status:** done (2026-09-24). `components/AuctionHousePanel.tsx`, `components/CreateListingModal.tsx`,
  `lib/movementService.ts`, `scripts/e2ePlayerNotificationLive.ts`, `scripts/e2eSlice1AntiCheatLive.ts`,
  `scripts/spawnBots.ts` — **5 insertions, 13 deletions** total; `.githooks/pre-push` +36 lines.
  `lib/movementService.ts` keeps its CRLF line endings (215 CRs before and after the edit).
- **Verification evidence (run at `ef163af`, pasted):**
  - `git diff --stat ef163af` → empty (the probes ran on exactly the committed content)
  - `npm run lint` → `LINT EXIT=0`, output is the npm banner only (no problem summary, no warnings):
    ```
    > darkframe@0.0.1 lint
    > eslint .
    ```
  - `npx tsc --noEmit` → `TSC EXIT=0`
  - `npm run test:ci` → `Test Files 136 passed (136)` · `Tests 1313 passed (1313)`
  - full chain → `HOOK EXIT=0`, **8** green lines, including:
    ```
    ✅ pre-push: ledger census clean (ledger census clean: live statuses lawful, no terminal FID parked, every SCOPE hash resolves)
    ✅ pre-push: eslint clean (0 errors, 0 warnings)
    ✅ pre-push: attribution scan clean
    ```
- **Negative drill evidence (same tree, real hook) → `HOOK EXIT=1`:**
  ```
  🔍 pre-push: eslint (Law 3 gate — repo-wide, 0 errors / 0 warnings)...
    2:7  error  'unusedByDesign' is assigned a value but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
  ```
  (throwaway `scripts/lintGateDrill.ts` deleted in the same command)
- **npm-missing branch (isolation):** `with npm on PATH: npm found -> guard would NOT fire` ·
  `with npm stripped: npm MISSING -> guard exits 2 (refuse, no green chain)`.
- **Before/after of the chain's coverage:** pre-fix gate list `1, 3, 4, 5, 6, 7, 2` with no `npm run`/`eslint`/`tsc`
  invocation, against a tree with six errors; post-fix the same run refuses a deliberate error.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] **lint exit 0, no output** (repo-wide, first time in the recorded
  ledger) · [x] tests 1313/1313 · [x] chain exit 0 (8 gates) · [x] drill proves Gate 8 refuses.
- **Commit hashes (G2):** `d3ad827` — *fix(lint): clear the 6 pre-existing eslint errors on main — dead imports and
  bindings, one never-wired probe helper, one unescaped apostrophe (FID-20260924-003)*, 6 files (+5/−13);
  `ef163af` — *chore(gates): pre-push Gate 8 — eslint wired into the chain so a dirty baseline cannot be recorded as
  clean again (FID-20260924-003)*, 1 file (+36). Two commits on purpose and in this order: a chain commit whose own
  tree would fail its new gate is a worse artifact than either half alone, so the baseline is cleared first and the
  gate lands second.
- **Fresh closure probe at `ef163af` (Law 16, 2026-09-24):** `git diff --stat ef163af` empty · `npm run lint` exit 0 ·
  `npx tsc --noEmit` exit 0 · suite 1313/1313 (136 files) · chain exit 0 with 8 gates · drill exit 1. Pasted in §7.
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260924-003-lint-baseline-cleared-and-gated.md
  SCOPE.md CHANGELOG.md VERSION` (filed and closed in one pass, the FID-20260924-002 shape, since the directive
  named the work).
- **Commit message (G8):** `docs(ledger): FID-20260924-003 closed on d3ad827 + ef163af — lint baseline cleared and
  gated (pre-push Gate 8); SCOPE row 121, CHANGELOG/VERSION 0.0.34 (FID-20260924-003)`
- **SCOPE row:** 121.
- **Still open, recorded and NOT implied fixed:** the chain runs **lint only** of the three Law-3 verification
  commands — `npx tsc --noEmit` (~10s) and `npm run test:ci` (~25s) are still not wired, so no ledger entry may
  read as if "the gates pass" covers typecheck and tests until that decision is taken.
- **Archive:** `dev/fids/archive/FID-20260924-003-lint-baseline-cleared-and-gated.md`; CHANGELOG entry under
  `0.0.34`; `VERSION` → `0.0.34`.

---

**Final status:** `closed` (2026-09-24, commits `d3ad827` + `ef163af`). The visible half is six one-line cleanups;
the actual finding is finding 2 — a gate chain that reported success while never running one of the three
verification commands its own protocol declares, which is why the dead `countFlags` helper in a live anti-cheat
driver was never noticed by anything.
