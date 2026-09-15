# Changelog

All notable changes to DarkFrame are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); dates are session dates (America/New_York).

## [Unreleased] — 2026-09-15 session

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

## [Unreleased] — 2026-09-13 session

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

## [Unreleased] — 2026-09-05/06 session

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

## [Unreleased] — 2026-09-04 session
- Initial Postgres migration effort, GitHub repo sanitization (secret scrub + history rewrite),
  README redesign, Vercel deployment pipeline bring-up (lazy DB connection for build-time
  env isolation), production DB connection fixes.
