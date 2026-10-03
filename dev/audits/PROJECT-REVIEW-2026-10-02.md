# DarkFrame project review — 2026-10-02

Scope: full project review, emphasizing game balance, army balance, and broken features. Review only; remediation and tuning require a separate directive. Evidence is collected from the current working files without assuming historical audit claims remain true.

**Result:** 19 findings: 11 High and 8 Medium, including two combat-design concerns. Fix integrity and enforcement gaps before relying on current telemetry for balance tuning. Tracking: `FID-20261002-001` is `analyzed`; no defect is fixed or closed.

**Plan:** 5 observations (estimate). Subject: project behavior, combat balance, economy, and feature integrity.

### Thought 1

The current project declares strict TypeScript, Next.js/React, PostgreSQL/Drizzle, Socket.io, and a Vitest suite. The review uses the project's declared verification commands and its existing production functions where possible.

## Baseline verification

- `npx tsc --noEmit`: exit 0, no diagnostics.
- `npm run lint`: exit 0, no findings.
- First `npm run test:ci`: 147 files; 1,418 passed, one failed. The failure is `ledgerIntegrityCensus.test.ts:127`, where the existing orphan-commit fixture invokes `git commit-tree` and cannot write `.git/objects` in the filesystem sandbox. This is an environment restriction, not evidence of a game regression. An unrestricted rerun was approved.

- Unrestricted `npm run test:ci`: exit 0; 147 files and all 1,419 tests pass. The isolated ledger-fixture failure above is resolved by the approved execution environment.

### Thought 2

The human-base raid path is newer than much of the combat coverage. Its tests pin helpers and duplicated expressions, so passing tests do not establish that the route enforces protection or transfers resources correctly. Review probes will invoke the actual route with isolated dependencies.

## Findings

- **R1 — High: human-base raids mint loot.** `app/api/combat/attack/route.ts:530` credits the attacker; the following defeat branch only updates bots or removes Beer bases. Human defender resource balances are never debited. A successful human raid increases total resources by its payout.
- **R2 — High: base raids omit aggression safeguards.** The same route never invokes defender protection checks, attacker protection forfeiture, or the flag-bearer attack prohibition. Those checks exist in the infantry route and protection service, and the ratified PvP design requires parity. Protected accounts and flag bearers can bypass those rules through base raids.

The first eight isolated probes pass, reproducing existing defects rather than asserting corrected behavior. They import actual routes/resolver; database and external dependencies are replaced. No live data is accessed. R1/R2 are reproduced together: a protected human defender is raided successfully by a shielded bearer, the attacker moves from 1,000 to 51,000 Metal, exactly one resource write occurs, and protection forfeiture is never called.

- **R3 — High: factory building bypasses tier progression.** The actual factory build route accepts `T5_TITAN` for a level-1 account with zero RP and only Tier 1 unlocked, producing 5,000 STR. Its enum check is not an unlock check.
- **R4 — High: the two build interfaces disagree on identity and slot cost.** The player build route stores `unitType: 'titan'`, while the factory route uses `T5_TITAN`. It casts the blueprint ID to `UnitType`, misses the configuration, and falls back to one slot. The probe successfully builds a Titan using the last single slot of a 400-slot factory. Permanent tier unlocks are not consulted by this route either.
- **R5 — Medium: army-balance harvesting is disconnected.** The slim projection omits `totalStrength` and `totalDefense`; the service passes zeroes into the shared estimator. A mono-STR army receives 800 Metal from an 800 roll instead of 600. Optimal armies likewise lose their intended 10% bonus. The UI estimator includes stats and therefore disagrees with payment.
- **R6 — High balance concern: casualties never reduce battle firepower.** Combat stats are computed once. An equal-pool base fight loses five of ten attackers in round 1 but deals exactly 520 again in round 2. Partial damage is independently floored for casualty counts; a two-unit 1,200-HP defender takes 1,000 damage without losing a unit, then loses both on pool exhaustion. Round casualty totals also omit forced wipe casualties. These are confirmed mechanics; selecting an attrition model needs a design decision.
- **R7 — Medium: killing the defender on round 100 awards a defender win.** The real resolver returns `DEFENDER_WIN` with defender HP 0 and attacker HP 511 when the last hit lands on the limit. Check the terminal outcome before declaring the cap a repel.
- **R8 — Medium: factory background regeneration uses a different curve.** The hourly job uses `10 * (1 + (level - 1) * 0.1)` slots/hour, while on-demand production uses `30 + (level - 1) * 10`. Each job write resets the same timestamp, losing the faster offline accrual; L10 refills at 19/hour offline versus 120/hour during on-demand calculation. The real hourly-job probe confirms 19 recovered slots versus 120 from the shared helper. The balance regeneration multiplier is not passed by either live consumer.
- **R9 — Medium: purchased core research has no gameplay consumers.** `advanced-mining`, `fortification`, and `tactical-warfare` are sold and advertised in the catalog; production searches find no identifier checks outside definitions. Their promised yield/speed/defense/combat effects never enter harvest or combat. These purchases cost 22,500 RP in total.

