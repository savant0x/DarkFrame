# Changelog

DarkFrame uses Savant Versioning — see `docs/SAVANT-VERSIONING.md`
(base-10 iteration counter; current: `VERSION` file). Every entry below
shipped on `main` — there is no Unreleased section; merged means released.
Older sessions predate versioning adoption and are kept as dated history.

## [0.0.4] — 2026-09-17 session

### Fixed — FID-20260917-002: shrine dead-economy cleanup + trade parity + presence enforcement (closed, commit `b11c370`)

- The shrine feature survey flagged `POST /api/shrine/extend` as a missing-UI gap; grounding dissolved the premise — the live ShrinePanel already extends via `activate` ("Replace / Extend"). What actually existed was a dead second economy: two zero-caller routes (`sacrifice`, `extend`), one carrying a phantom `'speed'` tier and a rarity table that under-valued Rare/Epic items 2×/1.5× vs the canonical `shrineHelpers` table.
- Both dead routes deleted along with the `ShrineSacrificeSchema` block (its sole consumer). The legacy economy's two live duties transfer to the wired pair: `activate`/`boost-all` now call `trackShrineTrade` + `awardXP(SHRINE_SACRIFICE)` once per transaction (operator ruling: boost-all's four suits are ONE trade, not four) — the SHRINE_DEVOTEE achievement (100 trades) is earnable through the live UI for the first time.
- Server-side shrine presence restored on both live routes via the shared fail-closed `assertAtShrine` helper (`lib/shrineServer.ts`): off-shrine API calls now refuse 400 before any write — previously only the client's keyboard gate stood between a session and remote boost activation.
- Bookkeeping failures after the committed primary write are logged, never reported as transaction failures; responses surface `xpAwarded/levelUp/newLevel`. 8 new pins (collection-aware activate harness rewritten, boost-all suite created); tsc 0 · eslint 0 · vitest 989+1skip (baseline 975+1).

### Fixed — FID-20260917-003: own-base artwork wired to level, not rank (closed, commit `57dbfef`)

- The operator's level-19 base rendered tier-1 art: the own-base selector called `getBaseImage(player.rank)` — `rank` is the admin-gating column (default 1) — and `getBaseImage` searched for `rank{N}` filenames that never existed, falling back to the first manifest entry (`1.jpg`) on every call.
- Own-base art now buckets `player.level` through the shared `levelToBaseTier` formula (10 levels per tier, clamp 1..10) — the same bucketing the enemy-base branch has shipped since FID-20260910-037 R2, extracted so both branches consume one truth. A level-19 own base and a level-19 enemy base now render the same tier art (`bases/2.jpg`). Corrupt/out-of-range levels clamp into the asset set. 6 pins in `__tests__/lib/baseTier.test.ts`.

### Removed — SCOPE #75: third shrine orphan + dead activity-logger mappings (commit `16a7fcb`)

- `GET /api/shrine/status` deleted (zero client callers — the panel renders boosts from the player payload), and `activityLogger`'s mappings for `/api/shrine/visit` + `/api/shrine/boost` removed (the routes never existed; `SHRINE_VISIT`/`SHRINE_BOOST` enum members deleted with them — zero writes ever carried those action types).

## [0.0.5] — 2026-09-17 session

### Fixed — base indicator pill: level surfaced, legibility on bright artwork (FID-20260917-003 follow-on, commit `b8910eb`)

- The own-base corner pill now shows the level (`Base · LV n`), closing the asymmetry with enemy bases (which already displayed `· LV n`).
- Both pill variants sit on the bottom status strip's void-backing method — new shared tokens `nn-viewport__badge--green/--magenta` (dark `--nn-void` fill + matching border/glow) — so raw neon text no longer vanishes over bright base artwork; fill opacity tuned on operator review.

## [0.0.3] — 2026-09-17 session

### Fixed — FID-20260917-001: clan-treasury snapshot-writer hardening (closed, commit `6577707`)

- Every clan-treasury writer now runs inside `withClanTreasuryLock` — SELECT … FOR UPDATE on the clan row inside a transaction — and moves funds via relative SQL deltas instead of snapshot-computed numbers. Closes the C1 sibling-writer class FID-20260916-013 explicitly carved out: double-collection of daily income (two leaders double-clicking), mid-flight bank mint/vaporize (clan and player updates in separate statements), and lost-update races across claims, bank, perks, WMD purchases, alliance, distribution, and warfare spoils.
- 13 writer sites across 8 services hardened, including `collectTax` — a dynamically-keyed treasury write the original census greps could not see, discovered during implementation. The two already-relative writers (alliance, distribution) gain the shared lock with in-lock sufficiency re-checks so their deltas race nothing.
- First-ever test coverage for the bank/perk/distribution services: 9 concurrency pins, including an in-lock re-check proof (a withdrawal that passes the pre-lock preview but fails the locked row) and a 2-updates-in-1-transaction atomicity pin. tsc 0 · eslint 0 · vitest 975+1skip (baseline 966+1).

## [0.0.2] — 2026-09-17 session

### Fixed — FID-20260916-013: war scoring unification + capture-flow repair + capture UI (closed, commit `32464f0`)

