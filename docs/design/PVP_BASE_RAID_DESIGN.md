# PVP BASE RAID DESIGN — player-held bases as raid targets

**Created:** 2026-09-28
**Status:** DRAFT — operator picks pre-decided 2026-09-28 (§4), awaiting operator ratification (§8) before any implementation.
**Relationship to `docs/design/BASE_RAID_BALANCE.md`:** that doc remains the mechanics source of truth for raid combat math and bot garrisons; this doc **extends the same pipeline to human defenders**. `lib/battleService` stays read-only in both.
**Origin:** operator directives of 2026-09-28 — *"players should be able to attack other players; they go to their base and attack them; the only time the base is 'not hostile' is when they are in an alliance or in the same clan/tribe"* and *"attacking is a MASSIVE system with tons of balancing — look for a design doc first."* This is that design doc.

---

## 1. Design intent

PvP resolution is **automated by design**: the player walks to an enemy-held tile, presses the existing ATTACK button, the fight resolves through the raid pipeline, and the **battle log is the review surface**. No new screen, no unit-selection modal — the original manual-PvP-modal premise of the first FID-20260928-006 draft is **retired** (recorded in the FID's amendment history). The gap this doc closes is not a UI gap: the unified attack flow exists and works for every bot base, but the route refuses human defenders at one gate (`app/api/combat/attack/route.ts:243-245`, `if (!base.isBot) … 'Target is not a hostile base'`). That gate was an edge of the FID-20260906-006a bot repair, never a recorded design decision — and the operator has now recorded the decision that contradicts it.

## 2. The hostility rule (the operator's recorded rule, formalized)

**Every base is hostile except:**

| # | Exemption | Check (server-side only) |
| - | --------- | ------------------------ |
| 1 | Self | existing guard — attacker username = target username |
| 2 | Same clan/tribe | both `players.clanId` non-null and equal |
| 3 | Active alliance between the two clans | `areAllies(attacker.clanId, defender.clanId)` — `lib/clanAllianceService.ts:653` (backed by `getAllianceBetweenClans`) |

- **All four alliance types block** (NAP, TRADE, MILITARY, FEDERATION): even the free NAP's contract in `docs/ENHANCED_WARFARE_DESIGN.md` prohibits aggression between parties, and the higher tiers only add benefits — none removes protection. If per-type nuance is ever wanted (e.g. alliances that permit scheduled sparring), that is a doc amendment here, not silent code drift.
- **Unclanned players** have `clanId = null` → neither same-clan nor allied → hostile (and their attackers are too). A clanless attacker can raid anyone; a clanless defender is protected by no social structure, only by the mechanics below.
- **Bot bases are unchanged:** all hostile, exactly as today. This rule only ever *widens* the target set by admitting humans.
- The check is a **server-side replacement** for the `isBot` refusal — the client already routes every enemy-held tile to this endpoint and must not become an authority on hostility.

## 3. Reuse map — the existing pipeline, stage by stage

The raid pipeline in `app/api/combat/attack/route.ts` is kept; the table is the full inventory of what carries over untouched, what is newly written, and what is harvested from the stale route.

| Stage | Status | Notes |
| ----- | ------ | ----- |
| Entry: auth, rate limiting, structured errors | **unchanged** | |
| Declared loot resource (FID-038 D4: metal/energy/both) | **unchanged** | same button, same semantics |
| Presence at the defender's tile (`verifyPresence`) | **unchanged** | positions from DB; the client cannot claim a location |
| **Hostility check (§2)** | **NEW — replaces the `isBot` refusal** | lib helper (same-clan / areAllies / self) with its own pin table |
| Defender army: bots | **unchanged** | synthesized/real garrison per `BASE_RAID_BALANCE.md` (weight-class floor, tier ladder) |
| Defender army: players | **NEW** | real units from the defender's `players` row, converted one-unit-per-copy (`playerUnitToUnits` pattern already in the infantry and stale battle routes); the weight-class floor does NOT apply — a human's army is what it is |
| Battle resolution (`resolveBattle` + army-balance multipliers) | **unchanged** | shared seam with the live PvE loop (FID-20260916-008 rule respected) |
| Attacker casualties (`applyAttackerCasualties`) | **unchanged** | real losses off the attacker's army |
| Defender casualties | **NEW** | persist per the battle math with the §4.2 floor; new battleService-adjacent helper |
| Loot | **modified cap** | §4.1 — same declared-resource logic, attacker-level ceiling, 1× multiplier |
| One-raid-per-base-per-period lock (FID-20260912-093) | **unchanged logic, wider scope** | keyed by usernames, counts wins and losses — now covers human defenders |
| XP | **unchanged** | `BASE_ATTACK_WIN` 400 / `BASE_ATTACK_LOSS` 60 — one XP table for the unified flow |
| Battle-log persistence + defender notification (`persistBattleLog`) | **unchanged** | already defender-notifying |
| Defeat bookkeeping (bot stockpile zeroing, `removeBeerBase`, analytics funnel) | **unchanged** | already gated `isBot` — players get none of it (§4.4) |
| **New-player protection parity** | **HARVESTED from `app/api/battle/attack/route.ts`** (FID-20260916-008's coded-but-dormant work): refuse protected *defenders*; initiating a raid voids the *attacker's* protection window | stale route **deleted** after harvest (zero UI callers, unsound client-supplied-`defenderUnits` contract) |
| Tutorial hooks (`recordTutorialBaseAttack`) | **unchanged, bot targets only in v1** | the quests' "Attack the Base" steps mean Beer Bases; raiding players should not complete tutorial combat quests |
| `logAttack` anti-cheat telemetry, `trackBattleWon` | **unchanged** | work as-is with human defenders |

## 4. The five balancing picks (operator-decided 2026-09-28)

Each pick: the decision, the why, and the tuning knob — constants ship **in this doc and the route together**, edited as one (the `BASE_RAID_BALANCE.md` pattern).

### 4.1 Loot caps — cap by the attacker, not the defender

**Pick:** PvP loot per raid = `min(defender stockpile, ATTACKER_LOOT_CAP × attacker level)` per declared resource, base multiplier **1×** (the 3× Beer premium stays bot-specific). Default `ATTACKER_LOOT_CAP = 5,000` per resource per level — explicitly tunable.
**Why:** bot loot is capped by the bot's own vault ceiling, but players have no spawner-defined vault, so a defender-side cap is meaningless — and uncapped player-stockpile raiding is the 452M-single-raid incident class (FID-20260915-004 Fix C). An attacker-scaled ceiling keeps raiding profitable against peers, unprofitable against alts, and bounded at every level.

### 4.2 Defender losses — real casualties, with a floor

**Pick:** defender unit losses **persist** per the same battle math, but one raid can never drop the defender's army below **25% of pre-battle total strength** (`DEFENDER_LOSS_FLOOR = 0.25`) — overflow is absorbed by the floor. **No unit capture** on base raids (the infantry path's 10–15% capture is that path's reward economy; mixing them double-pays winners).
**Why:** the attacker already bleeds real units; if the defender's casualties vanished, raiding players would be free farming. The floor is the harassment brake: a raid hurts, a streak cannot strip a player's army overnight.

### 4.3 Raid cadence — the existing period lock, extended to humans

**Pick:** the FID-20260912-093 one-raid-per-base-per-reset-period lock (counts wins *and* losses — "the garrison knows who came") now covers all hostile bases including players. Same period definition (`getRaidPeriodStart`), same refusal message pattern.
**Why:** it is already in the route, keyed by usernames rather than botness, and one attack per defender per period is the overnight-drain limit. Near-zero new code; the mechanism just stops assuming bots.

### 4.4 Defeat semantics — loot transfer only; players are Full Permanence a fortiori

**Pick:** a player defeat = the capped loot transfer + the battle-log notification + XP. **No** tile release, no base removal, no resource regrow event, **no post-defeat protection shield** — the period lock *is* the grace window.
**Why:** Beer Bases are removed on defeat and bots regrow by design (the bot-phase doc's Full Permanence model); players are more permanent than either — the game cannot delete or respawn them. A short defeat shield is recorded as the v2 lever if drain-farming telemetry ever appears (decided on data, like the 429-telemetry precedent).

### 4.5 Offline defense — none in v1; ADM stays research

**Pick:** no offline-defense multiplier in v1. The `docs/research/PBBG Territory Capture Design.md` ADM concept (activity-scaled defense) is unratified research and an entire activity-scoring subsystem.
**Why:** unlike clan territories, a personal base's garrison is the player's **real army** — defense quality is identical online or offline; there is no "empty base" to blitz. The binding constraints (period lock + 25% floor + attacker-level loot cap) already bound the worst-case offline loss. ADM is the named v2 lever, on telemetry.

**Riding along (existing guards, confirmed, not new decisions):** presence-at-tile · new-player protection parity (§3 harvest) · flag-bearer cannot initiate (§5.5 restricted list) · self-attack block · declared-resource semantics.

## 5. Explicit non-goals (v1)

- **No new UI.** The existing tile ATTACK button is the interface; the battle log is the review surface (operator design, §1).
- **No unit-selection screen.** Armies commit whole — the same as bot raids. Auto-farm's `selectUnitsForCombat` is an engine strategy, not the manual model.
- **No combat-math changes.** `resolveBattle`, level-gap protection, army-balance multipliers: untouched (FID-20260916-008 seam rule).
- **Zero regression on PvE.** The bot path must behave byte-equivalently: the same route serves both, and the bot branch is pinned by the existing suite (including the auto-farm tile-flow pins) plus a new explicit bot-path-unchanged pin.
- **No clan-war integration.** `ENHANCED_WARFARE_DESIGN.md`'s 48-hour war seasons, spoils ceremonies, and territory sieges are a separate clan-scale system; personal raids consume no war declaration and pay no war fee. The systems touch only through the shared hostility rule (§2).

## 6. Risks and guards

- **Win-trading / spoils laundering:** same-clan and all-alliance-type pairs are blocked at the hostility layer (§2) — the warfare doc's cartel-war concern cannot route through exempt pairs. Cross-clan alt farming is bounded by the attacker-level loot cap (repeat farming against a farmed-by-design victim pays ceiling-rate, worse than bot alternatives) and the period lock. Recorded as a **telemetry-watch item**, deliberately not over-engineered in v1.
- **New-player experience:** protected defenders refuse raids (parity, harvested); the tutorial's combat quests stay bot-targeted (§3). A brand-new player's base is reachable only by someone who walked to it — presence is the geographic cost.
- **Balance drift:** every constant in §4 lives here and in the route, edited together; the ladder-tuning precedent (FID-20260915-003) is the model for future sweeps.
- **The stale route:** `app/api/battle/attack` is deleted after its protection-parity work is harvested (§3). Its unsound contract (client-supplied `defenderUnits`) and its Zod-schema divergence die with it; `lib/battleTrackingService`'s docblock pointer is repointed. Two similarly-named combat routes remain: `combat/attack` (this flow) and `combat/infantry` (auto-farm's field battles) — the deletion removes the third, unsound one.

## 7. Implementation sketch (post-ratification, via rescoped FID-20260928-006)

Staged so each lands green independently:

1. **Harvest:** protection-parity helper into `lib/` (from the stale route) with pins — refuse protected defender; attacker window voids on aggression.
2. **Hostility helper:** `lib` function implementing §2's truth table (self / same-clan / areAllies) with pins for every cell, including unclanned-edge cases.
3. **Route rewiring:** replace the `isBot` refusal with the hostility check; player-defender army conversion; defender-casualty floor helper; loot-ceiling constants; period-lock scope. Pins: truth table through the route, floor holds, cap holds, period lock covers a human defender, **bot path unchanged** (behavioral pin), protection refusals surface verbatim (FID-20260911-041 pattern).
4. **Delete** `app/api/battle/attack` + repoint the docblock; inverted-route census stays clean.
5. **Ledger:** row 69 annotation (battle line resolved via this doc), CHANGELOG/VERSION, session summary; FID-20260928-006 rescoped onto this document (its manual-modal premise retired on the operator's recorded design statement).

Verification per the house chain: tsc 0 · eslint 0/0 · full suite green · census 0 · inverted-route census clean.

## 8. Ratification

- [ ] **Operator ratifies this document** (or amends §2/§4 picks — the doc absorbs edits before code).
- On ratification: FID-20260928-006 rescoped (status → `analyzed`, GREEN = §7), and implementation proceeds under the standard loop. No code moves before the box is checked.

---

## Appendix A — Blast-radius census (executed 2026-09-28, pre-ratification)

Method: `grep -rc isBot` across lib/app/components/utils/types/__tests__ with every consumer bucketed; hostile-refusal surface grep across `app/api`; tutorial-hook read; TileRenderer read; engine target-selection read; test-pin greps. Every claim below is a pasted-probe finding, not an inference.

### A1. The one direct change site

`app/api/combat/attack/route.ts:243-245` is the **only** hostile-base admission gate in the tree — every other `isBot` hit under `app/api` is an exclusion query (`ne(players.isBot, 1)` class: leaderboards, referrals). §3's hostility-check replacement touches exactly one gate.

### A2. Harvest-then-delete

`app/api/battle/attack/route.ts` (protection parity, FID-20260916-008) per §3 — zero UI callers confirmed again by this census.

### A3. Exclusion-domain consumers — MUST NOT change (verified out of the file list)

| Area | Sites | Domain |
| ---- | ----- | ------ |
| `lib/rankingService.ts` (5), `app/api/referral/leaderboard/route.ts` (5) | leaderboard/referral exclusion of bots | untouched |
| `lib/flagBotService.ts` (8), `app/api/cron/flag-bot-movement/route.ts` (4), `__tests__/lib/flagHolderSurvival.test.ts` (4) | flag-bearer bot system | untouched |
| `lib/playerService.ts` (4), profile route + page (2+3) | profile/queries excluding bots | untouched |
| Admin surface: `AdminView.tsx` (5), `PlayerDetailModal.tsx` (2), `bot-config` (3), `tutorial-diagnostic` (7) | admin diagnostics/counting | untouched |
| Bot machinery: `botService` (2), `botCombatService` (4), `botSummoningService` (3), `botGrowthEngine` (2), `botFactoryEconomy` (2), `beerBaseService` (7), migrations (3+2) | Full Permanence, growth, resync | untouched |
| `lib/factoryService.ts` (2) + `__tests__/lib/factoryCaptureVoid.test.ts` (5) | factory-capture semantics — adjacent domain, different routes | untouched |
| `types/game.types.ts` (2) | type declarations | untouched |

### A4. Verified already-safe by construction (no change needed)

- **Tutorial:** `recordTutorialBaseAttack` gates at the *service* on `step.validationData?.targetType !== 'beer_base'` (`lib/tutorialService.ts:1066`) — even with the route hook firing on a human raid, the step cannot complete. The census closes the design doc's earlier caution: tutorial combat quests are bot-targeted by construction, not by route convention.
- **Tile rendering:** `TileRenderer` is bot-agnostic — the garrison label derives from `baseLevel` (`:98-108,316-342`), the Beer image keys on `isBeerBase`, never `isBot`. A human-held base already renders exactly like any enemy base.
- **Client dispatch:** `page.tsx:863-865` already routes *every* enemy-held tile to `/api/combat/attack` — zero client changes, and the client stays a non-authority on hostility (§2).
- **Test pins:** `defeatBookkeeping.test.ts` pins pure bot-bookkeeping functions (declared-resource zeroing, vault caps) — no pin exists on the `'Target is not a hostile base'` refusal text, so the gate replacement breaks no existing test; the new pins are additive (§7).

### A5. Orthogonal (verified, no interaction)

- **Auto-farm:** its `attackPlayers` combat path (`utils/autoFarmEngine.ts:748` → `attackBase` at `:1196-1268`) fights through `/api/combat/infantry` (rank-filtered, 10-unit cap) — it never calls `/api/combat/attack`. Opening the unified gate does not alter engine behavior at all; the engine's PvP path is the infantry route and stays as-is.
- **BeerBasePanel:** remains bot-targeted (reads beer-base config rows); the manual tile button is the only human-defender entry point.

### A6. Net blast radius

**One gate replacement + one harvest + additive pins.** No rendering, tutorial, leaderboard, profile, admin, migration, or engine changes. The narrowness is the census's headline: the `isBot` web is wide, but almost all of it is exclusion logic on the other side of the wall this change does not touch.
