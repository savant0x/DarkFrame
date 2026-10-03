# FID-20261002-001: Project Balance And Feature Review

**Filename:** `FID-20261002-001-project-balance-and-feature-review.md`
**ID:** FID-20261002-001
**Severity:** HIGH
**Status:** analyzed
**Created:** 2026-10-02

---

## 1. Summary

Repository-wide review found 19 open issues affecting combat balance, army procurement/ownership, resource accounting, and strategic features. The approved task is review and evidence gathering. Remediation has not been requested; this document records analysis and stays open rather than declaring the issues fixed. The complete findings, priorities, source index, and coverage boundary are in [the audit](../audits/PROJECT-REVIEW-2026-10-02.md).

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| --- | --- | --- | --- |
| R1/R2 | Human loot minting and missing aggression safeguards | `app/api/combat/attack/route.ts:530` | Actual route: protected defender raided, attacker credited 50,000, no defender debit or shield forfeit |
| R3/R4 | Tier bypass and inconsistent unit identity/slot charge | `app/api/factory/build-unit/route.ts:82`; `app/api/player/build-unit/route.ts:316` | Actual routes: Tier 5 built at level 1/zero RP; player route charges Titan one slot instead of 30 |
| R5/R8 | Harvest balance and slot-regeneration disconnects | `lib/harvestService.ts:245`; `lib/jobs/factorySlotRegeneration.ts:51` | Actual payout 800 vs expected 600; hourly job 19 slots vs helper 120 at L10 |
| R6/R7/R10 | No firepower attrition, round-limit error, dominant STR offense | `lib/battleService.ts:247`, `:331`, `:477` | Actual resolver: five deaths leave 520 strike unchanged; defender dead at round 100 still wins; pure STR wins all seven equal-cost compositions in both modes |
| R9/R14 | Research/discovery/clan bonuses lack effect consumers | `lib/research/techCatalog.ts:39`; `lib/combatPowerService.ts:108` | Identifier/caller search; no personal core effects, no clan/discovery input in resolver |
| R11/R12/R13 | Stack-dependent WMD losses, effectless sabotage, no battery recharge | `lib/wmd/jobs/missileTracker.ts:158`; `lib/wmd/spyService.ts:1381` | Actual impact 0 vs 17 casualties; successful sabotage has zero target writes; cooldown lacks recovery deadline/consumer |
| R15 | Snapshot economy races | `lib/researchPointService.ts:935` | Two real 60-RP spends from 100 both succeed and both write 40; related source risks itemized in audit |
| R16/R17 | Auction unit loss/stale totals and missing clan authorization | `lib/auctionService.ts:355`, `:461`, `:620` | Actual listing removes 3 units and escrows 1; clan guards commented out |
| R18/R19 | Summoned row/tile divergence; beacon ID overflow | `lib/botSummoningService.ts:120`; `lib/botMagnetService.ts:67` | Placement call-chain mismatch; actual ID 30 characters against real varchar(24) schema |

Evidence commands/output:

```text
npx tsc --noEmit: exit 0
npm run lint: exit 0, no findings
npm run test:ci: 147 files passed, 1,419 tests passed
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts:
  Test Files 4 passed (4)
  Tests 16 passed (16)
inverted-route census: 240 routes / 302 call sites / MISSING 0 / UNPARSED 0
schema-consumer census: 57 live / 0 violations
timestamp / host-timezone censuses: clean
```

Call graph: live viewport and factory UI → authenticated routes → combat/procurement services; WMD routes/scheduler → impact and espionage services; auction routes/settlement → marketplace services. Specific source indexes and absent consumers are detailed in the audit. [Durable evidence JSON](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) includes source hashes and simulated results.

## 3. Impact Analysis

- Affected: player resources, unit ownership and progression, combat outcomes, defense systems, research value, auction privacy/fees, and summoned bots.
- Failure modes: minted/undercharged resources, lost units, stale power, bypassed shields/unlocks, misleading bonuses, disabled defenses, and unreachable or failing researched features.
- Repair blast radius: shared combat/accounting contracts, multiple build routes and army writers, UI representations, and strategic jobs. Normalize identity and aggregate invariants before tuning isolated constants.

## 4. Five Questions

| Question | Answer |
| --- | --- |
| Works for ALL cases, not just the common case? | No: stack, terminal-round, and alternate-route cases fail. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Not established; snapshot mutations and reset admission need concurrent database verification. |
| Survives a hostile attacker, not just an honest user? | No: progression, shield, and concurrent-spend paths are bypassable. |
| Maintainable in 2 years? | Not with multiple representations/bonus consumers; shared contracts are needed. |
| Sets the standard for the industry? | No: asset/accounting invariants and advertised-effect fidelity need repair. |

No GREEN convergence is claimed.

## 5. Proposed Fix (GREEN)

Analysis only. The audit recommends ordering and testable outcomes, not a finalized implementation plan. Await remediation direction, then split coherent concerns into scoped FIDs, settle the combat-design choices, and run each Perfection Loop before production code changes.

| File | Action | Description |
| --- | --- | --- |
| `dev/audits/PROJECT-REVIEW-2026-10-02.md` | create | Requested review and priorities |
| `dev/audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json` | create | Durable observations and source hashes |
| `SCOPE.md` | modify | Approved review and open discoveries |
| `dev/tmp/review-20261002/` | create | Isolated review harness, excluded from production checks |

Verification plan for future repairs: exact configured typecheck/lint/tests; transactional database probes for balances/ownership; actual route guards; composition/casualty-value simulations; grep consumer/call-graph proof. Build only when build-affecting configuration changes.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| --- | --- | --- | --- |
| Static analysis and existing tests | Repository baseline | Commands/output in section 2 | Baseline passes; does not invalidate findings |
| Production execution and source comparison | Actual route/resolver/job contracts under isolated dependencies | 16 probes, 98 fights, unit metrics, hashes | Findings reproduced or source-confirmed as labeled |

Analysis complete. Implementation-plan audit is pending; status remains `analyzed`. Early harness errors and a transient disk-full interruption were corrected before final probe evidence. No production database or external transaction was used.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** not-started.
- **Files changed:** review documents and ignored scratch harness only. No production remediation.
- **Verification evidence:** section 2 and linked audit/evidence.
- **Call-graph reachability evidence:** section 2 and source index in audit.

## 8. Closure

Not eligible: the defects remain open; no implementation or commit is claimed. Review delivery is complete. Do not archive this analyzed finding document or mark its defects closed on the strength of baseline gates. No CHANGELOG/VERSION update or staging/commit action is part of this review.

---

**Final status:** analyzed
