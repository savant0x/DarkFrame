# FID-20260925-002 — The session record is a gate: check D refuses a closure that no session summary cites

**Filename:** `FID-20260925-002-session-record-gate.md`
**ID:** FID-20260925-002
**Severity:** MEDIUM
**Status:** closed (2026-09-25, commits `9a5ba11` + `2e1d63b`)
**Created:** 2026-09-25
**Trigger:** operator directive, 2026-09-25 (*"resume"*), taken as authorization for the recommended option
recorded on `SCOPE.md` row 124 by `FID-20260925-001` §5 — option **a**, "make a session record required per
closed-FID session date", which that row left to the operator precisely because it changes a gate's contract.

**Filing note (honest):** the check and its tests were written before this document, as the directive arrived
as *continue* rather than as a plan to approve. The document is therefore a record of a decision already taken
under level-3 autonomy, and §5 states the reasoning, the cutover's derivation and the alternatives so the
decision is auditable rather than merely reported.

---

## 1. Summary

`dev/session-summaries/README.md` opens with Law 8 and `dev/echo-v0.1.2-single-agent.md:385` requires the
archival to be logged in a session summary, and **nothing in the repository read that directory** —
`grep -n session-summaries` over `.githooks/*`, `.github/workflows/*.yml` and `scripts/*.cjs` exited 1. So the
requirement was a convention, and `FID-20260925-001` is the evidence that conventions alone fail: four FID
closures and nine commits shipped on 2026-09-24 with no record, and the hole behind them spans six days. This
FID adds the missing check to **`scripts/ledgerIntegrityCensus.cjs`** — Gate 7, not a new gate, because the
ledger census *is* the ledger's integrity check and an eleventh gate for one more rule would fragment that
meaning. **Check D** is three rules and two refusals: a terminal FID whose stated closure date is on/after
**2026-09-24** must be cited by at least one `dev/session-summaries/*.md` (fatal); a terminal FID *filed* on/
after that date must carry a dated closure, because an undated one cannot be judged (fatal); a closure dated
before the FID was filed is a violation, which is what stops the cutover being dodged by writing an older date
(fatal). History is **reported, never failed**: 134 terminal archived FIDs predate the cutover or carry no
closure date, and demanding records for them retroactively would be the gate rewriting history the operator has
not decided about (`SCOPE.md` row 124 options b/c/d). The cutover itself is not a preference — it was derived
by probing the tree, and the probe is pasted in §2. Cost: `0.357s` against `0.339s` before, so the gate stays
wired for the reason `FID-20260924-002` recorded when the same script went from 8.5s to 0.34s.

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | **Nothing read the session record** — the requirement had no enforcement surface at all | `.githooks/*`, `.github/workflows/*.yml`, `scripts/*.cjs`, `scripts/*.mjs` | `grep -n "session-summaries" …` → **no output, exit 1**. Gate 7's three existing checks were FID statuses, terminal FIDs parked live, and SCOPE hash citations; no gate, workflow or script mentioned the directory |
| 2 | The consequence was not hypothetical — it happened, and was only found by a grounding pass | `dev/session-summaries/`, `FID-20260925-001` §2 | That FID's probe: `grep -rln "FID-20260924\|ledger-integrity\|Gate 8\|Gate 9" dev/session-summaries/ --exclude=SESSION-2026-09-24-002.md` → exit 1; 71 commits on 2026-09-19..09-22 with no summary; releases 0.0.13-0.0.31 unmentioned by any summary |
| 3 | **An unscoped citation rule is not viable — measured, not assumed.** 84 of 179 archived FIDs are cited by no summary, and range mentions are real | `dev/fids/archive/`, `dev/session-summaries/` | Probe of every archived FID ID against every summary text → `archived FIDs: 179 · cited by some summary: 95 · NOT cited: 84` (the uncited are largely the 2026-09-06 batch). And a range mention is not an ID: `FID-20260919-012:yes FID-20260919-013:no FID-20260919-014:no FID-20260919-015:no FID-20260919-016:no FID-20260919-017:no` — those six are recorded (commit `3d75409`, SCOPE rows) but cited as the range `012..017`, so an unscoped ID check would have failed six FIDs that are properly recorded. Date scoping is load-bearing; an allowlist of 84 exemptions would have been the wrong instrument |
| 4 | The cutover value is derived from the record, not chosen for convenience | `dev/fids/archive/` | Closure dates parsed from each archived `Status` line, matched against every summary: `terminal WITH date: 36 · terminal WITHOUT date: 106 · closure date >= 2026-09-24: 8` and **8/8 are cited** (`FID-20260925-001`, `FID-20260917-005`, `FID-20260923-001`, `-002`, `FID-20260924-001`, `-002`, `-003`, `-004`). 2026-09-24 is the first day with a demonstrably complete record; a later cutover would exempt closures that are recorded, an earlier one would fail history |
| 5 | **A probe of my own was wrong before it was a finding.** The session's earlier `CHAIN EXIT=0` assertions measured the pipe's first element, not the hook | this session's shell history; `SESSION-2026-09-25-001` §3.4 | `${PIPESTATUS[0]}` after `printf … \| bash .githooks/pre-push … \| tail` is **`printf`'s** status. The green verdict was independently corroborated (the successful run's last line is `✅ pre-push: attribution scan clean`, printed only on success), but the exit-code claim was measuring its own input. Re-measured from the hook itself: green → `CHAIN EXIT=0`, drill → `HOOK EXIT=1`. Recorded because the general lesson is the project's own: a check that looks like a verdict must be probed before it is trusted — the same class as the `AT TIME ZONE` literal probe in `FID-20260923-001` §8 |
| 6 | Two evasions would have made check D decorative, so both are closed by rule | `.githooks/pre-push`, `SCOPE.md` row 124 | (i) *undated closure* — a terminal status with no date cannot be located relative to the cutover, and "unjudged" is how a check becomes decorative, so a post-cutover filing must carry its date (fatal; drilled by fixture). (ii) *backdated closure* — the cheap sanity check that a closure cannot precede the filing closes it (probed: `closure date BEFORE filing date: 0` of 36 dated closures in the real archive, so the rule is free today and loud tomorrow) |
| 7 | The gate's own cost stays negligible, which is why it can be wired at all | `scripts/ledgerIntegrityCensus.cjs` | `time node scripts/ledgerIntegrityCensus.cjs` → `real 0m0.357s` (three extra `readdirSync`/`readFileSync` passes over 179 FIDs, 113 summaries, 409 ledger lines) against the `0.339s` recorded in `FID-20260924-002` |

Call-graph notes (Law 4): no runtime path. The check runs inside the existing Gate 7 block of
`.githooks/pre-push`, which CI executes through `.github/workflows/gate-chain.yml`, so no wiring change was
needed — reachability is proved by the gate's own line in a full chain run (§7), not by construction.

## 3. Impact Analysis

- **Who/what is affected:** every future FID closure, every session, and the chain itself (Gate 7's contract
  gains one fatal class and one reported class; the gate count stays at ten).
- **Failure modes if unfixed:** (1) *silent recurrence* — the exact defect `FID-20260925-001` filed: a
  campaign ships, the chain prints ten green gates, and nothing was written down where the protocol says to
  write it; (2) *unfalsifiable closure records* — a `closed` FID whose "when" is unstated makes every later
  question about ordering depend on git archaeology; (3) *date-shaped evasion* — without the filed-date rules,
  the cheapest way to satisfy the check would be to write a date, or none.
- **Blast radius:** one script (+156/−19 across two commits) and one test file (+114). No hook edit, no
  workflow edit, no runtime path, no dependency. The check reads only tracked text and `protocol.config.yaml`.
- **Blast radius against history — deliberately zero:** the 84 uncited archived FIDs and the 134 terminal
  closures that predate the cutover are *reported*, not failed. Making them fatal would be the gate deciding
  the 2026-09-19..09-22 question that `SCOPE.md` row 124 reserves to the operator.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — both terminal statuses (`closed`, `no-action`), dated and undated closures, pre- and post-cutover filings, FIDs whose filenames predate the eight-digit convention, and summaries that cite an ID anywhere in their text. Each branch has a fixture, plus two refusal paths (missing directory, empty directory) so the check cannot pass vacuously on a tree with no record at all. |
| Scales? | Yes — one directory listing and one read per summary, linear in the ledger's size, at `0.357s` for 179 FIDs and 113 summaries. No per-FID subprocess, which is the mistake `FID-20260924-002` already measured and removed. |
| Survives a hostile attacker? | Better than the alternative it replaces (a convention): the two obvious evasions are closed by rule (finding 6), and the failure text names the FID, the date and the missing citation. It is not tamper-proof against someone who edits the census itself — nothing here is — but every such edit is a reviewed diff on a `.cjs` file in the chain, which is the same boundary Gates 1-10 already depend on. |
| Maintainable in 2 years? | Yes — three rules stated in the script's header, one derived constant (`RECORD_FROM`) carrying its derivation, and a cutover the operator can move deliberately (one line, one reason). The rules read only fields the template already requires (`Status`, the filename) and one directory the README already defines. |
| Sets the standard? | Yes, and it is the generalizable half of this whole arc: **a process requirement with no check is a preference.** The project had already learned that for schema consumers (Law 17), for lint (`FID-20260924-003`) and for its own ledger (`FID-20260924-002`); this extends the same lesson to the record of intent — the artifact that explains why any of the other gates exist. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

**Check D in `scripts/ledgerIntegrityCensus.cjs`** (Gate 7), fail-closed on the input:

1. **The record must exist to be checkable.** A missing `dev/session-summaries/`, or one holding no `.md`
   besides `README.md`, refuses with exit 2 — a silent skip is a vacuous pass, the class this project hardened
   out of its hooks on 2026-09-16.
2. **D1 — an uncited closure (fatal).** For each archived FID whose status is terminal **and** whose stated
   closure date is on/after `RECORD_FROM` (2026-09-24), at least one session summary must contain its FID ID.
3. **D2 — an undated closure (fatal).** A terminal FID *filed* on/after the cutover whose status carries no
   `YYYY-MM-DD` cannot be located relative to the cutover; the honest response is to refuse it rather than
   exempt it silently.
4. **D3 — a closure before the filing (fatal).** `closed (2026-01-01, …)` on a FID filed 2099-01-01 is
   impossible, and without this the cutover is dodgeable by writing any older date.
5. **History is advisory.** Terminal closures that predate the cutover, or that carry no date at all while
   being filed before it, are counted and reported in one line that names `SCOPE.md` row 124 as the open
   decision. Archived labels keep their immunity (they are not checked against `allowed_statuses`).
6. **`RECORD_FROM` is a derived constant, documented in place.** 2026-09-24 is the first day with a complete
   record (finding 4); moving it is a one-line change with a stated reason, not a silent tuning knob.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Require a session record for **every** archived FID | Measured: it would fail 84 FIDs, most of them 2026-09-06-era records made before the summaries directory was used as a per-session log, and it would fail the six FIDs cited as the range `012..017` despite their records existing (finding 3). A gate that fails correct history teaches people to ignore it |
| An explicit exemption list for the 84 | The instrument for "history is exempt by rule" is a *date*, not a list that grows every time someone wants an exception — the same reasoning as `dispositions` vs. `KNOWN_DEAD`: an allowlist entry needs a probe and a reason, and 84 of them would be noise |
| Use git commit dates as the closure date | Available in one `git log` pass, but it answers "when was the file last edited" — which for `FID-20260919-012`..`017` is 2026-09-24 (their bookkeeping correction), i.e. it would *create* six false failures. The record must state its own date; that is the whole point of D2 |
| A separate Gate 11 for the session record | Fragments the meaning of "the ledger is intact" across two gates and two failure vocabularies; Gate 7 already owns FID status, archival boundary and citations, and this is the same artifact class |
| Check `SCOPE.md`'s `Last updated` header against `VERSION` in the same change (row 124 option b) | A prose field ("rows 124-126 added; CHANGELOG/VERSION 0.0.37") is not a value: a parser would either pin the wording or fail on the next rephrase. It belongs in its own decision, and row 124 keeps it open |
| Retro-file the 2026-09-19..09-22 span as part of this FID (option c) | Out of this directive's scope and it is a real work item with its own cost; making check D *fail* those FIDs would be worse — it would convert an operator decision into a gate verdict |
| Require a structured `Session:` field in the FID template | A stronger invariant (explicit mapping instead of a citation) but it changes `templates/FID-TEMPLATE.md` for every future FID and the archived corpus has no such field. Recorded as the natural follow-up if citation-based checking proves too loose in practice |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `scripts/ledgerIntegrityCensus.cjs` | modify | Check D (D1/D2/D3), `RECORD_FROM` with its derivation, two refusals, one advisory line, report and guidance text, clean-line wording |
| `__tests__/lib/ledgerIntegrityCensus.test.ts` | modify | Fixture gains the archive and the summary directory (created by default, omissible); 7 new tests: uncited closure, cited closure, undated post-cutover closure, backdated closure, pre-cutover history as advisory, missing directory refusal, empty directory refusal |

**Verification plan:** the four project commands plus the census (`tsc` 0; `lint` 0/0; suite pass; census exit 0)
and the **full chain** held at exit 0; and three **negative drills** on the real hook, because a check never
seen to refuse is not a check — an uncited closure, a backdated closure (both ran), plus the undated case by
fixture.

**Call-graph reachability plan:** not a runtime path. Reachability = Gate 7 executes the census inside a real
chain run (its `✅ pre-push: ledger census clean (…)` line, §7) and the output's new clauses
(`every closure from 2026-09-24 carries a session record`, `session record — 8 terminal FID(s) … cited by 113
session summary file(s)`) appear there, not only in a standalone invocation.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | `npx tsc --noEmit` · `npm run lint` · `npm run test:ci` · `node scripts/ledgerIntegrityCensus.cjs` · full chain, at both implementation commits | §7: chain `CHAIN EXIT=0` at `9a5ba11` with **1319 passed (1319)** and at `2e1d63b` with **1320 passed (1320)**; census exit 0 at `0.357s` | pass |
| Method 2: manual re-read against this FID | Each of the three rules traced to its code branch and its fixture; `RECORD_FROM` re-derived from the §2 probe rather than kept because it passed; the two refusals read against the same rule the other checks follow ("a silent skip is a vacuous pass"); the 84-uncited measurement re-run after the change to confirm it is still only advisory | §2 findings 3, 4, 6; §7 | pass |
| Drills on the real hook — uncited closure | `dev/fids/archive/FID-20990101-999-gate-drill.md` (`closed (2099-01-01, …)`, cited by nothing) + `.githooks/pre-push` | §7: `FIDs CLOSED ON/AFTER 2026-09-24 WITH NO SESSION RECORD (1)` … `❌ pre-push: ledger census refused the push (exit 1)` · `DRILL HOOK EXIT=1`; file removed (`grep -c 999` → `0`), census green | pass |
| Drills on the real hook — backdated closure | `dev/fids/archive/FID-20990101-998-drill.md` (`closed (2026-01-01, …)`) + `.githooks/pre-push` | §7: `CLOSURES DATED BEFORE THE FID WAS FILED (1)` · `DRILL EXIT=1`; file removed (`grep -c 998` → `0`) | pass |
| Drill by fixture — undated post-cutover closure | `archived('closed')` filed 2099-01-01 | `TERMINAL FIDs FILED ON/AFTER 2026-09-24 WITH NO DATED CLOSURE` | pass |

- Audit outcome: **PASS** → `closed` on `9a5ba11` + `2e1d63b` (§8).
- Circuit breakers: three passes (check D; the D3 hardening after the backdating evasion was identified;
  test-helper generalization), each small and convergent, no oscillation, well under the 10-iteration stop.

## 7. Implementation Record

- **Status:** done (2026-09-25).
- **Files changed:** `scripts/ledgerIntegrityCensus.cjs` (`9a5ba11`: +156/−19 as part of a 2-file commit;
  `2e1d63b`: +34/−1 for D3), `__tests__/lib/ledgerIntegrityCensus.test.ts` (7 new tests; 12 → 19 in the file).
- **Verification evidence — `9a5ba11` (from `SESSION-2026-09-25-001` §3.2):**
  ```
  ✅ pre-push: ledger census clean (ledger census clean: live statuses lawful, no terminal FID parked,
                                     every SCOPE hash resolves, every closure from 2026-09-24 carries a session record)
  ✅ pre-push: eslint clean (0 errors, 0 warnings)
  ✅ pre-push: typecheck clean (0 errors)
  ✅ pre-push: test suite clean (1319 passed (1319))
  ✅ pre-push: attribution scan clean
  CHAIN EXIT=0
  ```
- **Verification evidence — `2e1d63b`:**
  ```
  ✅ pre-push: ledger census clean (… every closure from 2026-09-24 carries a session record)
  ✅ pre-push: eslint clean (0 errors, 0 warnings) · ✅ pre-push: typecheck clean (0 errors)
  ✅ pre-push: test suite clean (1320 passed (1320))
  ✅ pre-push: attribution scan clean
  CHAIN EXIT=0
  ```
  and the census on the real tree:
  ```
  ledger census: 0 live FID(s), 179 archived; 409 ledger line(s) in SCOPE.md carrying 90 cited hash(es)
  ledger census: session record — 8 terminal FID(s) closed on/after 2026-09-24 cited by 113 session summary file(s)
  ledger census advisory: 134 terminal archived FID(s) predate 2026-09-24 or carry no closure date
                          (history, not demanded retroactively — the 2026-09-19..09-22 span is an open decision, SCOPE row 124)
  ledger census clean: … every closure from 2026-09-24 carries a session record
  ```
- **Drill evidence (real hook, §6):** uncited closure → `DRILL HOOK EXIT=1`; backdated closure → `DRILL EXIT=1`;
  both artifacts removed in the same command and `node scripts/ledgerIntegrityCensus.cjs` → exit 0 afterwards.
- **Reachability evidence:** the new clauses appear inside the hook's own Gate 7 line (§7, pasted), and CI runs
  the identical chain (`.github/workflows/gate-chain.yml` pipes a synthesized ref line into the hook), so the
  check is enforced wherever the chain is.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] tests 1320/1320 · [x] census exit 0 · [x] chain exit 0 ·
  [x] three drills (two on the real hook, one by fixture).
