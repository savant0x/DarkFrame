# Project Review 2026-10-02 — Remediation Plan

All 19 review findings have one remediation owner across 12 active FIDs. All 12 document Perfection Loops are complete; implementation is not started. [Review](PROJECT-REVIEW-2026-10-02.md) · [original evidence](PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [planning audit](PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md) · [measured snapshots/probes](PROJECT-REVIEW-2026-10-02-REMEDIATION-EVIDENCE.json).

## Complete finding ownership

| Findings | Remediation FID | Document status |
| --- | --- | --- |
| R15 | [FID-002: Atomic Economy and Operation Boundaries](../fids/FID-20261002-002-atomic-economy-and-operation-boundaries.md) | loop-complete |
| R1, R2 | [FID-003: Human Base Raid Integrity and Admission](../fids/FID-20261002-003-human-base-raid-integrity-and-admission.md) | loop-complete |
| R3, R4 | [FID-004: Canonical Unit Procurement and Tier Enforcement](../fids/FID-20261002-004-canonical-unit-procurement-and-tier-enforcement.md) | loop-complete |
| R16, R17 | [FID-005: Auction Instance Escrow and Clan Authorization](../fids/FID-20261002-005-auction-instance-escrow-and-clan-authorization.md) | loop-complete |
| R11 | [FID-006: WMD Representation Independent Army Losses](../fids/FID-20261002-006-wmd-representation-independent-army-losses.md) | loop-complete |
| R13 | [FID-007: Defense Battery Cooldown Lifecycle](../fids/FID-20261002-007-defense-battery-cooldown-lifecycle.md) | loop-complete |
| R12 | [FID-008: Sabotage Target Effects and Truthful Results](../fids/FID-20261002-008-sabotage-target-effects-and-truthful-results.md) | loop-complete |
| R18 | [FID-009: Summoned Bot Placement and Tile Ownership](../fids/FID-20261002-009-summoned-bot-placement-and-tile-ownership.md) | loop-complete |
| R19 | [FID-010: Bot Magnet Bounded Beacon Identifiers](../fids/FID-20261002-010-bot-magnet-bounded-beacon-identifiers.md) | loop-complete |
| R5, R8 | [FID-011: Harvest Balance and Factory Regeneration Parity](../fids/FID-20261002-011-harvest-balance-and-factory-regeneration-parity.md) | loop-complete |
| R9, R14 | [FID-012: Research and Combat Effects Consumer Parity](../fids/FID-20261002-012-research-and-combat-effects-consumer-parity.md) | loop-complete |
| R6, R7, R10 | [FID-013: Combat Attrition Terminal Outcomes and Army Roles](../fids/FID-20261002-013-combat-attrition-terminal-outcomes-and-army-roles.md) | loop-complete |

The original review FID 001 remains analyzed. Review defects stay open until their implementation and closure evidence exists.

## Implementation sequence and shared ownership

1. 002: transaction-aware RP/XP/clan/income foundations. Unify spendRP and spendResearchPoints, including WMD completion effects.
2. 011: harvest projection, relative payout/reset claim and slot regeneration, initially neutral for mining. Then 004: catalog/unlocks, all procurement seams and canonical army identity/reducer. Mining is a later integration input from 012, not a dependency cycle.
3. 003: human raid admission/conservation; 005: auction escrow/clan scope; 006: representation-independent WMD losses. These consume 002 and 004's army contract. 003 can implement guards/transfers independently of the later combat model.
4. 007: battery deadlines and recovery, then 008: sabotage effects. 009: claimed summon placement; 010: bounded beacon insert/admission. They share 002's transaction discipline without owning its RP primitives.
5. 012: purchased tech effects and shared combat composition; integrate mining with 011. 013: terminal outcome/attrition/role proposal, followed by the full combined balance sweep after accounting/ownership is trustworthy.

Lock order: clan IDs, then player usernames, then assets by table/key (factories/tiles by coordinates). Determine the complete participants before locking; revalidate and restart if identity/membership changes. No independent nested/global-db writers. Claims, debit/credit, owned arrays, weighted totals, rewards and terminal records commit together. Notifications run after commit.

| Transaction owner | Live writers/callers to convert | Lock/claim set |
| --- | --- | --- |
| 002 | spendRP/awardRP, xpService.spendResearchPoints/awardXP, clanResearchService, tierUnlockService, personal research, WMD spendRPOnResearch/completion, factory income | Relevant clan, player, research/factory accrual rows; stable source event + unique RP ledger ID |
| 003 | combat/attack guards, protection forfeiture, casualties, loot, rewards, battle log | Both human participants, relevant clans/flag/protection and attacker/defender/period claim |
| 004 | factory/build-unit, player/build-unit, factoryService.produceUnit | Player, complete selected factory set, army and investment/slot claim |
| 005 | create/bid/buyout/cancel/expiry and auctionDocBridge | Auction, seller/bidders/buyer clans and players, exact escrow/settlement claim |
| 006/007 | processDueMissiles damage and both interception paths | Missile, all target/owner players, affected factories and reserved batteries |
| 008 | spyService sabotage and target histories | Operator/victim, spy, actual battery/research/missile target and operation record |
| 009 | summonBots → createBotPlayer → claimBotBaseTile | Summoner/cooldown plus sorted five-tile ownership claims and bot inserts |
| 010 | deployBeacon and researched/cooldown admission | Player and beacon insert; bounded collision retry, truthful failure |
| 011/012 | resource harvest route/service and regeneration job/request paths | Player, tile/period claim, action deadline, affected factories; rewards in same transaction |

Shared additions are consumed through existing live seams: 004's lib/armyService.ts by procurement/battle/auction/missile; 012's pure lib/research/techEffects.ts by harvest, anti-cheat and combat effect composition. Battery cooldownUntil is written by both interception paths/spy disable and read by scheduled/lazy eligibility. nextResourceHarvestAt is written with successful resource harvest and read by route timing/status and clients. The helpers/fields do not exist yet; after implementation, actual imports/invocations and behavior probes are required, and an unwired addition is rejected.

Reserve migration 0041 for battery cooldownUntil and 0042 for the resource-action deadline after current highest 0040. Recheck allocation immediately before implementation; update every reference if another change takes a number. No migration is executed by this session.

## Test and reconciliation inventory

Extend production behavior suites where they exist; add a dedicated missing seam test rather than inventing an existing suite. Database interleavings require a disposable PostgreSQL target, never mocks or live credentials. Test additions are part of each owner's implementation inventory.

| Owner | Existing suites / explicitly planned additions |
| --- | --- |
| 002 | Extend __tests__/api/research/rp-unlock.test.ts; add __tests__/lib/economyTransactions.integration.test.ts for actual RP/XP/clan/WMD/income contention and rollback |
| 003 | Extend __tests__/api/combat/raidLogFidelity.test.ts and defeatBookkeeping.test.ts; add __tests__/api/combat/humanRaidAdmission.integration.test.ts |
| 004 | Extend __tests__/api/factory/build-unit-units-shape.test.ts and buildUnitBearerGate.test.ts; add __tests__/api/player/build-unit-contract.test.ts and __tests__/lib/armyIdentityResync.test.ts |
| 005 | Extend __tests__/api/auctionUnitListingHonesty.test.ts and __tests__/lib/auctionSettlement.test.ts; add __tests__/lib/auctionEscrow.integration.test.ts |
| 006 | Add __tests__/lib/wmdMissileArmyDamage.integration.test.ts through processDueMissiles |
| 007 | Add __tests__/lib/wmdBatteryLifecycle.integration.test.ts through scheduled/lazy and both shot paths |
| 008 | Add __tests__/lib/wmdSabotageEffects.integration.test.ts through executeSabotage |
| 009 | Add __tests__/lib/botSummonPlacement.integration.test.ts through summon/create/claim |
| 010 | Add __tests__/lib/botMagnetDeployment.integration.test.ts through actual deploy/status/update/deactivate |
| 011 | Extend lib/harvestService.test.ts, __tests__/lib/harvestEstimate.test.ts and factoryCurves.test.ts; add __tests__/lib/factorySlotRegeneration.integration.test.ts |
| 012 | Extend __tests__/api/research/catalog-contract.test.ts; add __tests__/lib/techEffectsConsumerParity.test.ts |
| 013 | Extend lib/battleService.test.ts and __tests__/lib/battleResolution.test.ts; add __tests__/lib/combatRoleMatrix.test.ts using the real resolver |

All new integration suites must refuse non-disposable connection targets, seed/clean their own fixtures, coordinate concurrent transactions explicitly and inject persistence failures. Change defect probes to corrected assertions and demonstrate RED against old production behavior. Current passing probes merely reproduce the defects.

004 owns lib/migrations/armyIdentityResync.ts: dry-run and explicit apply, preserving verified legacy inventory-produced units and reporting conflicting identities. 005/006 consume its canonical reducer and perform their own dry-run escrow/aggregate reconciliation. 009 reports mismatched position/tile claims and only repairs evidence-backed one-to-one cases. No historical currency restoration, retroactive WMD casualties or invented missing escrow asset is inferred from current rows.

## Concrete policies awaiting implementation ratification

- 005: whole-instance/whole-stack unit escrow, frozen seller clan scope, existing valid bids retain their admitted eligibility at settlement. Outsider direct reads and purchases fail closed.
- 008: battery sabotage extends the real cooldown; research sabotage destroys bounded active RP progress. Completed technologies remain owned; result fields report actual deltas.
- 012: resource harvesting action cadence uses the existing observed 3000ms base, divided by 1.25 for Advanced Mining; tile reset periods stay unchanged. Proposed Fortification reduction is 15%; Tactical Warfare adds 5 percentage points critical chance with 1.5× strike damage.
- 013: carried per-copy damage and casualty-based firepower, compressed stack representation, initial-composition balance snapshot and existing human powerMultiplier applied once. Equal-cost/slot role simulations and PvE impact measurements are implementation acceptance gates.

These are explicit proposals, not prior operator approvals or proven balance results. Implementation go-ahead must ratify them; rejected or revised policies require another document loop for affected FIDs.

## Completion boundary

This session's deliverables are the FIDs, complete ownership map, measured document loops and verification records. Production fixes, migrations, live-data changes, commits, releases and archival remain future work under the repository's document/implementation separation.
