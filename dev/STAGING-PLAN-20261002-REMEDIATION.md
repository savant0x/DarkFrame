# STAGING PLAN — 2026-10-02 Remediation (FIDs 002–013): logical-atomic commit groups

**Created:** 2026-10-03 (post-implementation, pre-G2)
**Method:** every path below is attributed from that FID's own §7 "Files changed" record plus the verified working tree (`git status` at plan time); commit messages are the FIDs' §8 house messages VERBATIM. **No git command is executed by the agent** — the operator runs each `git add` + `git commit` (G2). Shared-file ownership is decided by CONTENT (batch notes below), not by the file list.
**Suggested order:** dependency order = commit order (002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → bookkeeping), so each commit is a working tree whose gates were green at its batch.
**Verification rhythm:** `npx tsc --noEmit` between groups is cheap and safe; `npm run test:ci` + `node scripts/ledgerIntegrityCensus.cjs` after the bookkeeping commit (the census expects final ledger state).

## 1 — `fix(atomic-economy): atomic economy and operation boundaries (FID-20261002-002)`

```
git add lib/db/treasuryLock.ts lib/researchPointService.ts lib/xpService.ts lib/clanResearchService.ts lib/factoryService.ts app/api/research/route.ts lib/wmd/researchService.ts __tests__/lib/rpDailyCap.test.ts __tests__/api/research/rp-unlock.test.ts __tests__/api/research/catalog-contract.test.ts __tests__/lib/economyTransactions.integration.test.ts
```
Notes: foundational lock/retry primitives (`withTransactionRetry`, `lockPlayerRow`, `lockClanRow`) — everything later composes them. `lib/factoryService.ts` carries BOTH the 002 collect-income transaction AND later 004/011 work: if staging strictly by content, commit only the `collectAllFactoryIncome` hunk here (`git add -p`); if that is too fine-grained, the pragmatic alternative is committing `lib/factoryService.ts` whole in group 11 and leaving group 1 without it — the remaining 002 files compile and pass independently (their mocks are per-file).

## 2 — `fix(human-base): human base raid integrity and admission (FID-20261002-003)`

```
git add lib/playerProtection.ts app/api/combat/attack/route.ts
```
Notes: `lib/battleService.ts` is in 003's inventory (`applyDefenderCasualtiesWithFloorTx`) but is SHARED by 003/004/012/013 — commit it once, whole, with group 12 or 13 (the final state contains every FID's additions; per-FID splits would require hunk surgery across four entangled refactors). `__tests__/api/combat/humanRaidAdmission.integration.test.ts` (NEW, includes the batch-12 harness DDL fix) also belongs here conceptually, but its `next_resource_harvest_at` column line postdates batch 11 — commit it with group 12 to keep its file content self-consistent, or accept the one-line anachronism in group 3 (harness DDL, zero runtime effect). Operator's call.

## 3 — `fix(canonical-unit): canonical unit procurement and tier enforcement (FID-20261002-004)`

```
git add lib/migrations/armyIdentityResync.ts types/units.types.ts app/game/unit-factory/page.tsx __tests__/lib/factoryCaptureVoid.test.ts __tests__/lib/factoryCurves.test.ts __tests__/lib/headerTruthPins.test.ts __tests__/lib/armyIdentityResync.test.ts
```
Notes: 004's roster catalog is DERIVED (`types/game.types.ts` UNIT_CONFIGS) — the 004-attributed `types/game.types.ts` content is inside the shared file; it rides group 12/13 with battleService. `lib/armyService.ts` (NEW, shared 004/005/006 reducer) and `app/api/factory/build-unit/route.ts` + `app/api/player/build-unit/route.ts` (004 and 011 both) commit with their LATER owners (4/5 and 10). `headerTruthPins.test.ts` is the standing balanceService parity pin (unaffected by 013's docblock-only edit) — safe here. **004's §7 also names `lib/tierUnlockService.ts` — byte-identical in the final tree (no diff): nothing to stage.**

## 4 — `fix(auction-instance): auction instance escrow and clan authorization (FID-20261002-005)`

```
git add lib/auctionService.ts lib/validation/schemas.ts types/auction.types.ts app/api/auction/list/route.ts app/api/auction/my-bids/route.ts app/api/auction/my-listings/route.ts components/AuctionListingCard.tsx components/CreateListingModal.tsx __tests__/lib/auctionSettlement.test.ts __tests__/lib/auctionEscrow.integration.test.ts __tests__/api/auctionUnitListingHonesty.test.ts
```
Notes: `lib/armyService.ts` — commit its `calculatePlayerUnitStats` shared-reducer content here or in group 5; whole-file is fine (its consumers in 004/006/012 exist by group 12 anyway). `app/api/auction/my-bids/route.ts` and `app/api/auction/my-listings/route.ts` were touched after 005's record was written (tree shows them modified; same listing/bid surface) — the plan attributes them here with the listing-honesty pin.

