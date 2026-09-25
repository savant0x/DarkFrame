# FID-20260925-001 — The session record had a six-day hole: the four 2026-09-24 gate closures shipped with no session summary, and nothing checks that one exists

**Filename:** `FID-20260925-001-session-record-gap.md`
**ID:** FID-20260925-001
**Severity:** MEDIUM
**Status:** closed (2026-09-25, commit `9b7125e`)
**Created:** 2026-09-25
**Trigger:** operator directive, 2026-09-25 (*"write the missing session summary covering the four 2026-09-24
gate sessions (FID-20260924-001 through -004), with pasted verification evidence and a filed FID for the
gap"*), following the grounding pass that read the protocol 0-EOF and then probed the repository rather than
trusting the ledger's summary of itself.

**Retro-filing note (honest):** this FID documents a record that did **not** exist when the work it describes
was executed. The four FID closures it accounts for shipped on 2026-09-24; `SESSION-2026-09-24-002.md` was
written on 2026-09-25 and committed on its own (`9b7125e`) before this document, which is why G2 is satisfied
by that commit and this FID sits directly in `dev/fids/archive/` — filed and closed in one pass, the
`FID-20260919-014` / `FID-20260924-002` shape. It is a *record of a gap*, not a plan that gated the work.

---

## 1. Summary

`dev/session-summaries/README.md` opens its stated purpose with **Law 8**: *"the intended change is documented
before implementation starts"*, and the protocol's FID auto-archive rule ends with *"Log the archival in the
session summary"* (`dev/echo-v0.1.2-single-agent.md:385`). Between `SESSION-2026-09-18-001` (which records
`CHANGELOG 0.0.12`) and the retro-file this FID closes, **exactly one summary was written** —
`SESSION-2026-09-24-001`, for the 2026-09-23/24 timestamp batch. Everything else is unlogged. Measured, not
estimated: **71 commits landed on 2026-09-19 … 2026-09-22** with no summary of any kind, **no summary mentions
any release between 0.0.13 and 0.0.31 at all**, and the **nine commits and four FID closures of 2026-09-24's
gate campaign** (releases 0.0.33, 0.0.34, 0.0.35 — including all three Law-3 verification commands becoming
gated, and CI gaining an unbypassable caller of the same chain) were recorded in commit messages, FIDs,
SCOPE rows and the CHANGELOG, and in the session log **nowhere**. The campaign was the part that made the
chain itself trustworthy; the record of *why it happened* is the part that was skipped. Two things follow.
The narrow one: the record is now written (`SESSION-2026-09-24-002.md`, committed as `9b7125e`, with the
fresh 10-gate probe pasted). The structural one: **nothing in the repository can tell whether a summary
exists** — Gate 7 checks FID statuses, the archival boundary and SCOPE hash citations, and no gate, script or
workflow reads `dev/session-summaries/` at all — so the omission was invisible to every check this project
has, and will be again. That enforcement decision is recorded and **left to the operator** (§5), with the
same-day discovery that `SCOPE.md`'s own `Last updated` header had gone stale a second time in six days,
re-created by the very sessions that fixed it the first time.

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | No session summary existed for the gate campaign — not one that even *mentions* it | `dev/session-summaries/` | `grep -rln "FID-20260924\|ledger-integrity\|Gate 8\|Gate 9" dev/session-summaries/ --exclude=SESSION-2026-09-24-002.md` → **no output, exit 1** (the only hit in the tree is the retro-file itself) |
| 2 | The last summary before the hole records `CHANGELOG 0.0.12`; the only summary written since is the timestamp batch | `SESSION-2026-09-18-001.md:92`, `SESSION-2026-09-24-001.md` | `ls dev/session-summaries/ \| grep -oE '^SESSION-[0-9]{4}-[0-9]{2}-[0-9]{2}' \| sort \| uniq -c \| tail -4` → `34 SESSION-2026-09-16 · 24 SESSION-2026-09-17 · 1 SESSION-2026-09-18 · 1 SESSION-2026-09-24` (1, before the retro-file) · `SESSION-2026-09-18-001.md:92`: *"CHANGELOG 0.0.12, VERSION bump"* |
| 3 | **The hole is six days, four times the size of the directive.** 71 commits (2026-09-19 … 09-22) have no summary, and releases **0.0.13 – 0.0.31** have no summary of their own | whole history | `git log --format='%cd' --date=short \| sort \| uniq -c \| tail -8` → `53 2026-09-19 · 8 2026-09-20 · 1 2026-09-21 · 9 2026-09-22 · 17 2026-09-24` · `git log --since=2026-09-19T00:00:00 --until=2026-09-23T00:00:00 --format='%h' \| wc -l` → **71** · `grep -rhoE "0\.0\.[0-9]+" dev/session-summaries/ --exclude=SESSION-2026-09-24-002.md \| sort -t. -k3 -n \| uniq -c \| tail -5` → `5 0.0.8 · 1 0.0.9 · 1 0.0.12 · 3 0.0.31 · 5 0.0.32` — the version strings simply stop at 0.0.12 until 0.0.31/0.0.32 appear (only inside `SESSION-2026-09-24-001`) |
| 4 | **Nothing enforces the requirement.** No hook, workflow, script or census reads the session directory | `.githooks/pre-push`, `.github/workflows/`, `scripts/` | `grep -n "session-summaries" .githooks/* .github/workflows/*.yml scripts/*.cjs scripts/*.mjs` → **no output, exit 1**. Gate 7's three checks are FID statuses, terminal FIDs parked live, and SCOPE hash citations (`scripts/ledgerIntegrityCensus.cjs`) — the session record is outside all of them |
| 5 | So the omission was invisible by construction, not merely unnoticed | same | The chain prints **10 green gates** at the tree where no summary existed for the campaign (pasted in §7). A green chain and a missing session record coexisted, and no gate's contract mentioned the second |
| 6 | `SCOPE.md`'s `Last updated` header is stale — **the second time in six days, with the same root cause** | `SCOPE.md:9` | `grep -n "Last updated" SCOPE.md` → `9:**Last updated:** 2026-09-24 — FID-20260923-001 and FID-20260923-002 closed on their committed hashes and archived; SCOPE rows 116-117 dispositioned; CHANGELOG 0.0.32.` while `grep -c "^\| 12[0-2] " SCOPE.md` → **3** rows (120-122) exist beyond the header's claim and `cat VERSION` → **0.0.35**. `SESSION-2026-09-24-001` §3.2 corrected this exact field on discovery ("This field had gone stale — it still read 2026-09-14 (session 005)…"), and rows 118-122 re-created it |
| 7 | What survived, and what did not — the gap is a *process step*, not lost evidence | the nine commits, four FIDs, CHANGELOG | Survived: G8 commit messages, each FID's §1/§2/§5/§7/§8 (problems, rejected alternatives, pasted probes), SCOPE rows 118-122, CHANGELOG 0.0.33-0.0.35. Missing: the contemporaneous **intent log** (Law 8), the per-session **double-audit home**, the **plan-step statuses**, and the cross-reference the auto-archive rule asks for. Every claim is reconstructible in principle — at the cost of reading nine commit messages and four FIDs, which is exactly the work a summary exists to pre-empt |
| 8 | Law 8's home is the session summary, by name | `dev/echo-v0.1.2-single-agent.md:105`, `dev/session-summaries/README.md:9` | `\| **8** \| Log intent before coding \| Document the intended change in the session summary before implementation \|` · README: *"**Law 8 (Log intent before coding)** — the intended change is documented before implementation starts"* |
| 9 | Same grounding pass, different artifact: `SCOPE.md` has two identically-titled open-items headings, and its table ends out of order | `SCOPE.md:448, :1034, :1102` | `grep -n "^## \[OPEN-OUT-OF-SCOPE\]" SCOPE.md` → `448:## [OPEN-OUT-OF-SCOPE] — Discovered, Awaiting Operator Decision` and `1034:` the same heading again (the first heads a block of 09-08…09-15 session logs; the actual item table lives under the second) · `grep -n "^\| 30 \|" SCOPE.md` → `1102`, after `\| 65 \|` at 1101 · the 4-column table at 1039 carries both the open items (1-…) and the session ledger (…-122), so "which items are open" is not machine-answerable. Filed separately (row 125) as its own artifact class |