- Wars are pure points now: capture success awards +2 attacker war points and a repel awards +1 to the defender (in-transaction increments); hourly settlement compares total score FIRST — capture counts are a tiebreak, fixing the old precedence where 1 capture outranked 99 battle wins.
- Capture flow repaired: the defender's treasury is never touched on a successful capture (the attacker pays from their own row, A1); a repelled attempt no longer surfaces as a success (A2); treasury refusals and daily-cap hits return 400/403 with verbatim messages instead of 500 (A3).
- Capture strength is the clan's real army power — Σ(strength × quantity) over member units vs the defender's army floored at the shipped 5,000 wall, scaled by the existing adjacency bonus (+10%/tile, max +50%) and ±15% jitter. The clan-level strength curve is deleted; equal armies ≈ coin flip, 2× advantage reliably wins.
- The territory panel gains a War Captures section: enumerates ALL outgoing ACTIVE wars (no limit(1) hiding multi-wars), per-tile capture buttons gated Officer+ (mirroring the server role check), confirm-then-fire (the 25k M/E fee is paid win or lose), verbatim server toasts, daily-cap-aware disabling. Captures emit TERRITORY_CLAIMED/TERRITORY_LOST to both clans' activity feeds.
- 16 new pins (10 service + 6 component); tsc 0 · eslint 0 · vitest 966+1skip (baseline 951+1). Session-034 capture scaffolding reverted (disposition closed).

## [0.0.1] — 2026-09-16 session

### Fixed — daily-login streak bonus

- Streak bonus is now +10 RP per consecutive day beyond day 1, hard-capped at +70 RP (reached at streak day 8+). Day 7 pays 160 RP base-streak (previously 170 at day 7 under the off-by-one cap); day 8+ pays the 170 max as documented.
- Curve extracted as a pure function (`calculateStreakBonus`) pinned by unit tests (day 1 zero, +10/day ramp, cap binding at day 8, non-finite inputs pay zero).

### Added — FID-20260916-012: clan research panel — contribute/unlock UI (closed, commit `afcb92e`)

- The research tab's ComingSoonTab placeholder is replaced by the real panel: a thin `GET /api/clan/research/state` (`requireClanMembership` → `getResearchTree`, tree verbatim, no role data exposed), a fund header over the shared `researchResearchPoints` balance, a single MILITARY-honest node list (the FID-20260912-058 C1 cut preserved — 4 nodes, no fake branch tabs over empty arrays), contribute spending personal `researchPoints` into the clan fund, and unlock buttons gated presentationally for officers while the server remains the sole authority (`Insufficient permissions` surfaced verbatim).
- 9 pins (3 route + 6 component); tsc 0 · eslint 0/0 · vitest 951+1skip. Live round-trip probe 4/4: C1 shape verified live, contribute math exact (member 800→300, fund 0→500), unlock drains the fund by exactly the node cost and records the tech, member refusal verbatim.

### Added — FID-20260916-011: sabotage UI — target → victim preview → fire (closed, commit `0446629`)

- Sabotage finally reaches players: a shared `sabotageMath` module (difficulty/detection tables + formulas — the service delegates, the route and panel import), a `type=sabotage-targets` enumeration GET whose victim derivation mirrors `resolveSabotageTarget` exactly (owner username / clan leader per asset, `protectionActive` per row), and a third Sabotage tab in WMDIntelligencePanel driving operator → target → preview (victim, shield state, computed success/detection, void warning) → fire, with server refusals surfaced verbatim and no client-side pre-filtering.
- 11 pins; tsc 0 · eslint 0/0 · vitest 942+1skip. Live probe 3/3: seeded shielded victim flagged in enumeration, preview math matched the fire path bit-for-bit, protected-target fire refused with the parity constant verbatim, spy left AVAILABLE.

### Added — FID-20260916-010: three missing player-side endpoints rebuilt (closed, commit `2d9e05f`)