### Thought 3

An equal-pool composition sweep through the real resolver confirms a strategic imbalance independently of resource pricing. At 10,000 pool per side and equal level 25, seven STR shares (100%, 60%, 55%, 53%, 50%, 49%, 0%) produce 98 ordered fights across infantry and base raids. Pure STR wins against all seven defenders in both modes. Against 50/50, it loses 22% of units in infantry and 0% in base raids, while the 50/50 attacker loses 100% in infantry and 96% in base raids. The display's 0.5× critical power penalty is not itself used in damage resolution; its smaller dealt/taken penalties do not offset STR suppression and first strike.

- **R10 — High balance concern: pure-STR offense dominates the sampled compositions.** Balance bands advertise mixed-army rewards, but damage uses attacker STR and defender DEF; attacker DEF and defender STR mostly add HP. This role asymmetry and first strike produce the sweep above. Fix mechanical exploits and attrition before changing prices, then rerun an equal-cost, tier, doctrine, and casualty-value matrix.
- **R11 — High: WMD army damage depends on stack representation and leaves aggregate stats stale.** `missileTracker.applyDamage` floors each stack's percentage independently. Every quantity-1 entry produced by the player factory loses zero units for sub-100% destruction, while the same army folded into a stack loses units. The write changes `units` only, preserving dead units' `totalStrength`/`totalDefense` for factory captures, rankings, and balance calculations.
- **R12 — Medium: successful battery/research sabotage has no effect.** The live `spyService.applySabotageDamage` battery branch reports hypothetical wasted resources without writing the battery; there is no research branch. The operation can return success, log it, and expose the attacker while leaving the target untouched. The separate older sabotageEngine is not a live consumer and is excluded as a primary finding.
- **R13 — High: defense batteries never automatically leave cooldown.** Interception sets `COOLDOWN` and `updatedAt`; no consumer reads `cooldownDuration` to restore `IDLE`. The repair job only reads `repairCompletesAt`, which interception does not set. A successful defense disables that battery until a paid repair/replacement. This undermines advertised 10-minute to 1-hour recharge durations.
- **R14 — Medium: several bonuses change displayed power but not resolved combat.** Clan military research and discovery bonuses are read by `combatPowerService`, but not `resolveBattle`. Therefore they inflate stats/rankings without helping infantry or human-base battles. Doctrine power display also uses fixed 7.5%/10% averages rather than real army weighting/mastery. Personal core research R9 is more severe: no identified gameplay consumer at all. The three effectless personal purchases total 22,500 RP.

### Thought 4

Strategic and marketplace checks exposed behavior that nominal feature coverage misses. Actual WMD impact destroys zero units from 100 singleton entries versus 17 from one 100-unit stack. Actual sabotage returns success for battery and research targets with zero target updates. Actual interception writes cooldown without a recovery deadline. These are isolated production-function reproductions. The repair consumer and schema inspection confirm no automatic battery recharge exists.

