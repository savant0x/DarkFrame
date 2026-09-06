# FID-20260906-001: Flag Capture Reward Loop & Difficulty Balance

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-001-flag-reward-loop-balance.md`
**ID:** FID-20260906-001
**Severity:** MEDIUM (economy/design; no data-loss exposure)
**Status:** created
**Created:** 2026-09-06

---

## 1. Summary

The flag feature is mechanically functional (revived per FID-20260905-001 §7.2) but has **no
reward loop at all**: captures pay nothing, holding pays nothing, losing the flag costs nothing,
and the bot is trivially beatable by any player who walks to it. This FID inventories the
current economy and proposes tuned numbers — **proposals only; nothing changes until the
operator approves them.**

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