- The feature-survey census (SCOPE #69) found three player-facing panels calling endpoints that did not exist: DiscoveryLogPanel (`/api/discoveries`), FriendsList's online section (`/api/friends/online`), and FriendActionsMenu's block action (`/api/friends/block`). All three rebuilt as thin adapters over existing services — domain→client shape-mapping for discoveries (enum case, epoch ms, by-category totals), presence via `user_presence` (60s chat-heartbeat TTL), session-caller-only block with the sibling typed-error mapping.
- 12 pins; tsc 0 · eslint 0/0 · vitest 931+1skip. FID archived to `dev/fids/archive/`.

### Fixed — FID-20260916-009: protection window expiry shifted by the host UTC offset (live defect; D1/D2/D3)

- The `protection_until` column was timezone-naive: node-pg parses naive literals as local time, so on non-UTC hosts every window read back inflated (+4h on EDT) and expired late. Migration `0032` converts it to `timestamptz` (`USING (col AT TIME ZONE 'UTC')` — no stored instant shifts); the round-trip probe proved +14,400,000 ms → 0 ms.
- Predicate-drift refactor: `movementService` and `wmd/targetingValidator` now use the canonical `protectionActive` (refusal message parity included); the dead no-auth `createPlayer` (silent unprotected-account minter) is deleted.
- Gates: tsc 0 · eslint 0/0 · vitest 919+1skip. SCOPE ledger truth-sweep: rows #22/#23/#24/#36/#44/#51 re-verified closed with evidence; FID-003 closed (Option B implemented via -004).

### Added — FID-20260916-006/-007/-008: protection parity completed across all PvP surfaces (closed, commits `cf7437a`/`e9bf162`)

- FID-20260916-006 audit dispositioned every surface that touches another player; D1 (recon intel) and D2 (flag steal) ratified as intentionally open — information and proximity-contest surfaces never void the shield. (Ratified FINAL 2026-09-16, session 027; audit closed on `99ba521` and archived.)
- FID-20260916-007: repaired the broken sabotage pipeline (route call was transposed and the ownership assertion was unsatisfiable — live sabotage always refused), added operator binding, owner-derived target resolution, protection refusal, and the 4th void site at commit in `executeSabotage`; disclosed in-scope fix of a pre-existing `wmd_sabotage_operations.id varchar(24)` overflow the repair exposed.
- FID-20260916-008: factory capture now voids the attacker's window on player-owned targets only (`pvpCapture` — wild/bot stays pure PvE); the latent `/api/battle/attack` route gained both seams (beer-base defenders skip, shared `resolveBattle` untouched).
- Verification: 11 seam pins (6 -007 + 5 -008, roll-independent), live probes 4/4 + 6/6 against the real DB, tsc 0 · eslint 0/0 · vitest 919+1skip.

### Added — FID-20260916-004/-005: protection forfeit on WMD launch + war-clan join; WMD launch target validation (closed, commits `2cf2f8a`/`d3c5cd2`)

- FID-20260916-004 (Option B per FID-20260916-003): `launchMissile` voids the launcher's protection window after the missile's exists+READY preconditions, before effects; `joinClan` voids the joiner's window only when the target clan is at ACTIVE war (fail-open on war-lookup outage — onboarding never blocks). Infantry-route comment corrected: `validateTargeting` had zero production callers.
- FID-20260916-005: launch accepted any username with no target validation — nonexistent targets consumed built warheads for zero damage (impact no-op, weapon still terminal), and no production code ever consulted target-side protection, so the 72h shield did not stop incoming WMD strikes. The dormant `validateTargeting` is revived at the launch seam (self-target, existence, protection, level ≥ 10 floor kept by operator decision, own-clan), between the READY check and the FID-004 void: refusals leave the missile READY and never forfeit; valid targets commit and void as before.
- Verification: 11 seam pins (6 -004 + 5 -005, refusal classes assert no flip + no void); tsc 0 / eslint 0-0 / vitest 908+1skip; live probes 5/5 (-005 driver) + 4/4 (-004 driver, patched with a real target fixture since -005 now correctly refuses its historical dummy).

### Added — FID-20260916-002: new-player 72h protection window (closed, commit `0d18a93`)

- Registration stamps `protection_until` = now+72h (`createPlayerWithAuth`; new `lib/playerProtection.ts`: window constant, pure `protectionActive` predicate, `voidProtectionOnAggression` helper). Infantry route refuses protected targets with a server reason; `executeInfantryAttack` voids the attacker's own window on initiation (service-level, bots-only `executeBaseAttack` untouched); `attackFactory` refuses capture of protected owners' factories. `protectionUntil` typed on the domain `Player` and allowlisted in the sanitizer (client surfacing shipped separately).
- Verification: 14 unit pins; gates tsc 0 / eslint 0-0 / vitest 883+1skip at implementation; **live probes 7/7** on PORT=3002 (window Δ=71.999h, infantry 400 refusal, WMD target-side refusal with zero WMD code change, aggression void persisted NULL, factory refusal, bots-only base-raid negative control, zero fixture residual).
- Follow-up FID-20260916-003 (`analyzed`): forfeit edges debated — operator chose Option B (WMD launch voids; clan join voids only into ACTIVE-war clans); enforcement spec pending.

## [0.0.1] — 2026-09-15 session

### Fixed — FID-20260912-060 B1/B2/B4 + FID-20260912-061 R2/R4 (battle-RP pacing closed)

- B1 daily battle envelope (`applyBattleEnvelope`, inside `awardRP` so no battle site bypasses it): first 10 victorious battle awards/player/day pay full, then 20% (25 base floor), fail-open. B2 saturating level term (`saturatingBattleRP`: L1→110, L5→144, L14→201, L65→292, asymptote 300) wired at the raid site — max-level bots stop being a lottery. B4 `defenseRpEligible`: defense RP only vs higher-or-equal attackers, both PvP branches. Contract suite (9 tests); B3 suite intact; gates green.
- R2 doctrine stated on the growth engine (levels are spawn-time brackets, never regrown); R4 Beer Base display levels normalized to the tier ladder (rank→L5/15/25/35/45/55, deterministic).
- Docs: `RP_ECONOMY_GUIDE.md` re-audited to shipped v2 truth (5-rung milestones, 4,300/day envelope, catalog prices, unit tiers, battle rules, VIP math); `ARCHITECTURE.md` stack rewritten (Next 16/React 19/TW4/Postgres); tutorial/messaging stale-backend banners + worst falsehoods fixed; 14 dead progress notes relocated to `dev/archives/2026-09-15-docs-cleanup/`, 10MB scraped llms docs + empty ideas file removed; `dev/QUICK_START.md` refreshed; README rewritten to current state.

### Docs — open-FID audit close-out: 33 completed + 1 superseded archived (operator-accepted audit)

- Verified each file 0-EOF against live code (seams, routes, tests, token penetration, gates): FID-20260906-004, FID-20260906-012, FID-20260908-001–021 (001 closed as implemented-then-superseded — its tracking contract was replaced by the JSON quest architecture; 002 XP curve, 003 power sanitize, 004 factory count, 005 reconnect backoff, 006 umbrella + Waves A/B/C surfaces, 007 register, 008 tech-tree, 009 WMD, 010 clans, 011 game shell, 012 help, 013 dead-kit, 014 referrals, 015 profile/messages, 016 import guard, 017 admin, 018 map, 019 leaderboard/shop, 020 long tail with fresh 0-site census, 021 lint program), FID-20260909-022–024/027–032.
- Remaining open: FID-20260912-060 B1/B2/B4 + FID-20260912-061 R2/R4 (confirmed still pending — no envelope/saturating-curve/defense-gate/bracket-doc in code) and FID-20260906-005 (`fixed`, T5 gated).

### Docs — FID compliance audit: 62 stale-closed archived with ground-truth checks (SCOPE-55)

- Full `dev/fids/` audit (97 active): filename format ratified to repo practice (`FID-YYYYMMDD-NNN`, template + `protocol.config.yaml` corrected — the `YYYY-MMDD` sketch matched zero filed FIDs); uppercase statuses normalized (`CONVERGED`→`converged` ×4); `DRAFT`/`in_progress`/unparseable statuses resolved; missing required metadata (Filename/ID/Severity/Status/Created) restored on every touched file; zero attribution fields repo-wide.
- Archived with per-file code-anchor verification (routes/services/tests/migrations confirmed live): FID-20260902-001 (pg pivot), FID-20260904-005 (audit umbrella), FID-20260906-001/-002/-003/-006/-009/-010/-006a, FID-20260909-025/-034/-035, FID-20260910-037–040, FID-20260911-041–055, FID-20260912-056–059, FID-20260912-062–064/071–094, FID-20260915-001. Two rename-drift notes recorded in-file (063 `extractNewPosition`→`extractMovePosition`).
- Still active (35): 32 `converged` plans (09-08 neon waves, 09-09 batches — compliant, awaiting implementation) + 3 `fixed` with operator-open remainders (FID-20260906-005 menu T5 gated; FID-20260912-060 B1/B2/B4; FID-20260912-061 R2/R4).

### Docs — bulk archival of 10 stale-closed FIDs (dev/audit, no code)

- Archived to `dev/fids/archive/` with ground-truth cross-checks (code/SCOPE/CHANGELOG all confirm the work shipped): FID-20260403-001 (historical code review), FID-20260903-001 (mongodb seam typing — `lib/mongodb.ts` live, tsc 0), FID-20260903-002 (WMD schema — `lib/db/schema/wmd.ts` + migrations live), FID-20260904-004 (hotkey invariant — registry live), FID-20260909-026 (bank race/canvas — atomicity test live), FID-20260909-033 (catalog unification — canonical roster + test live), FID-20260913-001 (vitest jsdom — suite green since), FID-20260914-001/-002 (transport toggle + raid audit — both implemented per session records), FID-20260915-004 (balance-in-combat — SCOPE row 42, commit 049459b). Plus relocated misfiled `AUDIT-20260908-PHASE6` from `dev/fids/` to `dev/audits/`.

### Fixed — FID-20260915-008 (PvP counter-suppression softening, infantry-scoped)

- Defender counter is now `max(5, DEF − attackerSTR/3)` for PvP infantry (was `/2`); the 0-loss glass-cannon farm ends at 30% DEF share (40% counters 14k R1, 50% 45k), wins flip toward balanced armies, the pre-existing stall keeps its repelled outcome. Attacker strike and every PvE path (garrison tuning, incident replay) are byte-identical; PvE suites pass unmodified.

### Changed — ladder-truth gate extended to every documented game-math table (FID-20260915-007)

- **Four new ladders** (10 new documented sites, 65 new cells): regeneration-rate (4 sites — the rate table + three range summaries, actuals **engine-derived** as tick(0) ÷ spawner-max), unit-cost curve (game.types roster counts, BALANCING PHILOSOPHY table ↔ `TIER_UNLOCK_REQUIREMENTS`, slot ladder 1/3/7/15/30), build-rate (header intervals ↔ `BUILD_RATES`, Ghost pinned at the docs' one-decimal precision — 0.67 is a rounded 1/1.5), army composition (header bullets + table comments ↔ `ARMY_COMPOSITION`, bare `50/50` rows parsed as str-first).
- **Two live falsehoods corrected** (the new gate's first catch, before it even shipped): both regen summaries said "5-20% per hour" while Boss regenerates at 2% — now "2-20%" in all four sites; UNIT_CONFIGS' "all 40 units (5 tiers × 8)" now scoped truthfully to 65 units (40-unit blueprint-derived core + 25 SPEC/PRESTIGE).
- `BUILD_RATES`/`ARMY_COMPOSITION` exported from botGrowthEngine (pure data; botArmyCaps.test.ts already behavior-pins caps/age — scope respected).
- Drill-proven: comment-only edits to the regen table (drill E), the botService range summary (drill F), and the philosophy table (drill G) each fail the gate (2/2/2 tests), restored green after each. Coverage arithmetic asserted in-test (a parser silently skipping the bare 50/50 row shape is itself caught).

### Added — property-based regen-engine regression suite

- 14 property tests sweeping all 42 spec×tier configs (`__tests__/lib/regenEngineProperties.test.ts`) pinning the four regen semantics: never-below-current (plus over-cap clamp-down), revival from zero with the linear identity **derived from the engine itself** (`regen := tick(0)` — no mirrored rate table to drift), cap clamping through regen / growth-write / composed path (mocked 70/20/10 rolls), and NaN-free lookups incl. the Boss 120,000/h anchor. Mutation-drilled: absorbing-zero / clamp-removal / Boss-entry-deletion / negative-regen each fail the suite (4/4/1/8 tests); engine pristine after restore. Guards FID-20260915-005/-006/-006a semantics.

### Added — ladder-truth CI gate (FID-20260915-006a follow-through)

- New test (`__tests__/lib/ladderTruth.test.ts` + scanner
  `scripts/ladderTruth.ts`) parses the documented bot tier tables out of
  `lib/botService.ts` source comments — resource multipliers (2 sites),
  base defense (2 sites), player level brackets — and asserts each documented
  value equals the live function output (`getResourceRange`,
  `getBotDefenseForTier`, `getPlayerLevelBonus`). A comment-only edit that
  drifts from code now fails CI; a formula change without a doc update fails
  too. Site-count guards make a deleted table fail loudly; truth spot-pins
  keep the scanner honest. Drill-verified: a corrupted comment value fails
  2 tests and restores clean. `getBotDefenseForTier` exported for the gate.

### Docs — FID-20260915-006a: bot tier-ladder comment drift corrected

- Comments in `botService.ts` (file header + `getResourceRange`) claimed the
  tier-multiplier ladder ran 0.75→3.0×; the formula has always computed
  0.5 + tier × 0.25 = **0.75→2.25×** (T5–T7 were overstated as 2.0/2.5/3.0).
- The defense ladder quotes (150→9600) were pre-scale values; the
  `(100+50t)·2^(t−1)·0.1` function has always produced **15→2880**. The boss
  block's "192,000 total" inherits the 10× error (real: 2,880 × 20 = 57,600).
- Same corrections in the attack-route garrison comment and a historical-note
  banner on `BASE_RAID_BALANCE.md`'s worked example (its totalDefense column
  predates both the ladder and the ×0.1 rescale). Code behavior unchanged —
  comments and docs now equal code truth, verified by executing the formulas.

### Changed — FID-20260915-006: linear bot-vault regen + hoarder capacity tier

- Bot vault regen is now LINEAR (`rate × spawner max` per hour) instead of a
  percentage of current. The old curve made 0 absorbing — the raid win path
  zeroes a defeated bot's vault, so raided bots stayed dead forever (live
  census: 7/54 bots at 0/0, all raid-killed; map loot collapsed to zero within
  a month of modest raid pressure). Linear regen revives them on the next
  tick with no migration and makes raid income sustainable (~15× per audit).
- New shared `getVaultCap()` (botService): 2× spawner max for all specializations,
  3× for Hoarders (jackpot identity). Consumed by the regen clamp, the growth
  write clamp, the raid loot cap, and the resync tooling — they can no longer
  drift. At-cap loot values are unchanged for non-hoarders.
- Live acceptance gate PASSED: 7 dead bots → one growth cycle → 0 dead.
- Player-path jackpot verified live on three hoarders: declared-metal raids
  paid 323,739 / 352,804 / 411,713 (each above the old 300,000 2× cap; 3× cap
  = 450,000), the bots' energy survived (FID-005), and growth cycles regrew
  metal from 0 with a constant +7,500 linear step.

### Fixed — FID-20260915-005 (defeat bookkeeping precision + growth clamp)

- Raid defeat bookkeeping now zeroes ONLY the stockpile(s) the raid actually
  looted, mirroring the declared-resource loot rule: a declared-metal raid
  preserves the bot's energy (and vice versa); undeclared raids still wipe
  both. Previously both vaults were zeroed regardless.
- The growth cycle's 70/20/10 pattern write is clamped to the vault cap (the
  same clamp the regen step applies). Previously growth (up to ×1.15) wrote
  above cap and stored vaults idled 1–15% over cap until the next tick.

