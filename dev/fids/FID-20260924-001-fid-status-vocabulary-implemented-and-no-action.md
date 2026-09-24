# FID-20260924-001 — FID status vocabulary: `implemented` and `no-action` added; archival moves to terminal statuses

**Filename:** `FID-20260924-001-fid-status-vocabulary-implemented-and-no-action.md`
**ID:** FID-20260924-001
**Severity:** MEDIUM
**Status:** implemented (2026-09-24) — gates green; G2 commit pending
**Created:** 2026-09-24
**Trigger:** operator decision, 2026-09-24, on a blocking presentation (two options offered,
one chosen; recorded in §5).

---

## 1. Summary

The FID status vocabulary has **no lawful value for *implementation complete, gates green,
commit outstanding***, and **no lawful way to retire a terminal finding record that has no
code to commit**. Both gaps were hit for real in the 2026-09-23/24 session: two FIDs spent a
day parked on `verified` — which the spec defines as *"an intermediate status for
partially-executed work"* — because `closed` requires a G2 commit hash they could not yet
have, and each FID had to record the misfit in its own §8 rather than use an honest word.
The only remaining live FID, `FID-20260917-005`, is likewise terminal in substance
(`analyzed (premise dissolved)`, zero code delta, §6 "loop record: not warranted") but
**cannot be archived**, because archival is permitted only at `closed` and `closed` requires
a commit that will never exist for a no-action finding. The spec is also internally
inconsistent here — its lifecycle diagram already contains an `Implemented` stage — so this
is the protocol catching up to its own model, not a new concept.

## 2. Evidence (RED)

| # | Finding | Location | Evidence |
| - | ------- | -------- | -------- |
| 1 | The FSM names an `Implemented` stage the status list omits — the contradiction is pre-existing, not introduced by the 09-23 FIDs | `dev/echo-v0.1.2-single-agent.md:316` vs `:326` | diagram: `Created → Analyzed → LOOP-COMPLETE → Implemented → Closed → Archived` · list: "Allowed status values: `created \| analyzed \| fixed \| verified \| loop-complete \| closed`" |
| 2 | Two FIDs had to park on a status whose spec meaning contradicts their state, and both recorded the misfit | `dev/fids/archive/FID-20260923-001-…md` §8, `-002` §8 | "-001: `verified` is the allowed value for *implemented, gates green, evidence recorded, G2 outstanding*; note honestly that the spec describes it as an 'intermediate status for partially-executed work', which fits imperfectly. The protocol has no value for *fully implemented, awaiting commit* — a real vocabulary gap"; -002 carries the same sentence |
| 3 | The natural word for that state was actively **forbidden**: the legacy map sends `implemented → closed` | `protocol.config.yaml` → `fid.status_legacy_synonyms` | `implemented: closed` — so a FID reading `implemented` without a hash is an unlawful claim of closure |
| 4 | A terminal finding record cannot leave `dev/fids/`, so "live FID" stops meaning "work in flight" | `dev/fids/FID-20260917-005-…md` | status `analyzed (premise dissolved)`; "zero code delta"; §6 "**Not warranted.** … nothing to implement; §3 disposition is terminal." After 001/-002 closed it was the **only** file in `dev/fids/` (`ls dev/fids/` → 1 FID + `archive`). Archival is "ONLY at `closed`" (`:335`), and `closed` "Requires implementation evidence (commit SHA or file:line ranges + grep match)" (`:332`) |
| 5 | The word `implemented` is **already** protocol vocabulary — for plan *steps*, not FIDs | `protocol.config.yaml` → `scope.step_statuses`; spec Step-Level Anti-Deferral table `:450` | `step_statuses: [implemented, blocked, deferred, skipped]` — "`implemented` \| Code exists, gates pass \| Agent (verified by build output)". The FID-level list is the outlier, not the word |
| 6 | Fourteen archived FIDs still carry the 09-19-era string `loop-complete (filed + implemented…)` | `dev/fids/archive/` | recorded for completeness; **not** in scope here — the same-session amendment forbids re-opening archived files, and the six that had byte-identical active duplicates were already corrected |

## 3. Impact Analysis

- **Who/what is affected:** every future FID, and every reader of the ledger. The vocabulary
  surfaces are `dev/echo-v0.1.2-single-agent.md`, `protocol.config.yaml` and
  `templates/FID-TEMPLATE.md`; all three must agree or the next session re-derives the gap.
