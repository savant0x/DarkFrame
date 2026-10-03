# FID-20261002-006: WMD Representation Independent Army Losses

**Filename:** `FID-20261002-006-wmd-representation-independent-army-losses.md`
**ID:** FID-20261002-006
**Severity:** HIGH
**Status:** closed (2026-10-03, commit 3c5b824)
**Created:** 2026-10-02

---

## 1. Summary

WMD floors destruction separately per stack, making singleton armies immune to fractional damage, and leaves cached army totals unchanged.

**Review coverage:** R11. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R11 | `lib/wmd/jobs/missileTracker.ts:158; :167` | Actual 100-unit impact: 100 singleton entries lose zero versus one stack losing 17; only units field is written. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** WMD scheduler/cron/lazy ticks → processDueMissiles → applyDamage → player ownership/factory/resources → missile outcome. Changes must be exercised through processDueMissiles, not a dead helper.

**Exact source/caller probe:**

```powershell
rg -n 'processDueMissiles|applyDamage' lib/wmd/jobs/missileTracker.ts app/api/cron/wmd-tick/route.ts; rg -n 'totalStrength|totalDefense' lib/factoryService.ts lib/rankingService.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Every missile impact and downstream raw army power. Damage shares/warhead critical rules remain unchanged; current stale totals are repaired from ownership.

**Dependencies and ownership:** 002 transaction discipline; 004 common quantity-weighted army reducer. Battery lifecycle 007 is a separate owner of interception; no duplicate interception rewrite here.

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

1. Normalize the damage fraction after critical/share calculation to [0,1]. Group equivalent units by canonical type AND per-copy stats so different-stat variants remain distinct. Compute floor(total equivalent quantity×fraction) once per group, then distribute removals across entries with stable instance ordering; splitting/merging equivalent stacks cannot alter losses or total surviving power.

2. Preserve surviving instance identity, metadata and positive integral quantities; remove zero-quantity entries. Reject corrupt quantities/stats through the existing domain-validation boundary and record an integrity failure rather than silently dropping invalid assets.

3. Recompute totalStrength and totalDefense from the resulting army through 004's shared reducer, writing units and totals together on the locked target row. Preserve stored raw stats; do not persist temporary combat effects.

4. Conditionally claim the due missile and commit unit/resource/factory damage plus its terminal damage record in one transaction. Use the 002 lock order; determine random damage/critical roll once per operation, preserving it across transaction retries. Scheduler and lazy ticks cannot apply the same impact twice.

5. Repair current cached aggregates using an idempotent dry-run/recount on verified unit arrays. Historical singleton immunity cannot be reconstructed into retroactive casualties without an explicit operator action.

**Source-audit correction:** Acquire the complete target set, including secondary targets and factory owners, before asset locks. Failed missiles remain retryable without rerolling damage; terminal outcome and damage snapshot are authoritative. The army reducer includes verified transitional legacy ownership under 004 so totals cannot silently drop factory-produced units.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/wmd/jobs/missileTracker.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/battleService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Equivalent singleton/stack/partitioned/reordered armies yield identical deaths and STR/DEF for 0%, fractional, 100% and over-100% critical effects.
- Heterogeneous tiers/stats preserve group weighting and survivors; quantities stay integral/nonnegative; zero or corrupt arrays fail explicitly.
- Drive real processDueMissiles concurrently from cron/lazy scheduler; exactly one impact commits. Failure injection rolls back missile claim and all army/resource/factory writes.
- Factory captures/rankings/balance read the recomputed owned totals; recount twice is idempotent.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Rounding once per equivalent-stat group preserves both representation independence and tier composition; a per-entry floor or unweighted count-only aggregate is rejected. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 6 of the dependency-order implementation directive).
- **Files changed:** `lib/wmd/jobs/missileTracker.ts` (§5.1 — NEW `applyProportionalUnitLosses`: the damage fraction is normalized to [0,1] AFTER the critical/share math, equivalent units are grouped by canonical type AND per-copy stats (unitId/unitType/name/category/rarity/strength/defense — different-stat variants stay distinct so tier weighting survives), `floor(group total × fraction)` is computed ONCE per group and the removals distributed across the group's entries in stable instance (array) order — splitting, merging or reordering equivalent stacks cannot alter deaths or surviving power; survivors keep instance identity/metadata and positive integral quantities, zero-quantity remnants removed; R11's per-stack floor is dead — 100 singletons now lose 17 where they lost 0 before). §5.2 — NEW `ArmyIntegrityError`: every entry is validated (positive integer quantity, finite per-copy stats) BEFORE any planning; corrupt arrays fail the impact transaction explicitly and the tracker records the integrity failure (SYSTEM_ERROR CRITICAL wmd_alerts row + terminal zero-damage detonation — no infinite retry, no silently dropped assets). §5.3 — `applyDamageTx` recounts `totalStrength`/`totalDefense` from the resulting army through 004's shared `calculatePlayerUnitStats` and writes units and totals TOGETHER on the locked target row; stored per-copy raw stats are preserved (no temporary combat effect persisted). §5.4 — the detonation is ONE `withTransactionRetry` transaction: a CONDITIONAL claim (`status` must still be `LAUNCHED` and `impactAt` past, under the row lock) commits together with all unit/resource/factory writes and the terminal damage record; the cron sweep, the lazy tick and any other process race on the claim — exactly one impact ever commits, the loser sees zero claim rows and skips notifications/broadcasts entirely; the warhead's rolls (damage % + critical) are decided ONCE per impact OUTSIDE the retrying transaction so a retry replays the same detonation instead of rerolling; the target row and its factory rows (deterministic (x,y) order) are read FOR UPDATE from the locked truth and resources decrement by RELATIVE SQL floored at zero (never an absolute write from a stale snapshot). §5.5 — the idempotent recount repair is satisfied by the EXISTING `lib/migrations/armyIdentityResync.ts` tool (004: dry-run purity + idempotent recount already acceptance-verified); no retroactive restoration of historical singleton-immunity losses is performed (per §3: no inference from a current snapshot without operator action). `applyDamage`'s old autocommit per-write shape is fully replaced by the tx-aware `applyDamageTx` consumed only by `processDueMissiles`.
- **Inventory adjustment (implementation-planning authority):** the planned `lib/battleService.ts` modification required NO change — none of the five §5 items has a battleService consumer obligation: the shared army reducer lives in `lib/armyService.ts` (004's ownership, already consumed here), the raid casualty paths are FID-013's separate owner, and no WMD-specific code exists in battleService. Verified by reading battleService's unit-loss seam (HP-loop `calculateUnitLosses` — untouched, out of this FID's charter). Zero new files were needed: the pure grouping helper lives inside missileTracker.ts with its named production caller (`applyDamageTx` → `processDueMissiles`).
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` **149 passed + 7 skipped (156 files) / 1448 tests + 44 skipped**, exit 0. **Unit pins 6/6** (`__tests__/lib/wmdMissileArmyLosses.test.ts`): singleton/stack/partitioned/reordered equivalence at a fractional effect (17 deaths and identical surviving power in every representation — the RED behavior destroyed 0 of 100 singletons), 0% no-op / 100% wipe / over-100% clamp, heterogeneous tier weighting preserved (5 riflemen + 2 titans at 50%), stable-order distribution with zero-quantity removal and metadata survival, split/merge invariance, corrupt arrays (zero/negative/fractional quantities, NaN stats, NaN fraction) refused through `ArmyIntegrityError` while an empty army is legitimate. **Disposable-PG acceptance 5/5 PASS** (`__tests__/lib/wmdMissileArmyDamage.integration.test.ts`, embedded-postgres port 55438, UTF8 initdb, production URLs refused, self-skips in test:ci): representation independence through the REAL `processDueMissiles` (all three representations lose exactly 17 of 100 at the deterministic TACTICAL effect; totals recounted 8300/4150 and written WITH units; stacked target keeps its single instance identity); two concurrent sweeps race on the conditional claim — exactly one impact commits (83 survivors, resources 9750/4875, factory 95, no double damage); corrupt-army failure injection rolls back the claim AND every army/resource/factory write together, records the SYSTEM_ERROR CRITICAL alert and terminates at zero damage; a dropped-factories failure injection rolls back the units/totals/resource writes AND the claim (missile stays LAUNCHED, `damage_dealt` null — retryable without rerolled damage); crash-resume idempotency (second sweep processes zero, state byte-identical).
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — `processDueMissiles` is invoked by the cron route (`app/api/cron/wmd-tick/route.ts`) and the e2e script; `ensureWmdJobsTicked` by the defense/missiles/status WMD routes (the lazy tick shares the same claim-gated core); `applyProportionalUnitLosses` and `applyDamageTx` by the `processDueMissiles` impact path; `calculatePlayerUnitStats` is 004's shared reducer consumed per the ownership map. Factory captures/rankings/balance read the recomputed totals through the existing consumers (factoryService/rankingService read the same `totalStrength`/`totalDefense` columns the impact now writes) — recount-twice idempotency is pinned by 004's resync suite.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. Historical singleton-immunity losses were NOT retroactively reconstructed (§3 forbids inferring past casualties from a current snapshot; the idempotent recount tool covers cached-aggregate repair when the operator authorizes a live-data pass). Battery lifecycle/interception remains 007's separate owner and was not rewritten here.

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(wmd-representation): wmd representation independent army losses (FID-20261002-006)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes 5/5 green on real database contention, see §7)

---

**Closure (2026-10-03, G2):** closed on commit `3c5b824` — the staging-plan group commit carries this FID's full change inventory (ownership map: `dev/STAGING-PLAN-20261002-REMEDIATION.md`). Gates at close: tsc 0 · lint 0/0 · suite 152 files / 1479 passed + 79 skipped, exit 0 · ledger census clean. Agent-run commits and push under the operator's explicit 2026-10-03 directive. This closure supersedes any "G2 commit outstanding" wording above.