### Added — combat balance surfaced on the StatsPanel

- New "Dealt / Taken" row under the Military Power panel's Balance status shows
  the exact per-strike multipliers the engine applies to your army
  (`damageDealtMultiplier` / `damageTakenMultiplier` — e.g. CRITICAL ×0.80 / ×1.30).
  The numbers are computed from the same raw STR/DEF the engine uses, so the
  panel is a truthful preview of the next fight, not the display-only ×0.50
  power figure that previously carried all the signaling.

### Fixed — FID-20260915-004 (deep audit: balance-in-combat, garrison floor, economy caps, factory pill)

- Army balance finally executes in combat: every strike in `resolveBattle` is
  multiplied by the attacker's damage-dealt and the defender's damage-taken
  balance multipliers (CRITICAL 0.8/1.3 … OPTIMAL 1.05/0.95). Previously the
  whole suite fed display surfaces only — a CRITICAL ×0.50 raider's strike was
  provably raw STR − DEF/2. Mono-axis armies (pure offense or pure defense)
  are punished on both sides — the designed anti-glass-cannon tax.
- The weight-class floor now covers REAL regrown garrisons (previously only
  synthesized fresh ones): supplemental ephemeral reinforcement units raise a
  base's DEF to the tier-ladder target, so overmatched raiders can no longer
  kill the garrison inside their own strike phase and take a zero-loss free
  win (live-proven hole: 0 losses + 452M loot from a tier-2 bot).
