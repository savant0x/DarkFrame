# FID-20261002-011: Harvest Balance and Factory Regeneration Parity

**Filename:** `FID-20261002-011-harvest-balance-and-factory-regeneration-parity.md`
**ID:** FID-20261002-011
**Severity:** MEDIUM
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Harvest's slim player projection omits army stats, disabling shared balance payouts. Background and on-demand slot regeneration use different curves and omit the balance multiplier.

**Review coverage:** R5, R8. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R5 | `lib/harvestService.ts:247; :331` | Actual mono-STR harvest pays 800 from an 800 roll instead of 600 because totals default to zero; UI estimator supplies real stats. |
| R8 | `lib/jobs/factorySlotRegeneration.ts:51; lib/slotRegenService.ts:47` | Actual L10 hourly job recovers 19 versus canonical 120; helper applies multiplier after flooring and advances time using the unmodified rate. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Harvest route → harvestResourceTile → estimateHarvest; factory build/status/list → applySlotRegeneration; server registration → factorySlotRegenerationJob. Player build distribution must use the same slot accounting.

**Exact source/caller probe:**

```powershell
rg -n 'estimateHarvest|totalStrength|totalDefense' lib/harvestService.ts lib/harvestEstimate.ts; rg -n 'applySlotRegeneration|getTimeUntilNextSlot|startFactorySlotRegenJob' app/api lib/jobs/factorySlotRegeneration.ts server.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Resource payout estimates, every factory slot consumer and hourly job. Canonical 30+(level−1)×10 curve and advertised balance modifiers become consistent; no price tuning.

**Dependencies and ownership:** 002 locking/relative credits; 004 procurement consumes shared slot regeneration; 012 supplies mining effects. This FID owns regeneration rate, fractional-time and multiplier application.

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

1. Include totalStrength/totalDefense in the actual harvest payment projection and pass them unchanged to the existing estimateHarvest pipeline. Preserve random roll, VIP/bearer/shrine/inventory ordering and final integer rounding; no duplicated payout math in the route or UI.

2. Replace job-local 10×level curve with existing getRegenRate and applySlotRegeneration. Extend the existing helper with explicit now so background, request and tests use the same clock without racing Date.now calls.

3. Use effectiveRate=getRegenRate(level)×calculateBalanceEffects(owner raw totals).slotRegenMultiplier before calculating recovered=floor(elapsed×effectiveRate/hour). Advance checkpoint by recovered×hour/effectiveRate, preserving fractional time. Use the same effective rate in getTimeUntilNextSlot.

4. When usedSlots reaches zero, discard surplus idle capacity and advance the checkpoint to now so empty factories cannot bank unbounded recovery for future purchases. Future/corrupt timestamps or invalid rates fail safe without negative usedSlots or fabricated recovery; ownerless factories use neutral multiplier.

5. Run regeneration and slot reservation against locked factory rows using 002's transaction boundary; the job cannot overwrite a concurrently consumed slot snapshot. Batch owner-stat reads instead of querying once per factory. Current owner effects apply to each accrual calculation; ownership changes flush/rebase the checkpoint transactionally.

6. Commit harvest reset claim and relative resource credit together, so repeated concurrent harvests cannot pay twice. Cache/display/status paths compute the same estimate/rate without becoming authoritative permission checks.

**Source-audit correction:** Harvest route-level XP/milestones must consume the committed claim identity through 002; a payout followed by a reward failure must not become a duplicate payout retry. Implement neutral mining inputs first, then let 012 supply its owned effect; this is staged integration, not a circular prerequisite. Ownership transfer must flush old-owner accrual before rebasing.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/harvestService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/harvestEstimate.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/jobs/factorySlotRegeneration.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/slotRegenService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/factoryUpgradeService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/factory/build-unit/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/factory/status/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/factory/list/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/player/build-unit/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/harvest/route.ts` | modify | Transaction-aware claim/reward orchestration. |
| `lib/factoryService.ts` | modify | Flush old-owner regeneration before capture/ownership transfer. |
| `app/api/factory/release/route.ts` | modify | Flush/rebase slot checkpoint before neutral release. |
| `app/api/factory/abandon/route.ts` | modify | Flush/rebase checkpoint before abandoning ownership. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Actual harvest mono-STR roll800→600; optimal roll gains intended 10%; same input/clock yields identical UI/service estimate including VIP/bearer/mining stacking.
- L10 neutral one hour→120 recovered; critical multiplier uses the same 0.85 rate in job/build/status/list. Many short ticks equal one long tick until capacity becomes empty.
- Partial slots survive frequent updates; empty-idle→build cannot immediately refill from old time; future/null/corrupt timestamps behave safely.
- Race job versus build and two harvests using disposable PostgreSQL: no overwritten reservations or duplicate credit. Ownership changes cannot inherit unlimited stale accrual.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Simply passing 0.85 into the current helper reuses fractional elapsed time at the wrong rate. Correct the rate and checkpoint together, and prevent stored idle time from granting free future slots. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; operator directive — implement the remaining remediation FIDs in dependency order with gates and disposable-PG acceptance tests per batch).
- **Files changed:** `lib/slotRegenService.ts` (rewritten: effective-rate regeneration `getRegenRate(level) × balanceMultiplier` applied BEFORE flooring, explicit `now` clock via `SlotRegenOptions`, fractional checkpoint advance `applied × HOUR / effectiveRate`, empty-idle surplus discard + checkpoint rebase, future/corrupt-timestamp fail-safe, `getSlotRegenBalanceMultiplier` from `calculateBalanceEffects().slotRegenMultiplier` — §5.2/§5.3/§5.4); `lib/jobs/factorySlotRegeneration.ts` (job-local 10×level curve deleted; delegates to the shared helper; every row locked FOR UPDATE inside one `withTransactionRetry` transaction; owner stats batch-read in ONE query; exported `runFactorySlotRegenerationCycle` with the interval callback as its production caller — §5.2/§5.5); `lib/harvestService.ts` (payout projection carries real `totalStrength`/`totalDefense`; claim + relative credit in ONE transaction under the tile row lock; shrine-expiry, session earnings and milestone rewards staged strictly post-commit — §5.1/§5.6); `app/api/factory/build-unit/route.ts` (regen + slot reservation + player debit/credit + factory write against locked rows in one FID-002 transaction, owner multiplier, explicit clock — §5.5); `app/api/factory/status/route.ts` (owner's balance multiplier; persist under a row lock; countdown at the same effective rate — §5.3/§5.5); `app/api/factory/list/route.ts` (one owner read → one multiplier → one shared clock for every owned factory — §5.3); `app/api/player/build-unit/route.ts` (GET display and POST consumption use DERIVED capacity + regeneration at the owner multiplier; POST reserves against locked factory rows in one transaction with the player debit; relative total deltas — §5.5); `lib/factoryService.ts` (capture rebases `lastSlotRegen` with the ownership transfer — §5.5). `lib/factoryUpgradeService.ts` required NO code change (its `getRegenRate` is the canonical curve consumed everywhere); `app/api/factory/release/route.ts` and `app/api/factory/abandon/route.ts` already flushed/rebased the checkpoint on reset and were verified, not edited. Test mocks updated to transaction/`for('update')`-aware shapes asserting corrected behavior: `__tests__/api/factory/build-unit-units-shape.test.ts`, `__tests__/api/factory/buildUnitBearerGate.test.ts`, `__tests__/api/slice5FactoryAndRanking.test.ts`, `__tests__/api/clusterB2PgRewrites.test.ts` (player build-unit availability pinned to derived capacity, totals pinned to relative SQL deltas). No unplanned production files.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0 (zero diagnostics); `npm run lint` exit 0 (zero findings); `npm run test:ci` 147 files / 1430 tests passed + 16 skipped (DB-less mode), exit 0. **Acceptance criteria satisfied on a REAL disposable PostgreSQL:** `__tests__/lib/factorySlotRegeneration.integration.test.ts` (9/9 passing, same embedded-postgres fail-closed harness as FID-002) pins: L10 neutral one hour → exactly 120 recovered through the actual job cycle; CRITICAL-balance owner → floor(120×0.85) = 102 with batched owner-stat reads; empty-idle discards surplus and a fresh build cannot instantly refill from banked idle time; future checkpoint fails safe with no fabricated recovery; job-vs-concurrent-build reservation race composes exactly (200 − 120 + 10 = 90 under either lock acquisition order); two concurrent harvests of the same tile → exactly ONE payout, one claim record, final balance conserved; mono-STR roll 800 → 600 on the real `harvestResourceTile` path (R5 corrected); OPTIMAL 800 → 880; sequential re-harvest refused without double credit. Unit pins added to `__tests__/lib/harvestEstimate.test.ts` (mono-STR 800→600, OPTIMAL +10%, UI/service parity) and `__tests__/lib/factoryCurves.test.ts` (rate-before-flooring, many-short-ticks-equals-one-long-tick, empty-idle discard, corrupt/future fail-safe, countdown at the same effective rate, invalid multiplier → neutral). The suite self-skips without `ECHO_DISPOSABLE_DATABASE_URL` / `ECHO_AUTO_DISPOSABLE_PG=1`.
- **Implementation-correction found by the probes:** the job originally persisted only when `usedSlots` changed, so the empty-idle checkpoint rebase was computed but never written — a later build would have inherited the discarded idle time from the stale checkpoint. The job now persists whenever the checkpoint moved too; the integration test caught it (asserting the rebased checkpoint after an idle cycle).
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — `applySlotRegeneration` consumed by the job cycle, factory build-unit, status, list and player build-unit paths; `getSlotRegenBalanceMultiplier` by job/build/status/list/player-build; `runFactorySlotRegenerationCycle` by the production interval callback; `estimateHarvest` retains its callers with real totals now flowing from the transactional claim; `getRegenRate` consumed by the shared helper (job-local duplicate deleted). Every new export has named production callers; zero unwired additions.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs (011, 004, 003, 005–013) in dependency order with gates and disposable-PG acceptance tests after each; per-batch progress reporting. Mining-effect integration is deferred to FID-012 as planned (neutral inputs implemented here).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(harvest-balance): harvest balance and factory regeneration parity (FID-20261002-011)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes green, see §7)