- **Commit hashes (G2):** `9a5ba11` — *feat(gates): ledger census check D — a FID closed on/after 2026-09-24
  must be cited by a session summary, and a post-cutover terminal closure must carry its date
  (FID-20260925-002)*, 2 files (+250/−19); `2e1d63b` — *feat(gates): ledger census check D gains the
  closure-before-filing sanity check — a backdated closure cannot dodge the session-record cutover
  (FID-20260925-002)*, 2 files (+34/−1).
- **Fresh closure probe at `2e1d63b` (Law 16, 2026-09-25):** `git status --porcelain` → empty (the probes ran on
  exactly the committed content); census exit 0 at `0.357s`; chain `CHAIN EXIT=0` with 10 gates and
  **1320 passed (1320)**; both drill artifacts absent.
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260925-002-session-record-gate.md
  SCOPE.md CHANGELOG.md VERSION` — filed directly in `dev/fids/archive/` because the gate shipped before the
  document (the filing note above); `dev/fids/` stays empty of live FIDs.
- **Commit message (G8):** `docs(ledger): FID-20260925-002 filed closed on 9a5ba11 + 2e1d63b — ledger census
  check D, the session record is now a gate; SCOPE row 126 and the row-124 annotation, CHANGELOG/VERSION 0.0.37
  (FID-20260925-002)`
- **SCOPE rows:** 126 (this FID); row 124 annotated — option (a) implemented here, options (b)/(c)/(d) left
  open on the row.
- **Archive:** `dev/fids/archive/FID-20260925-002-session-record-gate.md`; CHANGELOG entry under `0.0.37`;
  `VERSION` → `0.0.37`.

---

**Final status:** `closed` (2026-09-25, commits `9a5ba11` + `2e1d63b`). The session record is now a
precondition of a closure from 2026-09-24 forward, enforced by the same gate that checks statuses, the archival
boundary and hash citations — and this FID is itself subject to it, which is why
`dev/session-summaries/SESSION-2026-09-25-001.md` cites it: the rule was obeyed by the change that introduced it.
