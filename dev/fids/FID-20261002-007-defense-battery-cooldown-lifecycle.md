# FID-20261002-007: Defense Battery Cooldown Lifecycle

**Filename:** `FID-20261002-007-defense-battery-cooldown-lifecycle.md`
**ID:** FID-20261002-007
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Interception parks batteries in COOLDOWN with no recovery deadline/consumer. Paid repair is the only current route back to IDLE.

**Review coverage:** R13. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R13 | `lib/wmd/jobs/missileTracker.ts:112; lib/wmd/jobs/defenseRepairCompleter.ts:45` | Actual interception writes COOLDOWN plus updatedAt; recovery job only queries repairCompletesAt. |
| R13 | `lib/wmd/defenseService.ts:162; lib/db/schema/wmd.ts:90` | Second live interception endpoint also writes cooldown; schema has duration but no cooldownUntil. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Scheduler/lazy missile tick → tracker interception; defense POST → defenseService.attemptInterception. Existing scheduler registers defenseRepairCompleter at one-minute interval.

**Exact source/caller probe:**

```powershell
rg -n 'attemptInterception|defenseRepairCompleter' lib/wmd/defenseService.ts lib/wmd/jobs/missileTracker.ts lib/wmd/jobs/scheduler.ts app/api/wmd/defense/route.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

WMD defenses, existing timed repair and schema migration. No new scheduler is needed; lazy eligibility and scheduled recovery share one transition.

**Dependencies and ownership:** 002 transaction discipline. Provides battery disable/recovery contract consumed by 008. Owns reserved migration 0041 for cooldownUntil timestamptz; recheck allocation before implementation.

Historical data repairs require evidence-backed dry-run output before mutation. Do not infer past player losses from a current snapshot.

## 4. Five Questions

| Question | Design answer and evidence obligation |
| --- | --- |
| Works for ALL cases, not just the common case? | Yes by the explicit refusal, boundary, legacy and concurrency contracts below; the acceptance matrix must verify them before implementation completion. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes in design: bounded operations and participant-scoped locking/batched reads; no global serialization or unbounded retry. Database contention must be measured where applicable. |
| Survives a hostile attacker, not just an honest user? | Yes in design: authoritative identity/state, conditional claims and validation; input and race tests below are required evidence. |
| Maintainable in 2 years? | Yes: reuse existing catalog/effect/state/transaction seams with explicit consumers and ownership; no parallel formula or accounting system. |
| Sets the standard for the industry? | Yes as an engineering contract: asset conservation, truthful results and reproducible failure tests. This is a design judgment, not a production certification or proven balance claim. |

These answers assess the plan. Neither current defective behavior nor unexecuted future tests are claimed passing.

## 5. Proposed Fix (GREEN)

**Approach:** repair the authoritative seams already reached by production. Prefer shared domain invariants and transactional state changes over client guards, mirrored tests or compensating writes.

1. Add nullable cooldownUntil withTimezone true and an index for due recovery; keep repairCompletesAt as the distinct paid-repair deadline. Comment live writer/reader pointers on the existing battery schema block.

2. Make both live interception paths invoke one battery-shot state transition in defenseService. Reserve IDLE→COOLDOWN conditionally in the same missile/interception transaction and persist now+cooldownDuration milliseconds. A failed reservation cannot report successful interception; competing missiles cannot consume one idle battery twice.

3. Extend the existing defenseRepairCompleter to recover due COOLDOWN rows using status/deadline predicates and RETURNING. Keep paid DAMAGED repair handling separate. An upgrade/damage/delete or later shot cannot be overwritten by an earlier recovery sweep.

4. Make the shared interception eligibility path apply due recovery before selecting batteries, so the feature works through lazy ticks even if the background scheduler was down. Repeated sweeps/read refreshes are idempotent and do not reset shot deadlines.

5. Backfill legacy COOLDOWN deadlines from updatedAt+validated duration in an idempotent migration. Recover only unambiguous due cooldowns; report missing/corrupt duration and protect concurrent repair/upgrade states. Align the existing panel DTO/countdown to the stored deadline.

**Source-audit correction:** Reserve lib/db/migrations/0041_battery_cooldown_until.sql after current highest 0040; include schema and deadline backfill together. Consumers are both interception paths plus the existing scheduled/lazy completer. A battery key is not a missile key: preserve separate conditional claims for both, with due recovery inside the same transaction.

**Boundary audit:** One due-recovery predicate is shared by scheduled repair completion and lazy eligibility; migration 0041 is reallocated only if another implementation claims it first, with every reference updated. Test schema nullability/index and the production deadline readers, not a copied timestamp expression.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/wmd/jobs/missileTracker.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/defenseService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/jobs/defenseRepairCompleter.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/jobs/scheduler.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/db/schema/wmd.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/wmd/defense.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/db/migrations/0041_battery_cooldown_until.sql` | add | Idempotent timestamptz deadline/index and validated legacy backfill. |
| `components/WMDDefensePanel.tsx` | modify | Render persisted cooldownUntil and recovery state. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Pin all advertised recharge durations, immediately-before/exactly-at/after expiry, process restart, scheduler absence/lazy recovery, null deadlines and timestamp zones.
- Race two interception paths against one battery; one reserves and consumes it. Old recovery tick cannot override new cooldown, DAMAGED or UPGRADING.
- Use actual processDueMissiles and scheduler-registered completer: intercept→not eligible→automatic IDLE→can intercept again; paid repair remains separate.
- Migration twice preserves existing real deadlines and schema/consumer/timestamp gates stay clean.