## 5 — `fix(wmd-representation): wmd representation independent army losses (FID-20261002-006)`

```
git add lib/migrations/armyIdentityResync.ts
```
Notes: 006's own inventory names the resync migration (`lib/migrations/armyIdentityResync.ts`, shared with 004's record) + `lib/wmd/jobs/missileTracker.ts` (shared with 007). The migration+test pair commits whole with group 3 (004's owner); group 5 then carries only the WMD-side files. `lib/wmd/jobs/missileTracker.ts` rides group 6 (its 007 battery-cooldown content is the later, larger change).

## 6 — `fix(defense-battery): defense battery cooldown lifecycle (FID-20261002-007)`

```
git add lib/db/migrations/0041_battery_cooldown_until.sql lib/db/schema/wmd.ts lib/wmd/defenseService.ts lib/wmd/jobs/defenseRepairCompleter.ts lib/wmd/jobs/missileTracker.ts components/WMDDefensePanel.tsx __tests__/lib/wmdBatteryCooldownLifecycle.integration.test.ts
```
Notes: migration 0041 is idempotent/nullable — committing it before any consumer code ran is already the shipped tree state; no data migration needed.

## 7 — `fix(sabotage-target): sabotage target effects and truthful results (FID-20261002-008)`

```
git add lib/wmd/sabotageTargets.ts lib/wmd/spyService.ts types/wmd/intelligence.types.ts components/WMDIntelligencePanel.tsx __tests__/api/sabotageTargets.test.ts __tests__/lib/spySabotageProtection.test.ts __tests__/lib/wmdMissileArmyLosses.test.ts __tests__/lib/wmdMissileArmyDamage.integration.test.ts __tests__/lib/wmdSabotageTruthful.integration.test.ts
```
Notes: the two missile suites were authored against the 006 representation change — they could equally open group 5; if the operator wants 006 fully self-contained, move `wmdMissileArmyLosses.test.ts` + `wmdMissileArmyDamage.integration.test.ts` to group 5.

## 8 — `fix(summoned-bot): summoned bot placement and tile ownership (FID-20261002-009)`

```
git add lib/botSummoningService.ts lib/botService.ts app/api/bot-summoning/route.ts __tests__/lib/botSummonPlacement.integration.test.ts __tests__/lib/botMagnetBeaconIdentifiers.integration.test.ts
```
Notes: `lib/botService.ts` is shared 009/010 — whole-file with group 8 is correct (010's beacon content is additive). The bot-magnet suite could live in group 9 instead; listed here because its harness pattern was established by 009's.

## 9 — `fix(bot-magnet): bot magnet bounded beacon identifiers (FID-20261002-010)`

```
git add lib/botMagnetService.ts
```

## 10 — `fix(harvest-balance): harvest balance and factory regeneration parity (FID-20261002-011)`

```
git add lib/harvestService.ts lib/slotRegenService.ts lib/jobs/factorySlotRegeneration.ts app/api/factory/build-unit/route.ts app/api/factory/list/route.ts app/api/factory/status/route.ts app/api/player/build-unit/route.ts __tests__/api/clusterB2PgRewrites.test.ts __tests__/api/factory/build-unit-units-shape.test.ts __tests__/api/factory/buildUnitBearerGate.test.ts __tests__/api/slice5FactoryAndRanking.test.ts __tests__/lib/factoryProduceCanonical.integration.test.ts __tests__/lib/factorySlotRegeneration.integration.test.ts __tests__/lib/harvestEstimate.test.ts __tests__/api/player/build-unit-contract.test.ts
```
Notes: `__tests__/api/player/build-unit-contract.test.ts` (NEW untracked, inside `__tests__/api/player/`) pins the shared player build-unit route both 004 and 011 reworked — owned here. **011's §7 record also names `lib/factoryUpgradeService.ts`, `lib/tierUnlockService.ts`, `app/api/factory/abandon/route.ts`, `app/api/factory/release/route.ts` — all four are BYTE-IDENTICAL in the final tree (no diff; their content was absorbed or reverted): nothing to stage for them.** `lib/factoryService.ts` (if not already committed in group 1) commits here whole. `lib/harvestEstimate.ts` carries BOTH 011's parity work AND 012's advanced-mining stage — whole-file with group 11 is pragmatic; strictly, its 012 hunk belongs in group 11's successor. `app/api/harvest/route.ts` + `components/HarvestModal.tsx` are 012-owned (deadline DTO + TOO SOON) — group 11.

## 11 — `fix(research-and): research and combat effects consumer parity (FID-20261002-012)`

```
git add lib/research/techEffects.ts lib/research/techCatalog.ts lib/researchPointService.ts lib/discoveryService.ts lib/clanResearchService.ts lib/db/migrations/0042_resource_harvest_action_deadline.sql lib/db/schema/players.ts lib/harvestEstimate.ts lib/harvestService.ts app/api/harvest/route.ts components/HarvestModal.tsx lib/antiCheatDetector.ts utils/autoFarmEngine.ts types/autoFarm.types.ts lib/combatPowerService.ts lib/battleService.ts __tests__/lib/techEffects.test.ts __tests__/lib/combatEffectsPairing.test.ts __tests__/lib/harvestActionDeadline.integration.test.ts __tests__/api/combat/humanRaidAdmission.integration.test.ts package.json package-lock.json
```
Notes: migration `0042_resource_harvest_action_deadline.sql` (NEW) + the `next_resource_harvest_at` column in `lib/db/schema/players.ts` are 012's schema pair — committed together. **`lib/battleService.ts` commits HERE whole** (003+004+012+013 additions in one file — the operator may instead defer it to group 12 to keep 012's commit combat-light; either compiles). `lib/combatPowerService.ts` is 012's rewrite. `embedded-postgres` in package.json/lock came in with the batch-2 harness. `types/game.types.ts` (survivorCount + prior FID type work) rides group 12.

## 12 — `fix(combat-attrition): combat attrition terminal outcomes and army roles (FID-20261002-013)`

```
git add lib/battleService.ts lib/balanceService.ts types/game.types.ts docs/design/BASE_RAID_BALANCE.md docs/design/PVP_BASE_RAID_DESIGN.md scripts/simulateCombatRoles.ts __tests__/lib/battleResolution.test.ts __tests__/api/combat/combatAttrition.integration.test.ts
```
Notes: if battleService was deferred from group 11, it lands here (its final content includes all four FIDs' changes). `scripts/simulateCombatTiers.ts` is untouched by 013 — nothing to stage.

## 13 — bookkeeping (ledger/docs) — house message pattern `docs(ledger): …`

```
git add SCOPE.md dev/STAGING-PLAN-20261002-REMEDIATION.md dev/fids/FID-20261002-001-project-balance-and-feature-review.md dev/fids/FID-20261002-002-atomic-economy-and-operation-boundaries.md dev/fids/FID-20261002-003-human-base-raid-integrity-and-admission.md dev/fids/FID-20261002-004-canonical-unit-procurement-and-tier-enforcement.md dev/fids/FID-20261002-005-auction-instance-escrow-and-clan-authorization.md dev/fids/FID-20261002-006-wmd-representation-independent-army-losses.md dev/fids/FID-20261002-007-defense-battery-cooldown-lifecycle.md dev/fids/FID-20261002-008-sabotage-target-effects-and-truthful-results.md dev/fids/FID-20261002-009-summoned-bot-placement-and-tile-ownership.md dev/fids/FID-20261002-010-bot-magnet-bounded-beacon-identifiers.md dev/fids/FID-20261002-011-harvest-balance-and-factory-regeneration-parity.md dev/fids/FID-20261002-012-research-and-combat-effects-consumer-parity.md dev/fids/FID-20261002-013-combat-attrition-terminal-outcomes-and-army-roles.md dev/audits/ dev/session-summaries/SESSION-2026-10-02-001.md dev/session-summaries/SESSION-2026-10-02-002.md dev/session-summaries/SESSION-2026-10-02-003.md
```
Notes: `dev/audits/` bundles the review + remediation docs + evidence JSON + audit script (PROJECT-REVIEW-2026-10-02*). If the operator prefers ledger-docs inside each FID's commit, split group 13 by FID accordingly — census is order-insensitive for unarchived rows. Each FID closure (status → closed + archival) then follows the established G2 flow with CHANGELOG/VERSION bumps.

## Post-commit verification (operator)

1. `npx tsc --noEmit` after each code group (cheap).
2. `npm run test:ci` after group 12 and again after group 13 — expect **151 passed + 12 skipped (163 files) / 1475 tests + 73 skipped**, exit 0.
3. Disposable-PG acceptance after group 12: `ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/api/combat/humanRaidAdmission.integration.test.ts __tests__/api/combat/combatAttrition.integration.test.ts` — expect **7/7 + 5/5**.
4. `node scripts/ledgerIntegrityCensus.cjs` after group 13 — expect `ledger census clean`, exit 0.
5. Working tree must end CLEAN: `git status --short` empty (every modified/untracked path above is claimed; anything left over is plan drift — report it, don't sweep it in).

## Known shared-file ownership decisions (summary)

| File | Groups | Decision |
| --- | --- | --- |
| `lib/battleService.ts` | 003/004/012/013 | whole-file with 012 or 013 (final content spans all four) |
| `lib/factoryService.ts` | 002/004/011 | 002 hunk via `git add -p`, or whole-file with 011 |
| `lib/armyService.ts` / `lib/migrations/armyIdentityResync.ts` | 004/005/006 | armyService whole-file with 005; resync migration + its test with 003 (004) |
| `lib/harvestEstimate.ts` | 011/012 | whole-file with 011 (012's hunk is additive) or with 012 |
| `lib/botService.ts` | 009/010 | whole-file with 009 |
| `lib/wmd/jobs/missileTracker.ts` | 006/007 | whole-file with 007 |
| `types/game.types.ts` | 004/012/013 | whole-file with 013 (or 012 if battleService lands there) |
| `package.json` / `package-lock.json` | 002 (devDependency) | with 011's harness commit or group 11 |
| `__tests__/lib/factoryCaptureVoid.test.ts` | 004 / 2026-10-03-001 | whole-file moves to addendum group 14 (its final content carries both the 004-era pins and the FID-20261003-001 mock fix — remove it from group 3's `git add`) |
| `__tests__/lib/spySabotageProtection.test.ts` | 008 / 2026-10-03-001 | whole-file moves to addendum group 14 (the batch-8-era mock extensions + the FID-20261003-001 mock re-point; remove it from group 7's `git add`) |
| `types/game.types.ts` (2026-10-03 hunk: `AttackResult.battle?`) | 013 / 2026-10-03-002 | rides group 12 whole (one commit earlier than its FID) or moves to addendum group 15 — operator's call; whole-file, once |

---

# 2026-10-03 ADDENDUM — session 2026-10-03-001 (groups 14–16)

**Created:** 2026-10-03, second session of the day. Covers the flake FID, the UI attrition surfacing, and the 2026-10-03 bookkeeping. The attrition acceptance suite (`__tests__/api/combat/combatAttrition.integration.test.ts`, now 6/6) already rides group 12 unchanged. **Execution order becomes: 1–12 → 14 → 15 → 13** (the ledger commit stays last so SCOPE.md, the FID-013 §7 amendment and this addendum carry their final content when they land).

## 14 — `test(factory): re-point dead relative vi.mocks — real xpService ran on capture-roll success (FID-20261003-001)`

```
git add __tests__/lib/factoryCaptureVoid.test.ts __tests__/lib/spySabotageProtection.test.ts dev/fids/FID-20261003-001-factory-capture-void-dead-mocks.md
```

Notes: the three `vi.mock('./…')` factories resolved against the TEST file's directory (nonexistent `__tests__/lib/*` modules) — silently dead; the real `lib/xpService` ran on capture-roll success (~11%) and `lockPlayerRow` threw "Player not found: attacker" against the transaction mock's empty locked read. The batch-11/12 "disposable-PG flake" attributions in rows 151/152 are corrected by SCOPE row 154. Test-only; 10/10 consecutive standalone runs (baseline 8/10). **Group 3's `git add` loses `factoryCaptureVoid.test.ts` and group 7's loses `spySabotageProtection.test.ts`** (both move here whole — their final content carries the earlier-era pins plus this fix). The spy suite's two dead mocks were the second instance of the class, fixed on the operator's "fix it" (SCOPE row 158).

## 15 — `feat(combat): surface attrition truth in live battle UIs (FID-20261003-002)`

```
git add app/game/page.tsx components/TileRenderer.tsx components/BeerBasePanel.tsx lib/battleNotification.ts lib/battleReportParser.ts __tests__/lib/battleReportParser.test.ts __tests__/lib/baseRaidFidelity.test.ts components/TileRenderer.attrition.test.tsx dev/fids/FID-20261003-002-ui-attrition-surfacing.md
```

Notes: presentation only — the raid route already shipped the full log. `types/game.types.ts` (the `AttackResult.battle?` hunk) rides group 12 per the ownership table, or here if the operator prefers FID-aligned commits — whole-file, once, never both. `components/TileRenderer.attrition.test.tsx` is NEW. The survivors bullet + ℹ️ notes line in `lib/battleNotification.ts` flow through the parser's existing rules (no parser/card edits; `lib/battleReportParser.ts` gains only the shared client-safe display helpers `survivorCountOf`/`roundLossSummary`).

## 16 — bookkeeping 2026-10-03 — `docs(ledger): session 2026-10-03-001 — flake FID, attrition acceptance merge, UI attrition, PvE ratification (FID-20261003-001,FID-20261003-002)`

```
git add dev/session-summaries/SESSION-2026-10-03-001.md
```

Notes: `SCOPE.md` (rows 153–158 + the session section), `dev/fids/FID-20261002-013-*.md`'s amended §7, and this addendum already ride **group 13's** `git add` — which is why group 13 executes LAST. Row 153 is the PvE-pacing ratification (operator "it's fine"); row 158 is the new `[OPEN-OUT-OF-SCOPE]` (dead relative mocks in `spySabotageProtection.test.ts`, awaiting operator decision).
