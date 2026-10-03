# FID-20261002-013: Combat Attrition Terminal Outcomes and Army Roles

**Filename:** `FID-20261002-013-combat-attrition-terminal-outcomes-and-army-roles.md`
**ID:** FID-20261002-013
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Resolver firepower never declines after casualties, independently floored round casualties lose damage carry, forced wipe counts disappear from rounds, and round-100 kills award defender wins. Pure STR dominates the reviewed equal-cost matrix.

**Review coverage:** R6, R7, R10. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R6 | `lib/battleService.ts:247; :331; :410; :477` | Actual first-round five-of-ten attacker loss leaves second strike at 520; defender killed on round100 returns DEFENDER_WIN with attacker HP511. |
| R7 | `dev/audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json` | 98 actual resolver fights: pure STR wins all seven sampled defenders in infantry and base; versus 50/50 it loses 22%/0% compared with mixed attacker losses 100%/96%. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Live infantry and unified base routes → resolveBattle → persisted round/participant report → applyBattleResults or attacker/defender casualty helpers. Bot and human raids share BattleType.Base, so scope cannot be inferred from battleType alone.

**Exact source/caller probe:**

```powershell
rg -n 'resolveBattle|applyBattleResults|applyAttackerCasualties|applyDefenderCasualtiesWithFloor' lib/battleService.ts app/api/combat/attack/route.ts app/api/combat/infantry/route.ts; rg -n 'calculateBalanceEffects|powerMultiplier' lib/battleService.ts lib/balanceService.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Every resolved battle, casualty reports and PvE raid profit. This is a concrete proposed design, not a proven balance repair; rollout requires ratification and measured acceptance. Existing defender floor/period/progression prices stay intact.

**Dependencies and ownership:** 003/004/005/006/011 integrity corrections precede trusting balance measurement; 012 shared effect composition precedes the final combined sweep. No price or tier-stat changes in this plan.

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

1. Fix outcome precedence independently: if a participant reaches zero HP on round100, resolve that terminal outcome before applying the surviving-both round-cap repel. Preserve the sequential no-dead-defender-counter rule, the empty-input draw guard and the live-live 100-round defender hold.

2. Propose persistent per-copy HP initialized to raw strength+defense (existing zero-power floor retained), with one seeded battle-order permutation and carried partial damage. Allocate clamped strike damage through this order, remove a copy only when its own HP reaches zero, and preserve survivor HP into the next strike. Equivalent stack partitions expand to the same canonical copies.

3. Recompute each side's STR/DEF from living copies before every strike; use the 012 frozen effect snapshot to transform those stats. Resolve attacker strike, apply defender losses, then let only surviving defenders counter with updated stats. Balance status is fixed from initial raw composition for the encounter, avoiding band oscillation from casualty identity.

4. Record all casualties, including last-hit exhaustion, in that round. Require per-round loss sums=participant losses and initial copies=survivors+casualties. Expose survivor count/HP consistently; post-battle raid casualty-floor persistence is a separate saved-army rule and is labeled distinctly in the log.

5. Propose applying existing balance powerMultiplier to effective STR/DEF once for human infantry and human base encounters, alongside each existing dealt/taken modifier once. This consumes the advertised critical power penalty instead of displaying a penalty that resolution ignores. Add a trusted server-derived human-combat context to ResolveBattleOptions, supplied at both live route/service seams after defender identity checks; never accept it from client JSON.

6. Keep bot reinforcement/loot/cadence policies intact and do not apply the new human-role multiplier to PvE. Attrition is a shared mechanics change and may alter PvE pacing; quantify that effect, then ratify any necessary PvE-specific tuning as part of this FID's implementation review rather than claiming byte-identical results.

7. Run deterministic candidate simulations first in scratch using the same production pipeline boundaries; then test the implemented real resolver. Sweep equal-resource and equal-slot armies across T1–T5, 0/49/50/53/55/60/100% STR, both orderings, doctrines/mastery, effects, level gaps and uneven sizes. Record casualty replacement value, wins, rounds and resource profit, not only count.

8. Acceptance for human role repair: pure STR must not dominate all sampled equal-cost mixed compositions on both win rate and casualty replacement cost; retain a meaningful offensive role and DEF's defensive role. Preserve stronger-army monotonicity within matched-role controls and ensure bounded fights. Ratification of this attrition/model proposal is required with implementation approval; simulation results may require a further document loop before rollout.

**Source-audit correction:** Combat copies are conceptual: implement carried damage with compressed ordered stack segments, splitting only the damaged frontier. Do not allocate one object per deployed unit. Validate bounded safe integral quantities and finite nonnegative stats before resolve; complexity follows stack segments and <=100 rounds. Candidate-policy simulations remain implementation acceptance evidence, not a claim these plans already prove balance.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/battleService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/game.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/balanceService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/combat/attack/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/combat/infantry/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `docs/design/PVP_BASE_RAID_DESIGN.md` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `docs/design/BASE_RAID_BALANCE.md` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Actual resolver round99/100 terminal kills, live-live cap, empty armies and no post-mortem counter; round sum/ownership invariants hold.
- Two 600-HP copies receiving 500+500 damage lose a copy on cumulative exhaustion, carrying 400 damage to the next; subsequent strikes use living stats.
- Heterogeneous/zero-stat/corrupt inputs, split/merged stacks and seeded casualty order cannot create negative HP, duplicate losses, hidden wipe casualties or NaN.
- Full equal-cost/tier/doctrine/effects/casualty-value matrix establishes the acceptance conditions; PvE tier/profit baselines are compared explicitly after shared attrition changes.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | A count-based casualty floor cannot model mixed per-copy HP, and refreshed stats without partial damage carry still leave phantom firepower. Human context must distinguish real targets from bot base raids sharing the same enum. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record

- **Status:** implemented (batch 12 of the 2026-10-02 remediation dependency order, operator directive — the FINAL FID of the order; R6/R7/R10).
- **Files changed:** per the change inventory — `lib/battleService.ts` (the attrition engine: `sanitizeStat` input sanitation (NaN/negatives → 0, 1e9 ceiling; zero-power 10 HP floor kept) + `buildArmyStack` (ONE seeded Fisher-Yates battle-order permutation per side, compressed into `ArmySegment` runs — only the damaged frontier copy splits; equivalent stack partitions expand to the same canonical copies) + `stackHP`/`stackCombatStats` (pool and firepower from LIVING copies) + `absorbDamage` (front-to-back absorption; a copy dies only when its OWN HP reaches zero — cumulative exhaustion; partial damage carries; overkill discarded; pool re-derived so a wipe is EXACTLY zero — a float-drift bug caught by the stalemate pin was fixed this way) + `applyStatSteps` (the frozen flag→doctrine→012-effect stat-axis pipeline re-applied to living stats before every strike; each step floors, application order recorded) + terminal-outcome precedence at the round-100 cap (a zero-HP resolves BEFORE the surviving-both repel; live-live standoffs remain repelled) + per-round truthful deaths (last-hit exhaustion in the dealing round; per-round sums = participant totals; no hidden wipe casualties) + `survivorCount` on both log participants + `humanCombat` application (frozen `powerMultiplier` on effective STR/DEF ONCE per human side) + `executeInfantryAttack` derives the trusted context SERVER-side from the players rows (both sides human) — never client JSON); `types/game.types.ts` (`BattleParticipant.survivorCount?` — conservation exposure: initial copies = survivors + casualties); `lib/balanceService.ts` (`powerMultiplier` docblock: no longer display-only for human encounters); `app/api/combat/attack/route.ts` (human branch passes `humanCombat` AFTER the hostility/protection/bearer gates and only when `!isBotDefender`; the saved-army floor is labeled distinctly in `battleLog.notes` — "Saved-army floor: N battle casualties capped to M persisted (25% pool floor)" — battle truth vs saved-army rule); `docs/design/BASE_RAID_BALANCE.md` (combat-math section rewritten for the attrition model + NEW 013 addendum: PvE pacing comparison, tuning lever, human-context sweep result); `docs/design/PVP_BASE_RAID_DESIGN.md` (013 amendment + NEW §4.1.5: the human-role power band executes in PvP, knob = the balance-band constants, PvE pays none of it). **Inventory deviation recorded:** `app/api/combat/infantry/route.ts` was NOT modified — its contract is unchanged; the §5.5 context is derived inside `executeInfantryAttack` from the authenticated players rows (a stronger server-side derivation than route-side wiring; the route supplies no client authority into it). `executeBaseAttack` was NOT wired: a grep census shows ZERO production callers (only its own definition) — modifying a dead seam would create an unreachable consumer; documented here instead. **NEW file added to the inventory per §5's rule:** `scripts/simulateCombatRoles.ts` — the deterministic role-dominance sweep (per-fight seeded mulberry32 PRNG swapped in for Math.random; REAL `resolveBattle`, applyCasualties:false; equal-RESOURCE 490 + equal-SLOT 14 + level-gap 7 + uneven-size 28 + cross-tier 20 = 559 fights + monotonicity control; exact STAT shares 0/49/50/53/55/60/100% from the tier's best pure-STR/pure-DEF units at equal budget). It is acceptance-evidence tooling for the operator's review loop (§5.7), not a production runtime consumer.
- **Verification evidence:** configured gates exit 0 — `npx tsc --noEmit` (0 diagnostics), `npm run lint` (0 errors/warnings), `npm run test:ci` **151 passed + 12 skipped (163 files) / 1475 tests + 73 skipped**, two green full runs (one intermediate run hit the PRE-EXISTING `factoryCaptureVoid` disposable-PG parallel-worker flake — "Player not found: attacker" via `lockPlayerRow`/treasuryLock; the suite is untouched by 013, flakes identically standalone and at HEAD, and is green in both full runs). Acceptance pins: `battleResolution.test.ts` re-pinned on the new engine (66 total with 7 NEW attrition pins) — round-99 kill resolves AttackerWin (1 HP survives on the kill round); **round-100 kill resolves AttackerWin** (terminal precedence — the R6 defect returned DefenderWin here); live-live cap still repelled (100 rounds, both survivors); **two 600-HP copies take 500+500: ONE copy dies of cumulative exhaustion carrying 400 to the survivor; subsequent strikes use living stats** (counter 200 → 5 as living DEF halves, recomputed strike 650); corrupt/zero-stat inputs finite (NaN/negatives sanitized, 10 HP floor); split/merged stack partitions resolve identically under the seeded order; humanCombat four-cell table 969 (no ctx) / 449 (attacker ×0.5) / 1004 (defender ×0.5) / 484 (both). The BATTLE-17894 incident replay re-traced EXACTLY: 4 rounds with the counter collapsing 261,210 → 40,805 → floor-5 → 0 as the garrison's living DEF dies; the raid pays 408 ≈ 3.8% (the living-stats truth vs the old pool model's 7,836 ≈ 73%). `combatEffectsPairing.test.ts` 9/9 (crit seeding updated for the permutation draws); `baseRaidFidelity` 19 and `pvpBaseRaid` 21 green UNMODIFIED. **§5.7/§5.8 sweep evidence:** the NEUTRAL (PvE) arm is recorded honestly — first-strike plus living-stats keeps pure-STR dominant among WINNING compositions at equal budget (100% wins; expected attacker cost 127k vs best mixed 1.72M; old-engine baseline 97%/1.27M) while pure-DEF walls kill STR-poor raiders for free; the **HUMAN-CONTEXT arm (the §5.8 human role repair) PASSES**: pure-STR falls to 54% wins (defect was 100%) and no longer dominates BOTH axes (expected cost 2.88M vs best mixed 872k at 49–50% STR, which sweeps 35/35); stronger-army monotonicity control PASS (1.25× budget wins, matched roles); bounded fights PASS (max 100 rounds). **PvE pacing quantified (§5.6):** old-vs-new engine over `scripts/simulateCombatTiers.ts` (21 fixtures) — outcomes 21/21 stable; mature band armies stable (T1-vs-WEAK 75→3% loss, T5-vs-ELITE parity 38→27%); fresh synthesized-garrison friction 15–38% → 0% (the R1 strike kills enough counter-strikers that the LIVING-DEF counter falls below the `attackerSTR/2` knee and floors at 5). Tuning lever recorded in BASE_RAID_BALANCE.md (raise the `GARRISON_STR_RATIO` ladder or give synthesized garrisons per-copy HP via the STR pad); ratification of any PvE retuning is a separate document loop — bot reinforcement/loot/cadence policies are untouched.
- **Call-graph reachability evidence:** §2's probe repeated post-implementation — infantry route → `executeInfantryAttack` → `resolveBattle(humanCombat)` (context derived from the players rows); raid route human branch → `resolveBattle(humanCombat)` after the identity gates; bot raid path → `resolveBattle` with NO context (PvE unchanged by §5.5); `applyDefenderCasualtiesWithFloorTx` → `capDefenderCasualties` with the caller writing the distinct floor label; `HumanCombatContext`'s only consumer is `resolveBattle`; both sim scripts consume the real `resolveBattle` as acceptance evidence. No orphan helpers — every new export (`HumanCombatContext`, `sanitizeStat`, `buildArmyStack`, `stackHP`, `stackCombatStats`, `absorbDamage`, `applyStatSteps`, `survivorCount`) has the named production caller above.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. **Disposable-PG acceptance (batch-12 surface): `__tests__/api/combat/humanRaidAdmission.integration.test.ts` 7/7 PASS** under `ECHO_AUTO_DISPOSABLE_PG=1` — the human-raid route path with the 013 humanCombat wiring, the atomic committed transfer, loot conservation and the period claim verified against real PostgreSQL; the run surfaced a pre-existing fixture gap (the FID-003-era harness's `players` DDL predated migration 0042) repaired by adding the nullable `next_resource_harvest_at timestamptz` column to the harness DDL. The directive constitutes the implementation approval §5.8 requires; ratification of the attrition model's PvE pacing consequences (and any `GARRISON_STR_RATIO` retuning) remains a separate document loop per §5.6. **Post-acceptance additions (operator follow-up, 2026-10-03):** `__tests__/api/combat/combatAttrition.integration.test.ts` (disposable-PG, port 55444, **6/6 PASS** under `ECHO_AUTO_DISPOSABLE_PG=1`) pins the §5.4 invariants through the REAL DB-facing seams — round sums/survivorCount/tallies/HP bounds on a resolved battle over real side rows (no module mocks; the 012 effect seam reads the real players table), `persistBattleLog`→`getPlayerCombatHistory` round-trip, the persisted jsonb conservation identity (stored per-round loss sums = column totals; jsonb units-length − units_lost = survivorCount; final HPs round-trip), terminal-precedence round-100 kill persisted as ATTACKER_WIN/total_rounds=100, the humanCombat band executing on real rows (969→484), and the saved-army floor persisting through a real locked transaction (capped casualties, pool exactly at the 25% floor, DB totals recomputed). *Merge note (2026-10-03 session 2026-10-03-001): the suite was authored by the prior session's post-acceptance pass; the follow-up session verified it 5/5 fresh, ported its jsonb-identity pin in, and deleted its own same-basename/same-port duplicate draft — 6/6 recorded above.* And `dev/STAGING-PLAN-20261002-REMEDIATION.md` stages the twelve FIDs into logical-atomic, path-scoped commit groups (house §8 messages verbatim, shared-file ownership decided by content, cross-checked against `git status` so every tree path is claimed and every named path exists) — the plan documents, it does not execute git; the 2026-10-03 session extended it with the groups 14–16 addendum for that session's work. G2 commit outstanding (operator executes).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(combat-attrition): combat attrition terminal outcomes and army roles (FID-20261002-013)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — 559-fight role sweep with the human-context acceptance PASS, terminal-precedence and attrition pins green on the real resolver, see §7)
