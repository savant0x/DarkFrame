# FID-20260912-060 — Measured Audit: RP Income Side (Battle / Login / Level-Up)

**Date:** 2026-09-12 · **Follows:** FID-056 (milestones), FID-057 (sinks), FID-058/059
(v2 implementation) · **Stance:** docs are inputs, not law — every income number
judged against measured live data and the v2 curve we just shipped.

---

## 1. Income census (every source, measured)

All awards flow through `awardRP()` (`lib/researchPointService.ts`), which applies
the ×1.5 VIP multiplier uniformly. Amounts below are base (pre-VIP).

| Source | Amount | Structure | Cap |
|---|---|---|---|
| Harvest milestones v2 | 200/300/400/500/750 — **4,300/day** base | 5 census-anchored rungs × 2 reset periods | **Self-capped by tile census (5,371/period)** |
| Daily login | 100 + 10×(streak−1), streak capped at 7 → **160/day max** | Flat + bounded streak term | 24h cooldown; streak resets at 24h gap |
| Level-up | `level × 5`, capped **500/level** (`lib/xpService.ts:353`) | One-time per level | Natural — finite levels |
| **Battle: bot-base raid** | **`100 + level × 20`** (`app/api/combat/attack/route.ts:262`) | **Repeatable** | **NONE** |
| **Battle: PvP infantry win/defend** | **`100 + 20 × levelDiff`** (`lib/battleService.ts:558/579`) | **Repeatable** | **NONE** |
| Achievements | 10 awards, **1,225 total** (`lib/achievementService.ts`) | One-time | Finite |
| Referral | Welcome package on tutorial completion | One-time | — |
| Global daily RP cap | — | — | **DOES NOT EXIST** |

## 2. Live data (measured this audit)

- **52 bots, levels 5–65, avg 14.1.** Bot levels are grown over time by
  `botGrowthManager` — the population is designed to climb.
- Bot combat is **Full Permanence** (FID-037): defeated bots are looted, left
  alive, and regrow — i.e. every bot base is a *renewable raid target*.
- AutoFarm's `attackBase` is an MVP stub (tracks attempts, no real combat), so
  the exploit below is manual-player-scale today — but the design pays whoever
  automates first.

## 3. Flagged: battle RP is an unbounded money printer

`100 + level × 20` spreads **15×** across live bot levels (L5 → 200 RP,
L65 → 1,400 RP; ×1.5 VIP → **2,100 per raid**). With 52 renewable targets and no
cooldown or daily cap, a player looping raids earns:

| Play pattern | Battle RP/day (base) |
|---|---|
| 20 raids on avg-level bots (L14 ≈ 380 each) | **7,600** |
| 20 raids on max-level bots (L65) | **28,000** |
| 100 raids mixed (an hour of clicking) | ~50,000+ |

For scale: the entire milestone envelope the v2 curve is anchored to is
**4,300/day**. Twenty minutes of raid-clicking on high-level bots out-earns a
full-day full-map harvest sweep. The full 600k WMD track becomes ~2 weeks of
trivial loop play — the pacing we just deliberately designed (47 best-case days)
is silently bypassable.

**The structural flaw (same disease as FID-056):** the raid formula's scale
factor is *bot level* — an unbounded, auto-inflating input. `botGrowthManager`
exists to raise bot levels over time, so battle RP **inflation accelerates as
the game ages**, with no feedback loop. Milestones were re-anchored to a physical
constant (the tile census); battle RP is anchored to nothing.

**Also flagged (minor):** successful **defenders** earn the same formula for
repelling bot attacks — with bots attacking on a schedule, a durable mid-level
base earns passive defense RP forever. Slightly exploitable, low rate.

## 4. Healthy verdicts (no change proposed)

- **Login (160/day max):** correctly bounded, streak mechanic sound. Fine.
- **Level-up (500/level cap):** cumulative to L60 ≈ 9,150 RP one-time — honest
  pacing. Fine.
- **Achievements (1,225 total):** finite, one-time. Fine.
- **Defender upset bonus** (more RP for beating a higher-level attacker):
  actually good design. Keep.

## 5. Proposals (decisions — not implemented without your pick)

| # | Proposal | Effect |
|---|---|---|
| **B1** | **Daily battle envelope:** first 10 victorious raids/day pay full formula, then 20% payout (hard floor 25) | Caps battles at ~2,000–4,500/day base — same scale as the milestone envelope |
| **B2** | **Diminishing level term:** `100 + 200 × (1 − e^(−level/20))` → L5≈145, L14≈228, L65≈297 | Kills the 15× spread so max-level bots aren't a lottery; bot growth no longer inflates income |
| **B3** | **Global daily cap** (backstop): total earned RP/day capped at 25k base, all sources | Blunt but permanent insurance against any future unbounded stream |
| **B4** | Defense RP: award only vs *higher-or-equal* level attackers | Closes the passive defense-farm loop |

**Recommended bundle: B1 + B2** (they compose: envelope caps volume, curve caps
per-unit value), with B3 as a cheap safety rail and B4 optional. With B1+B2,
best-case daily income becomes ~4,300 milestones + 160 login + ~2,500 battles
≈ **7,000/day base (10,500 VIP)** — every sink on the v2 curve keeps its
intended pacing, and nothing scales away from the design again.

---

## 6. Operational fix riding this PR (found during the :3001 restart)

`lib/migrations/factorySlots.ts` (runs at every server boot):
- The `migrations` bookkeeping table was **never created** on this Postgres
  database — the migration aborted at its first SELECT on *every boot* since the
  Mongo→Postgres port. Now self-heals with `CREATE TABLE IF NOT EXISTS`.
- The update loop rewrote **every** factory (962 rows) whenever any one drifted;
  now updates only `needingUpdate` rows.

Verified live: boot log now shows ✅ (962 inspected, 0 modified, marker
recorded) instead of ⚠️.

## 7. Gates

tsc 0 · eslint 0 · vitest 533 passed / 1 skipped · `npm run build` exit 0.
No data or balance change shipped in this FID — §5 awaits your call.