- Economy caps: bot vault growth clamps at 2× the spawner's per-tier maximum;
  raid loot is capped the same way; one-time resync drained 8.8B from 45
  bloated vaults (Devil_Agent 2.12B → 0.2M). Player balances untouched.
- Unit Factory cards now show an owned-count pill (×N, top-right) per unit.

### Changed — FID-20260915-003 (endgame raid pacing)

- Tier-multiplier ladder on the synthesized-garrison weight floor
  (`GARRISON_TIER_MULT` 1.0→1.5): top-tier bases now force multi-round endgame
  raids with real proportional losses (measured 3 rounds / 80–95% for the
  biggest raiders) while low tiers stay near-flat. The operator-proposed
  `GARRISON_SIZE_CAP` raise was swept and **falsified as a difficulty knob**
  (identical outcomes at 60/150/300/600 — the floor distributes across any unit
  count). Bot tier now resolves from `bot_config.tier` (canonical spawner
  field); the legacy b[WMSEUL] username marker matched nothing live and
  silently degraded every bot — including tier-scaled XP/RP — to tier 1.
- Live E2E (`scripts/e2eEndgamePacing.ts`): tier-6 base vs 220k raider → 3
  rounds / 95% losses, survivors intact; single-unit raid honestly repelled;
  a real raid as `fame` landed 2 rounds / 8.7% losses with the army fully
  accounted for.

### Fixed — FID-20260915-002 (tier-sim: garrison counter wired to the wrong stat)