- **Failure modes:** (1) *understated records* — `verified` means "partially-executed work",
  so a finished implementation reads as half-done and a reader cannot tell the two apart;
  (2) *forbidden honesty* — the accurate word for the state was the one word the map treated
  as an unlawful closure claim, pushing records toward either vagueness or an overclaim;
  (3) *ledger dilution* — terminal no-action records cannot be retired, so `dev/fids/`
  accumulates files that are not work in flight and "how many FIDs are open" stops being
  answerable from the directory; (4) *archive rule inversion* — the strictest-reading rule
  (archive only at `closed`) is satisfiable for code work and unsatisfiable for findings,
  which pushes toward inventing a hash, exactly the failure Law 16 exists to prevent.
- **Blast radius:** documentation, configuration and one finding record. No code, no routes,
  no schema, no runtime path — but every future FID inherits the vocabulary, which is why it
  is worth fixing rather than working around.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — the four real terminal shapes are all covered: done-and-committed (`closed`), done-not-committed (`implemented`), plan-final-no-code (`loop-complete`), and terminal-finding (`no-action`). `blocked`/`deferred` keep their meaning for work that did not happen. |
| Scales (design tolerates growth)? | Yes — the vocabulary is fixed-size and machine-readable in one config key; it does not grow with the number of FIDs. |
| Survives a hostile attacker? | Yes — this is the ledger's integrity surface. The amendment *reduces* the pressure to overclaim, and keeps `closed` strictly G2-gated, so the incentive to write a false `closed` (and thereby write a false hash claim) goes down, not up. |
| Maintainable in 2 years? | Yes — the change removes a documented contradiction (finding 1) and one redundant overload, rather than adding a parallel vocabulary. |
| Sets the standard? | Yes — "a status must be able to describe the real state of the work, and the terminal states are exactly the ones that can be archived" is the canonical rule; the alternative (document the misfit per document) is what these documents were reduced to doing. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

**Operator decisions (2026-09-24).** Both gaps were presented as blocking choices; the
operator chose:

1. **Status vocabulary — add `implemented` as a first-class status.** (Chosen over "amend G1
   so an approved level-3 session commits its own work, and the gap never opens" and over
   "keep the gap, document the misfit per FID.")
2. **`FID-20260917-005` — add a no-action disposition and archive it.** (Chosen over
   archiving it one-off as `closed (no-action)` with the SCOPE row as backing, and over
   leaving it live as a visible reminder.)

**Amendments:**

1. **`implemented` (FID-level)** — "the implementation exists in the codebase and gates pass;
   the G2 commit is outstanding." **Not** archival-eligible. `closed` still requires the
   commit hash. Deliberately the same word as the existing *step* status
   (`scope.step_statuses`), because it means the same thing at a different scope: a step is
   implemented inside an FID's plan; a FID is implemented inside the ledger. The overload is
   documented rather than renamed, so the two vocabularies stay one.
2. **`no-action`** — terminal. A documented finding or disposition with **zero code delta**
   (premise dissolved, dead-end, no-op finding). Requires a recorded disposition with
   evidence and a SCOPE row; cannot be used to avoid implementing approved work — work that
   did not happen is `blocked` (needs operator input) or `deferred` (operator-approved), and
   the anti-deferral rule still forbids silence.
3. **Archival rule** — archival happens at a **terminal status**: `closed` (G2-backed) or
   `no-action` (disposition-backed). Never at `loop-complete` or `implemented`.
4. **Legacy synonym map scoped to history** — `implemented → closed` now applies **only** to
   files archived before 2026-09-24, where it was the historical spelling of closure; it can
   no longer be read as a rule about live files, since `implemented` is now a status.
5. **`FID-20260917-005` archived** as the protocol's first `no-action` FID, with the prior
   value preserved in the file (`was: analyzed (premise dissolved)`) and SCOPE row 78
   annotated as its backing record.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Amend G1 so an approved level-3 session commits its own work | The operator chose the status instead. Worth recording that this session *did* commit, under an explicit go-ahead on a presented plan — which is exactly the point: the G1 overlay is a per-session authorization, and the vocabulary gap would still bite any session (or any agent) that implements ahead of its authorization. |
