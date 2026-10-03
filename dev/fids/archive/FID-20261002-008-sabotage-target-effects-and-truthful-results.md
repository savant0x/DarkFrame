# FID-20261002-008: Sabotage Target Effects and Truthful Results

**Filename:** `FID-20261002-008-sabotage-target-effects-and-truthful-results.md`
**ID:** FID-20261002-008
**Severity:** MEDIUM
**Status:** closed (2026-10-03, commit ecdadf3)
**Created:** 2026-10-02

---

## 1. Summary

Live sabotage can report battery/research success while performing no target update. The chosen effects must use real schema state and produce truthful, committed damage records.

**Review coverage:** R12. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R12 | `lib/wmd/spyService.ts:1382; :1434` | Actual battery and research sabotage returns success with zero target writes; battery branch calculates hypothetical resource waste, research has no branch. |
| R12 | `lib/db/schema/wmd.ts:50; :88` | Research is RP-contribution state; batteries have status/deadlines, without a health column. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** WMDIntelligencePanel → intelligence POST → spyService.executeSabotage → applySabotageDamage → operation history/target. Older sabotageEngine has no production caller and is excluded.

**Exact source/caller probe:**

```powershell
rg -n 'executeSabotage|applySabotageDamage' app/api/wmd/intelligence/route.ts lib/wmd/spyService.ts; rg -n 'getSabotageTargets' lib/wmd/sabotageTargets.ts app/api/wmd/intelligence/route.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Spy target effects, histories and result display. New balance policy needs ratification before gameplay rollout; completed research and purchased permanent technologies are not revoked.

**Dependencies and ownership:** 002 transaction contract; 007 authoritative battery deadlines. Gameplay defaults below are proposals to ratify with implementation, not previously signed balance rules.

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

1. Keep existing operator ownership, target-derived victim, protection and detection checks. Revalidate active target state under lock before committing a success roll; target disappearance/no active research yields an explicit refusal with no fabricated damage.

2. Use a battery-disable effect expressed by the real 007 lifecycle: extend cooldownUntil by ceil(clamped sabotageSkill/100×cooldownDuration) from max(now, existing deadline), at least 1 millisecond for positive skill. Move eligible IDLE/COOLDOWN batteries to COOLDOWN; DAMAGED/UPGRADING targets are unavailable. Record the actual extension as delayDuration; no invented resource loss or health write.

3. For active WMD research, reduce currentResearchRpSpent by min(current spent, floor(required×clamped skill/100×0.25)). Update currentResearchProgress from remaining/required if that column is used, keeping completedTechs/domain tiers and lifetime RP spent unchanged. No current research or zero destructible progress is a truthful no-effect result, not a successful damaging operation.

4. Commit target mutation, spy exposure/state and operation damage record together. Distinguish operation roll success from actual applied effect; report zero effect explicitly without claiming resources were destroyed. Throw/propagate persistence failures so rollback prevents a success-with-no-write response.

5. Compute resourcesWasted from destroyed contributions only where real corresponding spend evidence exists; otherwise report zero and actual RP progressLost/delay fields. Preserve missile sabotage behavior with a truthful actual components delta; do not import or wire the dead sabotageEngine.

6. Use the existing player-notification seam after commit for operator/victim results, carrying applied deltas. Align target enumeration and panel result fields to eligible states and committed outcome.

**Source-audit correction:** Required RP and progress percentages come from the locked active research row; currentResearchProgress is a numeric column, so write a validated decimal string. Define no-effect separately from target-unavailable and roll-failed outcomes. Cooldown disable is reported as time, research destruction as RP; neither is fabricated metal/energy loss.

**Boundary audit:** Synchronize target eligibility and result rendering in sabotageTargets and WMDIntelligencePanel. Research writes lock the same active row as 002; completed technology cannot be removed. A no-effect outcome has zero applied delta and explicit reason even when the operation roll succeeded.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/wmd/spyService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/sabotageTargets.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/researchService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/wmd/defenseService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/wmd/intelligence.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `components/WMDIntelligencePanel.tsx` | modify | Display committed cooldown/progress deltas and truthful no-effect outcomes. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Drive actual executeSabotage battery/research cases: successful effects change target state and returned damage matches persisted deltas.
- No research/zero progress/completed tech, protected victim, wrong spy owner, upgrading/damaged battery and vanished target produce truthful refusal/no-effect with no fake resource losses.
- Race sabotage against research completion, RP contribution, battery recovery and repair; locked authoritative state prevents lost unlocks or overwritten deadlines.
- Inject target/history/spy write failures and verify full rollback; notification failure cannot duplicate applied damage or change committed success.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | The schema cannot support a proposed battery-health reduction, and RP-based research cannot support an invented timed-completion delay. Defaults therefore target persisted cooldown and active contribution state. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 8 of the dependency-order implementation directive).
- **Files changed:** `lib/wmd/spyService.ts` (R12 closed — the truthful target-effect engine: `applySabotageDamage` → tx-aware `applySabotageDamageTx` with the target row FOR UPDATE-locked; §5.2 DEFENSE_BATTERY now uses the REAL 007 lifecycle — cooldownUntil extended by ceil(clamped skill/100 × cooldownDuration) (≥1 ms) from max(now, existing deadline), eligible IDLE/COOLDOWN batteries moved to COOLDOWN via the shared predicate, DAMAGED/UPGRADING unavailable, delayDuration = the ACTUAL extension, ZERO resource-waste figures (time is time); §5.3 RESEARCH now exists — currentResearchRpSpent reduced by min(spent, floor(required × clamped skill/100 × 0.25)), currentResearchProgress rewritten from remaining/required as a validated decimal string on the SAME row 002's writer locks, completed techs / domain tiers / lifetime RP spent NEVER revoked, no-active-research/zero-progress = truthful no-effect; §5.5 MISSILE preserved with the truthful ACTUAL components delta and resourcesWasted computed from REAL COMPONENT_COSTS evidence for components actually destroyed (the invented progressLost×cost figures deleted)); §5.4 executeSabotage restructured — rolls decided once OUTSIDE the retrying transaction (a retry replays, never rerolls), then ONE transaction commits the target mutation + the operation record + the spy exposure together (a persistence failure propagates and rolls back — success-with-no-write is impossible); a roll success with nothing to damage persists the zero-delta record carrying `noEffectReason` and reports it explicitly; notifications strictly post-commit; the shared `buildSabotageRecord` keeps both paths writing the victim-derived record). `types/wmd/intelligence.types.ts` (SabotageDamage: `noEffectReason?`; progressLost/delayDuration/resourcesWasted re-documented as RP / cooldown-ms / evidence-backed-only). `lib/wmd/sabotageTargets.ts` (§5.6 — enumeration aligned to eligibility: batteries carry status with DAMAGED/UPGRADING marked ineligible; research options mark no-active-tech/zero-RP rows ineligible with display-only statusNote — the fire path re-derives everything under lock). `components/WMDIntelligencePanel.tsx` (the result toast surfaces the service's truthful message — applied deltas or the explicit no-effect reason — instead of a generic 'executed').
- **Inventory adjustments (implementation-planning authority):** `lib/wmd/researchService.ts` needed NO change — its 002 writer (spendRPOnResearch) already locks the same active player_research row FOR UPDATE; the sabotage engine now locks the identical row, so the race contract holds without edit. The dead `lib/wmd/sabotageEngine.ts` was NOT imported or wired (per §5). No new helper files.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` **149 passed + 9 skipped (158 files) / 1448 tests + 55 skipped**, exit 0. Existing suites re-pinned: `__tests__/lib/spySabotageProtection.test.ts` (6/6 — all FID-20260916-007 protection seams hold under the new transaction contract; mock extended with db.transaction + FOR UPDATE shapes) and `__tests__/api/sabotageTargets.test.ts` (payload contract + `eligible` field). **Disposable-PG acceptance 6/6 PASS** (`__tests__/lib/wmdSabotageTruthful.integration.test.ts`, embedded-postgres port 55440, UTF8 initdb, production URLs refused, self-skips in test:ci): REAL executeSabotage battery sabotage lands the battery in COOLDOWN with `cooldownUntil − executedAt = 600000` exactly matching the returned delayDuration and the persisted record, resourcesWasted {0,0} (R12's invented figure is gone); research sabotage destroys the ACTUAL floor(required×skill×0.25) = 25 RP (50→25), progress rewritten 25.00, completed techs + lifetime RP untouched; truthful no-effect for no-active-research / zero-RP / DAMAGED battery (zero deltas + explicit reasons, all three records persist the reason, DAMAGED stays DAMAGED); two concurrent battery sabotages SERIALIZE under the row lock and their cooldown extensions COMPOSE (final deadline = start + 2×600000 — no overwritten deadline); sabotage racing a research RP contribution (spendRPOnResearch, +10) ends with BOTH effects — 50+10−25 = 35 under either order, no lost update, no lost unlock; a dropped-table persistence failure rolls back the target mutation + record + spy exposure together and the service reports failure, never success-with-no-write.
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — the intelligence POST route calls `executeSabotage` (which drives `applySabotageDamageTx` inside its committed transaction) and `getSabotageTargets` (the panel's target picker consumes the aligned eligibility fields); `WMDIntelligencePanel` renders the committed outcome. The dead sabotageEngine remains excluded with zero callers. No unimplemented symbol is represented as live.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. The §5 effect defaults (battery = cooldown extension; research = RP destruction at 25% of required × skill; no health/revoke writes) were implemented exactly as proposed. **RATIFIED 2026-10-02 as official balance policy** (operator decision; SCOPE row 149 + Operator Decisions table): the battery cooldown-extension formula, the 25%-of-required RP destruction ceiling, the components-evidence-only resource accounting and the no-effect record semantics are now the signed rules — any future change requires a new operator decision recorded in SCOPE.md.

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(sabotage-target): sabotage target effects and truthful results (FID-20261002-008)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes 6/6 green on real database contention, see §7)

---

**Closure (2026-10-03, G2):** closed on commit `ecdadf3` — the staging-plan group commit carries this FID's full change inventory (ownership map: `dev/STAGING-PLAN-20261002-REMEDIATION.md`). Gates at close: tsc 0 · lint 0/0 · suite 152 files / 1479 passed + 79 skipped, exit 0 · ledger census clean. Agent-run commits and push under the operator's explicit 2026-10-03 directive. This closure supersedes any "G2 commit outstanding" wording above.
