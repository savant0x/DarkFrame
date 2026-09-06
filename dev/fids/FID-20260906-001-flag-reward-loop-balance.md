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

## 2. Findings (RED evidence — file:line, all verified live where noted)

### A1 — Zero reward for capture or defense
- `app/api/flag/attack/route.ts` (post-§7.2 state): the defeat branch updates `flags`, restores
  the bearer's HP, and returns a message. **No RP, XP, metal, or energy is granted** to the
  victor; the defeated bearer loses nothing.
- Verified live: the 10-hit defeat test (§7.2 record) produced no resource/RP delta on the
  attacker beyond the pre-existing per-hit XP in `battleLog`-adjacent paths (none written here).

### A2 — No hold-duration incentive
- `FLAG_CONFIG.MAX_HOLD_DURATION = 3600` (`types/flag.types.ts:175`) is a **ceiling**, not a
  reward: nothing reads `holdDuration` for payout. `buildTrackerData`/`formatHoldDuration`
  (`lib/flagService.ts:251`) only format it for display.
- Design intent per README/UI copy: "hold the flag" — currently holding is pure risk, zero upside.

### A3 — Bot difficulty is flat and trivial
- `FLAG_BOT_CONFIG` (`lib/flagBotService.ts:38`): tier 2, Balanced, 1000 HP fixed.
- Verified live: every hit dealt exactly **100 damage** (base `BASE_ATTACK_DAMAGE` with ~0
  power multiplier at low strength) → **10 attacks kills the bot**; at 60s client cooldown that
  is ~9 minutes of waiting, zero counterplay by the bot (it never attacks back, never flees).
- `moveFlagBot` teleports every 30 min — a moving target for defense, but irrelevant while it
  never fights.

### A4 — Attack damage scaling is unbounded and off-economy
- `app/api/flag/attack/route.ts`: `powerMultiplier = 1 + attackerPower / 100000` — at late-game
  strength (millions) a single hit deals 10–30× base damage: one-shot kills, capture speedrun,
  no interaction for the defender.

### A5 — Server-side cooldown absent
- Verified live: 10 attacks in ~2 seconds all landed (no 429). The client's 60s countdown is the
  only cooldown (`app/game/page.tsx:637-650`). `FLAG_CONFIG.ATTACK_COOLDOWN` is enforced
  nowhere server-side. (Presence + identity are server-side; cooldown is not.)

## 3. Five Questions (RED)

1. **What breaks if we do nothing?** The flag is decorative: capture is a 10-click chore with no
   payoff; no one will contest it; the "flag" PvP loop stays dead on arrival.
2. **Why now?** The flag feature was just revived (§7.2); shipping it without a reward loop
   re-buries it.
3. **Who is affected?** All players (attacker/defender economy), bot difficulty, admin config
   surface (`wmd_config`-style tuning is not available for flags — constants are code).
4. **What is the smallest correct change?** Add payout + cooldown in the attack route, read
   hold-duration in one new cron/helper, scale bot HP by tier — no new tables (reuse `players`
   resource columns and existing RP service).
5. **What must NOT change?** Presence enforcement, HP persistence, defeat/transfer flow, trail —
   all just verified live; this FID touches only numbers + payouts.

## 4. GREEN Design — proposed numbers (OPERATOR DECISION REQUIRED)

| Knob | Current | Proposed | Rationale |
| ---- | ------- | -------- | --------- |
| Capture reward (victor) | 0 | **2,500 RP + 1,000 metal/energy** | Meaningful vs early income (harvest ≈ 1,000/tile) without being grindable |
| Hold bonus | none | **150 RP + 50 metal/energy per 10 min held** (paid on capture-interval cron, cap 1h) | Makes holding active income; total max hold ≈ 900 RP + 300/300 |
| Defeat penalty (loser) | none | **lose 10% of carried unbanked resources** (banked safe) | Real stakes, doesn't touch banked/bank |
| Bot HP | 1000 flat | **tiered: 1,000 / 2,500 / 6,000** rotating by week-of-month (W1–2 weak, W3 mid, W4+ strong) | Weekly variety; strong weeks need groups |
| Bot damage reflect | none | bot deals **50 dmg/hit back** (weak) / 150 (mid) / 400 (strong) | Attacker needs army size to matter |
| Attack damage | `1 + power/100k` × 100 | **`80 + 40 × log10(1+power/1000)`** (soft-capped ≈ 340 at 1M power) | Log scaling: early game viable, late game can't one-shot |
| Server cooldown | none | **60s per attacker** via `players.lastFlagAttack` (column exists in domain; add smallint epoch column if absent) | Server-authoritative; closes A5 |
| Capture global lockout | none | **15 min channel-wide cooldown after any capture** (flag uncontestable, held in `flags.lastCapturedAt`) | Prevents capture ping-pong between two alt accounts |

### Implementation surfaces (GREEN)
- Payouts: `app/api/flag/attack/route.ts` defeat branch + new `lib/flagRewardService.ts`
  (single seam; uses existing RP transaction service — same one the RP economy routes use).
- Hold bonus: extend `lib/jobs/flagBotManager.ts` tick (it already reads `flags` hourly).
- Damage curve + cooldown: attack route; add `lastFlagAttack` column via migration 0016
  (verify column absence first — `players` domain type has it, schema may not).
- Bot tier: `FLAG_BOT_CONFIG` gains per-tier HP/damage; `resetFlagBot` picks by week-of-month.

## 5. Verification plan (GREEN)

1. Unit-drive `flagRewardService` headless: capture → exact RP/resource delta; defeat → exact
   10% unbanked transfer; assert banked untouched.
2. Live: defeat bot on weak week → payout observed in DB; second capture inside 15 min →
   rejected with lockout message; second attack within 60s → 429 server-side.
3. Hold bonus: set `last_captured_at` back 20 min → run cron tick → exactly one 300 RP grant
   (idempotent on re-run).
4. Damage curve: simulate power 0 / 10k / 1M → expect 80 / ~132 / ~280 (± rounding).
5. Full gates: tsc 0, tests green, lint-delta 0 on touched files, then push + prod spot-check.

## 6. Loop record

- **Pass 1 (SELF-AUDIT of this document):** verified every cited line against current tree;
  A5 verified live (no 429 in hammer test); the proposal table is explicitly out of the
  implementation path until operator sign-off — Status remains `created`, NOT `converged`.
- **Pass 2:** re-read §4 vs §2 — every finding maps to exactly one knob; no knob without a
  finding. Lockout design uses `flags.lastCapturedAt` (already maintained by capture paths —
  no new write seam). Delta pass1→2 < 2%.

**Status:** created — awaiting operator decision on §4 numbers before convergence/implementation.
