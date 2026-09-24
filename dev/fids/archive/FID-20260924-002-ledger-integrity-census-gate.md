# FID-20260924-002 — Ledger-integrity census: the record of truth is the one artifact nothing checked (and the push-blocking Gate 3 inversion its drill exposed)

**Filename:** `FID-20260924-002-ledger-integrity-census-gate.md`
**ID:** FID-20260924-002
**Severity:** HIGH
**Status:** closed (2026-09-24, commit `e28731b`)
**Created:** 2026-09-24
**Trigger:** operator directive, 2026-09-24 ("add a ledger-integrity census gate that fails when a live FID's
status is outside allowed_statuses, when a terminal FID is still in dev/fids/, or when a SCOPE row cites a hash
that does not exist in the repo").

**Retro-filing note (honest):** the directive named the gate and its three checks; the implementation already
existed in this session's working tree when this document was written, so this FID *records* the work rather than
gating it — the FID-20260919-014 shape (a gate added under directive). It is therefore filed and closed in one
pass, and §2's findings are the ones the build actually turned up rather than a pre-implementation plan. Filing
and closure share the ledger commit; G2 is satisfied by the implementation commit `e28731b` (§8).

---

## 1. Summary

`scripts/` contains five censuses — inverted-route, Mongo eradication, schema-consumer (Law 17), timestamp
convention, host timezone — and **every one of them audits the codebase**. The ledger is what this project treats
as the record of truth: FID statuses, the archival boundary, and SCOPE.md's hash citations all *assert* facts, and
nothing has ever checked those assertions against the rules that define them. The three classes are real, not
hypothetical: the status vocabulary has already drifted twice and been repaired by hand (2026-09-16
`converged` → `loop-complete`; 2026-09-24 `implemented` + `no-action`), `dev/fids/` held a single non-work file
for days without anyone noticing (FID-20260917-005, retired 2026-09-24 precisely because an empty "what is in
flight" directory exposed it), and **four SCOPE.md rows cite commits that do not exist in this repository**.
Separately, wiring the new gate into `.githooks/pre-push` and drilling it end-to-end exposed a **pre-existing
defect that blocked every push whose scan was clean** (Gate 3), which had left `main` unable to reach the remote
since Gate 3 was added.

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | Every existing census audits code; nothing reads the ledger | `scripts/` | `ls scripts/ \| grep -i census` → `hostTimezoneCensus.cjs · invertedRouteCensus.cjs · lint-census-fid021.cjs · schemaConsumerCensus.cjs · timestampConventionCensus.cjs`. Scanning `scripts/` for a consumer of `dev/fids` or `SCOPE.md`: none. The status vocabulary lives in three *documents* (`dev/echo-v0.1.2-single-agent.md`, `protocol.config.yaml`, `templates/FID-TEMPLATE.md`) and was verified only by eye or by an ad-hoc grep run for the occasion. |
| 2 | Four SCOPE.md rows cite commits that do not resolve | `SCOPE.md:358, 1057, 1116, 1117, 1119, 1120` | `for h in af1e61e 23cdc63 53c1531 49b5991; do git cat-file -e "$h^{commit}"; done` → `fatal: Not a valid object name af1e61e^{commit}` (and identically for `23cdc63`, `53c1531`, `49b5991`). Census over all 83 cited hashes: `candidate hashes: 81 … MISSING: 4`. |
| 3 | …and all four are destruction-by-design, so "just re-point the hash" is not available | `SCOPE.md:1057, 1116, 1120` / `:1057, 1116` / `:358` / `:1117, 1119` | `af1e61e` = the 2026-09-03 checkpoint commit made without operator approval, removed by operator decision and never pushed (`OPEN-OUT-OF-SCOPE` #17); `23cdc63` = the tip it was reset from; `53c1531` = the remote `main` tip after the 2026-09-03 filter-branch force-push, superseded by the later history import; `49b5991` = base commit of the retained May-era stash — `git stash list` is empty today, so the object was gc-pruned. Each citation is the *only* record of a state that no longer exists. |
| 4 | **The pre-push hook could not pass at all**: Gate 3 refused a tree whose Mongo scan was clean | `.githooks/pre-push` (Gate 3, added 2026-09-19) | `printf 'refs/heads/main <HEAD> refs/heads/main <origin/main>\n' \| bash .githooks/pre-push …` → `❌ pre-push: mongo census enumeration failed (grep exit 0) — refusing the push`, `HOOK EXIT=2`. |
| 5 | The cause is inverted exit-code handling: grep exits **1 for "no matches"**, which is this gate's PASS state | `.githooks/pre-push` | `grep -rEn "<mongo pattern>" lib app scripts server.ts vitest.setup.ts vitest.config.ts next.config.js package.json …` → `grep exit=1`, `hit lines: 0`. The old form `shim_hits="$(grep …)" \|\| { …; exit 2; }` therefore fired exactly when the tree was clean, and fell through to the violation branch when matches existed. |
| 6 | The refusal's own diagnostic named the opposite of the cause | `.githooks/pre-push` (pre-fix) | The block's first statement was `echo "$shim_hits"`, which reset `$?` to 0 before the message `(grep exit $?)` was composed — hence "grep exit 0" beside a refusal triggered by exit 1. A tool failure must not impersonate a pass; this is its mirror: a pass impersonating a tool failure. |
| 7 | Consequence, observable: `main` has not reached the remote since Gate 3 was added | `git for-each-ref` | `refs/remotes/origin/main 25e8078 2026-09-17` while Gate 3's own header dates it 2026-09-19. Consistent with the defect (a `--no-verify` push would not be visible here, so this is corroboration, not proof). |
| 8 | The three ledger classes are non-vacuous today: the vocabulary parses, and the live directory is legitimately empty | `dev/fids/`, `protocol.config.yaml` | `ls dev/fids/` → `archive` only. Vocabulary read from the config by the census: `allowedStatuses=[created, analyzed, fixed, verified, loop-complete, implemented, no-action, closed] terminalStatuses=[closed, no-action]`. |
| 9 | Ledger drift that is real but must NOT fail the gate | `dev/fids/archive/` (175 files) | `37/175 archived FID(s) carry a non-terminal label` (`closed` 137 · `loop-complete` 13 · `verified` 6 · `implemented` 2 · `completed`/`complete`/`created`/`fixed` 1 each · `no-action` 1 · **12 with no parsable `Status` field at all**, all pre-template-era) and `7 cited hash(es) exist but are not reachable from HEAD` (`2426cf4 f7f0921 049459b` = remote-tracking branch tips; `4674b73 0e82eb5 8be0bde de914fa` = `backup-main-pre-rewrite`). Archived labels are preserved by rule, and a cited hash that resolves *is* an existing object; both are reported as **advisory** lines. |
| 10 | A slow gate gets unwired, so the census's own cost was measured | `scripts/ledgerIntegrityCensus.cjs` | First implementation resolved each of the 83 hashes with its own `git cat-file -e` subprocess: `real 0m8.464s`. Replaced with a single `git cat-file --batch-check` pass (one line per request, in request order, asserted against the request count): `real 0m0.339s`. Recorded because 8s on every push is how a "temporary" gate gets removed. |

Call-graph notes (Law 4): there is no runtime path. The consumers are by construction — `.githooks/pre-push`
invokes the script as **Gate 7** on every push (proved by running the hook, §7), and the script reads its
vocabulary from `protocol.config.yaml` at every run rather than embedding it, so an amendment to the vocabulary
and the check that enforces it cannot drift apart.

## 3. Impact Analysis

- **Who/what is affected:** every future FID, every SCOPE.md row, and every push. The gate is the enforcement
  arm of the vocabulary amendment (`FID-20260924-001`) and of the archival rule; without it, "the ledger says
  so" is unfalsified by construction.
- **Failure modes if unfixed:** (1) *unverifiable citations* — a row citing a dead hash reads exactly like a row
  citing a live one, which is the whole failure Mode-1 static analysis exists to prevent; (2) *vocabulary drift
  returns* — the third amendment would again be found by hand, days later; (3) *archival stops meaning
  anything* — a terminal FID in `dev/fids/` makes "how many FIDs are open" answerable only by opening files;
  (4) *pushes blocked* (Gate 3) — the remote silently stops receiving work, and the failure message points at
  grep rather than at the gate, so it reads like a local environment problem.
- **Blast radius of the fix:** one new script (~365 lines), one test file (12 tests), and 40 changed lines in
  `.githooks/pre-push` (Gate 7 wiring + Gate 3's exit-code contract). No application code, no schema, no route,
  no runtime path. The gate's only inputs are tracked text files and `git`.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — A covers the full allowed set plus the missing/legacy-synonym cases; B covers both terminal statuses; C covers every cited hash regardless of abbreviation length, and both commit-cite spellings (backticked and `commit <hash>`) while ignoring non-citations (fenced blocks, numeric dates, digit-free hex words). Each of those branches has a test, and the passing cases assert `1 live FID(s)` so A/B cannot pass against an empty directory. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — one `cat-file --batch-check` process and one `rev-list`, both asserted on line count; 175 archived FIDs and 83 citations cost 0.34s, and the cost is linear in citations, not quadratic in subprocesses. |
| Survives a hostile attacker, not just an honest user? | Yes, and this is the point of the gate: the ledger is the artifact a hostile or merely hurried author would edit. A dead hash can no longer be *pointed at* a live one to look verified (entries in the allowlist require a written reason plus a probe), a bogus status cannot be filed, and a terminal FID cannot be hidden by leaving it live. The gate itself fails closed on every enumeration error rather than reporting success from an empty scan. |
| Maintainable in 2 years? | Yes — the vocabulary has exactly one source (`protocol.config.yaml`), so an amendment needs no change here; the script refuses (exit 2) if the keys disappear, which turns a silent divergence into a loud one. The four waived hashes are the only embedded data, and each carries the reason and date it was established. |
| Sets the standard? | Yes — "the ledger is checked against its own rules, and a citation is only as good as its resolution" generalizes: the same census shape (one config-derived vocabulary, explicit waivers by reason, advisory vs fatal separation, fail-closed enumeration) is what a project's *process* artifacts need, and it is normally the last thing to get a gate. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

Three checks in `scripts/ledgerIntegrityCensus.cjs`, wired as pre-push Gate 7, plus the Gate 3 repair the drill
forced:

1. **Allowed statuses (fatal).** Parse `protocol.config.yaml`'s `allowed_statuses` and `terminal_statuses` (line
   parse; refuse if either key is absent or empty) and require every `dev/fids/*.md` status to be in the allowed
   set and *not* terminal — so a legacy synonym used as a live status (`converged`, `completed`) fails too, since
   the synonym map is scoped to archived history.
2. **Terminal FIDs parked live (fatal).** `closed`/`no-action` in `dev/fids/` means the archival step was
   skipped; the gate names the file, the line and the value.
3. **SCOPE.md hash citations (fatal).** Every hash-looking token on a ledger line (table row or bullet; fenced
   code blocks skipped, since a pasted transcript is not a citation) must resolve as a commit. Destruction-
   by-design hashes are **waived by reason** in a dated `KNOWN_DEAD` table — never re-pointed, because the
   citation is the last record of the destroyed state.
4. **Report-only lines.** Archived non-terminal labels and hashes that resolve but are not reachable from HEAD
   are printed as advisories; neither fails. Turning either into a failure would be a false positive against a
   documented rule (archived labels are preserved on purpose) or against legitimate backup refs.
5. **Fail-closed everywhere:** missing `dev/fids/`, missing `SCOPE.md` (check 3 would otherwise be vacuous),
   unreadable config, malformed vocabulary, unusable git, a partial `--batch-check` read, or an empty `rev-list`
   all exit 2 — never 0.
6. **Gate 3 repair (second finding).** Capture grep's status before any other command, and treat `1` ("no
   matches") as the gate's clean state: refuse only on `>1`. The exit-code contract is written into the hook.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Duplicate the allowed statuses inside the census | Recreates exactly the drift being checked — the vocabulary would then live in two places, one of which nobody remembers to amend. |
| Auto-repoint the four dead citations to a resolving commit | Falsifies the audit trail: each one records a state that was deliberately destroyed (an unlawful checkpoint commit, the tip it was reset from, a superseded remote tip, a dropped stash base). A citation that "looks fixed" is worse than one that is visibly dead. |
| Make HEAD-reachability a *failure* | The 7 such hashes legitimately live on `backup-main-pre-rewrite` / remote-tracking refs; failing on them would push toward deleting the refs that still hold rewritten history. Reported instead. |
| Fail on archived non-terminal labels | Archived files must keep their historical labels (established rule); 37 of them do, and "correcting" them is the archive rewrite the protocol forbids. |
| Parse the YAML with a library | No YAML parser is a direct dependency (`js-yaml` is present only transitively, via tooling), and the census's contract is two list keys; a targeted line parse with a refuse-on-missing-key path is dependency-free and fails loudly if the shape changes. |
| Skip check 3 when SCOPE.md is absent | A silent skip is a vacuous pass — the class this project hardened out of its hooks on 2026-09-16. |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `scripts/ledgerIntegrityCensus.cjs` | create | The three checks, config-derived vocabulary, dated `KNOWN_DEAD` waivers, advisories, fail-closed enumeration, `--root` for fixtures |
| `__tests__/lib/ledgerIntegrityCensus.test.ts` | create | 12 tests: the real tree; the vocabulary read-back; bogus status; archive-scoped synonym used live; terminal FID parked; all six lawful live statuses; unresolvable hash; real hash; fenced-block immunity; unparsable `Status`; no-live-dir refusal; missing-SCOPE refusal |
| `.githooks/pre-push` | modify | Gate 7 wired fail-closed; Gate 3's exit-code contract repaired and documented |

**Verification plan** (from `protocol.config.yaml` → `verification`): `npx tsc --noEmit` → 0 errors;
`npm run test:ci` → all suites pass; `node scripts/ledgerIntegrityCensus.cjs` → exit 0 on the real tree; the full
pre-push gate chain → exit 0; and — because a gate that has never been seen to refuse is not evidence of a gate —
a **negative drill**: park an unlawful live FID, run the real hook, confirm Gate 7 refuses, then remove it.

**Call-graph reachability plan:** not a runtime path. Reachability = the hook invokes the script (proved by the
hook's own output line `✅ pre-push: ledger census clean …` in §7) and the test suite invokes it directly.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | `npx tsc --noEmit` · `npm run test:ci` · `node scripts/ledgerIntegrityCensus.cjs` · the full pre-push chain | §7 (pasted). tsc exit 0; **1313/1313 across 136 files** (1301 pre-existing + 12 new); census exit 0; hook exit 0 with all seven gates green | pass |
| Method 2: manual re-read against this FID | Each §2 finding re-derived from its own pasted output; every §5 check traced to its test; the drill re-read against the gate's failure branch; the four `KNOWN_DEAD` reasons re-checked against the SCOPE rows that cite them | §2, §5, §7 | pass |
| Negative drill (the gate must refuse when it should) | A temporary live FID with `Status: underway` plus the real hook | §7: `HOOK EXIT=1`, `LIVE FID STATUS OUTSIDE allowed_statuses (1): dev/fids/FID-20990101-999-gate-drill.md:4 status \`underway\`` | pass |

- Audit outcome: **PASS** → `closed` on `e28731b` (§8).
- Circuit breakers: two build passes (the per-hash → batch-check rewrite, and the fail-closed hardening for a
  missing `SCOPE.md` / unparsable `Status`), both small and convergent; no oscillation, well under the
  10-iteration stop.

## 7. Implementation Record

- **Status:** done (2026-09-24). Files: `scripts/ledgerIntegrityCensus.cjs` (+365),
  `__tests__/lib/ledgerIntegrityCensus.test.ts` (+137), `.githooks/pre-push` (Gate 7 block; Gate 3 rewritten).
- **Verification evidence (run at `e28731b`, pasted):**
  - `npx tsc --noEmit` → `TSC EXIT=0`
  - `npm run test:ci` → `Test Files 136 passed (136)` · `Tests 1313 passed (1313)`
  - `node scripts/ledgerIntegrityCensus.cjs` → `CENSUS EXIT=0`:
    ```
    ledger census: 0 live FID(s), 175 archived; 402 ledger line(s) in SCOPE.md carrying 83 cited hash(es)
    ledger census: vocabulary from protocol.config.yaml — allowedStatuses=[created, analyzed, fixed, verified, loop-complete, implemented, no-action, closed] terminalStatuses=[closed, no-action]
    ledger census: 4 destroyed-by-design hash(es) waived by reason: 53c1531, af1e61e, 23cdc63, 49b5991
    ledger census advisory: 37/175 archived FID(s) carry a non-terminal label (historical labels are preserved by rule)
    ledger census advisory: 7 cited hash(es) exist but are not reachable from HEAD: 2426cf4, f7f0921, 049459b, 4674b73, 0e82eb5, 8be0bde, de914fa
    ledger census clean: live statuses lawful, no terminal FID parked, every SCOPE hash resolves
    ```
  - **full pre-push chain → `HOOK EXIT=0`**, all seven gates green:
    ```
    ✅ pre-push: census clean (routes: 240 · call sites: 301 (unparsed: 0))
    ✅ pre-push: mongo eradication census clean
    ✅ pre-push: schema census clean (57 tables — 57 live, 0 ticketed, 0 violations)
    ✅ pre-push: timestamp census clean (no naive instants)
    ✅ pre-push: host-tz census clean (no host-local game-time math)
    ✅ pre-push: ledger census clean (live statuses lawful, no terminal FID parked, every SCOPE hash resolves)
    ✅ pre-push: attribution scan clean
    ```
  - **negative drill, same tree, real hook → `HOOK EXIT=1`:**
    ```
    ledger census: 1 live FID(s), 175 archived; 402 ledger line(s) in SCOPE.md carrying 83 cited hash(es)
    LIVE FID STATUS OUTSIDE allowed_statuses (1):
      dev/fids/FID-20990101-999-gate-drill.md:4  status `underway`
    ❌ pre-push: ledger census refused the push (exit 1) — fix the status/archival/citation violations above
    ```
    (drill file deleted in the same command; `ls dev/fids/` → `archive`)
  - `npm run lint`: the new files are clean (`npx eslint scripts/ledgerIntegrityCensus.cjs
    __tests__/lib/ledgerIntegrityCensus.test.ts` → exit 0). **Not** clean repo-wide: 6 pre-existing
    `@typescript-eslint/no-unused-vars` / `react/no-unescaped-entities` errors in files this change does not
    touch (`components/AuctionHousePanel.tsx`, `components/CreateListingModal.tsx`,
    `lib/movementService.ts`, `scripts/e2ePlayerNotificationLive.ts`, `scripts/e2eSlice1AntiCheatLive.ts`,
    `scripts/spawnBots.ts`). Recorded, not fixed here: unrelated scope, and the recorded "eslint 0" claim for
    0.0.32 is therefore stale for the repo as a whole.
- **Call-graph reachability evidence:** the hook's own run printed
  `🔍 pre-push: ledger-integrity census (FID statuses, terminal FIDs, SCOPE hashes)...` immediately before
  `✅ pre-push: ledger census clean …` (§7, the clean run above) — the gate is in the push path, not merely on disk.
- **Gate 3 repair evidence:** before the fix the same hook run ended `HOOK EXIT=2` at Gate 3 with
  `mongo census enumeration failed (grep exit 0)`; after it, `✅ pre-push: mongo eradication census clean` and the
  run continues to Gate 2 (§7). The inverted-exit probe is §2 findings 5–6.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] tests 1313/1313 · [x] census exits 0 · [x] call-graph (hook) proven ·
  [ ] lint 0 repo-wide — **6 pre-existing errors in untouched files** (§7); the changed files are clean.
- **Commit hash (G2):** `e28731b` — *feat(gates): ledger-integrity census — FID statuses, terminal FIDs and SCOPE
  hash citations checked; wired as pre-push Gate 7, and Gate 3's inverted exit-code handling fixed
  (FID-20260924-002)*, 3 files changed (+562/−5) → `scripts/ledgerIntegrityCensus.cjs`,
  `__tests__/lib/ledgerIntegrityCensus.test.ts`, `.githooks/pre-push`.
- **Fresh closure probe at `e28731b` (Law 16, 2026-09-24):** `git diff --stat e28731b` → empty (the probe ran on
  exactly the committed content); `npx tsc --noEmit` → 0; `npm run test:ci` → 1313/1313 (136 files);
  `node scripts/ledgerIntegrityCensus.cjs` → exit 0; full pre-push chain → exit 0; negative drill → exit 1 at
  Gate 7. All pasted in §7 — none of it from memory.
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260924-002-ledger-integrity-census-gate.md
  SCOPE.md CHANGELOG.md VERSION` — this document is filed directly in `dev/fids/archive/` because filing and
  closure are the same act here (§1); `dev/fids/` is left empty of live FIDs, which is the truthful state.
- **Commit message (G8):** `docs(ledger): FID-20260924-002 closed on e28731b — ledger-integrity census gate
  (pre-push Gate 7) and the Gate 3 inversion it exposed; SCOPE rows 119-120, CHANGELOG/VERSION 0.0.33
  (FID-20260924-002)`
- **SCOPE rows:** 119 (this gate) and 120 (the Gate 3 defect it exposed — given its own row so the ledger indexes
  a push-blocking defect independently of the gate that found it).
- **Archive:** `dev/fids/archive/FID-20260924-002-ledger-integrity-census-gate.md`; CHANGELOG entry appended
  under `0.0.33`; `VERSION` → `0.0.33`.

---

**Final status:** `closed` (2026-09-24, commit `e28731b`). Filed, implemented, verified and closed against the
same commit; the second finding (Gate 3) is recorded with its own SCOPE row because a gate that cannot pass is a
worse failure than the drift it was written to catch — and it was this FID's own drill, not a review, that found
it.
