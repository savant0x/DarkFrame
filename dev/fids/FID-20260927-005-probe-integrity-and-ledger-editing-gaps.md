# FID-20260927-005: Probes that lie, a ledger too large to edit, and a row that asserts a defect that no longer exists

**Filename:** `FID-20260927-005-probe-integrity-and-ledger-editing-gaps.md`
**ID:** FID-20260927-005
**Severity:** MEDIUM
**Status:** implemented
**Created:** 2026-09-27 15:47

---

## Summary

A single working session produced **two false findings that had to be retracted**, a
**structural blocker that made the ledger uneditable by the primary edit tool**, a
**stale ledger row that asserts a defect session-005 already fixed**, **sloppiness
shipped into a gate script**, and — found by the second audit pass at Loop 4 —
**a document asserting a vocabulary the repository does not define, and a
machine-readable contract pointing at a file that has never existed**. None of them
are production outages; all of them are the *evidence-integrity* class this
repository treats as its highest concern — a ledger, a gate, or a contract that
states something false is worse than one that is silent, because it is believed.
This FID catalogs all eight with re-executed evidence, and specifies the fix for
each.

---

## Environment

- **OS:** Windows 11, Git Bash (MSYS) — POSIX shell, `win32`
- **Language/Runtime:** TypeScript 5.x / Node v25.2.1, vitest 4.1.11
- **Tool Versions:** `npx tsc --noEmit` exit 0 · `npx eslint . --max-warnings 0` exit 0 (0 errors / 0 warnings) · `npx vitest run` → 141 files / 1358 tests passed
- **Commit/State:** `main` @ `a5c8016`, working tree carrying 15 modified + 3 untracked files from FID-20260927-001 and FID-20260927-004 (both `implemented`, G2 commit outstanding)

---

## Detailed Description

### F1 — A misindented line shipped into a gate script

**Problem.** `scripts/ledgerIntegrityCensus.cjs` carries statement lines at column 0
where their block siblings are indented — a transcription defect in the editing
output, not a logic defect.

> **Corrected at Loop 4 (2026-09-27, second measurement).** The line this finding
> originally named — `:365`, `return;` at column 0 — is **now correctly indented**.
> The damage did not stay where it was measured: it *moved* to `:364`
> (`inFence = !inFence;`, the line above it), and a **second, previously
> unrecorded** site exists at `:527-528`. A repair was attempted between the two
> measurements and stripped the indent from the wrong line — which is precisely
> the failure mode this finding's own root-cause paragraph describes, and the
> clearest possible demonstration of why a line-anchored fact must be re-measured
> rather than assumed. The original evidence block is kept below as the dated
> record it is; the live state is the one Loop 4 measured.

**Root cause.** Mine. Across this session the same `str_replace` mistake recurred:
in a multi-line replacement the leading whitespace of the **first** line of the new
string is dropped. On one attempt it was made *worse* — "correcting"
`if (inFence) return;` by stripping the indent from the `return;` line above it.
This is a transcription defect in the editing output, not a logic defect: the
script parses, lints, and behaves correctly.

**Expected behavior.** The file is formatted consistently with its neighbours.

**Evidence — dated record (first measurement, superseded):**

```text
$ sed -n '363,370p' scripts/ledgerIntegrityCensus.cjs | cat -A | cut -c1-45
    if (/^\s*```/.test(raw)) {$
      inFence = !inFence;$
return;$
    }$
    if (inFence) return;$
    if (!LEDGER_LINE.test(raw)) return;$
    ledgerLines += 1;$
```

**Evidence — live (Loop 4 re-measurement, 2026-09-27):**

```text
$ awk 'NR==364||NR==527||NR==528 {printf "L%d:[%s]\n", NR, $0}' scripts/ledgerIntegrityCensus.cjs
L364:[inFence = !inFence;]
L527:[const violations =]
L528:[unknownStatus.length +]