- **R15 — High: economy guards are not consistently atomic.** Concurrent real `spendRP` calls each spending 60 from the same 100 snapshot both succeed, both write 40, and therefore debit only 60 for 120 of purchases. `gte(balance, amount)` does not make an absolute snapshot write safe. Related source-confirmed risks: `awardRP`/`awardXP` overwrite snapshot balances; clan research contribution writes two absolute balances; unit builds subtract without a balance predicate and reserve slots separately; raids check their period before logging and credit an old resource snapshot; factory income advances accrual timestamps before crediting an absolute player balance. These can undercharge, overdraw, lose rewards, bypass single-use locks, or strand completed operations on a mid-write failure. Only the RP interleaving was executed; the related paths are source findings requiring transactional probes during remediation.
- **R16 — High: unit auctions delete extra units and desynchronize army totals.** Selection uses `.find(unitId)` but removal uses `.filter(unitId !== selected)`. The actual listing probe starts with three singleton Titans sharing blueprint `unitId`, removes all three, and escrows only the first. No STR/DEF aggregate update accompanies escrow, transfer, or refund. This destroys units and leaves factory capture power/rankings detached from actual ownership. Select by instance `id` and maintain aggregate stats in the same transaction.
- **R17 — Medium: clan-only auctions are public transactions with a fee exemption.** Listing chooses the clan sale fee, but `sellerClan` is not populated and both bid/buyout clan checks are commented out (`auctionService.ts:461`, `:620`). Outsiders can transact against a known listing. Restore authorization before offering the discounted option.
- **R18 — Medium: bot summoning relocates rows without relocating their claimed map tiles.** `createBotPlayer` already claims a Wasteland tile in a zone. `summonBots` then overwrites the returned base/current position with unchecked offsets without releasing/reclaiming that tile. The tile remains in the original location while the response advertises another; edge offsets can leave 1..150 or collide. `getTileAt` reads base ownership from tiles, and raid presence resolves the claimed tile first. Summoned encounters therefore fail the promised local-spawn contract. This is a source-confirmed finding; no live bots were spawned.
- **R19 — High feature break: Bot Magnet IDs exceed the schema limit.** The actual beacon generator produces a 30-character `beacon_<epoch>_<random>` ID for a `varchar(24)` primary key. An isolated probe checks the generated value against the real schema. PostgreSQL will reject that insert, so deployment fails before the researched feature can work. Use the shared bounded ID generator.

### Thought 5

The 40 canonical blueprints agree with their configuration stats and prices; execution paths disagree. Standard-tier efficiency generally increases from about 0.25 power/resource to 0.375, with intended slot costs 1/3/7/15/30. Those curves cannot control growth while one build route ignores unlocks and another charges one slot for every blueprint. Army representation also determines WMD vulnerability and auction loss. Correct those mechanics before measuring progression or changing prices.

## Ranked action order and source index

Priority reflects exploitation, loss of player assets, and gameplay distortion. Live occurrence and population-level prevalence were not measured.