**Verification plan (exact configured commands):**

```text
npx tsc --noEmit
npm run lint
npm run test:ci
```

Require exit 0, zero TypeScript diagnostics, zero lint errors/warnings and every test passing. Run `npm run build` if implementation changes build-affecting configuration. Use isolated PostgreSQL for database semantics and injected-dependency production route/service tests for admission/results; never substitute copied expressions for production execution. Tests reproducing old defects must be rewritten to assert corrected behavior and shown failing against the old implementation.

**Call-graph reachability plan:** repeat Section 2's exact probes after implementation, checking imports plus the actual invocation inside each reachable success/validation path. Every shared helper and new field must have the named production caller and a behavior-level integrated test.

## 6. Audit Record

| Method | What is checked | Evidence | Result |
| --- | --- | --- | --- |
| Method 1: configured static/test gates | Current source baseline; planning documents cannot establish repair correctness | Shared planning audit records exact exits/output | PASS: tsc/lint exit 0; 147 files / 1419 tests pass |
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Two production interception writers exist. UpdatedAt is mutable audit time, not a durable cooldown deadline; using it for recovery after unrelated writes would restart cooldowns. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 7 of the dependency-order implementation directive).
- **Files changed:** `lib/db/schema/wmd.ts` (§5.1 — `cooldownUntil` timestamptz added to `wmdDefenseBatteries` with live writer/reader pointers commented on the column (both interception paths write through the shared reservation; the completer + shared eligibility path read), plus the due-recovery index `wmd_defense_cooldown_due_idx` on (status, cooldownUntil); `repairCompletesAt` untouched as the DISTINCT paid-repair deadline); `lib/db/migrations/0041_battery_cooldown_until.sql` (NEW — idempotent: guarded ADD COLUMN, partial due-recovery index, legacy COOLDOWN backfill `cooldown_until = updated_at + validated duration` ONLY for positive durations with a GET DIAGNOSTICS NOTICE count, ambiguous rows (missing/nonpositive duration) reported and left untouched; the `cooldown_until IS NULL` predicate makes re-runs preserve existing real deadlines); `lib/wmd/defenseService.ts` (§5.3/§5.4 — the ONE shared battery state machine: `dueCooldownRecoveryPredicate` (status='COOLDOWN' AND cooldownUntil not null AND due — the single predicate both recovery legs drive), `recoverDueCooldownsTx` (tx-aware core, idempotent, never resets a future deadline), `recoverDueCooldownBatteries` (non-tx wrapper), `reserveBatteryShotTx` (the shared conditional reservation: IDLE→COOLDOWN requires the row still IDLE under the lock, persists `shotTime + cooldownDuration` milliseconds, zero updated rows = failed reservation that can never report a successful interception); the manual `attemptInterception` path rebuilt on them — due recovery BEFORE battery selection (lazy eligibility without the scheduler), every shot reserved conditionally, a lost reservation skips to the next battery; `getPlayerBatteries` applies due recovery first so read refreshes show recovered state); `lib/wmd/jobs/missileTracker.ts` (§5.2 — interception moved INSIDE the per-missile impact transaction: the missile row is FOR UPDATE-locked and re-verified, `attemptInterceptionTx` runs the shared due-recovery + locks the clan's IDLE batteries + reserves through `reserveBatteryShotTx`, and the missile's terminal claim (INTERCEPTED with interceptedBy, or DETONATED with damage) commits WITH the battery reservation — a battery cooldown and its missile claim roll back together; the old db-level `attemptInterception` helper is deleted, the tracker no longer writes COOLDOWN without a deadline); `lib/wmd/jobs/defenseRepairCompleter.ts` (§5.3 — the scheduled leg first recovers due COOLDOWN rows via the SHARED predicate + RETURNING (single conditional UPDATE — cannot override future deadlines, DAMAGED or UPGRADING), then the existing paid-repair (repairCompletesAt) handling unchanged); `components/WMDDefensePanel.tsx` (the local battery DTO gains `cooldownUntil`; COOLDOWN batteries render the persisted deadline as a `Recovering — ready <time>` row).
- **Inventory adjustments (implementation-planning authority):** `lib/wmd/jobs/scheduler.ts` needed NO change — it already registers `defenseRepairCompleter` at its 60 s interval and the extended handler keeps its signature; `types/wmd/defense.types.ts` needed NO change — `DefenseBattery.cooldownUntil` and `isBatteryAvailable`'s deadline check already existed (the production gap was persistence + consumers, not the type). No new helper files; the shared transitions live in defenseService with named production callers in both interception paths plus the completer.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` **149 passed + 8 skipped (157 files) / 1448 tests + 49 skipped**, exit 0. **Disposable-PG acceptance 5/5 PASS** (`__tests__/lib/wmdBatteryCooldownLifecycle.integration.test.ts`, embedded-postgres port 55439, UTF8 initdb, production URLs refused, self-skips in test:ci): REAL `processDueMissiles` interception persists the DURABLE deadline (battery COOLDOWN with `cooldown_until − updated_at = 3600000` — the battery's OWN duration; the RED state left the column NULL); the full lifecycle intercept → not-eligible-while-cooling (a second due missile DETONATES through the real impact path, 17 of 100 units, battery untouched) → AUTOMATIC IDLE via the scheduler-registered `defenseRepairCompleter` → intercept again; RACE: two concurrent `attemptInterception` paths against ONE battery — exactly one SUCCESS, one consumption (one COOLDOWN row, one interception record), the loser cannot report a successful interception; the recovery sweep cannot override a future cooldown (deadline preserved byte-for-byte), DAMAGED (paid repair still completes via repairCompletesAt), or null-deadline ambiguous rows (left COOLDOWN, not guessed); migration 0041 applied TWICE (validated backfill = updated_at + 3600000 exactly, duration-0 row left NULL, existing real deadline preserved across re-run).
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — `attemptInterception` consumed by the defense POST route; the tracker's impact transaction calls `attemptInterceptionTx` (which drives `recoverDueCooldownsTx` + `reserveBatteryShotTx`); the scheduler registers `defenseRepairCompleter` (the scheduled recovery leg) while the same shared predicate serves the lazy legs (interception transactions + `getPlayerBatteries`); `cooldownUntil` has the schema writers (both interception paths through `reserveBatteryShotTx`), the migration backfill, and the readers (completer predicate + panel DTO). No unimplemented symbol is represented as live.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. Migration 0041 was NOT executed against live data (no live-data mutation is authorized in this session; the SQL is idempotent and its twice-apply behavior is acceptance-verified on the disposable cluster).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(defense-battery): defense battery cooldown lifecycle (FID-20261002-007)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes 5/5 green on real database contention, see §7; migration 0041 ready, apply to live data is an operator action)
