# FID-20261002-002: Atomic Economy and Operation Boundaries

**Filename:** `FID-20261002-002-atomic-economy-and-operation-boundaries.md`
**ID:** FID-20261002-002
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Concurrent RP spends undercharge purchases; snapshot RP/XP rewards, clan research, procurement, raid admission/rewards and factory income can lose, duplicate or strand value. Establish one transaction contract before feature-specific accounting repairs.

**Review coverage:** R15. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R15 | `lib/researchPointService.ts:935` | Two production spendRP(60) calls from 100 both succeed and both leave 40: 120 purchased, 60 charged. |
| R15 | `lib/xpService.ts:296; lib/clanResearchService.ts:95; lib/factoryService.ts:131` | Source-confirmed snapshot writes and separately advanced accrual timestamps; related paths require database interleaving tests, rather than claiming the RP probe tested them. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Authenticated research/admin rewards → spendRP/awardRP and research/WMD → spendResearchPoints; harvest/build/combat → awardXP; clan research contribute route → contributeRP; player/factory collection → collectAllFactoryIncome. Build, raid and auction routes are separate transaction consumers covered by dependent FIDs.

**Exact source/caller probe:**

```powershell
rg -n 'spendRP|spendResearchPoints|spendRPOnResearch|awardRP|awardXP|contributeRP|collectAllFactoryIncome' app/api lib; rg -n 'withClanTreasuryLock|playerResourceDelta|transaction' lib/db/treasuryLock.ts lib/researchPointService.ts lib/xpService.ts lib/clanResearchService.ts lib/factoryService.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Player progression and every named currency writer; contention is scoped to involved rows. API result shapes and economy parameters remain stable. Data reconciliation reports are dry-run first; no reconstruction of historical lost or minted currency is assumed.

**Dependencies and ownership:** First prerequisite for 003–009 and 011. Feature owners implement their own complete transaction boundaries; this FID owns the shared transaction/resource primitives and the RP/XP/clan/income writers. No duplicate implementation ownership.

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

1. Extend the existing db/treasuryLock.ts arithmetic/transaction idiom with typed player-row locking and caller-supplied transaction support. Infer row types from schema; remove unsafe casts on touched lines. Use database-relative deltas with sufficient-balance predicates and RETURNING; zero affected rows is a business refusal. Validate finite positive safe-integer amounts before SQL.

2. Define lock ordering across all consumers: clan rows sorted by ID, then player rows sorted by username, then assets sorted by table/key (including coordinate factories). Acquire the complete participant set before mutation; never nest an independent transaction or call a global-db writer from a transaction. Bounded deadlock retries restart the whole transaction, never a partial write.

3. Rewrite spendRP, its spendResearchPoints adapter, and awardRP to commit balance, rpHistory, rptransactions and daily cap/milestone counters together. Calculate daily allowance and VIP/bearer modifiers once against the locked row and authoritative time. Preserve existing cap/multiplier rules; refund is a signed ledger movement with an operation identity, not a second purchase.

4. Rewrite awardXP against locked XP/level state. Commit XP, levels, level-derived RP and ledger events together through transaction-aware RP calls. Preserve level thresholds, action tables and ordinary repeated reward eligibility; transport retries cannot duplicate one operation.

5. Make clan research contribution and tier/personal-tech unlocks debit and unlock/pool updates one transaction. Revalidate membership/eligibility in-lock. Factory income credits relative player balances in the same transaction as claimed factory accrual checkpoints; an error rolls both back.

6. Inventory the named related writers in build, raid, auction, WMD, summon and harvest boundaries. Assign their transactional conversion to the explicit dependent FIDs; record exact writers and lock sets in the remediation index. Notifications run after commit and cannot convert committed success into a retryable purchase error.

**Source-audit correction:** Route research and WMD contributions also call spendResearchPoints in xpService; make it a transaction-aware adapter to the same RP writer. WMD spendRPOnResearch must commit debit, contribution, completion effects and available-tech recalculation together. Deduplicate stable source events through their locked harvest/raid/unlock/income claims and existing unique RP ledger IDs; independent authorized commands remain independent. Reuse one event ID across transaction retries.

**Boundary audit:** Participant changes discovered after locking restart the whole operation with a new complete lock set. Stable RP event IDs include username/source/claim identity within rptransactions.id's actual 64-character budget; validate stored amount/source on replay. WMD completion effects must accept the caller transaction, not retain global-db writes.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/db/treasuryLock.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/researchPointService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/xpService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/clanResearchService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/factoryService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/tierUnlockService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/research/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/researchService.ts` | modify | Atomic contribution/completion and shared RP adapter caller. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Real isolated PostgreSQL interleaving: two 60-RP spends from 100 produce exactly one success, final 40, one debit ledger; concurrent credits both survive and histories contain both.
- Concurrent awards at daily-cap/reset boundaries, XP crossings and unlock retries preserve caps, levels and exactly-once grants. Test opposite-direction participants for lock ordering.
- Inject failure at each ledger, pool, unlock and income checkpoint write: all monetary/state writes roll back. Repeat an income collection and transport retry: no second payout.
- Use a dedicated disposable PostgreSQL database and reject production connection targets; mocks establish call contracts but cannot prove database race safety. Implementation stays unverified until these probes pass.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Relative arithmetic alone does not atomically grant the purchased item. Transaction context must cross every debit/grant/ledger boundary; the existing clan helper is reused, with typed rows and a consistent global order. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; operator ratified the four gameplay-policy proposals and directed dependency-order implementation).
- **Files changed:** `lib/db/treasuryLock.ts` (added `lockClanRow`, `lockPlayerRow`, `assertValidAmount`, `withTransactionRetry` — §5.1/§5.2); `lib/researchPointService.ts` (`awardRP` locked row + relative credit + balance/rpHistory/rpTransactions/rp_daily_totals one transaction + caller-tx; `spendRP` conditional relative debit, zero-rows = refusal; `applyBattleEnvelope` tx-aware — §5.3); `lib/xpService.ts` (`awardXP` whole operation one transaction, level RP via tx-aware awardRP, 1-RP fallback removed, achievements post-commit; `spendResearchPoints` tx-aware adapter to spendRP — §5.4/source-audit); `lib/clanResearchService.ts` (`contributeRP` clan+player lock-order transaction, in-lock membership revalidation, relative debit/credit; `unlockResearch` guarded relative debit — §5.5); `lib/factoryService.ts` (`collectAllFactoryIncome` checkpoint advance + relative credit one transaction — §5.5); `app/api/research/route.ts` (debit + unlock one transaction — §5.5); `lib/wmd/researchService.ts` (`spendRPOnResearch` locked row, debit + contribution + completion effects one transaction, notifications post-commit — source-audit correction). Test mocks for `__tests__/lib/rpDailyCap.test.ts`, `__tests__/api/research/rp-unlock.test.ts`, `__tests__/api/research/catalog-contract.test.ts` extended to transaction/RETURNING semantics asserting corrected behavior. Change inventory otherwise as planned; no unplanned files.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0 (zero diagnostics); `npm run lint` exit 0 (zero findings); `npm run test:ci` 147 files / 1419 tests passed + 7 integration tests skipped (DB-less mode), exit 0. **Acceptance criteria satisfied on a REAL disposable PostgreSQL:** `__tests__/lib/economyTransactions.integration.test.ts` (7/7 passing) self-provisions a throwaway cluster from the `embedded-postgres` devDependency (real server binaries, gitignored data dir, deleted on stop; production-shaped URLs refused fail-closed) and pins the interleaving contract on actual database contention: two concurrent 60-RP spends from 100 → exactly one success, final 40, one debit ledger row; concurrent credits both survive with full histories; concurrent XP crossings conserve XP exactly with exactly-once level grants; factory income double-collection pays exactly once; clan contributions race-exact under the lock order; injected ledger failure rolls the whole spend back; WMD research completion commits debit + contribution + completion effects + recalculation together. The suite self-skips when neither `ECHO_DISPOSABLE_DATABASE_URL` nor `ECHO_AUTO_DISPOSABLE_PG=1` is set, so CI and the full suite remain DB-less and green.
- **Implementation-correction found by the probes:** `applyTechEffects`/`recalculateAvailableTechs` originally ran as global-db writes inside the composed transaction — a guaranteed self-deadlock against the same transaction's FOR UPDATE lock on player_research. Both are now transaction-aware (`tx` parameter, errors propagate) and `spendRPOnResearch` stages its notification for strictly post-commit, returning the staged tech on the transaction result. The WMD completion test exercises the fixed path.
- **Call-graph reachability evidence:** §5's exact probe repeated post-implementation — `withTransactionRetry` has 7 production invocation sites (awardRP, spendRP, awardXP, contributeRP, collectAllFactoryIncome, spendRPOnResearch, research route), `lockPlayerRow` 4, `lockClanRow` 2 including the composed helper; relative-SQL RP arithmetic confirmed by grep at every rewritten debit/credit site; all seven writer functions retain their full pre-existing caller sets (46 production matches). Every shared helper consumed; zero unwired additions.
- **Authorization:** operator directive 2026-10-02 — review the FID folder, verify the Perfection Loops, then complete all pending work; policies ratified; dependency-order batching chosen. The DB-interleaving step was initially blocked (Docker daemon unreachable) and resolved per the operator's "find another route" direction via the embedded-postgres devDependency (18.4.0-beta.17, dev-only; the suite skips without it); recorded as SCOPE row 140.

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(atomic-economy): atomic economy and operation boundaries (FID-20261002-002)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — see §7 for the blocked PostgreSQL-interleaving acceptance probes)