$ sed -n '362,366p' scripts/ledgerIntegrityCensus.cjs
    if (/^\s*```/.test(raw)) {
inFence = !inFence;
      return;
    }
    if (inFence) return;

$ node --check scripts/ledgerIntegrityCensus.cjs          # exit 0
$ npx eslint scripts/ledgerIntegrityCensus.cjs --max-warnings 0   # exit 0, 0/0
$ node scripts/ledgerIntegrityCensus.cjs                   # exit 0, "ledger census clean"
```

Two sites, not one: `:364` (a statement at column 0 inside a 4-space block) and
`:527-528` (a two-line `const violations =` accumulation whose first two lines sit
at column 0 while the rest of the sum is indented 2). The original plan named one
line, at the wrong number, and would have left `:527-528` in place.

**Impact.** Cosmetic only — no gate enforces `indent` for `.cjs`, and all 1358
tests pass. It matters because a gate script is the most-read artifact in the
repo; a reader who sees one line out of step distrusts the next four.

---

### F2 — SCOPE.md is past the tool's read ceiling, so the primary edit tool cannot reach it

> **RETRACTED at implementation — see F9.** The 100,000-character ceiling named
> below is unsourced, and `SCOPE.md` is 1,313 lines against a documented 2,000-line
> read cut. This finding is preserved below as the record it is, not as a claim.

**Problem.** `str_replace` reports *"old string not found"* for text that
provably exists, because `read_files` truncates at 100,000 characters and
SCOPE.md is **265,271**.

**Root cause.** Structural, not incidental. The ledger has grown well past the
point where a whole-file read fits the tool's budget, and the edit tool's
read-before-write contract (Law 1) depends on that read succeeding.

**Evidence.**

```text
# DURABLE measurement (re-runnable, unchanged by any later edit):
$ wc -l -c SCOPE.md
  1312 265271 SCOPE.md          # 265,271 vs the tool's 100,000-char read ceiling

# HISTORICAL reproduction, 2026-09-27, line numbers as they stood at the time.
# The anchors were each grep-confirmed present before the edit was refused:
#   SCOPE.md:1114  "| 66 | **CI is red"        → refused ×1
#   SCOPE.md:1113  "| 30 | **Gate-baseline"    → refused ×1
#   SCOPE.md:1304  "is defined in four places" → refused ×1
# → str_replace: "The old string ... was not found in the file"
# These rows have since MOVED (66 → 137, 30 → numeric position), so the line
# numbers above are a dated record of the refusals, not a live reproduction.
# The finding itself is the wc -c figure, which does not depend on any of it.
```

**Current reproduction anchor** (for whoever re-tests this): the register's rows
still live at `SCOPE.md:1049-1312`, all past the cut. `SCOPE.md:1305` is row 130,
confirmed by `awk` — any `str_replace` against it is refused while a `grep` for
the same text succeeds.

**Impact.** Every future edit to a late line of SCOPE.md — and the register's
open items all live at lines 1073-1312 — requires a workaround. This session
used three throwaway `.mjs` scripts in `dev/tmp/`, one of which introduced a
`require()` import that the Law-15 lint gate rejected (Law 15 caught my own
sloppiness, which is the gate working). Every one of those detours cost a full
agent turn.

---

### F3 — Rows 58 and 57 are printed out of order

**Problem.** The register's item table is not in ascending order at one point.

**Evidence.**

```text
$ awk 'NR==1105||NR==1106{n=$0; sub(/\|[ \t]*$/,"",n); split(n,a,"|"); \
       printf "L%d -> row [%s]\n", NR, a[2]}' SCOPE.md
L1105 -> row [ 58 ]
L1106 -> row [ 57 ]
```

**Impact.** Low. Citations resolve by *number*, not position, so nothing is
unresolvable. It is now surfaced mechanically by the new check E as an advisory.

---

### F4 — Row 125 asserts a defect that no longer exists

**Problem.** Row 125's body claims the `[OPEN-OUT-OF-SCOPE]` heading *"appears
twice — line 448 heads a block of 2026-09-08..09-15 session logs while the real
item table starts at 1034"*. It appears **once**. Session-005 removed the
duplicate and did not write the correction back.

**Root cause.** The exact Law-16 drift class the ledger exists to prevent: a
finding recorded as open after the work landed. Note the asymmetry — session-005
*did* correct the 26/27/28 numbering gap and the duplicate heading, but the row
that tracks those defects was left asserting them.

**Evidence.**

```text
$ grep -c '^## \[OPEN-OUT-OF-SCOPE\]' SCOPE.md
1
```

**The second clause is no longer stale** — it was corrected earlier this session:

```text
$ grep -oE 'the item table ended with an out-of-order row 30 after row 65 — \*\*FIXED[^*]*\*\*' SCOPE.md
the item table ended with an out-of-order row 30 after row 65 — **FIXED 2026-09-27: row 30 now sits in numeric position between rows 29 and 31**
```

So only clause 1 remains a false assertion; clause 2 is already recorded as fixed.

**Impact.** Medium. The register is the project's record of truth. A row that
asserts a fixed defect sends the next session to re-investigate work that is
finished.

---

### F5 — Two probes reported findings that did not exist

This is the most important finding in the document, because both produced output
that looked entirely plausible.

**F5a — `sed` alternation.** In a POSIX basic regular expression, `\|` is
**alternation**, not an escaped pipe. My substitution replaced every character
instead of every escaped pipe:

```bash
sed 's/\\|/@@PIPE@@/g'      # ✗ alternation — replaced every character
```

The resulting output was a wall of `@@PIPE@@` tokens. I discarded it rather than
reason from it. The working replacement was a backwards character scan for the
last literal `|`, which needs no substitution at all.

**F5b — `awk -F'|'` on escaped pipes.** SCOPE row 134's own description contains
the literal text `1 failed \| 1338 passed (1339)`. Splitting that row on `|`
yields seven fields instead of five, so a fixed column index silently lands on
the **date** column. I reported rows 71/104/133/134 as having *"a bare date in the
status column"* — **none of those rows has a bare date.** All four were retractions.

**Root cause.** Both are the same failure: a probe that mis-indexes does not
announce itself. It returns plausible text, and the plausible text is believed.
This is the identical shape as the error recorded in
`SESSION-2026-09-27-003` §"The error worth recording", where an earlier audit
reported that rows 134/135 carried each other's dispositions — also false, also
from the same `awk` column-index mistake. **The lesson has now recurred twice in
one day and is not written down anywhere.**

**Evidence.**

```text
# The retracted claim, and its current (corrected) state:
$ grep -c 'is defined in four places' SCOPE.md
0
$ grep -c 'is defined in at least four places' SCOPE.md
1

# The shift, demonstrated on the escaped-pipe row (row 134, currently line 1309):
$ awk '{n=$0; sub(/\|[ \t]*$/,"",n); if (n ~ /^\| *134 *\|/) {c=gsub(/\|/,"|"); split(n,a,"|"); \
      printf "pipes=%d a[4]=[%.22s] a[5]=[%.22s]\n", c, a[4], a[5]}}' SCOPE.md
pipes=6 a[4]=[ 1338 passed (1339)`; ] a[5]=[ 2026-09-27 ]
```

A well-formed 4-column register row has **5** pipes. Row 134 has **6** — the
extra one is the escaped `\|` inside its own text — so a fixed column index reads
`a[5]` as the **date** column, not the status. That is the exact shift that
produced the false "bare date" claim.

---

### F6 — The harness Law 3 re-edit gate blocked six verified fixes (EXTERNAL)

**Problem.** Re-editing `scripts/ledgerIntegrityCensus.cjs` in the same session
raised `BLOCKED: Law 3: ... is dirty and unverified. Run typecheck/lint before
re-editing this file` **six times**, including on the round immediately after
`npx eslint` exit 0 (0/0), `npx tsc --noEmit` exit 0, `node --check` exit 0, and
the census's own suite at 29/29.

**Root cause.** Not in this repository. This is Savant-harness behaviour (the
EHEL tool executor), and `protocol.config.yaml:149` records
`agent_executes_git: false`, so the harness's own state is not this project's to
change.

**Impact.** The delivered check E is complete and verified; the only casualty is
F1, one cosmetic line. I stopped after six blocks per Circuit Breaker Rule #4
rather than burn credits on a seventh.

**This finding is recorded honestly as BLOCKED, external. It is not dressed up
as a repository defect and there is no repository fix for it.**

---

### F7 — This document asserted a vocabulary the repository does not define, and a heading twice

**Problem.** The metadata block of *this* FID carried two fields that are not part
of `templates/FID-TEMPLATE.md` and appear nowhere else in the repository —
`**Automation level:** 2` (with a blockquote explaining it) and
`**YAGNI-Compliance:** Verified` — and the body carried `## Verification Gates`
**twice**, once as a real heading and once nested inside a fenced block that
repeats it.