| Order | Findings | Source | Evidence |
| --- | --- | --- | --- |
| 1 | R1 loot minting; R2 safeguards omitted | `app/api/combat/attack/route.ts:270`, `:530` | Actual route + infantry/design comparison |
| 2 | R3 progression bypass; R4 one-slot Titans | `app/api/factory/build-unit/route.ts:82`; `app/api/player/build-unit/route.ts:316` | Actual route probes; Titan intended cost 30 slots |
| 3 | R16 auction destroys extra units | `lib/auctionService.ts:338`, `:355`, `:824` | Actual listing: 3 removed, 1 escrowed |
| 4 | R15 unsafe economy updates | `lib/researchPointService.ts:918`, `:935` | Actual concurrent spend: 120 purchased, 60 charged |
| 5 | R11 WMD representation dependence | `lib/wmd/jobs/missileTracker.ts:158`, `:167` | Actual impact: 0 vs 17 deaths |
| 6 | R13 battery recharge missing | `lib/wmd/jobs/missileTracker.ts:112`; `lib/wmd/jobs/defenseRepairCompleter.ts:45` | Actual write + absent recovery consumer |
| 7 | R19 Bot Magnet insert fails | `lib/botMagnetService.ts:67`; `lib/db/schema/config.ts:238` | Actual generated ID: 30 chars; varchar(24) |
| 8 | R6 attrition; R10 STR dominance | `lib/battleService.ts:247`, `:331`, `:410` | Resolver probes and 98-fight sweep |
| 9 | R5 gathering; R8 regeneration | `lib/harvestService.ts:245`, `:331`; `lib/jobs/factorySlotRegeneration.ts:51` | Payout and hourly-job probes |
| 10 | R9 personal research; R14 display-only bonuses | `lib/research/techCatalog.ts:39`; `lib/combatPowerService.ts:108`, `:128` | Consumer census + resolver inspection |
| 11 | R12 sabotage has no target effect | `lib/wmd/spyService.ts:1381`, `:1434` | Actual battery/research execution |
| 12 | R18 summoned row/tile mismatch | `lib/botSummoningService.ts:120`; `lib/botService.ts:660` | Source call chain; no live spawning |
| 13 | R17 clan auction authorization | `lib/auctionService.ts:219`, `:229`, `:461`, `:620` | Seller clan absent; checks commented out; 0% fee vs public 5% |
| 14 | R7 round-100 outcome | `lib/battleService.ts:477` | Defender dead, attacker 511 HP, defender wins |

Production reachability: viewport/Beer base attack → `/api/combat/attack` → resolver → casualty helpers → reward/persistence. The resolver supplies none of the omitted admission guards. Both procurement routes have live UI callers (`UnitBuildPanelEnhanced` and the unit-factory page). WMD impact is reached through scheduling and lazy route ticks. Auction changes are reached by create/bid/buyout/settlement. No dormant helper is counted as a broken live feature.

## Army and economy balance assessment

The composition sweep uses 100 canonical Infantry/Barricade copies per side: 10,000 power and exactly 20,000 Metal + 20,000 Energy, equal level 25, neutral doctrine/flag bonuses, captures disabled. Equal pool is also equal procurement cost here. It measures resolution before the human defender's post-battle casualty floor. Total losses are deterministic because every unit has the same 100-point pool, despite randomized casualty identity.

| Attacker STR share | Infantry wins / 7 | Base wins / 7 | Infantry losses vs 50/50 | Base losses vs 50/50 |
| --- | --- | --- | --- | --- |
| 100% | 7 | 7 | 22% | 0% |
| 60% | 3 | 6 | 100% | 81% |
| 55% | 4 | 6 | 100% | 81% |
| 53% | 4 | 6 | 100% | 72% |
| 50% | 4 | 5 | 100% | 96% |
| 49% | 4 | 4 | 100% | 100% |
| 0% | 0 | 0 | 100% | 100% |

This establishes dominance within the sampled equal-cost T1 set, not every tier/doctrine/unequal-power matchup. Pure DEF's inability to win as an attacker is consistent with its defensive role; the concerning result is pure STR's efficiency relative to mixed armies despite their advertised rewards.

| Tier | Intended slots/unit | Power/resource band | Power/slot range |
| --- | --- | --- | --- |
| 1 | 1 | 0.20–0.275 | 80–110 |
| 2 | 3 | approximately 0.275 | 83.3–100 |
| 3 | 7 | approximately 0.305 | 85.7–114.3 |
| 4 | 15 | approximately 0.340 | 100–120 |
| 5 | 30 | approximately 0.375 | 150–183.3 |

Tier 2 offers better resource efficiency but can have worse slot efficiency than the best T1 units. Tier 5 improves both; the broken one-slot path magnifies its intended slot efficiency by 30×. Scout has 80 power/400 combined resources versus Infantry's 100/400, but their different resource splits still matter under scarcity. The resolver gives no scouting, speed, armor, range, or counter-class effect based on descriptions; these variants currently differ as procurement choices.