| Leave the gap and document the misfit per FID | Rejected: it makes `verified`'s false-negative the norm, and it had already produced two §8 essays about the same missing word. A vocabulary that cannot describe a real state generates per-document workarounds indefinitely. |
| Name the new status `complete` / `COMPLETE` | `complete` is already a **legacy synonym for `closed`**, so reusing it would recreate finding 3 in mirror image. |
| Allow `closed` without a commit hash for no-code work | Destroys the one hard guarantee the status set has (G2). `no-action` is a separate terminal state precisely so `closed` keeps meaning "shipped and hash-backed". |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `dev/echo-v0.1.2-single-agent.md` | modify | Amendment banner; status list gains `implemented` + `no-action` with definitions; archival rule → terminal statuses; legacy-synonym paragraph scoped to pre-2026-09-24 history; FSM diagram aligned to the vocabulary |
| `protocol.config.yaml` | modify | `allowed_statuses` gains both; new `terminal_statuses`; `status_legacy_synonyms` scoped; comments amended |
| `templates/FID-TEMPLATE.md` | modify | Comment block's status list, definitions and archival rule brought into line (this is what every new FID is copied from) |
| `dev/fids/FID-20260917-005-…md` | modify + move | Status → `no-action` (prior value preserved); archived to `dev/fids/archive/` |
| `SCOPE.md` | modify | Row 78 annotated as the backing record; new row 118 for this amendment |
| `CHANGELOG.md` | modify | A protocol subsection added to the current 0.0.32 release iteration |

**Verification plan** (from `protocol.config.yaml` → `verification`): `npx tsc --noEmit` → 0;
`npm run lint` → 0/0; `npm run test:ci` → all pass; all four census gates exit 0. The change
is documentation and configuration only, so these are regression checks — the load-bearing
verification is the **vocabulary-consistency check**: the status set must read identically in
the spec, the config and the template, and `dev/fids/` must contain no non-directory entry
after the archival.

**Call-graph reachability plan:** not applicable in the runtime sense (no code path). The
machine-readable surface is `protocol.config.yaml → single_agent.protocol.fid`, consumed by
the session itself; the reachability proof is therefore documentary — grep each vocabulary
surface for the full status set and paste the three outputs side by side.

## 6. Audit Record

| Pass | What changed | Change % | Converged? |
| ---- | ------------ | -------- | ---------- |
| 1 | RED established (six findings), GREEN drafted, decisions presented | — | — |
| 2 | Operator decisions recorded; the `complete`-naming alternative added after noticing `complete` is already a legacy synonym; the G1-alternative paragraph sharpened with this session's own commit history | ~6% | no |
| 3 | Wording pass only (no claim, no approach, no evidence changed) | <2% | yes |

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | This FID audits a **document and a config key**, so `tsc`/tests are regression checks, not evidence for the claims: they were run at the closure commit and are recorded in §7/§8. The claims themselves were verified by grepping the three vocabulary surfaces (§2 findings 1, 3, 5 are literal quoted output). | §2 rows 1, 3, 5 | pass |
| Method 2: manual re-read against this FID | Each of the six findings re-derived from its quoted source; §5 checked against §4; the rejected alternatives checked against the reason each would fail | §2, §5 | pass |

- Audit outcome: **PASS** → the loop converged on the document; the vocabulary amendment was
  already operator-signed in §5 before implementation, so implementation proceeded
  immediately (filed → converged → implemented → closed in one session, the FID-20260919-018
  pattern).
- Circuit breakers: 3 passes, no oscillation, no rejected change reappearing, well under the
  10-iteration hard stop.

## 7. Implementation Record

- **Status:** done (2026-09-24).
- **Files changed:** `dev/echo-v0.1.2-single-agent.md` (amendment banner; status list;
  archival rule; legacy-synonym paragraph), `protocol.config.yaml`
  (`allowed_statuses`, new `terminal_statuses`, `status_legacy_synonyms` scoping, comments),
  `templates/FID-TEMPLATE.md` (status list + archival rule in the usage comment),
  `dev/fids/FID-20260917-005-…md` (status → `no-action`, archived), `SCOPE.md` (row 78
  annotation + row 118), `CHANGELOG.md` (0.0.32 protocol subsection).
- **Verification evidence:** see §8 (pasted at closure, in the closure commit).
- **No code, no migrations, no gates added or removed** — the four pre-push censuses are
  untouched by this change.

## 8. Closure

- **Commit hash (G2):** `_pending commit A_` — recorded in the closure commit's §8 update.
- **Archive:** `dev/fids/archive/FID-20260924-001-fid-status-vocabulary-implemented-and-no-action.md`.

---

**Final status:** `implemented` — the vocabulary amendment is written into the spec, the
config and the template, and `FID-20260917-005` is retired under the new disposition; what
remains is the G2 commit. This FID is deliberately the first document to use the status it
creates, rather than parking on `verified` again.