**Root cause.** The same class as Loop 3, one layer out. Loop 3 caught this
document asserting a *status* the repository's `allowed_statuses` does not
contain. What survived that pass is the document asserting two *metadata fields*
from a different harness's vocabulary, plus a duplicated section heading. A field
the census does not check is a field nothing will ever catch.

**Evidence.**

```text
$ grep -n 'Automation level\|YAGNI-Compliance' dev/fids/FID-20260927-005-*.md
8:**Automation level:** 2
12:**YAGNI-Compliance:** Verified

$ grep -n '^## Verification Gates' dev/fids/FID-20260927-005-*.md
317:## Verification Gates
320:## Verification Gates
```

**Impact.** Medium for a document whose entire subject is documents that assert
things falsely. The census is blind to it: `ledgerIntegrityCensus.cjs` validates
`Status` against `allowed_statuses` and nothing else, so these two fields and the
duplicate heading would survive every gate indefinitely.

---

### F8 — The machine-readable contract points at a lessons file that does not exist

**Problem.** `protocol.config.yaml:70` declares
`learnings: dev/LEARNINGS.md`, annotated "not yet present in repo". The
repository's actual lessons corpus is `dev/lessons-learned.md` (133,058 bytes). The
protocol's own Quick Reference table repeats the non-existent path. F5 is directed
to write its lesson — and would have written it to whichever path it trusted.

**Root cause.** Missed Question 1 already noticed the mismatch but attributed it
to `ECHO.md`, the retired harness protocol, and concluded the path "does not bind
this repository". That conclusion is right about the *effect* and wrong about the
*source*: `protocol.config.yaml` is declared to be the single source of truth for
single-agent sessions, and **it** is the file carrying the wrong path. Attributing
a contract defect to a retired document lets the contract keep lying.

**Evidence.**

```text
$ grep -n 'learnings' protocol.config.yaml
70:      learnings: dev/LEARNINGS.md         # not yet present in repo

$ ls -la dev/LEARNINGS.md
ls: cannot access 'dev/LEARNINGS.md': No such file or directory

$ ls -la dev/lessons-learned.md
-rw-r--r-- 1 spenc 197611 133058 Sep 19 13:15 dev/lessons-learned.md
```

`SCOPE.md`'s `[OPEN-OUT-OF-SCOPE]` item 1 lists `dev/LEARNINGS.md` as a
"companion path referenced by the protocol [that] does not exist yet" — the same
drift observed a third time, in the ledger, never connected to the config.

**Impact.** Low mechanically, high as a truth defect: a gate-adjacent contract
field names a file that has never existed, and the repository's actual lessons
corpus is therefore governed by nothing — which is the concrete reason F5's lesson
had to be chosen by hand instead of by the contract that should have named it.

---

## Impact Assessment

### Affected Components

- `scripts/ledgerIntegrityCensus.cjs` (F1 — two sites, cosmetic)
- `SCOPE.md` as an editable artifact (F2 — workflow blocker)
- `SCOPE.md` row 125 (F4 — false assertion)
- `SCOPE.md` rows 57/58 (F3 — ordering, advisory)
- The session's audit method (F5 — two retracted findings)
- `dev/lessons-learned.md` (F5 destination — currently **last updated 2025-10-26**,
  i.e. stale by eleven months, and the probe lesson is absent from it)
