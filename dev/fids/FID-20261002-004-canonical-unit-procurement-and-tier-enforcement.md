# FID-20261002-004: Canonical Unit Procurement and Tier Enforcement

**Filename:** `FID-20261002-004-canonical-unit-procurement-and-tier-enforcement.md`
**ID:** FID-20261002-004
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Two live build routes disagree about blueprint identity, unlocked tiers and slot costs. A level-1 account builds Tier 5; the player route builds a Titan in one slot instead of 30.

**Review coverage:** R3, R4. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R3 | `app/api/factory/build-unit/route.ts:82` | Actual factory route accepts T5_TITAN at level 1 with zero RP and Tier 1 only. |
| R4 | `app/api/player/build-unit/route.ts:316` | Blueprint 'titan' cast to UnitType misses UNIT_CONFIGS and falls back to one slot; actual final-single-slot Titan build succeeds. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** UnitBuildPanelEnhanced.tsx:166 → factory/build-unit; unit-factory/page.tsx:228 → player/build-unit. Both GET availability and POST admission must share the same catalog/unlock rules.

**Exact source/caller probe:**

```powershell
rg -n 'factory/build-unit|player/build-unit' components/UnitBuildPanelEnhanced.tsx app/game/unit-factory/page.tsx; rg -n 'isTierUnlocked|UNIT_CONFIGS|unitType|slotCost|totalStrength|totalDefense' app/api/factory/build-unit/route.ts app/api/player/build-unit/route.ts lib/battleService.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Both build interfaces and the legacy producer, saved army identity and canonical availability. Existing owned units survive normalization; permanent progression and intended 1/3/7/15/30 slot curve are enforced.

**Dependencies and ownership:** 002 provides transactions; 011 provides shared regeneration. Owns canonical blueprint→UnitType mapping and army-total reducer reuse by 005/006; no duplicate reducer elsewhere.

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

1. Reuse existing UNIT_ID_TO_UNIT_TYPE at types/units.types.ts:619. Its values are enum member keys (T5_Titan), not persisted enum values (T5_TITAN): resolve through a typed key guard and UnitType, then UNIT_CONFIGS. Tighten the existing mapping type without a circular runtime import. Validate all 40 standard blueprints and reject unknown identifiers; remove casts and the one-slot fallback.

2. Use existing isTierUnlocked and permanent unlockedTiers in GET availability and both POST paths. Tier 1 stays available; higher tiers require the recorded unlock and canonical level rule. Current RP balance is not a substitute for a purchased permanent unlock. Preserve special/prestige doctrine/level gates where the factory enum permits those units.

3. Share procurement planning across both routes while preserving their request envelopes and single-factory versus distributed-factory behavior. Authenticate ownership, validate positive bounded integral quantity, and compute total cost/slots without overflow from trusted configs.

4. Under the 002 lock order, re-read player and all selected factories, apply 011 regeneration, and verify capacity/balances/unlocks. Commit slot reservations, resource debits, unit ownership/aggregates, investment accounting and build rewards together; failure rolls back the whole batch.

5. Generate a distinct instance id for each PlayerUnit entry (including repeated builds in one millisecond), store blueprint and canonical unitType separately, and preserve stack quantity. Extract existing calculatePlayerUnitStats from battleService:1278 as the common army reducer; sum strength×quantity and defense×quantity without temporary bonuses.

6. Provide an idempotent normalization/recount tool for existing recognized blueprint-shaped unitTypes and duplicate instance IDs. Preserve quantities, stats, investment and factory references; quarantine ambiguous records and require an explicit reconciliation report rather than deleting or guessing. Update both UI availability/slot previews from the same server contract.

**Source-audit correction:** Also audit the live factory/produce → factoryService.produceUnit seam. It stores legacy Unit objects in inventoryItems; canonical-army recount must not erase their power. Move verified produced units into units exactly once by instance ID during normalization, preserving their existing cost contract until separately ratified. Extract the reducer to lib/armyService.ts with battle, procurement, auction and missile callers; bridge verified legacy entries during migration and reject conflicting duplicate IDs.

**Boundary audit:** The shared army reducer is pure and server-used; client catalogs stay browser-safe. Normalization reports conflicts between units and inventoryItems before transfer, then removes only migrated legacy entries in the same transaction. Add producer failure/concurrency and legacy-power preservation tests to the existing factory/battle suites.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `app/api/factory/build-unit/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/player/build-unit/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/units.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/game.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/tierUnlockService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/slotRegenService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `components/UnitBuildPanelEnhanced.tsx` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/game/unit-factory/page.tsx` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/factoryService.ts` | modify | Legacy production transaction and canonical owned-army conversion. |
| `lib/battleService.ts` | modify | Consume extracted quantity-weighted army reducer. |
| `lib/armyService.ts` | add | Shared canonical identity/quantity reducer consumed by 004–006 and battle. |
| `lib/migrations/armyIdentityResync.ts` | add | Explicit dry-run/apply, idempotent legacy normalization with conflict report. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Actual routes: Tier 5 at level 1/Tier 1 only refuses without writes; an already unlocked tier remains buildable after RP drops below its former purchase cost.
- All 40 blueprint mappings match canonical price/stats/slot costs; Titan with one available slot refuses, with 30 succeeds; quantity scales all charges.
- Concurrent builds competing for resources and slots cannot overdraw; injected midway failures leave no partial unit/slot/investment changes.
- Build→auction→WMD→casualty persistence uses the same canonical types and weighted totals; normalization run twice is unchanged, unknown records are reported.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Do not infer enum identity by uppercasing blueprint labels; several names differ. Instance ids must also be unique across the factory route's quantity-stack builds, not just player-route singleton builds. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 3 of the dependency-order implementation directive).
- **Files changed:** `types/units.types.ts` (UNIT_ID_TO_UNIT_TYPE tightened to `Record<string, keyof typeof UnitType>` via a TYPE-ONLY import — no runtime cycle; the mapping's values are now compile-checked to be enum keys, not persisted values — §5.1); `types/game.types.ts` (added the canonical resolution seam: `resolveCanonicalUnitType` accepting blueprint ids / enum keys / persisted values and refusing everything else, `unitConfigForIdentifier`, `UNIT_TYPE_TO_BLUEPRINT` derived from the canonical mapping, `isCoreRosterUnit`, `isTierAdmissible` — the permanent-tier admission rule with SPEC/PRESTIGE exemption — §5.1/§5.2); `lib/armyService.ts` (NEW: the ONE shared army contract — `calculatePlayerUnitStats` quantity-weighted reducer extracted verbatim from battleService's private copy, `newUnitInstanceId` distinct-instance-id minting safe within one millisecond, `canonicalPlayerUnitFromConfig` minting blueprint id + canonical unitType SEPARATELY with stack quantity and provenance — §5.5); `lib/battleService.ts` (private reducer deleted; consumes the shared one — source-audit correction); `app/api/factory/build-unit/route.ts` (server-side tier gate it never had — R3 closed: core-roster requires the permanent unlock re-verified against the LOCKED player row inside the transaction, 403 without writes; canonical minting replaces the timestamp-id stack entry — §5.2/§5.5); `app/api/player/build-unit/route.ts` (R4 closed: the `unitBlueprint.id as UnitType` cast and the `slotCost || 1` fallback are DELETED; identity resolves through the typed guard; unlock checks moved from the stale blueprint.unlockRequirement to the permanent tier system; tier admission re-verified on the LOCKED row in-tx; slot costs canonical — a titan costs 30; GET availability tier-based with the server's lock reason — §5.1–§5.4); `lib/factoryService.ts` (`produceUnit` rewritten: ONE transaction under the 002 lock order with 011 regeneration at the owner multiplier, capacity re-verified on the locked row, relative debits, the produced unit minted through the CANONICAL contract into players.units instead of the legacy inventoryItems blob; legacy 100M/50E cost contract preserved until separately ratified; inventoryItems UNIT entries become migration-only history — source-audit correction); `lib/migrations/armyIdentityResync.ts` (NEW: explicit dry-run/apply identity normalization — recognized legacy identities ('titan', 'T5_Titan') normalized to canonical values preserving quantity/stats/provenance, verified legacy inventoryItems Units moved into units EXACTLY ONCE by instance id, duplicate identical ids merge quantities, conflicting duplicates and unrecognized identities QUARANTINE the player untouched and are reported, totals recounted via the shared reducer, apply idempotent and per-player atomic under the 002 boundary — §5.6); `app/game/unit-factory/page.tsx` (lock hint renders the server's tier-based lockReason instead of the stale purchase price — §5.6). `lib/tierUnlockService.ts` and `lib/slotRegenService.ts` needed no code change (isTierUnlocked/TIER_UNLOCK_REQUIREMENTS and 011's regeneration were consumed as-is; verified). Test mocks updated to locked-row/transaction shapes asserting corrected behavior: `__tests__/lib/factoryCaptureVoid.test.ts`.
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0 (zero findings); `npm run test:ci` **148 files / 1440 tests passed + 24 skipped**, exit 0. **Acceptance criteria satisfied on a REAL disposable PostgreSQL:** `__tests__/lib/factoryProduceCanonical.integration.test.ts` (4/4) — produceUnit writes the canonical owned army (unitType 'T1_RIFLEMAN' + unitId 'rifleman' stored separately, provenance, inventory blob untouched), capacity refusal on the locked regenerated row with no partial writes, concurrent produces both land with distinct instance ids and exactly-composing debits/slots, resources for exactly one produce pay exactly once; `__tests__/lib/armyIdentityResync.test.ts` (4/4) — dry-run reports all corrections and writes NOTHING, apply normalizes identities preserving quantities/stats and moves legacy units exactly once (legacy power preserved, 2×5000+5000+95 = 15095 recount), second apply is a no-op byte-for-byte, conflicting duplicate ids quarantine the player untouched, unrecognized identities are reported never guessed. Unit pins: `__tests__/lib/factoryCurves.test.ts` (+4: all 40 roster ids resolve; all 40 mappings match canonical price/stats/tier AND the 1/3/7/15/30 slot curve with mirrored TIER_UNLOCK_REQUIREMENTS; identity resolution accepts the three legal forms and refuses 'TITAN' and junk; tier admission refuses Tier 5 at level 1/Tier 1 and admits with the recorded unlock at zero RP while SPEC/PRESTIGE are exempt); `__tests__/api/player/build-unit-contract.test.ts` (NEW, 6/6: titan blueprint build charges canonical 30 slots — R4 closed; Tier 5 at level 1 with rich RP refuses without writes — R3 contract; already-unlocked tier buildable at ZERO RP; quantity scales charges with relative SQL totals; GET availability tier-based with the server lock reason; unknown identifiers refuse without writes). The ladder-truth coverage gate (which caught my own new doc comment matching its scanner) re-passed 10/10 after rewording.
- **Implementation-correction found by the probes:** the canonical catalog conversion surfaced that the legacy produceUnit seam hardcoded T1_Rifleman STR=5 while the derived catalog says 95 — the integration test pinned the CORRECT canonical value (95) and the aggregate totals now track the catalog, closing a silent fivefold power undercount on the legacy seam. Also, the ladder-truth scanner initially counted my new `isCoreRosterUnit` doc comment as a 24th documented cell — the gate is real; the comment was reworded rather than the gate weakened.
- **Call-graph reachability evidence:** §2's exact probe repeated post-implementation — `resolveCanonicalUnitType`/`unitConfigForIdentifier` consumed by the player build-unit route (GET + POST) and armyIdentityResync; `isTierAdmissible` by both build routes' admission paths (pre-check + in-lock re-verification); `isCoreRosterUnit` by isTierAdmissible; `calculatePlayerUnitStats` by battleService (its original call sites) and armyIdentityResync; `canonicalPlayerUnitFromConfig`/`newUnitInstanceId` by factory build-unit, player build-unit and produceUnit; `armyIdentityResync` exports (`dryRunArmyIdentityResync`/`applyArmyIdentityResync`) are the operator-facing migration entry points with their behavior-level integration suite. Every new export has named production callers; zero unwired additions.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each. The dry-run/apply migration was NOT executed against live data (no live-data mutation is authorized in this session; the tool is ready with its conflict report).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(canonical-unit): canonical unit procurement and tier enforcement (FID-20261002-004)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes green, see §7; migration tool ready, dry-run required before any live apply)