Call-graph notes (Law 4): there is no runtime path. The artifacts are the session directory and `SCOPE.md`;
the *consumers* are readers — the next session, the operator, and Gate 7, which is the reason this is filed as
a gate-shaped gap: the one artifact currently trusted as the record of truth (the ledger) references releases
whose session record does not exist, and nothing can notice.

## 3. Impact Analysis

- **Who/what is affected:** every future session, every reader reconstructing "why did this change", and the
  ledger's own credibility. The session directory is where intent-before-coding and the per-session double
  audit are supposed to live; four closed FIDs and three releases were absent from it.
- **Failure modes if unfixed:** (1) *unreconstructible intent* — the campaign's "why" survives only in FID
  prose and commit subjects; the moment a reader wants the ordering rationale ("why did lint land before the
  lint gate?") they must rebuild it from nine commits, and the answer is in the FIDs only because those
  documents happen to be unusually thorough; (2) *a silent recurrence* — nothing checks, so the next busy
  session repeats it, which is what already happened once: the 6-day hole was not noticed until a grounding
  pass looked for it; (3) *double-audit without a home* — Method 1/Method 2 evidence exists inside the FIDs
  here, but the README's structure says it belongs in the session record too, so its absence makes "was the
  campaign double-audited?" a question answerable only from the FIDs; (4) *a hand-maintained header that has
  now gone stale twice in six days* (finding 6) — the same class: a claim about the ledger that nothing reads.
- **Blast radius of the fix:** one new session summary (232 lines), one FID document, three SCOPE rows, one
  CHANGELOG section, one `VERSION` bump. No code, no gate contract, no hook, no runtime path. The
  recurrence-prevention half is explicitly **not** in this blast radius — it is the operator-gated decision in
  §5 and SCOPE row 124.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes, for what it claims to do: the retro-file covers all four FID closures and all nine commits, not just the gate-shaped three (the directive named `-001` through `-004`, and `-001` is the protocol amendment, not a gate), and it states the wider 71-commit hole rather than implying the campaign was the whole gap. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — one file per calendar day is the README's own grain, and the retro-file's structure is the required one (header, intent, plan steps, evidence, double audit, out-of-scope, operator decisions). Nothing here depends on the number of sessions that were missed. |
| Survives a hostile attacker, not just an honest user? | This finding is *about* that: a record that nothing checks is exactly the artifact a hurried author leaves out, and the ledger then asserts releases whose session record never existed. The retro-file re-derives every claim from a probe or a commit rather than from recollection, so a future reader can falsify it. |
| Maintainable in 2 years? | Yes for the record itself (dated, cross-referenced by hash to all nine commits and by row number to SCOPE). The honest gap is finding 4: **maintainability of the *habit* is undecided** — until the requirement is checkable, this file's existence is a convention, and this FID is evidence that conventions alone failed once. |
| Sets the standard? | Partly, and the part that does not is stated: "log the intent before coding, and let a gate fail when the session record is missing" is the standard; this FID delivers the first half and files the second. Claiming it delivered both would be the same class of overclaim the campaign it documents exists to remove. |

One honest `no` remains — *maintainable in 2 years* holds for the artifact and not yet for the enforcement —
which is why the enforcement half is recorded as an open decision rather than absorbed here.

## 5. Proposed Fix (GREEN)

1. **Retro-file the campaign** as `dev/session-summaries/SESSION-2026-09-24-002.md` — dated to the day the
   work shipped (the README's "one date = one calendar day" grain), with the retro-filing date stated on the
   header line rather than buried, and the missing intent log declared in its §2 instead of papered over.
   Four units, nine commits, three releases, the four directives quoted verbatim from each FID's `Trigger`,
   the recorded probe numbers from each FID, and a fresh probe at session end pasted in full.
2. **Correct `SCOPE.md`'s `Last updated` header** while the ledger record is being written (finding 6), and
   record it as a finding rather than a chore — a hand-maintained field that has gone stale twice in six days
   is a mechanism problem, not an oversight.
3. **Ledger rows:** 123 (this FID), 124 (the enforcement decision + the 71-commit span — operator-only),
   125 (`SCOPE.md`'s own structure, finding 9).
4. **CHANGELOG `0.0.36`** and `VERSION` → `0.0.36`, following the release-per-ledger-record pattern of
   0.0.33-0.0.35.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Write four summaries, one per FID | The four units ran as one continuous operator-driven session on 2026-09-24 and share one day; the directory's naming convention is one file per calendar day (`SESSION-YYYY-MM-DD-NNN`), so four files would fragment a single day's record and invent four sessions that did not happen. The FIDs remain the per-unit record. |
| Do nothing, or "start clean from here" | Leaves the campaign unlogged while the ledger cites its releases, and leaves the 71-commit span unrecorded without anyone having decided that. Silence is not a disposition. |
| Backfill 2026-09-19 … 2026-09-22 as well, now | Real work of a size the directive did not name, and the *decision* (backfill vs. start clean) belongs to the operator — it depends on whether a 6-day reconstruction is worth the cost when the CHANGELOG entries for 0.0.13-0.0.31 and SCOPE rows 98-115 already carry the outcomes. Recorded as row 124 rather than done unilaterally or dropped. |
| Extend Gate 7 to require a session summary for every closed FID's session date | The right shape eventually, and rejected *here* only on process: it changes a gate's contract, needs its own negative drill and its own FID (the `FID-20260924-002`/`-003` pattern), and the mapping rule ("which session covers which FID?") is a design decision — FIDs do not currently cite session summaries in either direction. Recorded in row 124 as the recommended option. |
| Have the ledger census also check the `Last updated` header against `VERSION` | Same reason as above, and the field's format is prose ("rows 116-117 … CHANGELOG 0.0.32"), not a value: parsing it would either constrain the prose or produce a check that fails on rewording. Row 124 rather than a rushed parse. |
| Restructure `SCOPE.md` now (merge the two headings, move the open items to their own table) | A 230 KB append-only ledger's structure is not a side-effect of a record-gap fix; the observation is filed (row 125) and the edit left to a decision that can consider the whole file. |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `dev/session-summaries/SESSION-2026-09-24-002.md` | create | The retro-filed record: four units, nine commits, three releases, intent reconstruction + its limitation, plan-step statuses, recorded and fresh verification evidence, double audit, out-of-scope discoveries, operator decisions — committed separately as `9b7125e` |
| `dev/fids/archive/FID-20260925-001-session-record-gap.md` | create | This document (archived on filing — §1's retro-filing note) |
| `SCOPE.md` | modify | Rows 123-125; `Last updated` header corrected |
| `CHANGELOG.md` | modify | `0.0.36` section |
| `VERSION` | modify | `0.0.35` → `0.0.36` |

**Verification plan** (from `protocol.config.yaml` → `verification`): `npx tsc --noEmit` → 0;
`npm run lint` → 0/0; `npm run test:ci` → all pass; the full pre-push chain → exit 0 with all ten gates;
`node scripts/ledgerIntegrityCensus.cjs` → exit 0 with the new FID archived and the three new rows' citations
resolving; and the self-referential check this campaign deserves — **the ledger gate must accept the record
that documents why the ledger had no session log**, or the closure is wrong.

**Call-graph reachability plan:** not a runtime path. Reachability = Gate 7 reads this FID (status parsed
against `protocol.config.yaml`, and its presence in `dev/fids/archive/` rather than `dev/fids/`), and
`SESSION-2026-09-24-002.md` is reachable from the README's directory listing and from SCOPE row 123.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | The tree at the record commit (`9b7125e`) and again at the ledger commit: `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, all five censuses, the full pre-push chain | §7 (pasted): chain exit 0 with **10 gates**, 75.4s at the 128-commit range; suite **1313 passed (1313)**, 136 files; ledger census exit 0 | pass |
| Method 2: manual re-read against this FID | Each of the nine §2 findings re-derived from its own pasted probe (the two probes that could be contaminated by the new file were re-run with `--exclude=SESSION-2026-09-24-002.md` so the measured numbers describe the tree *before* the fix); every claim in the retro-file re-read against its source — the four `Trigger` quotes against the FIDs, the nine commits against `git show --stat`, the CHANGELOG sections against the FIDs' §8 | §2 rows 1-9, retro-file §3, §4.1 | pass with one correction |
| Correction made during Method 2 | The retro-file's first draft said *"the newest summary is `SESSION-2026-09-18-001`"* — true of the file written **before** the hole, false of the directory (which already contained `SESSION-2026-09-24-001`). Rewritten before its commit to name both files and the measured version-mention counts | retro-file §6.1 | corrected |

- Audit outcome: **PASS** → `closed` on `9b7125e` (§8).
- Circuit breakers: two passes (RED from the grounding probes; GREEN as the retro-file plus this document),
  no oscillation, well under the 10-iteration stop.

## 7. Implementation Record

- **Status:** done (2026-09-25). `dev/session-summaries/SESSION-2026-09-24-002.md` (232 lines, +232,
  committed as `9b7125e` on its own so that this FID's G2 hash is the artifact it documents); then this FID
  and the ledger record (SCOPE rows 123-125, CHANGELOG `0.0.36`, `VERSION`).
- **Verification evidence — the campaign being recorded, at `470e17b`, full chain exactly as CI invokes it
  (run 2026-09-25, over the real push range, 128 commits, pasted in full in the retro-file §4.2):**
  ```
  ✅ pre-push: typecheck clean (0 errors)
  ✅ pre-push: test suite clean (1313 passed (1313))
  ✅ pre-push: attribution scan clean
  CHAIN EXIT=0
  chain wall: 75369ms
  ```
  with the seven earlier gates green in the same run (`census clean (routes: 240 · call sites: 301 (unparsed:
  0))`, `mongo eradication census clean`, `schema census clean (57 tables — 57 live, 0 ticketed, 0
  violations)`, `timestamp census clean`, `host-tz census clean`, `ledger census clean`, `eslint clean (0
  errors, 0 warnings)`).
- **Ledger census at the record commit:** `0 live FID(s), 178 archived; 406 ledger line(s) in SCOPE.md
  carrying 88 cited hash(es)` → exit 0, two advisories unchanged (37/178 archived non-terminal labels; 7
  cited hashes unreachable from HEAD).
- **Fresh closure probe at `9b7125e` (Law 16, 2026-09-25):** `git status --porcelain` → empty (the probes ran
  on exactly the committed content); `git rev-parse HEAD` → `9b7125efe0ded7ea313f90bdb88aa77b98710ac8`;
  `git show --stat --format= 9b7125e` → `1 file changed, 232 insertions(+)` (the retro-file only).
- **Call-graph reachability evidence:** `node scripts/ledgerIntegrityCensus.cjs` parses this FID's status
  against `protocol.config.yaml` and confirms it is not parked in `dev/fids/` — the gate reads the closure
  record for this very gap, which is the check that would have caught the omission if it had existed (and is
  the reason row 124 is worth deciding).

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0/0 · [x] tests 1313/1313 · [x] chain exit 0 with 10 gates ·
  [x] ledger census exit 0 (this FID archived, three new rows' citations resolve) · [x] tree clean.
- **Commit hash (G2):** `9b7125e` — *docs(session): retro-file SESSION-2026-09-24-002 — the four 2026-09-24
  gate FID closures (FID-20260924-001..-004), with the fresh HEAD probe and the record gap it exposes
  (FID-20260925-001)*, 1 file changed (+232).
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260925-001-session-record-gap.md
  SCOPE.md CHANGELOG.md VERSION` — this ledger commit carries the FID and its records; the retro-file was
  already committed on its own so G2 cites an artifact, not this commit.
- **Commit message (G8):** `docs(ledger): FID-20260925-001 filed closed on 9b7125e — the session record's
  six-day hole; SCOPE rows 123-125, CHANGELOG/VERSION 0.0.36 (FID-20260925-001)`
- **SCOPE rows:** 123 (this FID), 124 (enforcement + the 71-commit span — Open, operator-only), 125
  (`SCOPE.md`'s own structure — Open).
- **Archive:** `dev/fids/archive/FID-20260925-001-session-record-gap.md`; CHANGELOG entry under `0.0.36`;
  `VERSION` → `0.0.36`.

---

**Final status:** `closed` (2026-09-25, commit `9b7125e`). The record now exists; the mechanism that would
have produced it does not. That distinction is deliberate and is the last line of the retro-file: writing the
summary closes the gap, and making the requirement checkable is a decision this FID was not authorized to take.
