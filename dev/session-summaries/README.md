# Session Summaries — Conventions

Directory for ECHO Protocol v0.1.2 (single-agent) session summaries.

## Purpose

Session summaries are the running record of intent, work, and evidence for each work session. They exist so that:

- **Law 8 (Log intent before coding)** — the intended change is documented before implementation starts.
- **Step-Level Anti-Deferral** — every plan step carries an explicit status with evidence.
- **FID Ground-Truth Verification** — status claims are backed by tool output pasted into the record.
- **Double Audit** — both audit methods (static analysis + manual re-read) have a written home.

## Naming

`SESSION-YYYY-MM-DD-NNN.md`

- One date = one calendar day (UTC). Scan this directory first and allocate the next available `NNN` on that date.
- Never reuse a number on the same date. Never overwrite an existing session file.

## Required Structure

Every session summary MUST contain, in this order:

1. **Header block** — Session ID, date, protocol version, task source.
2. **Intent (logged before implementation)** — what was going to be done and why. Written *before* code changes.
3. **Plan steps** — the same steps recorded in `SCOPE.md`, each with a status of
   `implemented | blocked | deferred | skipped`.
4. **Verification evidence** — actual tool output (commands + results). Self-reported claims ("I believe this works")
   are prohibited and must not appear.
5. **Double audit record** — Method 1 (static analysis) and Method 2 (manual re-read) results.
6. **Out-of-scope discoveries** — anything found but not worked, cross-referenced to `SCOPE.md`.
7. **Operator decisions** — presentations made and outcomes, if any.

## Rules

- No agent names, signatures, or author attribution anywhere in a session summary.
- No sensitive data (credentials, tokens, connection strings) — log redacted references only.
- A session summary is append-mostly: later corrections are added as dated addenda, not silent rewrites.
