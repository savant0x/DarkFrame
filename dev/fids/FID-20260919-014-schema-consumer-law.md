# FID-20260919-014 — Standing law: every schema block carries a live-consumer pointer or a removal ticket

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19
**Origin:** Operator directive: "Add a standing ledger law: every schema block in lib/db
must carry a live-consumer pointer or a removal ticket, so unwritten-adjacent stacks
can't accumulate again."

## 1. The defect class being outlawed

Three times this arc, schema truth drifted from runtime truth:

- `wmd_alerts` — kept in FID-011 as "live reader", but **zero writers** ever existed:
  the table can never hold a row.
- `wmd_notifications` — a writer existed, **zero readers**: rows land in a void.
- `clan_chat` — a *phantom* referenced by `disbandClan` while the real table
  `clan_chat_messages` had no drizzle definition at all.

The class: **schema definitions outliving their consumers, or consumed by code that
never runs.** Law 16 protects closure truth; nothing protects schema truth between
sessions. This law closes that gap.

## 2. The law (protocol amendment)

**Law 17: Every schema block carries a live-consumer pointer or a removal ticket.**

> **A drizzle table definition in `lib/db/schema/` is lawful only if it names its live
> consumers (writer path + reader path) or carries a removal ticket — a filed FID row
> dispositioning the table by a stated date. No pointer, no ticket, no schema.**

- **Live-consumer pointer** — a comment on the table block naming the producing path
  (route/service/job that INSERTs) and the consuming path (route/service/component that
  SELECTs). "Live" is probe-verifiable, not aspirational: the named path must run.
- **Removal ticket** — when a table is believed dead, the belief must be written as a
  filed, dated ticket (FID row), not left as implicit accretion.
- **Migration for schema changes** — follow the existing convention (idempotent SQL in
  `lib/db/migrations/`, applied and verified) — unchanged.
- **Enforcement** — `scripts/schemaConsumerCensus.cjs` runs in the pre-push hook next
  to the inverted-route census: every exported table is grepped for insert/select
  consumers outside its defining file; a table with neither writer nor reader fails the
  push with a message naming the table and the fix (add a live pointer, wire a
  producer, or file a removal ticket). Fail-closed on unparsable blocks, matching the
  census-gate convention.

Both amendments (protocol text + gate) land in this FID; the gate makes the law
mechanical rather than memory-resident.

## 3. Scope discipline

- No schema definitions change in this FID. Existing tables currently lacking pointers
  are not retroactively annotated by this FID — the gate starts enforcing from the
  writer/reader standard (mechanically checkable), and pointer-comments accumulate as
  files are next touched.
- The gate tolerates the known-ghost case: tables with zero consumers fail the gate,
  which is the law working as intended (the operator then chooses wire-or-remove).

## 4. First catch — the census found four violations on day one

The gate's calibration run against the current tree flagged four tables (none
previously on any survey board — the law working immediately). Probed and ticketed:

| Table | Census class | Probe result | Disposition ticket |
|---|---|---|---|
| `chatReadStatus` | no consumers | exists in DB, zero code references | Candidate for the channel mark-as-read FID (FID-012 §5 item 2) or removal — tracked via SCOPE row 112 (Open) |
| `shrineBlessings` | no consumers | exists in DB, zero code references | Removal candidate — no shrine consumer has ever referenced it |
| `wmdSuspiciousActivity` | write-only | writer exists (`wmdAdminService.reportSuspiciousActivity`) but has **zero callers** — never fires; no reader | Wire an anti-cheat caller or remove — operator sweep to decide |
| `wmdConfig` | no consumers | exists in DB, zero code references | Removal candidate |

Additionally recognized as ticketed by prior FIDs: `achievements` (read-only),
`wmdVotes`, `wmdIntelligenceReports`, `wmdCounterIntelOperations`, `wmdInterceptions`,
`wmdResourcePools`, `wmdDefenseGrids`, `wmdAlerts`, `wmdConsequenceEvents`
(FID-20260919-011/-013 dispositions). This section is the removal ticket for the four
new tables; each requires a follow-up FID (wire-or-remove) before it can leave this
queue.

## 5. Verification

- Unit-style runs of the census script against the current tree: known-live tables pass;
  a synthetic ghost table in a scratch schema file fails with a correct message.
- Full gates + closure per convention (§8, archive, SCOPE row, CHANGELOG).

## 8. Closure

Implemented same session on operator standing directive. Implementation commit: `3ec3752`.
Closed on `3ec3752`. Gates: suite 1231/1231, tsc 0, eslint clean.

Gate evidence: census run on the current tree reports 63 tables — 50 live, 13 ticketed
(9 prior-FID ghosts + the 4 new §4 tickets), 0 violations. Fail-closed verified: a
synthetic ghost table (`zzCensusGhostTable`) was refused with exit 1 and removed.
Enforcement wiring: pre-push Gate 4, beside the inverted-route census (Gate 1) and the
Mongo eradication census (Gate 3).

