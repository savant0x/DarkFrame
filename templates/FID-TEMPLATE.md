# FID-YYYY-MMDD-NNN: {Title — kebab-case in filename, Title Case here}

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID Template.

  Usage rules (from dev/echo-v0.1.2-single-agent.md):
  - Save as: dev/fids/FID-YYYY-MMDD-NNN-{kebab-case-title}.md
    Scan dev/fids/ AND dev/fids/archive/ to allocate the next available NNN on the
    date; never reuse a number on the same date.
  - Allowed statuses: created | analyzed | fixed | verified | converged | closed
    * converged = FID document is complete and Perfection Loop-passed, but
      implementation has NOT started. The plan is approved; code is not written.
    * closed = implementation exists in the codebase AND gates pass. Requires
      implementation evidence (commit hash or file:line ranges + grep match).
      A `closed` FID with no code violates the Ground-Truth rule.
  - On close: move to dev/fids/archive/, append a CHANGELOG.md entry, log the
    archival in the session summary. Closed FIDs must not remain in dev/fids/.
  - Evidence rule: every stage claim must be backed by pasted tool output.
    Self-reporting ("I believe this works") is prohibited.
  - Attribution rule: NO Author field, no agent names, no signatures. The
    document speaks for itself.
    (Protocol note: the protocol text lists "Author" among required metadata
    fields, but the Document Signing & Attribution rule forbids attribution
    fields; the attribution rule is non-negotiable and wins. This template
    therefore omits the field.)
  - G2: a FID cannot be closed without a committed hash; the agent does not
    execute git — it prepares the path-scoped staging plan for the operator.
-->

**Filename:** `FID-YYYY-MMDD-NNN-{kebab-case-title}.md`
**ID:** FID-YYYY-MMDD-NNN
**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Status:** created
**Created:** YYYY-MM-DD

---

## 1. Summary

One paragraph: what is wrong (or what is being built), where, and why it matters.

## 2. Evidence (RED)

All findings cataloged before any fix is designed. Every claim here must be reproducible.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 |         |           |                                     |

Call-graph notes (Law 4): how the affected code is reached in production (entry point → … → here), and what is
NOT wired if that is part of the finding.

## 3. Impact Analysis

- **Who/what is affected:** (routes, components, data, users)
- **Failure modes:** what breaks if unfixed
- **Blast radius of the fix:** what the change touches directly vs. transitively

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | |
| Scales (design tolerates growth; harness reference is 1000 agents)? | |
| Survives a hostile attacker, not just an honest user? | |
| Maintainable in 2 years? | |
| Sets the standard for the industry? | |

Any `no` → redesign until all are `yes` before leaving GREEN.

## 5. Proposed Fix (GREEN)

Minimal changes that answer all Five Questions. Most robust defaults chosen.

- **Approach:** (what will change and why this approach over alternatives)
- **Alternatives considered:** (what was rejected and why)
- **Changes:**

| File | Action (create/modify/delete) | Description |
| ---- | ----------------------------- | ----------- |
|      |                               |             |

- **Verification plan:** exact commands that will be run (from `protocol.config.yaml` →
  `single_agent.protocol.verification`) and what output counts as passing.
- **Call-graph reachability plan:** the exact grep/entry-point checks that will prove the new/changed code is
  actually called in production.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | | | pass/fail |
| Method 2: manual re-read against this FID | | | pass/fail |

- Audit outcome: PASS → status `converged` | FAIL → SELF-CORRECT: update Section 5, re-run audit.
- Circuit breakers: track change % per pass (10% cap), convergence (<2% delta across 2 passes), oscillation
  (same issue 3×), hard stop (10 iterations). Flag for review at 5 iterations without convergence.

## 7. Implementation Record (only after status reaches `converged`)

Code is written ONLY after the FID converges. Record what was actually built, not what was planned.

- **Status:** not-started | in-progress | done
- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
|      |       |       |

- **Verification evidence:** paste actual command output here (typecheck / lint / tests).
- **Call-graph reachability evidence:** paste actual grep output proving production entry points reach the change.

## 8. Closure

- **Gates:** [ ] typecheck 0 errors · [ ] lint 0 errors/0 warnings · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2 — required for `closed`):** `<hash>` *(prepared by agent; committed by operator — the agent does
  not execute git)*
- **Staging plan (path-scoped, G3/G4):** `git add <paths>` — logical-atomic, one concern
- **Commit message (G8):** `<type>(<scope>): <desc> (<FID-ID>)`
- **Archive:** moved to `dev/fids/archive/` on close; CHANGELOG entry appended; archival logged in session summary.
  Closed FIDs must not remain in `dev/fids/`.

---

**Final status:** created
