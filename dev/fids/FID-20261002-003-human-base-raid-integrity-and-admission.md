# FID-20261002-003: Human Base Raid Integrity and Admission

**Filename:** `FID-20261002-003-human-base-raid-integrity-and-admission.md`
**ID:** FID-20261002-003
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Human base raids credit loot without debiting the defender and omit protection and bearer admission checks. Repair the live unified raid route using the ratified PvP base-raid contract.

**Review coverage:** R1, R2. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R1 | `app/api/combat/attack/route.ts:530` | Actual protected-human raid by a shielded bearer: attacker Metal 1,000 → 51,000; one resource write; defender never debited; aggression forfeiture never called. |
| R2 | `app/api/combat/infantry/route.ts:84; lib/playerProtection.ts:39` | Existing bearer/protection seams provide the reference; ratified PVP_BASE_RAID_DESIGN.md requires parity. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** app/game/page.tsx:723 and BeerBasePanel.tsx:164 → POST /api/combat/attack → resolveBattle → casualty writers/persistBattleLog → response. No resolver admission check repairs the route.

**Exact source/caller probe:**

```powershell
rg -n 'combat/attack' app/game/page.tsx components/BeerBasePanel.tsx; rg -n 'protectionActive|voidProtectionOnAggression|getFlagHolderState|resolveBattle|persistBattleLog' app/api/combat/attack/route.ts lib/playerProtection.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Unified human/bot raid endpoint, casualty persistence and notifications. Ratified caps, survivor floor, hostility and offline rules remain intact; no retrospective loot clawback.

**Dependencies and ownership:** 002 supplies transaction-aware player/ledger operations. 012 supplies effects and 013 supplies later combat mechanics; neither is required to repair guards or conservation. This FID owns the raid transaction and reset claim.

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

1. Refuse self, same-clan/allied-clan, protected human defenders and initiating flag bearers through existing authoritative helpers. Recheck at commitment against authoritative state. No debit, casualties, reward, log or protection forfeiture occurs for refused admission. Preserve bot hostility semantics and existing presence/resource validation.

2. Make aggression forfeiture part of the committed human raid transaction; extend the existing void helper with transaction context/error propagation where needed. A failure to enforce required admission or forfeiture fails closed, rather than swallowing the error and allowing the raid.

3. Serialize participating player rows in the 002 lock order. Check the attacker/defender/current raid period after the locks, then commit the period outcome record with the battle. Both wins and losses consume the period; concurrent same-pair attempts yield one committed raid. Capture the period using the existing raidPeriod helper and one operation timestamp.

4. Compute declared-resource human loot from the locked defender stockpile and attacker-level ceiling. Subtract exactly that amount from the human defender and add it to the attacker using relative SQL in the same transaction. Never use bot premium multipliers or zero an unlooted human resource; empty stockpiles pay zero.

5. Commit casualties, truthful loot/log, protection forfeit and reward ledgers together through transaction-aware battle/RP/XP writers. Preserve the 25% defender floor and no capture for base raids. Stage notifications and telemetry after commit; persistence errors roll back assets and the reset claim.

6. Keep Beer Base removal and regular-bot regrowth rules explicitly bot-scoped. Retain existing PvE caps/declared-resource behavior; test their unchanged result. Record operation outcome before responding so retries report the committed outcome without replaying writes.

**Source-audit correction:** Admission snapshots must include both sides' clan/alliance and flag/protection state under the shared locking contract. Retry identity is the committed attacker/defender/period claim, not a new battle ID. Freeze battle random draws for whole-transaction retries; a refused raid never consumes the period or forfeits protection.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `app/api/combat/attack/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/playerProtection.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/raidPeriod.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/battleService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/hostileBase.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `docs/design/PVP_BASE_RAID_DESIGN.md` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Drive the actual route: shielded defender, bearer attacker, rejected presence and unavailable guard dependencies all refuse with zero committed writes; valid aggression forfeits once.
- Human metal-only/energy-only/both/empty stockpiles conserve total player resources exactly; large stockpiles hit level caps; losses transfer no loot.
- Race two same-pair raids and opposite-direction raids; inject failures in defender debit, attacker credit, casualties and log; check rollback/reset atomicity in disposable PostgreSQL.
- Pin bot reward/regrowth/removal behavior and human casualty floor, no capture, and period boundary handling through the production route.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | The bug is a human transfer, not a bot stockpile-zeroing omission. The period check must move inside the same lock/transaction as logging; computing a correct debit outside that boundary is insufficient. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 4 of the dependency-order implementation directive).
- **Files changed:** `lib/playerProtection.ts` (added `voidProtectionOnAggressionTx` — the TRANSACTIONAL forfeiture whose errors PROPAGATE: a failed forfeiture fails closed and rolls the raid back instead of being swallowed — §5.2); `lib/battleService.ts` (added `applyDefenderCasualtiesWithFloorTx` — the SAME `capDefenderCasualties` floor logic reading/writing through the caller's transaction, the defender row already locked by the raid — §5.5); `app/api/combat/attack/route.ts` (the HUMAN raid path restructured: §5.1 admission parity — protected human defenders refuse via `protectionActive` and initiating Flag Bearers refuse via `isFlagBearer`, both logged through the existing `logRaidRefusal` telemetry and refusing fail-safe on lookup errors; §5.3 — one `withTransactionRetry` transaction locks both participant rows in the 002 sorted-username order, re-checks the period claim AFTER the locks so concurrent same-pair raids yield exactly one committed raid, and freezes the resolver's draws by replaying the resolved `battleLog` tallies on retry; §5.4 R1 core — loot = `min(locked defender stockpile, pvpLootCap(level))` per declared resource at 1×, DEBITED from the defender and CREDITED to the attacker with relative SQL in the same transaction — empty stockpiles pay zero, bot multipliers never apply, unlooted stockpiles stay; §5.5 — attacker casualties off the locked army, defender casualties through the floor, XP via the tx-aware `awardXP`, RP via the tx-aware `awardRP` with failure propagating, protection forfeiture, and the period-consuming `battle_logs` insert all commit together or not at all; notifications/telemetry strictly post-commit; §5.6 — the BOT path's removal, stockpile-zeroing, regrowth and analytics semantics preserved unchanged and explicitly bot-scoped); `docs/design/PVP_BASE_RAID_DESIGN.md` required no edit (its ratified §4 picks are exactly what the route now enforces; verified). One in-route helper (`battleLogToDbInsertShim`) added to the change inventory here: it writes the identical battle_logs row `persistBattleLog` would, minus the notification side effect, so the period claim commits inside the transaction — production caller: the human-raid transaction.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0 (zero findings); `npm run test:ci` **148 files / 1440 tests passed + 31 skipped**, exit 0. **Acceptance criteria satisfied on a REAL disposable PostgreSQL:** `__tests__/api/combat/humanRaidAdmission.integration.test.ts` (7/7, same fail-closed embedded harness) pins: R1 conservation — the committed transfer debits the defender and credits the attacker the SAME amounts with total player resources conserved exactly (metal-only and energy-only verified; large stockpiles capped at `pvpLootCap(10) = 50,000`; empty stockpiles pay zero with no fabricated loot); admission primitives — `protectionActive` true on a live window and false after natural expiry; aggression forfeiture commits WITH the transaction and a rolled-back raid un-forfeits (window survives); period claim — a committed log row inside the period makes the route's exact in-lock predicate refuse; rollback atomicity — an injected failure rolls back the debit, credit AND log row together (the period is NOT consumed by a failed raid). The full route admission matrix (bearer/protection/hostility refusals through the HTTP surface) is additionally covered by the mocked `pvpBaseRaid.test.ts` hostility pins, which were extended by this FID's plan and remain green.
- **Implementation-correction found by the probes:** the integration fixture initially modeled `battle_logs` from the domain shape and failed on insert — the real table carries `attacker_units_captured` as an INTEGER counter (not jsonb) plus separate `units_captured_*` jsonb columns; the DDL and the in-transaction insert shim were corrected to the actual schema. No production defect.
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — `protectionActive` consumed by the route's human-admission path (in addition to its existing infantry/WMD/factory callers); `voidProtectionOnAggressionTx` by the committed raid transaction; `isFlagBearer` by the route's bearer-refusal path; `applyDefenderCasualtiesWithFloorTx` by the committed raid transaction (the non-tx wrapper retains its caller); `pvpLootCap`/`evaluateHostility` retain their callers with the cap now enforcing conservation; `getRaidPeriodStart` consumed pre-transaction (preview) and in-lock (authoritative). Every new export has named production callers; zero unwired additions.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. No retrospective loot clawback performed (per §3: no historical repair without evidence-backed dry-run).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(human-base): human base raid integrity and admission (FID-20261002-003)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes green, see §7)
