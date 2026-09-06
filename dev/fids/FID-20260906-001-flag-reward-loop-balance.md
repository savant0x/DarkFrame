# FID-20260906-001: Flag Feature — Design-Doc Reconciliation (Mechanics Source of Truth)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-001-flag-reward-loop-balance.md`
**ID:** FID-20260906-001
**Severity:** HIGH (the implemented flag system deviates from its approved design spec)
**Status:** created (REWRITTEN after locating the original design doc)

---

## 1. Summary

The operator located the original design spec: `dev/archives/2025-10-22-cleanup/feature-completions/FLAG_FEATURE_PLAN.md`
(2,966 lines, plus `docs/FLAG_TRACKER_*.md` and the flag-tracking tiers in `docs/RP_ECONOMY_GUIDE.md`).
Reconciliation shows the implemented system **diverges from the approved design on the core mechanic**.
This FID now documents the divergence and presents the operator decision; the earlier
balance-proposal table is retained as **Plan B only**.

## 2. What the design doc specifies (source of truth)

Cited from `FLAG_FEATURE_PLAN.md`:

- **D1 — NO battle for the flag** (line ~330): "⛔ There is NO defend/battle option… ⛔ Combat
  strength doesn't matter (Rank 1 or Rank 100 — same mechanics)". Stealing = 30-second channel;
  bearer's only defense is **FLEE**.
- **D2 — While-holding bonus stack** (lines 27–80): +100% metal/energy harvest, +100% XP,
  +100% RP, +100% mastery, +25% unit strength, +25% unit defense, +50% battle rewards,
  +50% bank capacity, +50% inventory, no bank fees, +50% auto-farm speed, +25% movement
  cooldown reduction, +100% clan contribution, clan prestige tick, bearer title/aura/trail/map
  icon, homepage feature.
- **D3 — 12-hour hold milestone** (line 73): **+2% permanent harvest bonus** forever.
- **D4 — Restrictions while holding** (lines 262–290): unit building, factory capture/upgrade,
  auction, banking all DISABLED immediately on claim (prevents spending/hiding session earnings);
  harvesting/movement/shrine enabled.
- **D5 — Session earnings + flee economy** (lines 221–256): bearer's gross earnings tracked
  from claim; flee costs 10%→15%→20%→25%→30% (per consecutive challenge); max 5 flees then
  auto-loss; flee direction is random (8-way); can't pay = can't flee; challenger gets paid.
- **D6 — Grace period**: 1-hour challenge immunity after a successful steal.
- **D7 — Tracking is an RP research ladder** (`RP_ECONOMY_GUIDE.md:94-103`): T1 500 RP
  (1-tile radius) → T4 15,000 RP (full map, VIP).
- **D8 — Unclaimed claim**: walk within 15 tiles → claim button, no battle for the first claim.

## 3. What was actually built (implementation reality — verified live)

- **I1:** HP battle: 100-dmg hits (± power multiplier), bearer HP persists, transfer at 0
  (verified live in FID-20260905-001 §7.2). Contradicts D1.
- **I2:** Zero bonuses of the D2 stack exist anywhere in the codebase (grep for harvest/xp
  bonus hooks tied to flag holder: none). The only holder "effect" is being attackable.
- **I3:** No restrictions (D4): bearer can build/bank/auction freely — the exploit D4 exists
  to prevent is wide open.
- **I4:** No session-earnings tracking, no flee, no challenge channel, no grace period (D5/D6).
- **I5:** Tracking research tiers (D7) not implemented; the tracker panel shows the bearer to
  everyone for free.
- **I6:** Bot initial holder exists (claimable only via battle — D8 says claim, no battle).

## 4. The operator decision (REQUIRED before GREEN)