- `dev/fids/FID-20260927-005-*.md` (F7 — this document's own metadata and heading)
- `protocol.config.yaml` + the protocol spec's Quick Reference (F8 — wrong path)

### Risk Level

- [x] **Medium** — no production impact; three defects are in the *evidence* layer,
      which is where this repository invests most and where a false claim costs most
- [ ] Critical: no crash, data loss, or security exposure
- [ ] High: no feature is broken and every issue has a workaround
- [ ] Low: F1 and F3 alone would be low; F4 and F5 raise the aggregate

---

## Proposed Solution

### Approach

Fix what is in the repository's power, record what is not, and write down the
lesson that has now cost two sessions. Specifically: (1) repair the indentation;
(2) reorder rows 57/58; (3) annotate row 125 so each of its four clauses matches
reality; (4) add the probe-integrity lesson to the repo's lessons file, with the
escaped-pipe row shape as the worked example; (5) record F6 as blocked-external
with the evidence, so the next session does not re-derive it. F2 gets a
**documented workflow remedy** rather than a speculative refactor — the ledger
cannot be shrunk without an operator decision about its own content, and a
refactor nobody asked for is exactly the anti-pattern this protocol names.

### Steps

1. **F1** — restore the indent on **both** re-measured sites in
   `scripts/ledgerIntegrityCensus.cjs`: `:364` (`inFence = !inFence;`, to 6 spaces,
   matching the `if` block it sits in) and `:527-528` (`const violations =` /
   `unknownStatus.length +`, to 2 spaces, matching the four terms below them).
   The originally-planned single line at `:365` is already correct — do not touch it.
2. **F3** — swap SCOPE.md rows 57 and 58 so the register ascends; then check for
   positional citations of either row before the move (the row-30 precedent: a
   positional citation must be repointed, not left to rot).
3. **F4** — rewrite row 125's four clauses to match measured reality: clause 1
   (duplicate heading) → fixed 2026-09-27; clause 2 (row 30 out of order) → fixed
   2026-09-27, already recorded; clause 3 (single mixed table) → still true;
   clause 4 (`[DEFERRED]` still "(none yet)") → still true.
4. **F5** — append a probe-integrity lesson to `dev/lessons-learned.md` covering
   both the BRE-alternation trap and the escaped-pipe column-shift trap, with
   SCOPE row 134 as the worked example and a "count the delimiters before you
   index" rule.
5. **F6** — record in this FID as blocked-external, with the six-block log. No
   repository change.
6. **F2** — record the measured constraint and the working remedy in this FID's
   Resolution section, so the next session does not re-discover it. **No refactor
   without an operator decision** — splitting or rotating the ledger is a change
   to the project's record of truth and is not this session's call.
7. **F7** — delete `Automation level` (and its blockquote) and `YAGNI-Compliance`
   from this document's metadata, retitle it `# FID-20260927-005: …` to match the
   template's naming, and collapse the duplicated `## Verification Gates` heading
   to one, keeping the fenced fence-intent note as prose.
8. **F8** — repoint `protocol.config.yaml`'s `paths.learnings` at
   `dev/lessons-learned.md` (the file that exists), and the protocol spec's Quick
   Reference row with it, so the contract and the corpus agree. Two files, one
   path, no behaviour change.

### Verification

- `npx tsc --noEmit` → exit 0
- `npx eslint . --max-warnings 0` → exit 0, 0 errors, 0 warnings
- `npx vitest run` → 141 files / 1358 tests, 0 failed
- `node scripts/ledgerIntegrityCensus.cjs` → exit 0, and the out-of-order advisory
  **disappears** once F3 lands (it is the check E advisory reporting F3)
- `grep -c '^## Verification Gates' dev/fids/FID-20260927-005-*.md` → 1 (F7)
- `awk '/^## /{exit} /Automation level|YAGNI-Compliance/{c++} END{print c+0}'` over this
  document → **0** (F7). The predicate is scoped to the **metadata block** on
  purpose: the whole-file count is 8, because F7's own prose below quotes both
  field names while describing their removal. A whole-file grep is the *wrong*
  gate here — it cannot distinguish "the field is set" from "the field is named",
  which is the same distinguish-a-claim-from-its-subject problem as Lesson 45.
- `grep -n 'learnings' protocol.config.yaml` → `dev/lessons-learned.md` (F8);
  `ls dev/lessons-learned.md` → present
- `grep -nE '^[a-zA-Z_$]' scripts/ledgerIntegrityCensus.cjs` reviewed: every
  column-0 statement either opens a top-level block or is one of the two repaired
  sites (F1)
- `grep -c '^## \[OPEN-OUT-OF-SCOPE\]' SCOPE.md` → 1 (unchanged; F4 is a *record*
  correction, not a code change)
- `awk` ascending-row census over SCOPE.md → no inversions

---

## Verification Gates

```markdown
- gate: test __tests__/lib/ledgerIntegrityCensus.test.ts
- gate: quality
```

> The census's own suite is the gate that proves check E still holds after F1 and
> F3. `quality` covers the repo-wide file ceiling and style gate. Typecheck and
> full-suite results are recorded in the Resolution section; the ledger findings
> (F3, F4) are verified by direct probe output quoted there, not by a gate,
> because they are corrections to a markdown register.

---

## Perfection Loop

### Loop 1 — RED → GREEN → AUDIT → ADVERSARIAL

- **RED:** Six findings catalogued above, each with re-executed command output.
  Two of them (F5a, F5b) are retractions of claims this session made about the
  ledger; F2 is a tool-boundary measurement; F4 is a ledger row measured against
  ground truth (`grep -c` → 1, row claims 2); F1 is a byte-level `cat -A` read.
- **GREEN:** Fix plan specified per finding, with F6 routed to *blocked-external*
  and F2 routed to *documented, not refactored* — both are scope decisions taken
  deliberately rather than defaults.
- **AUDIT:** Every finding re-verified this session: F1 `cat -A`; F2 `wc -c` plus
  the reproduction of the `str_replace` refusal against a grep-confirmed anchor;
  F3 `awk` on the two raw lines; F4 `grep -c`; F5 the two retracted claims
  re-checked for absence; F6 six block messages logged. Gates at time of writing:
  `tsc` exit 0, `eslint .` exit 0 (0/0), `vitest run` 141/1358 green,
  `ledgerIntegrityCensus.cjs` exit 0.
- **ADVERSARIAL:** The strongest objection is to F2's classification. A reviewer
  could argue the ledger *should* be split or rotated, and that declining to
  propose it is scope reduction. **Ruled against:** rotating the project's record
  of truth is an operator decision, and Law 2 makes a scope reduction without
  approval the violation. The finding is therefore recorded in full with a
  measured remedy, and the decision is surfaced for the operator rather than
  taken silently. A second objection — that F1 is cosmetic and does not warrant
  a FID entry — is **ruled against**: the whole subject of this document is
  evidence integrity, and shipping a known-sloppy line into a gate script while
  writing a document about sloppy evidence would be incoherent.
- **CHANGE DELTA:** 100% (initial authoring).

### Loop 2 — Self-correction: the document caught its own defect class

The AUDIT pass re-measured every evidence block in the document above against
the live tree. **Three were stale.** This is worth recording rather than quietly
repairing, because it is F5's exact subject: this FID was written to catalog
stale evidence, and then shipped some.

| Block | Claimed | Measured | Corrected to |
| - | - | - | - |
| F2 evidence | `awk 'NR==1114…'` reproduced the `str_replace` refusal | L1114 is now **empty** — row 66 was renumbered to 137 and row 30 was relocated earlier this session | Split into a **durable** measurement (`wc -c` = 265,271, which no later edit invalidates) and a **dated** reproduction log, plus a live re-test anchor at `SCOPE.md:1305` |
| F4 evidence | `grep '…ends with an out-of-order row 30'` | Returns **0** — the clause now reads `ended with … **FIXED 2026-09-27**` | Replaced with the current text; F4 narrowed to clause 1 only, since clause 2 was already corrected |
| F5 evidence | `grep -c 'is defined in four places'` → "1 — the retracted claim" | Returns **0** — corrected to "at least four places" during the row-129 fix | Replaced with the current pair of counts, and the escaped-pipe demonstration was re-pinned to row 134's **current** line and its true **6** pipes |

- **RED:** Three stale evidence blocks, all of them line-number-anchored facts
  that earlier edits in the same session had invalidated.
- **GREEN:** Each block now separates what is *durable* (a measurement no later
  edit can invalidate) from what is *dated* (a reproduction that records when it
  was observed). The F2 block explicitly states that its line numbers are a
  historical record, not a live reproduction.
- **AUDIT:** Re-measured after the edit — `L1104=56, L1105=58, L1106=57,
  L1107=59` confirms F3's evidence is still exact; `pipes=6 a[4]=[ 1338 passed
  (1339)`; ] a[5]=[ 2026-09-27 ]` confirms F5b's demonstration against the live
  row.
- **ADVERSARIAL:** The objection that a FID may not ship with any stale block at
  all is **upheld** in spirit and answered structurally: rather than re-anchoring
  every fact to today's line numbers — which the next edit would invalidate
  again, recreating the defect — each block now names *what kind of fact it is*.
  That is the difference between a number that rots and a measurement that does
  not.
- **CHANGE DELTA:** ~4% of document text (three evidence blocks).

### Loop 3 — The gate caught a defect in this very document

Running the census against the tree immediately after authoring **refused the
run (exit 1)** on this FID:

```text
LIVE FID STATUS OUTSIDE allowed_statuses (1):
  dev/fids/FID-20260927-005-probe-integrity-and-ledger-editing-gaps.md:6  status `converged`
```

I had written the status from the **harness's** vocabulary, not the repository's.
`protocol.config.yaml:78` is the single source of truth:

```yaml
allowed_statuses: [created, analyzed, fixed, verified, loop-complete, implemented, no-action, closed]
```

`converged` is not in it; the lawful pre-implementation value here is
**`loop-complete`**. Corrected, and the census now reports 3 live FIDs with
`live statuses lawful`.

This is the seventh instance of the session's own theme, and the most valuable
one: **a document can be internally consistent, well-evidenced, and still
unlawful** — because the vocabulary it asserts is not the one the repository
defines. The census is the only thing that caught it. A human re-reading the
FID would have seen a plausible status line and moved on.

- **RED:** Status value `converged` — out of vocabulary for this repository.
- **GREEN:** `converged` → `loop-complete` in the metadata and in the Resolution
  line that referenced it.
- **AUDIT:** `node scripts/ledgerIntegrityCensus.cjs` → exit 0, `ledger census
  clean`, `3 live FID(s), 185 archived`, `live statuses lawful`;
  `npx eslint . --max-warnings 0` → exit 0 (0 errors, 0 warnings);
  `npx tsc --noEmit` → exit 0.
- **ADVERSARIAL:** The objection that this is a trivial metadata slip, not a
  finding, is **upheld** — it is not a new finding, and the FID does not claim it
  as one. It is recorded in Loop 3 because the *method* matters more than the
  instance: the gate caught what review did not. Filed as Loop 3 rather than
  folded into Loop 2 so the record shows the sequence honestly.
- **CHANGE DELTA:** <1% of document text (two lines).

### Loop 4 — A second audit, the plan was stale before a line of it ran

The operator directed the outstanding findings to be fixed through this FID. The
first act was therefore to re-measure every claim in the document against the live
tree rather than to implement the plan as written. **The plan would have shipped a
wrong fix**, and re-measuring surfaced two findings the original pass missed.

- **RED:** Four defects, each with pasted output above.
  1. **F1's plan was stale and its evidence contradicted the file.** The plan
     named `:365`; that line is correctly indented. The damage had moved to `:364`
     and a second site at `:527-528` was never in the document. A repair attempt
     between the two measurements had stripped the indent from the *wrong* line —
     the exact failure F1's root cause describes, performed a second time.
  2. **F7** — this document asserted `Automation level` and `YAGNI-Compliance`,
     fields from a harness vocabulary the repository does not define, and repeated
     `## Verification Gates` at two headings.
  3. **F8** — `protocol.config.yaml` names `dev/LEARNINGS.md`, which has never
     existed; the corpus is `dev/lessons-learned.md`. Missed Question 1 had
     spotted this and attributed it to the retired `ECHO.md`, leaving the
     authoritative contract still wrong.
- **GREEN:** F1's evidence split into a dated record and a live measurement, and
  its step rewritten to name both real sites and to *not* touch `:365`; steps 7
  and 8 added for F7 and F8; the document retitled and its metadata reduced to the
  template's five fields; the duplicated heading collapsed.
- **AUDIT:** Every changed claim re-measured after the edit — the metadata block
  (everything before the first `## ` heading) contains exactly the five template
  fields and **0** of the two removed ones; `grep -n '^## Verification Gates'`
  returns one line; `awk` on the two repaired sites shows the expected indents;
  `grep -n 'learnings' protocol.config.yaml` names the file that exists. Gates
  re-run as Method-1 proof: `node --check`, `eslint`, `tsc`, and the census.
  **One gate was itself wrong and was corrected:** the F7 predicate was first
  written as a whole-file `grep -c`, which returns **8**, not 0 — because F7's own
  prose quotes both field names. The predicate is now scoped to the metadata
  block. Recording this rather than quietly swapping the command: a gate that
  passes for the wrong reason is the same defect as a probe that mis-indexes, and
  the fix was to the *claim*, not to the threshold.
- **ADVERSARIAL:** The strongest objection is that F7 and F8 are not *code*
  defects and do not belong in a FID whose Impact Assessment says "no production
  impact". **Ruled against.** A document that asserts fields the repository does
  not define, and a contract that names a file that has never existed, are exactly
  the class this FID was filed to address — the whole premise is that a false
  assertion in a load-bearing artifact is worse than a silence, and `protocol.config.yaml`
  is load-bearing for every FID that follows. Declaring them out of character
  would be the same error as Loop 3's, one level out. A second objection — that
  F8's fix is a one-word config edit too small to warrant a loop pass — is
  **ruled against** on the same ground: size is not the test, truthfulness is.
- **CHANGE DELTA:** ~9% of document text (F1 evidence + two new findings + steps
  + gates + this section), inside the 10% per-pass circuit-breaker cap.

### Missed Questions

1. **Should `dev/LEARNINGS.md` exist?** The ECHO Quick Reference names it, and the
   session boot read resolves it from an embedded harness copy — but
   `ls dev/LEARNINGS.md` returns *No such file*. The repository's actual
   lessons file is `dev/lessons-learned.md` (54 sections, last updated
   2025-10-26). → **Answer, corrected at Loop 4:** the *conclusion* stands — F5's
   lesson goes to `dev/lessons-learned.md`, and the path is not this session's to
   invent. The *attribution* did not. This question blamed `ECHO.md`, the retired
   harness protocol, but `protocol.config.yaml:70` — declared the single source of
   truth for single-agent sessions — carries the same wrong path, and the protocol
   spec's Quick Reference repeats it. That is filed as **F8**: the contract is
   repointed at the file that exists rather than the file that was wished for. The
   eleven-month staleness of that corpus remains an observation, not actioned —
   rewriting the project's lessons corpus is not this session's scope.
2. **Is the 58/57 inversion the *only* one?** → **Answer:** no. F3 was found by
   check E, which was itself added this session. A full census of the register is
   now mechanically available; running it is step 2's verification, and this FID
   makes no claim about rows it has not measured.
3. **Does the F2 remedy belong in a script?** → **Answer:** no, not until the
   operator decides whether the ledger gets restructured. Recording the
   constraint plus the throwaway-script remedy is sufficient for the next
   session; committing a permanent editing tool would be speculative work.

---

## Resolution

- **Closed Date:** *(pending commit — this record is `implemented`, not `closed`;
  G2 requires a committed hash)*
- **Fix Description:** Eight findings, seven fixable in-repository (F1, F3, F4, F5,
  F7, F8, plus the F2 documentation), one external and recorded as blocked (F6).
  F7 and F8 were found by the Loop-4 re-measurement, not by the original pass.
- **Tests Added:** No — every finding is a correction to existing code or records,
  not new behavior. The census suite already covers check E, which is the mechanism
  that *found* F3, and the `it.each` split in FID-20260927-004 is what keeps that
  suite from timing out under load.
- **Implementation evidence (2026-09-27, this session):**

  | Finding | Change | Probe after |
  | - | - | - |
  | F1 | indent restored at `:364` and `:527-528` | `sed`/`cat -A` show 6- and 2-space indents; `node --check` exit 0 |
  | F3 | SCOPE rows 57/58 swapped via a fail-closed inline swap (precondition-asserted, no scratch file) | register ascends 55→60; census out-of-order advisory count **0** |
  | F4 | row 125's four clauses rewritten against measurement | three clauses now read as resolved with their probes cited; two marked "still true" |
  | F5 | two lessons appended to `dev/lessons-learned.md` (45: probe mis-indexing; 46: line-anchored evidence rots) | new `##  PROBE INTEGRITY LESSONS` section present |
  | F7 | non-repository metadata removed; document retitled; duplicate heading collapsed | metadata block holds exactly the 5 template fields and 0 removed ones; `grep -c '^## Verification Gates'` → 1 |
  | F8 | `protocol.config.yaml:70` and the spec's Quick Reference repointed at `dev/lessons-learned.md`; SCOPE row 1's dependent citation repointed with them | `grep -n 'learnings' protocol.config.yaml` names the file that exists; row 1 narrowed from four missing paths to one |

- **Verification Evidence:** Gates re-run on the implemented tree —
  `npx tsc --noEmit` **exit 0**; `npx eslint . --max-warnings 0` **exit 0**;
  `npm run test:ci` → **141 files / 1358 tests passed, 0 failed**, exit 0;
  `node scripts/ledgerIntegrityCensus.cjs` **exit 0**, `ledger census clean`;
  `node scripts/invertedRouteCensus.cjs` exit 0 (`MISSING (0) / UNPARSED (0)`);
  `node scripts/schemaConsumerCensus.cjs` → **57 tables, 57 live, 0 violations**;
  `node scripts/timestampConventionCensus.cjs` → 144 declarations, clean;
  `node scripts/hostTimezoneCensus.cjs` → 467 server files, clean.
  `dev/tmp/` verified clean (only the pre-existing `timestamp-pre-state.json`),
  so nothing invisible to `git status` is scanned by `tsc`/`eslint` (row 128).
  Attribution rule verified by grep over every file touched: 0 matches.
- **Two gates in this document were themselves wrong, and both were corrected
  rather than passed:** F1's plan targeted a line that had moved (Lesson 46), and
  F7's predicate was a whole-file grep that returns 8 rather than 0 because the
  document quotes the very field names it removed. The fixes were to the *claims*,
  not to the thresholds.
- **And the defect this FID was filed to document reproduced itself during
  implementation.** SCOPE row 138 records F5's own two traps — a BRE `\|` and an
  `awk -F'\|'` column shift — and was authored with those backslashes *stripped*,
  leaving 7 structural pipes where a well-formed row has 5. Nothing failed: the
  census counts hash citations, not delimiters, so it printed `ledger census clean`
  over a malformed row, and the ledger would have shipped a row that mis-indexes
  for the next reader using `awk -F'|'` — which is how row 134's own text became a
  false finding. Caught by counting delimiters before trusting the row, repaired to
  5 structural pipes, and verified against row 137 as a control. The census cannot
  catch this class; a reader can. That asymmetry is the argument for Lesson 45
  living in the corpus rather than only in this document.
- **Not fixed here, and not silently dropped:** `dev/progress.md` still asserts
  "NOT BUILDABLE — 2,039 TypeScript errors" against a live `tsc` exit 0 (the same
  claim sits in `dev/issues.md`). Rewriting a 25-day-old narrative document is a
  distinct piece of work, not a line item in an evidence-integrity FID; it is filed
  as its own ledger row rather than absorbed here.

### Operator-directed addendum (2026-09-27, same session)

The operator was shown the F2 retraction and the un-mechanised row-shape class, and
directed both: *leave the ledger's structure alone; add a lesson plus a malformed-row
check to the census.* Delivered:

- **Check F — register row shape** (`scripts/ledgerIntegrityCensus.cjs`). A register
  row must have **3** structural pipes (`| n | text |`, the shape rows 52-54 have
  always used) or **5** (`| n | text | date | status |`, every other row). Anything
  else is fatal. `splitRow` already treats `\|` as content, so an author who escapes
  a pipe is never penalised.
- **The red drill found four live defects the moment it landed.** The census had been
  printing `ledger census clean` over all of them: rows **63** (`` `git log … || true` ``),
  **71** (a title authored as its own cell), **104** (`` Factory.owner: string|null ``)
  and **129** (`` `|| []` ``) each carried an unescaped `|` inside the description.
  All four were escaped; the shape check now reports **0 malformed**.
- **Lesson 47** added to `dev/lessons-learned.md` — an unsourced number in a finding
  is a claim wearing a measurement's clothes, with the three rules it earned.
- **Five new pins** in `__tests__/lib/ledgerIntegrityCensus.test.ts` (34 total): the
  two failure shapes, the lawful two-column shape, escaped-pipe immunity, and a
  non-vacuity guard that the live register is actually measured (138 rows, 0 malformed).

**Why the check is a range and not a rule.** A blanket "must be 5 pipes" would have
failed rows 52-54, which are valid two-column history. The check encodes the shapes
the ledger actually uses, so it fails genuine defects without failing valid rows —
and the *reason* each shape is lawful is written next to it, because a check whose
rationale lives only in the author's head rots the same way an undocumented limit did.

**And then it caught its own author, a third time.** Writing this addendum into
SCOPE row 138 — a sentence that *names* the defect by quoting `` `|` ``, `` `|| true` ``,
`` `string|null` `` and `` `|| []` `` — reproduced the malformation immediately: row
138 went to **11 structural pipes** and Gate 7 failed. Caught by the check that had
just been written, on the very row recording the check, within one edit of the
repair. Three reproductions of this class in one session: row 138 at authoring, the
four rows check F found on landing, and row 138 again while documenting both.

**That is the argument for the gate.** The first two would have shipped. The lesson
text (Lesson 45) did not stop me once; the lesson text could not have, because the
failure is a transcription slip in a *format*, and prose advice is checked by
reading while format is checked by counting. The check counted.
- **F2 measured constraint:** SCOPE.md is 265,271 characters against the tool's
  100,000-character read ceiling; register rows live at lines 1073-1312, all past
  the cut. The working remedy used this session is a fail-closed `.mjs` helper in
  `dev/tmp/` with precondition assertions and postcondition assertions, run via
  node, then deleted. A permanent remedy is an operator decision.
- **F6 blocked-external:** Savant-harness EHEL Law 3 re-edit gate. Six blocks
  logged, all on a file whose every gate was green at the time of each block.
  No repository fix exists; the harness's own state is outside the project
  boundary (`protocol.config.yaml:149` → `agent_executes_git: false`).
- **Archived:** *(pending)*

---

## Lessons Learned

**A probe that mis-indexes does not announce itself — it returns plausible text.**
The single highest-value lesson of this session, and it has now recurred **twice
in one day**: once in `SESSION-2026-09-27-003` and again here, both times from
`awk -F'|'` applied to a table whose cells contain escaped pipes. Two concrete
rules follow:

1. **Count the delimiters before you index.** `SCOPE.md:1310` has seven `|`
   characters, five of them structural; the two extras live inside a cell's
   `1 failed \| 1338 passed (1339)`. Any fixed column index is wrong there, and
   it is wrong *silently*.
2. **In a BRE, `\|` means alternation, not an escaped pipe.** The substitution
   `sed 's/\\|/X/g'` matches the empty string at every position. Prefer a scan that
   does not need a substitution at all.

The general form: **verify a probe against a known-correct case before trusting
its verdict on an unknown one.** Both of today's retractions would have been
caught in seconds by running the probe against a row whose answer was already
known. And the meta-lesson: a retraction recorded honestly — "I claimed X, it
was false, here is the reason" — is worth more than a silent correction, because
the next session will otherwise make the same claim.
### F9 — F2's diagnosis was never sourced, and the file is inside the read cut anyway (RETRACTS F2)

**Problem.** F2 attributes the `str_replace` refusals to a *"100,000-character read
ceiling"* that `SCOPE.md` (265,271 chars) allegedly exceeds. **The number is not
sourced anywhere in this repository.** A repo-wide grep for `100,000` /
`100000` / `read ceiling` / `read-before-write` returns hits only in
`CHANGELOG.md` (restating F2) and in unrelated game-mechanics constants in
`dev/archive/`. Nothing in the protocol, `protocol.config.yaml`, the FID template,
or any prior session record establishes such a limit.

**What the tooling actually documents:** a whole-file read is cut off after
**2,000 lines**, with a note reporting the file's true line count.
`SCOPE.md` is **1,313 lines** — inside the cut, with 687 lines of headroom, and it
was 1,312 lines when F2 was written. F2's premise was already false on the day it
was recorded.

**Direct counter-evidence from this session.** Four `str_replace` edits to
`SCOPE.md` succeeded, three of them *past the line F2 says is unreachable*:

| Edit | Line | Result |
| - | - | - |
| "Last updated" header rewrite | 9 | applied |
| SCOPE row 1 rewritten (F8) | 1049 | applied |
| SCOPE row 125 rewritten (F4) | 1300 | applied |

The register spans lines 1049–1313. If the tool could not reach it, none of those
would have landed.

**The most likely real cause of the original refusals** is the one this FID's own
F1 describes: the `oldString` was reconstructed rather than copied, and did not
match the file byte-for-byte — a transcription miss, not a reachability wall. The
three anchors F2 logged were short fragments (`"| 66 | **CI is red"`) taken from
`grep` output, which is exactly the shape most likely to miss on surrounding
whitespace. **This is a hypothesis, not a claim**; what is *established* is that
the ceiling F2 names does not exist and the file is inside the documented cut.

**What I did with it.** I had already restated F2's ceiling as fact in
`CHANGELOG.md` 0.0.44 and in SCOPE row 138 — the same defect F5 documents, committed
while writing the document about it. Both were corrected to the retracted form.
**Retraction recorded rather than silently deleted**, per Lesson 45: the next
session needs to know this claim was made, believed, and withdrawn.

**Impact on the ledger's structure: none required.** The obvious remedy — splitting
the register from the session prose — does **not** reach any verified ceiling
either. Measured: register 182,864 bytes (68.9%), prose 87,891 bytes (33.1%).
Neither half clears 100,000 on its own, and the file is already inside the cut that
actually exists. A large refactor of the project's record of truth would have been
performed to solve a constraint that was never there.

---

## 8. Staging Plan (G3/G4 — the agent prepares; the operator executes)

The working tree carries **two** sessions' work, and the commit boundary must not
blur them: session 005's two implemented FIDs are already staged-for-commit in the
tree, while this session's work is separate. Nothing below has been staged, and
the agent does not execute git (G1).

**Commit 1 — session 005, FID-20260927-001 (one farmable-terrain truth).** *Not this
session's work; carried unchanged from the tree it was found in.*

- `types/game.types.ts`, `utils/autoFarmEngine.ts`, `lib/harvestService.ts`,
  `lib/harvestService.test.ts`, `app/api/harvest/route.ts`, `app/help/page.tsx`,
  `components/TileRenderer.tsx`, `components/TileHarvestStatus.tsx`
- `__tests__/terrainTruth.test.ts` (new)
- `dev/fids/FID-20260927-001-farmable-terrain-single-source.md`
- message: `refactor(terrain): one farmable-terrain definition replaces seven copies (FID-20260927-001)`

**Commit 2 — session 005, FID-20260927-004 (the row-134 flake).** *Also not this
session's work.*

- `__tests__/lib/ledgerIntegrityCensus.test.ts` (the `it.each` split only)
- `dev/fids/FID-20260927-004-ledger-census-test-timeout-flake.md` (new)
- message: `test(ledger): split the six-subprocess status loop so each carries its own timeout (FID-20260927-004)`

**Commit 3 — this session, FID-20260927-005 (F1: the gate script's indentation).**

- `scripts/ledgerIntegrityCensus.cjs` — **only** the two indent restorations at
  `:364` and `:527-528`. This file also carries commit 2's hunks, so it must be
  staged with a partial add (`git add -p`) or the two commits must be taken as one.
  Flagged rather than assumed: this is the one file in the plan where the split is
  not clean.
- message: `fix(ledger): restore the indent on both column-0 statement sites (FID-20260927-005)`

**Commit 4 — this session, FID-20260927-005 (F7, F8: the documents and the contract).**

- `dev/fids/FID-20260927-005-probe-integrity-and-ledger-editing-gaps.md` (new),
  `protocol.config.yaml`, `dev/echo-v0.1.2-single-agent.md`
- message: `docs(protocol): drop non-repository FID metadata; point the contract at the lessons corpus that exists (FID-20260927-005)`

**Commit 5 — this session, FID-20260927-005 (F3, F4, F5: the ledger and the corpus).**

- `SCOPE.md` (rows 57/58 swapped, row 1 and row 125 rewritten, row 138 added,
  header updated), `dev/lessons-learned.md` (Lessons 45 & 46)
- message: `docs(ledger): fix the row-order inversion, the stale row, and record the probe-integrity lessons (FID-20260927-005)`

**Commit 6 — the record (both sessions).**

- `CHANGELOG.md`, `VERSION`, `dev/session-summaries/SESSION-2026-09-27-005.md`,
  `dev/session-summaries/SESSION-2026-09-27-006.md`
- message: `docs(release): 0.0.44 — the evidence layer audited (FID-20260927-005)`

**Never `git add -A` (G3).** The untracked set above is the complete list; anything
appearing later belongs to another thread and must not be swept in.
