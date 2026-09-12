# FID-20260912-061 — Measured Audit: Bot Level Growth & What Levels Should Mean

**Date:** 2026-09-12 · **Follows:** FID-060 (income audit, proposed B1+B2) ·
**Question posed:** "Should botGrowthManager keep scaling bots to L65+, and what
should levels mean for difficulty once battle RP stops depending on them?"

---

## 1. The premise dissolves — bots never scaled to L65+

Verified against the code, not the docs:

- `botGrowthManager` is only an hourly scheduler wrapper. The engine it runs
  (`botGrowthEngine.runGrowthCycle`) writes **resources, armies, movement** —
  it never writes `level`. Zero level writes anywhere in the growth path.
- Bot `level` is assigned **once at spawn**: `getBotTierForZone(zone)` → tier
  1–7 → `getPlayerLevelForTier(tier)` → fixed level (L5/15/25/35/45/55/65).
- Live DB proof: 52 bots spanning L5–65, exactly matching the spawn ladder —
  no drift mechanism exists. Only **1** regular bot sits ≥ L61 (a T7 zone roll).
- Bosses are fixed L65 by design (`createBossBot`).
- Beer Bases re-level *after* spawn by power tier: L1–5 / 5–10 / 10–20 /
  20–30 / 30–40 / 40–60 (`beerBaseService.ts:1176-1196`).

**Correction to FID-060:** its claim that "bot levels are grown over time and
the inflation accelerates as the game ages" is wrong about levels — the raid-RP
unboundedness stands, but its source is the *level spread across zones at
spawn*, not growth. The proposed B1+B2 fixes are unaffected. (Correction
appended to FID-060.)

## 2. What bot level actually does today

| System | Reads level? |
|---|---|
| Combat outcome (`botCombatService`) | **No** — resolves on `totalStrength`/`totalDefense` (armies) |
| Raid loot (`/api/combat/attack`) | **No** — loot = bot's current resources (age-driven stockpiles) |
| Battle RP (FID-044) | **Yes — the only mechanical consumer** (`100 + level×20`) |
| XP for raids | **No** — flat 400 (`BASE_ATTACK_WIN`), tier-blind |
| Scanner / tile UI | Yes — display only |
| `getPlayerLevelBonus` (+25%/bracket) | **Zero consumers — dead code** |

So bot level is **decorative** — a number shown to players that corresponds to
nothing they actually fight. That is the root cause of the earlier complaint
("this is actually a high level" while the base died trivially).

## 3. Flagged: endgame-zone bot difficulty DECAYS after spawn (real bug)

`TIER_ARMY_CAPS` defines tiers **1–3 only** (`{1:20, 2:40, 3:60}`);
`getMaxArmySize()` falls back to `TIER_ARMY_CAPS[1]` for tiers 4–7
(`botGrowthEngine.ts:145`). Consequences, measured:

- Zone 6–8 bots (T5–T7, displayed L45–65) are army-capped at **20 units** —
  *fewer than a tier-3 mid-game bot (60)*. An "ancient" T7 at 30+ days reaches
  only 40 (2× age multiplier) — still below T3.
- The exponential spawn defense (`getBotDefenseForTier`, T7 = 9,600 × spec
  multiplier) makes day-one difficulty look right; the hourly build cycle then
  rebuilds armies *down* toward the tier-1 cap. The engine's own header
  ("Older bots = larger armies", "Scaling Difficulty") is contradicted by its
  caps table — the table predates the 7-tier ladder.
- Bosses (192k defense) also build toward a 20-unit army — their menace is
  spawn-day only.

## 4. Design verdict (the question answered)

**Should bots "keep scaling to L65+"? They never did — and they shouldn't
start.** With 6 human players (max L17) and 52 bots, dynamic bot leveling adds
moving parts to a system whose difficulty already lives in armies, resources,
and the Beer Base power-tier ladder. Recommendation: **levels are spawn-time
zone brackets** — a stable identity ("this is an endgame-zone bot"), not a
progression stat. Rewards stop reading level (FID-060's B2 does this for RP;
loot already reads stockpiles; XP is already flat). Nothing else needs to move.

| # | Proposal | Type |
|---|---|---|
| **R1** | Extend `TIER_ARMY_CAPS` to all 7 tiers: 20/40/60/80/100/120/140 (×2 age ceiling → 280 legendary T7) | **Bug fix — shipped in this PR** (engine's own documented intent) |
| **R2** | Adopt "levels = spawn-time zone brackets" as the stated design; document on the growth engine | Decision |
| **R3** | Land FID-060's B1+B2 so battle RP reads a saturating curve instead of raw level | Cross-ref, pending your call |
| **R4** | Optional: normalize Beer Base display levels to tier brackets (currently 1–60 by power tier — a *better* difficulty proxy than regular bots, but still decorrelated from armies) | Decision |

**R1 shipped here** because the caps table contradicts the engine's documented
contract and actively inverts difficulty for the highest tiers. Effect on the
live game: over the coming build cycles, T4–T7 bots grow armies to their real
tier caps — endgame zones become endgame again. Spawn-day stats are unchanged.

## 5. Gates

tsc 0 · eslint 0 · vitest (incl. new army-cap ladder pins) · `npm run build` 0.