- Tier-mismatch simulation (`scripts/simulateCombatTiers.ts`, runs the real engine)
  proved the synthesized-garrison weight-class floor was routed into STR — a stat the
  counter formula never reads (defender damage = DEF − attackerSTR/2). Fresh-base raids
  were free wins at every mismatch (0–9% losses). The floor now lands on DEF
  (`GARRISON_DEF_RATIO = 0.65` → 0.15×attackerSTR counter per round) with a small STR HP
  pad (0.2). Post-fix: 13–15% attacker losses at every mismatch, rounds scale with
  defender tier. Findings + remaining open flags (real-garrison floor, stall band, doc
  drift) in `dev/audits/COMBAT-TIER-SIM-2026-09-15.md`.

### Fixed — FID-20260915-001 Phase 3 (combat rebalance converged + two army-wipe bugs)

- Battle HP scale is now power-proportional (`strength + defense` per unit;
  zero-power floor 10), replacing the flat 10/15 scale under which every battle
  resolved in round 1 (army pools of hundreds vs per-round damage of
  hundreds–thousands — the BATTLE-17894 annihilation-DRAW class was the norm).
  Mirror matches fight ~2 rounds at any tier; tanky garrisons fight
  multi-round; overreached raids die fast. The incident's exact matchup now
  resolves as a 4-round Pyrrhic victory (~70% proportional losses) instead of a
  mutual-annihilation DRAW — the pinned regression suite covers the full matrix.
- Live raid verification surfaced and fixed a second annihilation class: the
  type-tally write-back subtracted each type's TOTAL casualties from EVERY
  entry of that type, so any multi-entry army (the canonical per-unit build
  shape) lost entryCount × killed units — a 400-unit infantry army wiped by
  225 casualties. Both write-back paths (raid `applyAttackerCasualties` and PvP
  `applyBattleResults`) now drain the tally across the type's entries.
- Live E2E (`scripts/e2eBattleRebalance.ts`): competitive raid = ATTACKER_WIN
  in exactly the projected 10 rounds with exactly the projected 225/400
  proportional losses and 175 survivors intact in the DB; overreached raid =
  clean DefenderWin with the garrison unscratched. Never a DRAW.
- Rejected the FID's original per-axis coefficient sketch in the perfection
  loop: algebra showed no linear coefficients can produce multi-round close
  matchups while keeping incident-class fights in round 1 (proven live: the
  incident replay's honest outcome is a close-matchup-shaped fight).

### Fixed — FID-20260914-004 (compat-seam hardening)

- The Mongo→pg compat seam counts honestly: `updateOne`/`updateMany`/`deleteOne`/
  `deleteMany`/`bulkWrite` and the upsert insert branches report real affected-row
  counts via `.returning()` — seven integrity branches (ban-player, factory
  abandon/upgrade, build-unit batch slots, greeting) and three analytics reporting
  sites gain live failure paths with zero caller edits.
- `$pull` rewritten to the probe-verified `jsonb_agg` deep-equality form (the old
  `jsonb - jsonb` operator does not exist on this engine — every `$pull` was a
  guaranteed 500); `$addToSet` gains real set semantics via a containment guard
  (duplicate tier unlocks no longer possible).
- Live honest-branch route sweep (23/23) surfaced and fixed two pre-existing defects:
  ban-player + clear-flags audit inserts 500'd AFTER applying their action (legacy
  Mongo doc keys resolve to no `mod_log` column; fixed to column keys with the legacy
  payload preserved in `details`), and player build-unit's `$push` corrupted
  `players.units` (plain-array operand appended as one nested element; now the
  probe-verified `{ $each }` shape with per-unit `quantity: 1`).
- Probe + live seam verification exit 0; regression suite 747 → 760 passed;
  tsc 0, eslint 0. Closed as `f21f6f1` (pre-merge hash; canonical: PR #41).

### Fixed — FID-20260914-003 (auction escrow correctness)

- Buyout no longer forfeits the outbid leader's escrowed bid: claim-first close
  (`findOneAndUpdate` Active→Sold) + fresh-pair leader refund; leader-is-buyer is
  charged only the remainder; concurrent bid/buyout cannot double-pay (lost claims
  refund immediately; delivery failure rolls the close back).
- Unit listings escrow for real: unit snapshot frozen into `item.unitSnapshot` and
  removed from the seller's army at listing; delivery is buyer-side; cancel/expire/
  transfer-failure refunds return the unit (legacy no-snapshot rows keep a fallback).
- Tradeable-item listings rejected before any fee/lock (`TRADEABLE_NOT_TRADEABLE_YET`);
  my-bids now orders by the caller's own latest `bidTime` (stale `bids.timestamp`
  dot-path removed). A read-only probe proved the shim's `$pull` SQL invalid on this
  engine (`jsonb - jsonb` absent) — escrow uses `$set` array rebuilds; the verified
  `jsonb_agg` rewrite is banked for the shim-hardening follow-up (FID-20260914-004).
- Verified live end-to-end over real HTTP + postgres (`scripts/e2eAuctionLedger.ts`):
  every escrow ledger entry balances; conservation ΣΔ = −250 = exactly the two fees.
   Regression suite 736 → 747 passed; tsc 0, eslint 0.

### Changed - FID-20260916-001 (remove dead Mongo index tooling)

- Deleted `scripts/createIndexes.ts` (Mongo-driver index script for a database
  that no longer exists; zero live callers) and removed the `create-indexes`
  npm script. Postgres indexes remain owned by `lib/db/schema/*` + migrations.
  Shim census banked in the FID: ~20 live `lib/` consumers of `lib/mongodb.ts`
  plus 4 scripts + `server.ts` — full shim retirement is a phased epic,
  explicitly deferred, not silently dropped. Gates green (tsc 0, lint 0,
  865 tests).