Other balance decisions after correctness repairs:

- The 25% survivor floor applies per raid, and the reset lock per attacker/defender pair. Three separate winning attackers can reduce an offline defender toward 1.56% of its original pool. This matches current design; it is a harassment-tuning concern, not a regression.
- PvE reinforcement scales from attacker STR and the tier ladder. Building a bigger army can raise opposing defense; compare replacement costs and net profit with live raid telemetry, not just win rate/payout.
- Ten L10 factories yield up to 2.4M Metal + 1.2M Energy/day from passive income (L10: 10,000/5,000 per hour). Compare this with harvesting and net raids after accounting is safe. No production player distribution was read.
- VIP gives 2× harvest and 1.5× RP; bearer benefits add another 2×. The daily RP cap is 25,000 base before multipliers, permitting 75,000 actual RP on a fully stacked day by design. Assess ordinary and accelerated progression separately and preserve bearer restrictions.

## Coverage and verification boundary

| Area | Method |
| --- | --- |
| Combat, roster, PvP/PvE, protection, casualties/captures | Deep tracing, actual resolver/route probes, roster audit, composition sweep |
| Harvest, factory, progression, RP, research, doctrine | Payout/build/job/concurrency probes, formula/consumer checks, existing suite |
| WMD, espionage, defenses, scheduling | Impact/interception/sabotage/job probes, guard/repair call chains, existing suite |
| Auctions, inventory, personal/clan banking | Escrow/settlement and transaction inspection, actual listing probe, existing bank tests |
| Clans, territory, wars, alliances | Service/route and bonus/scoring caller survey, existing regressions |
| Map, movement, transport, AutoFarm, bot ecology | Tile/presence/job/summoning survey, grounding, existing terrain/movement/AutoFarm/bot tests |
| Auth, VIP/payment, tutorial, chat/DM/friends, admin | Route/schema/client-contract survey and existing regression suite; no live external transactions |

Repository-wide censuses: **240 routes / 302 call sites**, no missing/unparsed calls; **57/57 tables** have identified writers/readers; **144 timestamp declarations** pass timezone convention checks; **469 server files** pass the host-timezone census. These establish structural reachability, not semantic correctness of every feature.

```text
npx tsc --noEmit                      exit 0
npm run lint                         exit 0, no findings
npm run test:ci                       147 files; 1,419 tests passed
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
                                     4 files; 16 probes passed
invertedRouteCensus                   MISSING 0 / UNPARSED 0
schemaConsumerCensus                  57 live / 0 violations
timestampConventionCensus             clean
hostTimezoneCensus                    clean
```

The initial suite failed only on its sandbox-restricted Git fixture; the approved unrestricted rerun passed. A later probe startup encountered C: `ENOSPC`; free space subsequently returned and the final focused run passed. Early harness mock/mapping errors were corrected before final evidence and are not product findings. No production code/data, migrations, dependencies, or release version were changed.

This is a repository-wide static/contract review with targeted isolated execution, not exhaustive live acceptance of all 240 routes. Production balances, applied migrations, hosted job uptime, Stripe settlements, multi-client sockets, and real PostgreSQL load races were not exercised. No build was needed for documentation/scratch-only changes. A green suite does not establish game balance or working advertised effects.

Evidence: [raw probes, 98 fights, all 40 unit metrics, and source SHA-256 hashes](PROJECT-REVIEW-2026-10-02-EVIDENCE.json). The reproducible harness remains in ignored `dev/tmp/review-20261002/`; the JSON preserves observations if scratch files are cleared.

### Final

The requested review is complete. Repair integrity and enforcement first, agree on attrition/defender survivability/army roles, then rerun comparable resource/slot-cost simulations and tune from trustworthy telemetry. All 19 findings remain open in SCOPE.md and the analyzed FID. Review completion does not close the defects.
