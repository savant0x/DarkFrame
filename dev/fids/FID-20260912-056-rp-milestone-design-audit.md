# FID-20260911-056 — RP Milestone Audit: Design-First Verdict + Milestones v2 Proposal

**Date:** 2026-09-12 · **Trigger:** post-revival audit of the harvest-milestone
RP economy (FID-045 revived the dead source). **Stance (operator):** no design
doc is binding — GPT-4-era docs are inputs, not law. This audit judges the
system on its own merits.

## 1. What exists today (measured, live DB)

Milestones (per AM/PM reset period, i.e. **per half-day**):

| Threshold | RP | — | Threshold | RP |
|---|---|---|---|---|
| 1,000 | 500 | | 10,000 | 1,500 |
| 2,500 | 750 | | 15,000 | 1,750 |
| 5,000 | 1,000 | | 22,500 | 2,500 |

Monotonic tail per FID-006 P4 (15k was 1250, 22.5k was 1000 — now 1750/2500).
`awardRP` stack: ×1.5 VIP, ×2 flag bearer (admin exempt). Other sources:
`daily_login` 100 + 20×streak, `battle` 100+20×target level, tech tree spends
5k–15k, WMD ladder 50k–330k (clan research + clan perks also spend RP).

## 2. The doc-vs-code comparison (the literal ask)

| Aspect | Original design (RP_ECONOMY_AUDIT) | FID-006 P4 proposal | Code today | Verdict |
|---|---|---|---|---|
| Tail values | 15k→1250, 22.5k→1000 (non-monotonic) | 15k→1750, 22.5k→2500 | **1750 / 2500** | P4 implemented ✓ |
| Envelope | "6,000–12,000/day target" | 7,750/day full map | 7,750 base × multipliers | P4 math ✓ |
| Multipliers | VIP +50% | unchanged | ×1.5 VIP, **×2 flag** | flag ×2 added by FID-001 |

So: the code faithfully implements P4. **The audit conclusion is that P4 —
and the doc it patched — is itself the wrong design.** Three structural
findings:

## 3. Finding A — the milestone curve is unreachable for humans, trivial for bots

Harvestable tiles: **10,871** (Metal 4619 + Energy 4464 + Cave 1788), each
harvestable **once per player per half-day** (west half resets midnight, east
half at noon — `getCurrentResetPeriod` splits at x=75).

- The **theoretical human max** is ~5,300 harvests/half-day (every harvestable
  tile, both halves). Milestone thresholds of 10k/15k/22.5k **cannot be
  reached by a human being** — they're not "hard," they're dead tiers.
- **AutoFarm reaches them trivially.** Cycle ≈ 1.5–2s (200ms move + ~800ms
  harvest + delays), VIP ≈ 5.6h to sweep all harvestable tiles = ~10.8k
  harvests/day → **10k threshold guaranteed, 15k+ partially, every day,
  AFK**. The "full map" 22.5k tier is bot-only and the doc's own "Active
  Player (22,500 harvests/day)" premise was never physically possible with a
  0.15s-per-tile human hand.
- The doc's progression table ("Flag T4 in 2 days of active play") was
  computed assuming **an inhuman 22.5k harvests/day**. The curve's whole
  shape is calibrated to a player who doesn't exist.

## 4. Finding B — rewards scale with tile count, but the *rest of the game* pays by the half-day

Milestone thresholds count harvests; everything else (terrain yield, tile
cooldowns, the two-period reset) is designed around ~5.3k opportunities per
half-day. A curve whose 6 rungs live at 1k–22.5k while the ceiling is 5.3k
means 3 of 6 rungs are unreachable and the reachable rung spread (1k vs
2.5k vs 5k) is the entire actual reward ladder — an accidental 3-rung system
dressed as a 6-rung one.

## 5. Finding C — the multiplier stack, not the base, is the real balance surface

Base 500 at ×1.5 VIP ×2 flag = **1,500 RP per crossing**, and the flag
bonus applies to *every* source while the flag itself is transient state
(anyone can capture it). The FID-045 live test measured exactly this stack.
Balance work that tunes base amounts without noticing the stack (as both the
doc and P4 did) tunes the wrong dial by 3×.

## 6. Proposal — Milestones v2 (operator decision required, numbers are mine)

**Design goals:** every tier reachable by an active human; AutoFarm rewarded
linearly, not superlinearly; base curve tuned so the ×3 stack lands inside a
deliberate envelope.

- **Half-day curve (5 rungs), thresholds at ~19%, 38%, 57%, 76%, 95% of the
  5.3k half-day ceiling:** 1000 → 200 RP, 2000 → 300, 3000 → 400, 4000 → 500,
  5000 → 750. Base total **2,150/half-day → 4,300/day** at base.
- **With the ×3 stack that's up to ~12,900/day for a VIP flag-bearer doing a
  full sweep** — top-end, AFK-assisted, and consistent with the WMD ladder
  (50k–330k = ~4–26 full-sweep days for that best case; months for non-flag
  players). Today's curve pays the same best case 7,750 base / 23,250
  stacked but with 3 dead tiers.
- **Anti-idle invariant:** thresholds expressed as % of `harvestableTileCount`
  computed from the live tiles table (not magic 22,500), so map regeneration
  can never re-break the curve.
- **Alternative (minimal-touch):** keep the current curve, delete the three
  unreachable tiers (>5,300), rescale the rest. Honest but keeps a
  bot-calibrated ceiling as the design's anchor.

Explicitly **not** proposing: per-24h periods (the AM/PM split is good — it
gives two play sessions and punishes nothing), removing the flag ×2 (that's
a separate, deliberate FID-001 lever), or touching WMD/tech prices in this
FID.

## 7. Also in this pass

- `dev/EGRESS-WATCH.md` gained a **Reading Log** section (dated rows:
  date, GB used, verdict) — the dashboard check is now a recorded routine,
  not a conversation.
- Status: **PROPOSED — awaiting operator decision** on v2 curve vs minimal
  rescale. No code changed pending sign-off; the audit itself is the deliverable.
