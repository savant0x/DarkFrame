# FID-20260912-057 — Measured Audit: WMD Ladder + Tech-Tree Prices (RP Sinks)

**Date:** 2026-09-12 · **Follows:** FID-056 (milestones v2 proposal) · **Stance:**
docs are inputs, not law — every number judged against measured income and
live data. Income reference points (FID-056 tile census + current curve):

| Player | RP/day (best case) |
|---|---|
| Dedicated human, no VIP, full sweep both halves | 4,500 |
| Same, VIP | 6,750 |
| Same, VIP + flag bearer | 13,500 |

## 1. WMD ladder — three findings, one fatal

**Measured reality: the ladder is 30 techs across THREE parallel 10-tier
trees (missile/defense/spy), 2.5M RP each = 7,500,000 RP total.** Every
audit to date (RP_ECONOMY_AUDIT, FID-006 §4.6 "2.5M total") counted only one
tree. P8/P9 were written against a ladder one-third the real size.

- **FLAGGED — pacing:** 7.5M at the best case is **556 days (base player) to
  1,111 days (VIP+flag) — 1.5 to 3 years** for the full WMD endgame. Even
  one tree (2.5M) is 185–370 days. No live player is at the first rung's
  level gate meaningfully: top human level is 65, fame (your own save) is
  L17 with 6,952 RP — 3.7% of tier 1. `player_research` table: **0 rows**.
  Nobody has ever started WMD research.
- **FLAGGED — gate misplacement:** only the three tier-1 techs carry
  `requiredLevel: 40`; tiers 2–10 have **no level gate at all**. The gate
  is at the front door while the 500k ceiling floats free — inverted from
  any sane progression (gates should tighten with tier).
- **FLAGGED — structural duplication:** three identical price ladders for
  three categories is copy-paste pricing, not design. Tier 2 of defense
  costs the same as tier 2 of missile regardless of effect strength.

**Proposal W1:** collapse the ladder to a **single 10-tier WMD track,
2.5M → ~600k total** (50k → 65k → 85k → 110k → 140k → 175k → 210k → 250k →
290k → 330k: ~1.5× steps), every tier gated L40+tier×2, targeting
~45–90 days of best-case play for the full track — a season goal, not a
sentence. Category perks stay; only the pricing/gating unifies.
**Proposal W2 (if three trees are loved):** keep trees, cut each to 5
meaningful tiers (~800k total across all), same gates.

## 2. Tech tree — the worst finding of the audit

The `/api/research` route catalog has **6 techs (5k–15k, 56k total)**. The
Tech Tree **UI ships 10 techs (adds bot-hunter, advanced-tracking, bot-magnet,
bot-concentration-zones at 15k/30k/35k)** — and those four are the *only ones
with implemented effects* (scanner access/radius/cooldown, bot-magnet route,
concentration zones, combat bonuses in botCombatService/battleService).

- **FLAGGED — the purchase path is broken by design:** the four
  effect-bearing techs exist only in the client's mock catalog. POSTing
  their ids returns "Invalid technology ID" — **the game advertises techs
  the server refuses to sell.** The 6 server techs, meanwhile, have **zero
  effect consumers** anywhere (verified: no `unlockedTechs.includes` for any
  of them) — the server happily sells **dead content**.
- **FLAGGED — pricing inversion:** 56k of dead content priced the same as
  the functional bot-hunter line (35k). Players would pay real RP for
  nothing.
- Level-up RP (P3-era `level×5, cap 500`) and P1/P2 XP curves are
  implemented and consistent with L65 existing in live data — no finding.

**Proposal T1 (required before any pricing debate):** move the client's 4
bot techs into the route catalog (they're implemented server-side — this is
a catalog sync, not a feature build), then delete or implement the 6 dead
techs. **T2:** reprice the functional line: bot-hunter 5k, advanced-tracking
12k, bot-magnet 20k, bot-concentration-zones 35k — the whole *useful* tree
for 72k ≈ 11 best-case days (VIP+flag), which is honest pacing for the
game's only real tech content.

## 3. Clan research — minor flag

Three trees × {5k, 15k, 40k, 100k} = 480k RP (clan-wide, correct as a
shared sink), but `getClanBonuses` has exactly **one consumer**
(combatPowerService). The harvest/economy trees exist in pricing only.
**Proposal C1:** wire the harvest-tree bonuses into harvestService (or cut
those trees to match reality). Same pattern as the tech tree: priced
content with no effect.

## 4. Sinks census (for the record)

| Sink | Total | Status |
|---|---|---|
| WMD ladder | **7.5M** | unreachable ×3 duplication |
| Clan research | 480k | 2/3 effectless |
| Tech tree (server) | 56k | 100% effectless |
| Tech tree (client, bot line) | 80k | unsellable (catalog mismatch) |

The RP economy's problem was never income — it's that **~8.1M RP of sinks
are unreachable, dead, or unsellable**. Fixing the plumbing (T1) matters
more than any price change.

## 5. Status

**PROPOSED — operator decision on W1/W2, T1/T2, C1.** No code changed in
this FID. T1 is the only item I'd call urgent: it's a straight bug fix to
the purchase path, not a balance opinion.