## History — pre-versioning sessions (kept verbatim)

### May 2026 era (26 commits, Mongo-era game — `git log --since=2026-05-01 --until=2026-09-01`)

Multi-phase archetype battle rewrite; gather→build→battle repair; shrine/chat/flag/auto-farm UI fixes; enterprise quality audit (80+ issues); phased test rewrite, cleanup, performance passes; structured-logger migration across API routes. Dormant late May → September, then the Postgres pivot (below).

### 2026-09-13 session

### Fixed — FID-20260913-001 (vitest jsdom suite dead)

- Every vitest suite using the jsdom environment (75 of 76 files) died at
  collection with `No such built-in module: node:` — vite 8.0.3 externalizes
  node builtins to the bare `__vite-browser-external` stub and vitest 4.1.2's
  `toBuiltin()` reverse-maps it via `slice(24)` → `""` → literal `node:`,
  which Node rejects (ERR_UNKNOWN_BUILTIN_MODULE). Removed the dead
  TextEncoder/TextDecoder polyfill from `vitest.setup.ts` (the trigger —
  Node ≥11 ships both as globals, so the guard could never fire), added
  `// @vitest-environment node` to 25 server-side test files whose import
  chains pull node builtins (pg, drizzle, mongodb, socket.io), and replaced
  the hardcoded ISO week in `beerBaseScheduler.test.ts` with
  `getISOWeek(new Date())` (exported from the manager). Suite went from
  75 failed files / 2 tests to 75 passed / 734 tests / 0 failures; tsc 0,
  eslint 0.

### Removed — root bloat cleanup (operator-approved)

- Deleted ~8.6MB of untracked runtime/lint/test logs, dump files, the
  malformed `D:devDarkFramefix_sub.ps1`, orphaned one-off scripts, and the
  `__temp_patches/` + `.freebuff/` temp dirs from the repo root (`.freebuff/`
  was tracked; the rest were never committed). Two dev-server logs
  (`df-094.log`, `df-094.err.log`) remain file-locked by the running
  process — delete after stopping it.

### 2026-09-05/06 session

### Fixed — FID-20260906-011 (chat delete dead-wire)
- Chat message delete always failed: the client sent `messageId` in a DELETE body
  while the route reads it from query params (its own documented contract), so every
  click 400'd and the confirm dialog never cleared (the reported "hang"). Client now
  sends the query param and reads the `{ error }` envelope; verified live by API probe
  (old transport 400 / new 200 / double-delete guard) and operator-confirmed in the UI.

