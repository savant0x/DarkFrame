# FID-20260927-002: The ledger census's verdict must not depend on the local object store

**Filename:** `FID-20260927-002-ledger-census-host-independence.md`
**ID:** FID-20260927-002
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-09-27

---

## 1. Summary

Gate 7 (ledger-integrity census) judged seven SCOPE.md hash citations **green on the host and red on CI** for the same commit: the citations resolve as objects in this clone's store (left there by the 2026-09-03 filter-branch/history-import rewrite) but are absent in any fresh clone, so CI run `36334419960` — the first genuine ubuntu-latest execution of the chain — refused at Gate 7 while the local pre-push probe printed exit 0 minutes earlier. This is the FID-20260925-004 defect class again, one layer deeper: Gate 1 stopped being host-shaped; Gate 7's *verdict* still was. The fix waives the seven by reason (the census's own prescribed mechanism) and re-classes "resolves but unreachable from HEAD" from advisory to fatal-so-waived, making local and CI verdicts identical by construction.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **CI refused at Gate 7 on seven citations** | `.github/workflows/gate-chain.yml` → run `36334419960` | `SCOPE.md:1075 `2426cf4` — not a commit in this repo` … `:1076,1077 f7f0921`, `:1078 049459b`, `:1102 4674b73`, `:1102,1198 0e82eb5, 8be0bde, de914fa` — `❌ pre-push: ledger census refused the push (exit 1)` (55 s run; gates 1–6 green before it) |
| 2 | **The same citations pass locally** — probed minutes before the push | host terminal | `for h in …; do git cat-file -e $h^{commit} …` → all seven `EXISTS locally (unreachable)`; census printed `advisory: 7 cited hash(es) exist but are not reachable from HEAD` and **exit 0** |
| 3 | **The verdict therefore depends on local gc state, not the ledger** | `scripts/ledgerIntegrityCensus.cjs` check C | `if (missingHashes.has(hash)) { KNOWN_DEAD ? waived : dead }` else `!reachable → unreachableHashes` (advisory): a citation falls into a *different branch* depending on which objects the local store happens to hold — a fresh clone cannot reach the advisory branch at all |
| 4 | **The seven are 2026-09-03 rewrite debris, cited in good faith from the pre-rewrite ledger** | SCOPE `:1075-1078` (rows 39–42, "canonical: PR #45/#47"), `:1102` (row 30), `:1198` (2026-09-07 session log) | row 23 records the filter-branch force-push + history import; `53c1531`'s existing KNOWN_DEAD reason names the same event — these seven are more of its debris, never probed because locally they still resolved |
| 5 | **The waiver list's own procedure was followed only half-way** | census `:127` doc block | "Probed absent 2026-09-24 (`git cat-file -e …` → "Not a valid object name")" — probed absent *on the host*; the host kept resolving them, so they were never added |
| 6 | **The class is structural**: any clone/gc event re-silently flips advisory → fatal | items 2–3 | the advisory masks locally-present-but-unreachable citations until the next fresh checkout exposes them as red — the same mask FID-004 removed at Gate 1 |

**Call-graph notes (Law 4):** the census runs as pre-push Gate 7 and in CI (`gate-chain.yml` executes `.githooks/pre-push` itself — one definition, two callers). Its verdict gates every push; no other script consumes `unreachableHashes` (print-only).

## 3. Impact Analysis

- **Affected:** every push and every CI run (Gate 7); ledger trustworthiness (a citation that one platform verifies and another refuses is not evidence).
- **Failure modes if unfixed:** CI stays red (pushes now require either history falsification or gate bypass); or the divergence is "fixed" by trusting the local pass — the exact self-reporting the protocol forbids.
- **Blast radius of the fix:** census script (waiver entries + classification + messages + header doc), its test (new pin assertions), ledger rows (new row + this FID), CHANGELOG/VERSION. No source, route, or schema change.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | **Yes.** The verdict on a citation becomes a function of the *commit graph* (reachability from HEAD), which is identical on every platform by definition, plus an explicit reason-bearing waiver list — not of object-store state. |
| Scales? | **Yes.** The waiver list grows only by probed, reasoned entries (the doc block already demands this); the classification is O(cited), unchanged. |
| Hostile attacker? | **Yes — stronger than before.** A fabricated citation now fails on *every* platform (previously it passed on any clone that happened to hold the object); a destroyed-but-legitimate citation needs a written reason in a reviewed file, not gc luck. |
| Maintainable in 2 years? | **Yes.** The failure message teaches the failure mode ("CI will see it as missing"); the test pins the full waived list, so silent list-rot fails the suite. |
| Industry standard? | **Yes.** "A gate's verdict must be a function of the repository, not the machine" is the same principle Gate 1's fix established, now applied to the ledger. |

## 5. Proposed Fix (GREEN)

- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `scripts/ledgerIntegrityCensus.cjs` | modify | (1) `KNOWN_DEAD` gains the seven hashes, each with a written reason + probe reference (CI run `36334419960` refused all seven; locally present-but-unreachable). (2) Classification: a citation that resolves but is **not reachable from HEAD** joins the fatal set (distinct message: "exists locally but is not reachable from HEAD — a fresh clone sees it as missing"), unless KNOWN_DEAD-waived; the pure-advisory branch is removed. (3) `headReachable()` computed unconditionally (cheap; the empty-history refusal stays). (4) Header doc block: §C and the advisory paragraph updated to the tightened contract (backup-ref-only citations are now waived-by-reason entries, not silent advisories). |
| `__tests__/lib/ledgerIntegrityCensus.test.ts` | modify | Pin: the waived line names all eleven hashes (4 original + 7 new) — list-rot now fails the suite. |
| `SCOPE.md` | modify | New row 135 (this finding + fix); the sweep-record untouched. |
| `CHANGELOG.md` / `VERSION` | modify | 0.0.41 entry. |

- **Negative drill (the red that proves the classification):** a hermetic fixture repo in `dev/tmp/` (gitignored but gate-scanned — **removed before any gate run**, row 128) whose SCOPE cites (a) a reachable hash, (b) a present-but-unreachable hash (orphan commit, then `reset --hard` away), (c) a missing hash. Pre-fix census on the fixture: (b) advisory, exit 0 — the divergence reproduced locally. Post-fix: (b) and (c) both refused, (a) passes. Fixture deleted immediately after the drill.
- **Verification plan:** census exit 0 on the real tree with `11 destroyed-by-design hash(es) waived by reason` and **no** unreachable-advisory line; tsc 0; lint 0/0; suite green (test pins updated); then the two path-scoped commits and a push whose CI run is watched to completion.
- **Reachability plan:** `grep -n "2426cf4\|f7f0921\|049459b\|4674b73\|0e82eb5\|8be0bde\|de914fa" scripts/ledgerIntegrityCensus.cjs` → the seven KNOWN_DEAD entries; `grep -n "unreachableHashes" scripts/ledgerIntegrityCensus.cjs` → definition + classification + (removed advisory print).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: command re-execution | CI log fetched and quoted (`gh run view --log-failed`); all seven probed locally (`git cat-file -e` → present, unreachable); pre-fix census re-run (exit 0 + advisory line) — the divergence demonstrated from both sides; fixture drill executed per §5 | transcript excerpts in §2; drill output in §7 (implementation record) | pass |
| Method 2: manual re-read | Census read 0-EOF (517 lines) before edit; classification path re-read against the CI report's branch order; KNOWN_DEAD doc-block contract honored (probe + reason per entry); test file read before extending; Five Questions re-checked post-draft | this document | pass |

- Circuit breakers: 2 GREEN passes, delta < 2%, no oscillation, 2 of 10 iterations.
- Audit outcome: **PASS → `loop-complete`.**

## 7. Implementation Record

- **Status:** done (2026-09-27, under the operator's standing plan "fixes ride on top as ordinary commits")
- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
| `scripts/ledgerIntegrityCensus.cjs` | +47/−14 | header §C + advisory paragraph rewritten to the graph-based contract; 7 KNOWN_DEAD entries (quoted digit-leading keys) each with reason + CI-run probe reference; `headReachable()` unconditional; present-but-unreachable citations join the fatal set via the waived/fatal fork; failure message distinguishes locally-present vs absent; the pure-advisory print removed |
| `__tests__/lib/ledgerIntegrityCensus.test.ts` | +40/−2 | the tree pin asserts all eleven waived hashes and the ABSENCE of the old advisory wording; new orphan-commit fixture pin (commit-tree + short-hash citation → exit 1 with the fresh-clone message) |

- **Red drill:** both new pins failed against the pre-fix census — `2 failed \| 18 passed`; the tree pin failed on the waiver list and the advisory wording, the orphan pin got exit 0 where it required 1. Post-fix: **20 passed (20)**.
- **Verification evidence:** `node scripts/ledgerIntegrityCensus.cjs` → `11 destroyed-by-design hash(es) waived by reason: 53c1531, af1e61e, 23cdc63, 49b5991, 2426cf4, f7f0921, 049459b, 4674b73, 0e82eb5, 8be0bde, de914fa`, **no** unreachable-advisory line, `ledger census clean`, **exit 0**; full gates re-run before the push (transcript in SESSION-2026-09-27-004).
- **Reachability evidence:** the seven hashes now appear only in the KNOWN_DEAD block (reason-bearing entries) — `grep -n` confirms; `unreachableHashes` has zero remaining references.
- **Equivalence argument (why CI now agrees):** in a fresh clone the seven are *absent* objects → `probeMissing` flags them → KNOWN_DEAD branch → waived. On the host they are *present-but-unreachable* → reachability check flags them → the same KNOWN_DEAD branch → waived. The fork between the platforms is closed; the verdict is a function of the commit graph plus the reviewed waiver list.

## 8. Closure

- **Staging plan (G3/G4):** commit 1 `fix(gates): the ledger census judges citations by the commit graph, not the local object store (FID-20260927-002)` — `git add scripts/ledgerIntegrityCensus.cjs __tests__/lib/ledgerIntegrityCensus.test.ts`; commit 2 ledger — `git add SCOPE.md CHANGELOG.md VERSION dev/fids/ dev/session-summaries/`.
- **Commit message (G8):** as above; archive on `closed` only.

---

**Final status:** loop-complete
