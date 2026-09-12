# FID-20260912-076 — Clan Warfare & Territory: Real Build (War Engine v2)

**Date:** 2026-09-12 · **Trigger:** user review request — "i don't think it's built,
if not, we need a proper fid + perfection loop, and redesign if it's weak."
**Verdict: not built — a facade. Redesigned and rebuilt below.**

## Part 1 — Audit findings (what actually exists today)

| Piece | Claimed (types/UI/routes) | Reality (verified in code + prod DB) |
|---|---|---|
| Declare war | Full flow w/ cost | The ONLY persistence is a `WAR_DECLARED` row in **mod_log**. No war entity exists. Treasury debit + mod_log insert are transactional — you pay 50k/50k for a log entry. |
| War reads | Wars tab, history | `getActiveWars`/`getClanWarHistory`/`getWar` are stubs returning `[]`/null. `/api/clan/wars` reconstructs "wars" by grepping mod_log. No status transitions ever occur — wars cannot start, progress, or end. |
| End war | WIN/LOSS/TRUCE | `endWar` literally `throw`s: "not yet migrated to Drizzle". Spoils/Objectives code is unreachable. |
| Capture territory | Deterministic war outcome | **RNG coin flip** (`Math.random() < 0.7 - defense`), callable by ANY officer of ANY clan against ANY clan — **no war required**, no cooldown, no cost, infinite spam. Mutates `clans.territories` jsonb. |
| Territory | Map control w/ adjacency + income | Territory lives ONLY in `clans.territories` jsonb — `tiles` has zero clan columns; the live map shows nothing. `MAX_TERRITORIES: 100` marked deprecated vs `TERRITORY_LEVEL_CAPS` (25→700). Income collection exists as an on-demand route only — no scheduled job, so income accrues only if someone clicks. |
| Live state | — | `select count(*) from clans` → **0 rows**. The system has never run. |

**Design weaknesses (even if it worked):** pay-to-declare with nothing to do
after; RNG instead of played combat; capture doesn't require the war it claims
to serve; no settlement loop; no map presence; mod_log as a war ledger.

## Part 2 — The redesign (War Engine v2)

Principles: **war is a state machine over real data; capture is earned through
the same combat math players already use; the map is the scoreboard; endings
pay out automatically.**

### Data model (migration 0029)
`clan_wars` table: `war_id` (pk), attacker/defender clan ids + names + tags,
`status` (DECLARED→ACTIVE→ENDED/TRUCE), timestamps, declaration_cost (jsonb),
score (`attacker_score`, `defender_score` int — 1 per won battle),
captures (`attacker_captures`, `defender_captures` int),
`ended_at`, `outcome` (ATTACKER_WIN/DEFENDER_WIN/TRUCE), `spoils` jsonb.
Indexes on both clan ids + status.

### War lifecycle
- **Declare** (L10+ clan, leader/co-leader/officer, 50k/50k treasury):
  inserts a real `clan_wars` row (status DECLARED, becomes ACTIVE immediately)
  in the same transaction as the treasury debit. Cooldown: no second
  simultaneous war between the same pair (either direction). Cooldown after
  end: 7 days (checked from `ended_at`).
- **Score:** real battle outcomes feed the war.
  `battleService.resolveBattle` (player-vs-player base attacks) and the
  factory-attack path award +1 to the winner's side **when a war is ACTIVE
  between the two clans** (looked up by the attackers'/defenders' clan ids).
  recording function is idempotent-guarded by a lightweight in-memory
  last-recorded set (single server process).
- **Capture (contested, requires war):** `captureTerritory` now:
  1. requires an ACTIVE war attacker→defender,
  2. requires attacker STR ≥ defender factory-style defense (reuse
     `getFactoryDefense`-style curve math via territory defense bonus),
  3. uses the SAME strength-comparison resolution as `attackFactory`
     (attacker STR + random jitter vs defense) — no pure coin flip,
  4. costs 25k metal/energy per attempt (treasury), win or lose,
  5. limited to 3 captures per clan per war per day (tracked in war row via
     `capture_attempts` jsonb day counters),
  6. moves the tile in both clans' jsonb + updates `stats_total_teritories`
     counters, records +1 capture on the war, awards clan XP
     (`territory_claim` source), logs to mod_log.
- **Settlement (hourly job):** wars that have been ACTIVE ≥ 48h minimum
  duration settle automatically:
  - more captures → that side wins; tie → higher score; still tied → TRUCE.
  - Winner takes `calculateWarSpoils` (15%/15%/10% of loser treasury/RP) —
    transferred loser→winner treasury via the same atomic pattern as bank
    distribution, RP via `awardRP` split evenly among winner members (cap
    per member), +`WAR_VICTORY_XP_BONUS` clan XP; loser pays
    `WAR_DEFEAT_XP_PENALTY` (clamped ≥0).
  - War row → ENDED/TRUCE with outcome + spoils jsonb. Both clans get an
    inbox notification (styled system message, war-result type).
- **Truce:** leader/co-leader of EITHER side can propose; if both sides
  propose within 24h (or single-side after 7 days of war), settles as TRUCE
  with no spoils. (Stored as two booleans + timestamps on the row.)

### Territory (kept, corrected, made visible)
- Adjacency + level caps (25→700 curve) + claim costs stay.
- `MAX_TERRITORIES: 100` deprecated constant deleted; level caps are canon.
- **Daily income job:** hourly scheduler collects due territory income
  (existing `collectDailyTerritoryIncome` semantics) so clan treasuries
  actually accrue — income route stays for manual collection display.
- **Map visibility:** tiles rendered from clan territory get a clan-colored
  overlay via `GET /api/clan/territory/list` data already cached per clan —
  deferred to the map-overhaul FID (spec exists) to keep this one shippable.

### Surfaces
- `/api/clan/wars` reads the real table (active + history) — mod_log grep
  deleted. Declare/capture/truce routes rewritten thin over the service.
- `ClanWarfarePanel` Wars tab shows real wars with live score/captures,
  settle-countdown, capture button (enabled only when legal, with the real
  rejection reason surfaced à la FID-075).
- Admin jobs-status: new War Settlement card (start/stop/run-now).

### Anti-abuse
- Capture cooldown 6h per clan; attempts cost treasury even on failure;
  declare requires L10 (curve: ~level 10 needs sustained harvest+combat XP —
  achievable in days for active clans, not years).
- All money movements transactional; all rejections return machine-readable
  reasons.

## Part 3 — Execution checklist
1. Migration 0029 (`lib/db/migrations/0026_clan_wars.sql` record +
   `lib/migrations/clanWars.ts` boot runner, server.ts registration).
2. `clanWarfareService.ts` rewrite over the real table; keep exported
   constants (same values); delete the mod_log war ledger.
3. `recordWarBattleOutcome(winnerClanId, loserClanId)` + hooks in
   `battleService.resolveBattle` and factory attack victory path.
4. `lib/jobs/clanWarSettlementManager.ts` + jobs-status wiring.
5. Routes: wars (real read), declare, truce, capture.
6. ClanWarfarePanel updates.
7. Tests: declare validation, settlement matrix (win/lose/truce), capture
   gating, spoils math. Gates + live verify + PR.