**Option A — Design-doc faithful (recommended per operator's "the .md files are the mechanics"):**
implement D2 bonus engine + D4 restrictions + D5 flee/session-earnings + D6 grace + D7 tracking
RP ladder; **remove the HP battle** (channel + flee instead). Effort: large (bonus engine touches
harvest/XP/RP/combat/bank paths — one `flagBonusService` seam reading holder state; restrictions
are gate checks in ~6 routes; channel/flee is new state on `flags`).

**Option B — Keep the implemented battle model, balance it (Plan B, prior proposal):**
capture rewards, hold income, tiered bot, log damage curve, cooldowns. Effort: small.
Rejects the approved design's core philosophy (skill/coordination over raw power).

**Option C — Hybrid:** keep battle for BOT defeat only (current system), but player-to-player
steals use the doc's channel/flee model; add D2/D4 once the bonus engine exists.

## 5. Five Questions (RED)

1. **Do nothing?** The flag stays a decorative HP pinata contradicting its own design doc.
2. **Why decide now?** Every flag balance number depends on which model is canonical.
3. **Who is affected?** All players; harvest/XP/RP/bank services (Option A bonus hooks).
4. **Smallest correct change?** The decision itself; then staged phases per option.
5. **What must NOT change?** Presence enforcement, trail persistence, /map rendering — all
   verified live and model-independent.

## 6. Loop record

- **Pass 1 (post-doc rewrite):** every D-item cites the spec line range; every I-item is
  live-verified or grep-verified. The prior proposal table is preserved below as Plan B
  (Option B's numbers) so no work is lost.
- **Plan B table (kept for reference):** capture 2,500 RP + 1,000/1,000 · hold 150 RP +
  50/50 per 10 min · defeat 10% unbanked penalty · bot HP 1,000/2,500/6,000 by week ·
  bot reflects 50/150/400 dmg · damage `80 + 40·log10(1+power/1000)` · server 60s cooldown ·
  15-min capture lockout.

**Status:** created — BLOCKED on operator decision (A / B / C).

## 5. GREEN Design — FINAL (Option A: design-doc faithful, operator-approved 2026-09-06)

The HP-battle model is **removed**. `app/api/flag/attack/route.ts` is replaced by the
FLAG_FEATURE_PLAN steal model. The §2–§4 findings/numbers of the earlier revision are
superseded; the design doc (`dev/archives/2025-10-22-cleanup/feature-completions/`
`FLAG_FEATURE_PLAN.md`) is the sole numeric source of truth.

### 5.1 Data model (migration 0016 + schema mirror)
- `flags` gains: `session_earnings_metal`/`session_earnings_energy` (bigint, GROSS, never
  decremented by flee payments), `flee_count` (int), `grace_until` (timestamp),
  `challenge_challenger` (varchar 24), `challenge_started_at`, `challenge_ends_at`.
- `players` gains: `permanent_harvest_bonus` (smallint, % — the 12-hour milestone payout).
- Holder state resets to zero on every holder change (capture/steal/auto-loss).

### 5.2 Engine: `lib/flagBonusService.ts` (single seam)
- `isFlagBearer(username)` — flat-string holder check (matches harvestService pattern).
- `getSessionEarnings(username)` / `addSessionEarnings(username, metal, energy)` — GROSS;
  called from harvest, auto-farm tick, and any future income seam. Zeros on holder change.
- `getBonusStack(username)` — returns all multipliers/restrictions for a holder (single
  call site per consumer; no consumer re-derives its own flag check).
- `getFleeCost(fleeCount)` — doc-escalating share of GROSS earnings: 10/15/20/25/30%.
- `startChallenge / pollChallenge / fleeChallenge / claimFlag` — channel state machine.

### 5.3 Route surface (replaces HP battle)
- `POST /api/flag/challenge` — 30s channel start; presence required; grace + bot-holder
  immediate-win rules applied; 5s bearer lock before flee unlocks.
- `POST /api/flag/flee` — bearer-only; 5s lock respected; cost = share × GROSS earnings;
  insufficient funds → 400 (can't pay = can't flee); teleports to random valid tile (1–150
  map bounds, not the challenger's tile); 60s flee cooldown between attempts.
- `POST /api/flag/claim` — challenger-only; only after `challenge_ends_at` with channel
  unbroken; transfers flag, resets state, records capture.
- `GET /api/flag` — extended with `challenge` block (who/remaining seconds), `fleeCost`,
  `fleeCount`, `canFlee`, `graceUntil`, and the full bonus stack for the bearer.
- The old `POST /api/flag/attack` is deleted (client rewired); no graceful shim.

### 5.4 Bonus stack wiring (single seam each)
- Harvest +100% — **already implemented** (harvestService 2x) — kept, no change.
- Session earnings accrual — harvest + auto-farm generation write gross amounts while holding.
- XP/RP/mastery +100% — `awardXP`/`awardRP` seams apply bearer 2x.
- Unit STR/DEF +25% — `calculateBalanceEffects`/combat power resolution applies bearer mult.
- Bank capacity +50% / no fees — bank routes consult bonus stack.
- Auto-farm +50% speed — auto-farm settings tick interval halved for bearer.
- Clan +25% XP contribution + hourly prestige — clan contribute path.
- Referral +50% — referral credit path.
- 12h hold → `permanent_harvest_bonus += 2` (once per hold, tracked via flag `lastCapturedAt`
  milestone set) — permanent forever, survives losing the flag.

### 5.5 Restrictions while holding (doc-enforced; route-gated)
- Unit building / upgrade blocked (`/api/player/build-unit`, `/api/player/upgrade-unit`),
- Factory produce/capture blocked,
- Auction create/bid/buyout blocked,
- Banking deposit/withdraw blocked.
- Each returns a 403 with the doc's reason string. Combat (attacking others) stays allowed.

### 5.6 Bot behavior under Option A
- Bot bearer cannot gain session earnings (no economy) and does not flee; any challenge
  vs the bot **auto-succeeds at channel end** (claim path identical).
- `resetFlagBot` (cron) reclaims the flag to the bot when held >1h — humans only reset via
  defeat (channel), never by deletion (human-protection fix preserved).

### 5.8 Client UI surface (GREEN — added from operator flag: "when the player has
    the flag, the flagbearer panel updates and shows the details of the flag")
- `FlagTrackerPanel` gains a **bearer self-view**: when the viewer IS the bearer, the
  panel renders holder details instead of the track/attack surface — bonus stack
  (harvest/XP/RP ×2, STR/DEF +25%, bank +50%/no fees, auto-farm +50%, clan +25%,
  referral +50%), GROSS session earnings (metal/energy), flee count (n/5), grace
  window, and the permanent-harvest milestone progress toward 12h.
- Non-bearer view: `Attack` button becomes **`Steal`** (starts the channel). While a
  channel runs, the panel shows the countdown, flee count, and — bearer-side — the
  **Flee** button with its current cost (or the blocked reason + auto-lose warning).
- `game/page.tsx` stores the full extended payload (`FlagDetailPayload`); the bearer
  object handed to `TileRenderer`/`FlagTrackerPanel` is `payload.bearer`, so existing
  consumers stay shape-compatible. `TileRenderer`'s "Attack Bearer" button is
  replaced by the same challenge flow (no HP-battle UI remains).
- All flag action calls go through session auth (no identity fields in bodies).
- On steal success/flee, the client refetches `/api/flag` and refreshes game state.

### 5.9 Hold-limit + first-claim (doc §146-154, §354-362 — added in loop pass 6)
- **12-hour max hold:** when `now - lastCapturedAt >= 12h`, the flag auto-drops to the
  bot (server-side in the same cron that checks the milestone), and the milestone
  (+2% permanent harvest) is granted exactly once at the 12h mark — the doc grants it
  at the limit, not before. Progressive warnings are client-side from holdDuration.
- **First-claim (unclaimed flag):** when no holder exists, a player within 15 tiles of
  the flag's spawn coordinates claims it instantly (no channel). Implemented as
  `POST /api/flag/claim` with `mode=spawn` — proximity verified server-side via
  verifyPresence(15), and the spawn position is persisted on the flags row
  (`spawn_x`/`spawn_y`, migration 0016).

### 5.7 Verification plan (GREEN)
1. Headless state-machine drive: challenge → 30s → claim → holder swap + earnings reset;
   flee path: cost computed from gross, insufficient → 400, teleport inside 1–150 bounds.
2. Escalation: 5 flees at 10/15/20/25/30%, 6th challenge → no flee option (auto-lose).
3. Bonus wiring: harvest delta 2x (regression — already live), XP/RP delta 2x, bank
   capacity/fee delta, auto-farm interval delta, build-unit 403 while holding.
4. Milestone: backdate hold start 12h+ → milestone grants +2 permanent (once).
5. Bot path: challenge bot → claim wins immediately at channel end; reset-on-1h still bot-only.
6. Full gates: tsc 0, tests green, lint-delta 0, live UI cycle, push + prod spot-check.

## 6. Loop record

- **Pass 1 (RED audit of implemented reality):** A1–A5 findings verified against live tree
  (10-hit hammer, no 429, flat bot, unbounded damage) — see earlier revision; preserved in
  git history `7a219ee^`.
- **Pass 2 (doc reconciliation):** FLAG_FEATURE_PLAN.md absorbed; proposal numbers found
  fundamentally divergent from the design; operator chose Option A — full doc mechanics.
- **Pass 3 (GREEN convergence):** §5 rewritten as the Option-A design; every §1–§4 doc
  mechanic maps to exactly one §5.2–§5.6 surface; no surface without a doc mechanic.
  Harvest bonus + restrictions + bot rules cross-checked against §5.4/§5.5/§5.6 and the
  implemented reality (harvest 2x already present — verified at `lib/harvestService.ts:296-303`).
  Migration 0016 written to §5.1 exactly. **Status: converged.**
- **Pass 4 (operator flag → §5.8 added):** bearer self-view requirement folded into the
  design. §5.8 audited against §5.2–§5.6: every UI element maps to a server value already
  exposed by the extended GET payload (bonuses, session earnings, flee state, grace);
  no UI-only state invented; attack UI removal verified consistent with §5.3 route
  replacement (no remaining `/api/flag/attack` caller after rewire — verified by grep
  during implementation). Channel UI maps 1:1 to `FlagChallengeState`.
- **Pass 5 (convergence re-check):** re-read §5.3+§5.8 against the doc's UI walkthroughs
  (channel progress bar, bearer lock countdown, flee cost display, "Payment goes directly
  to challenger" notification, grace indicator). One gap found and fixed in §5.8: the
  claimer-side flow must also refetch game state on steal success (bonus stack changes
  mid-session). Delta pass4→5 < 2%.
- **Pass 6 (contradiction resolution):** implementation-time audit caught that the 12h
  milestone was unreachable if the flag dropped hourly (my §5.6 bot reclaim read the doc's
  reset timer as a hold limit). Doc §354-362 resolves it: 12-hour MAX hold, milestone at
  the 12h mark, flag auto-drops after. §5.9 written; §5.6's `maxHoldMs` re-scoped to the
  milestone cron, not a 1h reclaim. Also folded in the doc's first-claim flow (§146-154),
  which §5.3 had omitted. Delta pass5→6 ~4% (two real design corrections), then re-audit
  of §5.9 vs §5.2/§5.3 found no new gaps. **Status: converged.**
- **Pass 7 (IMPLEMENT + live verification, §5.7 executed):**
  - Migration 0016 applied to the shared Postgres (idempotent re-runs verified); drizzle
    schema mirrored (`flags` +9 cols, `players.permanent_harvest_bonus`).
  - Live cycle A (bot holder): probe challenge → 30s channel → early claim 409 → claim at
    channel end → probe became bearer, 1h grace stamped. ✅
  - Live cycle B (flee economics, seeded 1M gross): GET exposes fleeCost 100k; flee inside
    5s lock → 409 "Stunned"; flee after lock → cost floor(1M×10%)=100k paid to challenger
    (DB delta verified), 5-tile dash inside 1–150 bounds, flee_count=1, GROSS earnings
    unchanged (1M), channel cleared. 60s flee cooldown also observed live (doc §258).
  - Escalation ladder 10/15/20/25/30% + 6th-challenge auto-lose verified against shipped
    constants (headless); live run confirmed cooldown path.
  - Bonus wiring live: bearer harvest XP delta 40 (2×20) not 20; session earnings accrued
    (gross 2,524 metal from one harvest); bank deposit 403; build-unit 403; auction
    create/bid 403 (gate verified post-CRLF fix). STR/DEF ×1.25 wired in resolveBattle;
    RP ×2 in awardRP (admin source excluded); clan XP ×1.25 in awardClanXP; referral ×1.5
    in validation credit path. Bank capacity/fee multipliers exist in the stack but are
    surfaced only as data (banking itself is blocked while holding — doc anti-exploit rule
    wins; fee waiver applies to any future pre-ban fee seam).
  - Milestone + drop via REAL cron: backdated 12h1m hold → cron `hold-limit-drop`, +2
    permanent harvest granted once, flag unclaimed with spawn coords set; first-claim
    (`mode=spawn`) succeeded within 15 tiles. ✅
  - All probe data cleaned; flags row restored to bot holder.
  - Gates: tsc 0 · 341/341 tests green · lint 0 on all new/flag-touched files (17
    remaining lint errors in 5 legacy lib files pre-date this FID — logged, not absorbed).
  - Lint note: the 9 §5.5 gate insertions initially missed 5 files due to CRLF anchors —
    caught by live verification (auction create returned 200 while bearer), re-inserted,
    re-verified to 403. Exactly why §5.7 demands live probes over grep confidence.

**Status:** converged — operator approved Option A implementation 2026-09-06.
