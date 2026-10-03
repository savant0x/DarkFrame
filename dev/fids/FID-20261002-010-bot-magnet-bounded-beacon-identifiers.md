# FID-20261002-010: Bot Magnet Bounded Beacon Identifiers

**Filename:** `FID-20261002-010-bot-magnet-bounded-beacon-identifiers.md`
**ID:** FID-20261002-010
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Bot Magnet generates a 30-character beacon id for varchar(24), so PostgreSQL rejects deployment of the purchased feature.

**Review coverage:** R19. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R19 | `lib/botMagnetService.ts:67; lib/db/schema/config.ts:238` | Actual generator length 30; actual beacon primary key maximum 24. Shared generateId currently produces at most 23 characters at the current epoch. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** BotMagnetPanel.tsx:96 → POST /api/bot-magnet → deployBeacon → botMagnetBeacons insert; getBeaconStatus/shouldAttractToBeacon read its id.

**Exact source/caller probe:**

```powershell
rg -n 'deployBeacon|generateId|beaconId' app/api/bot-magnet/route.ts lib/botMagnetService.ts lib/utils.ts; rg -n 'bot-magnet' components/BotMagnetPanel.tsx
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Single service identifier and error handling; existing beacon keys and gameplay timing stay compatible.

**Dependencies and ownership:** Existing generateId in lib/utils.ts is the reuse target. This FID also owns serialized researched/cooldown admission on the player row; 002 supplies its transaction contract.

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

1. Import existing generateId from lib/utils and use its full returned value as the beacon primary key. Do not truncate the legacy beacon_ string or widen the database schema.

2. Keep every returned/stored beacon id identical through status, attraction counter and deactivation. Do not alter cooldown/duration/attraction constants.

3. Serialize deploy admission and insertion under 002's player transaction, committing beacon/cooldown together. Handle primary-key collision as an explicit bounded insert retry with a fresh id only; do not swallow other constraint/storage errors or claim deployment succeeded when no row exists.

4. Verify the real POST/deploy insert against the actual schema budget at representative frozen times and ensure a failed insert changes no beacon/cooldown state. No historical-row migration is required for formerly rejected inserts.

**Source-audit correction:** generateId's output varies with epoch digits; today's <=23-character observation is not a timeless schema guarantee. Validate <=24 before INSERT and test oversized-epoch refusal, zero random output and collision exhaustion. Preserve database errors other than duplicate-primary-key refusal.

**Boundary audit:** At today's 13-digit epoch generateId emits <=23 characters; the maximum JavaScript Date epoch can emit 26. The service must reject >24 before mutation, not claim universal schema fit. Test both current-epoch acceptance and oversized-clock refusal; cap collision retries at three.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/botMagnetService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Call actual deployBeacon under frozen clock/random: generated insert id fits varchar(24), response uses that same id, and primary-key collision retry is bounded.
- Disposable PostgreSQL deployment→GET/status→counter update→deactivation works for a researched account; unauthenticated/unresearched/cooldown refusals remain intact.
- Storage failure is reported honestly, with no success response or partial cooldown update.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Reuse the existing bounded generator as directed by R19; adding a second generator or schema expansion would multiply identity contracts. Length proof must test actual output against actual schema. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record

- **Status:** implemented (batch 10 of the 2026-10-02 remediation dependency order, operator directive).
- **Files changed:** `lib/botMagnetService.ts` only (per the change inventory; no migration — no schema change). deployBeacon rewritten: §5.1 the beacon primary key is the FULL shared `generateId()` output from `lib/utils` (the 30-char hand-built `beacon_${Date.now()}_${random}` string deleted; no truncation, no schema widening); §5.4 a pre-insert length validation (`generateBeaconId`) checks the id against the ACTUAL varchar(24) budget and throws the NEW exported `BeaconIdTooLongError` for oversized-epoch output (the JS Date maximum emits 26 chars) BEFORE any mutation; §5.3 the whole deployment — player row FOR UPDATE-locked via the 002 contract (`withTransactionRetry('bot-magnet:deploy')`), in-lock tech gate (the route's early 403 remains as a friendly pre-check), in-lock active-beacon and cooldown admission — commits as ONE transaction (the cooldown derives from the beacon row itself, so a committed beacon IS the consumed cooldown and a failed insert changes no state by construction); duplicate-primary-key collisions (SQLSTATE 23505) retry with a FRESH id bounded at 3 attempts; every other storage error propagates — never a success response without a beacon row. New exported error classes: `BeaconRefusal`, `BeaconCooldownError` (carries cooldownRemaining for the route envelope), `BeaconIdTooLongError`. New test file: `__tests__/lib/botMagnetBeaconIdentifiers.integration.test.ts` (disposable-PG acceptance, §5 matrix). getBeaconStatus/getActiveBeacons/shouldAttractToBeacon/incrementAttractedCount/cleanupExpiredBeacons/deactivateBeacon/getBeaconStats unchanged — ids are opaque strings end-to-end.
- **Verification evidence:** configured gates exit 0 — `npx tsc --noEmit` (0 diagnostics), `npm run lint` (0 errors/warnings), `npm run test:ci` **149 passed + 11 skipped (160 files) / 1448 tests + 68 skipped**, two consecutive full runs (an early isolated pin-3 failure in the unrelated factoryCaptureVoid suite did not reproduce in either full run or standalone — pre-existing parallel-worker flake, not touched by this FID). **Disposable-PG acceptance 5/5 PASS** (embedded-postgres port 55442, UTF8 initdb, production URLs refused, self-skips in test:ci): real deployment → the full generateId fits varchar(24) at the current epoch, response id = stored row = status id = counter-update id = deactivation id (one id through the whole lifecycle), 336h cooldown persists after deactivation; in-lock admission — unresearched (`Requires Bot Magnet technology`), already-active, and cooldown refusals create nothing; oversized-epoch refusal — a frozen maximum-epoch clock (8.64e15−1 ms, 26-char id) refuses truthfully with NO mutation (the probe's mock generator uses the real clock so the boundary is genuinely exercised); primary-key collision — a pre-seeded conflicting id is retried with a fresh id and succeeds; storage failure (dropped table) → honest failure envelope (`no beacon was created and no cooldown was consumed`), no state change.
- **Call-graph reachability evidence:** §2's probe repeated post-implementation — BotMagnetPanel.tsx → POST /api/bot-magnet → deployBeacon (now the locked one-tx path); getBeaconStatus/deactivateBeacon consumed by the same route's GET/DELETE; shouldAttractToBeacon + incrementAttractedCount consumed by scripts/spawnBots.ts. All beacon ids flow as opaque strings; no caller read the id's internal structure.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. G2 commit outstanding (operator executes).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(bot-magnet): bot magnet bounded beacon identifiers (FID-20261002-010)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance 5/5 green on real database contention, see §7)
