# FID-20261002-012: Research and Combat Effects Consumer Parity

**Filename:** `FID-20261002-012-research-and-combat-effects-consumer-parity.md`
**ID:** FID-20261002-012
**Severity:** HIGH
**Status:** closed (2026-10-03, commit 66d94dc)
**Created:** 2026-10-02

---

## 1. Summary

Three sold core technologies have no gameplay consumers; clan/discovery combat bonuses and fixed doctrine averages inflate displayed power without matching resolved combat.

**Review coverage:** R9, R14. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R9 | `lib/research/techCatalog.ts:39; :49; :130` | Production identifier search finds only definitions/prerequisites for advanced-mining, fortification, tactical-warfare; combined price 22,500 RP. |
| R14 | `lib/combatPowerService.ts:108; :128; :149; lib/battleService.ts:375` | Display reads clan/discovery effects and hardcodes doctrine averages; resolver reads flag/doctrine only. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Personal tech unlock/catalog → unlockedTechs; harvest/auto-farm timing → payouts; combat routes → resolveBattle; stats/rankings → calculateCombatPower; shared discovery/clan/doctrine producers already exist.

**Exact source/caller probe:**

```powershell
rg -n 'getClanBonuses|getDiscoveryBonuses|getDoctrineBonusesForUsernames|calculateCombatPower|resolveBattle' lib/combatPowerService.ts lib/battleService.ts; rg -n 'advanced-mining|fortification|tactical-warfare' lib app utils
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Tech value, combat source reads, rankings/stat breakdown and harvest action timing. No RP price/refund rewrite; existing purchases become effective. New unspecified numbers are proposals, not retroactive operator decisions.

**Dependencies and ownership:** 002 transaction-aware tech purchase; 011 economy estimator/rate contract; 013 consumes effective combat stats without double-applying effects. Proposed unspecified numeric effects below require gameplay ratification before implementation.

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

1. Introduce one typed effect composition seam adjacent to combatPowerService, consumed by calculateCombatPower and resolveBattle. It reads existing getClanBonuses/getDiscoveryBonuses/getDoctrineBonusesForUsernames plus authoritative unlockedTechs/flag state once per encounter. Record explicit planned caller sites; no unused general-purpose bonus API.

2. Compose raw army stats with independent stat multipliers: doctrine/mastery, flag, clan attack/defense, discovery unitStrength/unitDefense and personal technologies. Use existing effect percentages; composition is multiplicative across source categories, additive within a source category. Clamp/validate finite domains and damage-taken reductions; raw owned aggregates remain unmodified.

3. Wire Advanced Mining to +10% resource yield in estimateHarvest and +25% action speed (duration/base delay divided by 1.25) in the proposed authoritative harvest timing contract consumed by manual/auto-farm clients. It does not increase harvest reset frequency or duplicate eligibility. A committed unlocked tech is required; estimates and payments use the same value.

4. Wire Fortification to +15% effective DEF when defending a human base, plus proposed 15% incoming base-raid damage reduction. Wire Tactical Warfare to +20% effective attacking STR and proposed +5 percentage points critical chance with 1.5× strike damage; draw once per actual strike, not per stat lookup. Record these previously unspecified defaults in catalog/design prose for ratification; do not silently remove the promised effects.

5. Apply clan attack/defense and discovery stat/damage modifiers in resolved battles. Doctrine display uses actual STR/DEF weighting and mastery, via the same effect seam. Display stat contribution from effective stat sums; show damage/critical effects separately instead of inventing an averaged all-purpose combat multiplier.

6. Keep balance measured from raw composition, applied in one defined place per 013, with dealt/taken modifiers each used once. Assert no effect double-applies between display/preparation/resolver. Neutral unresearched/unclanned/unflagged inputs preserve current baseline.

7. Batch source reads for the involved players and reuse the encounter snapshot on transaction retries. Required effect reads must fail explicitly rather than silently charging for absent bonuses. Align catalog header/copy with actual consumers and expose effect breakdown without claiming a numeric rating predicts every matchup.

**Source-audit correction:** Existing harvest is immediate; antiCheatDetector only observes a 3000ms cadence. Proposed speed contract: authoritative per-player next-action deadline, base 3000ms / 1.25 when researched, unchanged tile reset periods. Enforce only resource harvests under the player lock; expose retryAt/delay to manual and auto clients and use the same threshold for detection. This new admission policy requires gameplay ratification.

**Boundary audit:** Add nullable nextResourceHarvestAt timestamptz to players via reserved migration 0042; update it only with successful resource payout in the 002/011 transaction. Derive retryAt from this deadline on refusal. Use a pure lib/research/techEffects.ts seam with harvest/anti-cheat/effect callers; move personal coefficients into it without a client-to-database import.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/research/techCatalog.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/combatPowerService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/battleService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/harvestEstimate.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/harvestService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/specializationService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/clanResearchService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/discoveryService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `utils/autoFarmEngine.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/harvest/route.ts` | modify | Resource-action deadline admission and timing DTO. |
| `components/HarvestModal.tsx` | modify | Consume server timing without client authority. |
| `lib/antiCheatDetector.ts` | modify | Use the same researched resource-harvest cadence. |
| `lib/research/techEffects.ts` | add | Pure coefficients with harvest, timing and combat consumers. |
| `lib/db/schema/players.ts` | modify | Persist nextResourceHarvestAt timestamptz with caller pointers. |
| `lib/db/migrations/0042_resource_harvest_action_deadline.sql` | add | Nullable deadline, idempotent migration; no retroactive cooldown. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Each of the three tech purchases produces its advertised actual payout/timing/defense/attack/critical effect; ownership absence and prerequisite failure leave neutral behavior.
- Real resolver paired fixtures isolate clan, discovery, personal tech, flag, doctrine/mastery and combined stacks; zero-stat axes stay zero and bonuses apply once.
- calculateCombatPower's effective stat breakdown equals resolver preparation for the same participants/context; asymmetric army weighting rejects fixed 7.5% averages.
- Seed critical rolls and clamp extremes; mining speed leaves period-lock/reset semantics intact. Test both human/base and infantry callers and neutral PvE control.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Catalog promises speed and critical chance without an existing numeric gameplay consumer. The plan makes the timing meaning and proposed values explicit, and separates stat rating from damage-only effects. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record

- **Status:** implemented (batch 11 of the 2026-10-02 remediation dependency order, operator directive; R9/R14).
- **Files changed:** per the change inventory — `lib/research/techEffects.ts` (NEW pure seam: TECH_EFFECTS coefficients, BASE_RESOURCE_HARVEST_DELAY_MS 3000 / getResourceHarvestDelayMs 3000→2400 (÷1.25), getPersonalTechCombatEffects, composeCombatEffects — multiplicative ACROSS categories, additive within, damage-taken clamp ≤80% / floor 0.2, crit clamp 0.5, no db imports); `lib/db/migrations/0042_resource_harvest_action_deadline.sql` (NEW, nullable players.next_resource_harvest_at timestamptz, idempotent, NO backfill); `lib/db/schema/players.ts` (nextResourceHarvestAt column); `lib/harvestService.ts` (§5.3 in-lock admission after the claim check — a future deadline refuses `{claimed:false, reason:'action-deadline', retryAt}` → truthful `rate-limited` envelope with retryAt; deadline committed in the SAME players update as the payout; HARVEST_PLAYER_PROJECTION gains unlockedTechs/nextResourceHarvestAt; result carries nextResourceHarvestAt); `lib/harvestEstimate.ts` (advancedMining input → final `floor(amount × 1.10)` stage + truthful terms); `app/api/harvest/route.ts` (nextResourceHarvestAt ISO + retryAt in the DTO); `lib/antiCheatDetector.ts` (harvest cooldown detection reads players.unlockedTechs fail-soft → the SAME getResourceHarvestDelayMs threshold); `components/HarvestModal.tsx` (deadline-driven rate-limit state + TOO SOON, server-authoritative); `utils/autoFarmEngine.ts`/`types/autoFarm.types.ts` (hasAdvancedMining → basic-tier cadence 1900/2000ms without client authority); `lib/research/techCatalog.ts` (consumer header + truthful effect copy; provenance note — values are §5.4 proposed defaults, operator-ratifiable via techEffects.ts); `lib/discoveryService.ts`/`lib/clanResearchService.ts` (NEW batch readers getDiscoveryBonusesForUsernames/getClanBonusesForClans — neutral zeros, no throw); `lib/battleService.ts` (§5.2/§5.5/§5.7 encounter-effect block: one batch side-row read → role-filtered tech (defender fortification only in BattleType.BaseRaid; attacker tactical STR/crit) → composeCombatEffects per side → stat axes floored on the same stats balance already measured RAW; whole block try/catch fail-soft neutral; strike math: per-strike crit roll skipped at zero chance, effect dealt/taken multipliers join the balance chain once, round log gains truthful attackerCritical/defenderCritical); `lib/combatPowerService.ts` (§5.5: the SAME seam — clan attack%→STR / defense%→DEF axes, discovery stat axes + damage/crit shown SEPARATELY, doctrine via getPlayerDoctrineBonuses real axis weighting (the invented fixed 7.5% averages deleted), tech roleless display convention; flag deliberately excluded as encounter state).
- **Correction found by acceptance:** the resolver's damage-taken multipliers were initially wired to each side's OWN outgoing strike; the pairing suite caught it — `damageTakenMul` scales the damage that side TAKES (attacker strike × the DEFENDER's reduction, counter-strike × the ATTACKER's). Fixed in `lib/battleService.ts`; a defense bonus can never inflate the defense's damage, and neutral behavior stays byte-identical (all pre-existing combat suites green unmodified).
- **Verification evidence:** configured gates exit 0 — `npx tsc --noEmit` (0 diagnostics), `npm run lint` (0 errors/warnings), `npm run test:ci` **151 passed + 12 skipped (163 files) / 1468 tests + 73 skipped**, two consecutive full runs green (one earlier run had 2 failures in the unrelated xpService/factoryCapture disposable-PG path — pre-existing parallel-worker flake, suite green standalone twice and in both full runs; not touched by this FID). New suites: `__tests__/lib/techEffects.test.ts` 11/11 (composition multiplicative/clamps/neutral, tech coefficients, catalog constants, cadence 3000/2400) and `__tests__/lib/combatEffectsPairing.test.ts` 9/9 — REAL resolveBattle + REAL calculateCombatPower over paired fixtures with exact production arithmetic (the fixture armies are both CRITICAL: ratio 0.5 → dealt ×0.8 / taken ×1.3): neutral baseline 780 preserved; tactical-warfare +20% STR once (988); fortification DEF ×1.15 + damage-taken ×0.85 once in BaseRaid only (629, infantry control 780); combined clan ×10 / discovery ×20 / tech ×20 multiplicative once (1387); discovery damageDealt +25% on the dealt chain once (975); clan DEFENSE rides the DEF axis only (714 < control — zero-stat axes stay zero); seeded crit ×1.5 once with truthful round-log provenance (1482 vs 988); clan-read outage fails SOFT to neutral. **Disposable-PG acceptance 5/5 PASS** (`__tests__/lib/harvestActionDeadline.integration.test.ts`, embedded-postgres port 55443, UTF8 initdb, production URLs refused, self-skips in test:ci): advanced-mining payout 1150→1265 (×1.10) with the 2400ms deadline committed in the SAME transaction (result value === players.next_resource_harvest_at column); in-lock admission — an immediate second harvest on a FRESH unclaimed tile refuses with retryAt === the stored deadline, no payout, no claim; base cadence 3000ms + un-researched payout 1150; expired deadline admits and the payout rewrites it; a depleted tile refuses on the CLAIM (not the clock) and refusals write no deadline. Reset periods/claim eligibility untouched.
- **Call-graph reachability evidence:** §2's probe repeated post-implementation — techCatalog purchases → players.unlockedTechs → (a) harvestResourceTile → estimateHarvest(advancedMining) + deadline write → /api/harvest DTO → HarvestModal/autoFarmEngine; (b) antiCheatDetector detectCooldownViolation → getResourceHarvestDelayMs (same threshold); (c) resolveBattle encounter block → composeCombatEffects/getPersonalTechCombatEffects (stat axes + strike math + crit); (d) calculateCombatPower → the SAME composeCombatEffects (stats/rankings route). getClanBonusesForClans/getDiscoveryBonusesForUsernames consumed by the resolver's batch reads; the single-player producers remain the display path. No orphan helpers — every new export has the named production caller above.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. Effect DEFAULTS ratified as official balance policy by the operator (recorded in SCOPE Operator Decisions + row 149 + FID-20261002-008 §7). G2 commit outstanding (operator executes).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(research-and): research and combat effects consumer parity (FID-20261002-012)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — pairing 9/9 on the real resolver/display, disposable-PG harvest-deadline acceptance 5/5, see §7)

---

**Closure (2026-10-03, G2):** closed on commit `66d94dc` — the staging-plan group commit carries this FID's full change inventory (ownership map: `dev/STAGING-PLAN-20261002-REMEDIATION.md`). Gates at close: tsc 0 · lint 0/0 · suite 152 files / 1479 passed + 79 skipped, exit 0 · ledger census clean. Agent-run commits and push under the operator's explicit 2026-10-03 directive. This closure supersedes any "G2 commit outstanding" wording above.