### Fixed — FID-20260906-010 (AutoFarm move-verification contract)
- AutoFarm skipped every tile (`Position mismatch … got {}`): the engine extracted
  the new position from four nested response shapes, none of which the move API
  guarantees, while flat `currentPositionX/Y` on the row carry the STALE pre-move
  position. The route now guarantees nested `currentPosition` on the way out
  (preserve-don't-overwrite) and the engine reads `data.data.player` first with a
  flat-column fallback. Live UI drive: 4/4 moves verified, 0 mismatches,
  `tilesCompleted` advancing; probe account + claimed tile cleaned from dev DB.

### Fixed — FID-20260906-009 (base position contract drift)
- Sidebar PLAYER INFO showed Base (0,0) for every player: the §5.0 sanitize
  projection kept flat `baseX/baseY` but dropped the nested `base: Position` the
  client contract promises (same class as FID-010). `sanitizePlayer` now composes
  nested `base` with finite-number guards; public profile API returns real base coords.

### Fixed — FID-20260906-008 (Track flow dead-end)
- **Track now works end-to-end:** the Flag Tracker's Track button pushed
  `/profile/<username>`, but the destination had never been built — every click 404'd
  (design doc: "Track button → Click to view Flag Bearer's profile"). Added
  `GET /api/profile/[username]` (public, sanitized §5.0 projection, explicit
  `PublicProfile` shape, 404 for unknown / 400 for hostile segments, no existence
  oracle) and `app/profile/[username]/page.tsx` (glass-language profile with bot
  identity banner: "Autonomous rogue unit — not a player").
- **Shared lookup validator** `isLookupableUsername()` (lib/authService): documented
  superset of the registration charset accepting themed bot names with spaces
  ("Thundering Depot") while rejecting hostile URL segments before any DB access.
- Verified live: Track click → `/profile/Flag-Bearer-4523` rendered with matching
  position (74,150) and rogue-unit banner; bot/unknown/malformed probes 200/404/400;
  zero PII keys in responses; suite 348 passed / 1 skipped.

### Fixed — FID-20260906-007 (bot name generation)
- **Beer Bases no longer spawn as machine slugs:** `spawnBeerBase` overwrote the themed
  name with `b<tier><timestamp><rand>` (e.g. `bS299792251945`) to dodge a historic
  varchar(20) crash. Beer Bases now get place-style themed names ("Thundering Depot",
  "Crimson Bastion") from a curated descriptor/noun lexicon; the dropped tier-letter
  encoding was grep-proven to have zero parsers. Username PK collisions retry with a
  numeric variant ("Crimson Bastion 2").
- **Latent insert-crash class removed (same class as SCOPE #20 flags.id overflow):**
  measured word census showed `generateBotName()` could compose 26 chars
  (`Legionnaire-Nightmares-999`) and boss names 31 — all against a varchar(20)
  **primary key**. All three generators now enforce the 20-char budget
  (re-roll + bounded fallback); contract-tested with 500-sample sweeps.
- **Live data repaired:** the two slug rows renamed to "Rusted Redoubt" and
  "Forsaken Outpost" after a schema-driven reference sweep (28 username-bearing
  columns) confirmed zero rows referencing the slugs; slug census = 0.
- Verified live: `spawnBeerBase` persisted "Thundering Depot" through the full
  service path; suite at 348 passed / 1 skipped (349).

### Added — FID-20260906-006/006a (game-wide balance audit + PvE loop repair)
- **Balance audit:** evidence-first measurement of the implemented economy (census of 61
  cited constants → `dev/audit/`; week-one archetype simulation → `dev/scripts/balance-sim.cjs`),
  then operator-approved implementation: XP curve rebuilt as a power curve (500×L^1.35) to
  L30 then 50k×1.15^n (kills the L29→30 inversion where the hardest level was followed by
  the cheapest); harvest XP scales +2/level; RP milestone tail made monotonic (full map
  2,500 RP); unit rarity efficiency strictly increasing via cost-side repricing (32
  blueprints, STR frozen); WMD research ladder re-anchored to the design doc (T1 50k,
  2.5M/track); per-raid theft capped at 25k.
- **PvE loop (Beer Bases) — was fiction:** the attack route announced loot it never credited
  and fought a 0-HP garrison (bots spawn with `units: []`). Bases now synthesize a real
  garrison from stored defense, wins credit resources × the admin-configurable multiplier,
  defeated bases are removed (drizzle, isBot+isSpecialBase-gated), and win/loss XP uses the
  doc-faithful 400/60 schedule. Live-verified end-to-end (11/11 probe).

### Fixed — FID-20260904-005 (Postgres-pivot systemic audit, phases 1–4)
- **Persistence:** phantom tables created (0010–0014); mysql2-isms repaired across services
  (`affectedRows`, `JSON_ARRAY_APPEND`, `JSON_CONTAINS` → pg jsonb containment, `insertId`,
  raw-result `.rows` access); admin analytics GROUP BY binding; activityLog 24-char id overflow.
- **Security — auth sweep (29 routes):** client-supplied username/position/IDs replaced with
  session identity (`authenticateRequest`); all admin writes behind `requireAdmin`.
  Late finds: `chat/delete` and `chat/edit` resolved identity from a hardcoded `TestUser`
  placeholder (unauthenticated edit/delete of anyone's messages) — now session-authenticated.
- **Dead endpoints (34 rebuilt):** admin referrals/VIP/moderation/tiles/bot-scanner, full clan
  lifecycle (bank, promote, chat, alliances, wars, territory), friends (routes were Mongo-era
  rip-outs), chat de-mocked (`dummyMessages` fixture removed — real round-trip persistence).
- **Notable:** `requireClanMembership` used MySQL `JSON_CONTAINS` — every clan route 500'd;
  9 services looked players up by `mongoId` (NULL on every live row); `declareWar` debited
  clan treasuries without persisting the war (transaction + `target_id` widened, 0014).

### Fixed — FID-20260905-001 (gate unification · admin de-mock · lint convergence)
- **Gates:** all 21 `rank >= 5` gate sites → `requireAdmin(request)`; `requireAdmin` reads
  the JWT `isAdmin` claim — the owner's `rank=1` no longer locks them out of admin actions.
- **De-mock:** flagged-players serves real derived detections (`player_activity` + `referrals`,
  deterministic severity rollup); tiles gained a real admin POST upsert + phantom-column fix;
  VIP grant/revoke write `mod_log` audit rows; clear-flag id overflow removed (schema default).
- **Types:** all 9 `@ts-nocheck` directives removed (real drizzle row types; fixed a hidden
  `isBot` boolean-vs-smallint bug); lint 1,294 → 592 with **app/api at zero**; eslint config:
  `_`-prefixed ignore patterns, CommonJS tooling override for `scripts/` + `dev/scripts/`.
- **Flag feature (was dead end-to-end):** `GET /api/flag` returned `data:null` since the
  Mongo pivot (nested `currentHolder` doc vs flat Postgres row) — holder position/level/HP
  now derive from the `players` row at read time (`lib/flagState.ts`); new `flag_trail`
  table (0015) powers the 8-minute map glimmer, written on bearer movement; tile route sets
  `hasFlagBearer`/`hasTrail`; flag attacks compute real DB distance (were crashing on
  undefined position) and persist HP; `/map` renders the animated gold bearer marker +
  fading trail; legacy dead `POST /api/flag` duplicate removed.
- **Flag cron (data-loss bug):** the 30-min cron deleted the player row of whoever held the
  flag >1h — human accounts could be destroyed. Reset now applies only to bot holders;
  humans keep the flag until defeated. Bot teleportation also repaired (never matched
  Postgres rows). `CRON_SECRET` provisioned on Vercel (was unset → cron 500'd since deploy).
- **Chat:** client read `message.content` but the API returns `message.message` (render crash
  in ErrorBoundary); DM conversations 500 (phantom `participants` column); typing indicator 500
  (MySQL-ism); tutorial 500 race fixed with `onConflictDoNothing`.

### Verification highlights
- Live prod sweep: 135 GET routes → zero 5xx (single failure found+fixed: cron secret).
- Flag lifecycle driven live: 10-hit defeat → transfer → bot HP reset; holder-swap → move →
  trail row → glimmer tile; cron all 5 paths (401/401/moved/human-protected/reset).
- Gates at close: tsc 0 · 341 tests green · app/api lint 0 · censuses zero (nocheck, mocks,
  TestUser, dead-wire).

### 2026-09-04 session
- Initial Postgres migration effort, GitHub repo sanitization (secret scrub + history rewrite),
  README redesign, Vercel deployment pipeline bring-up (lazy DB connection for build-time
  env isolation), production DB connection fixes.
