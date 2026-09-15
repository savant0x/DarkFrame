# Combat tier-mismatch simulation — post-Phase-3 scale (2026-09-15)

> **UPDATE (same day):** Flag 1 was implemented — `GARRISON_DEF_RATIO = 0.65` now routes
> the weight-class floor into DEF (the stat that counters) with `GARRISON_STR_RATIO = 0.2`
> padding the HP pool. Post-fix matrices below. Gates: tsc 0 · lint 0 · vitest 794/1 skipped.
> Sim rerunnable via `scripts/simulateCombatTiers.ts` (runs the real `resolveBattle`).

> **ADDENDUM — endgame pacing (FID-20260915-003):** the operator-directed `SIZE_CAP`
> sweep **falsified the cap as a difficulty knob** — cap 60/150/300/600 produced
> byte-identical outcomes at every multiplier (the weight floor distributes across any
> unit count; only per-unit stats shrink). The shipped knob is a **tier-multiplier
> ladder** on the floor (`GARRISON_TIER_MULT`, 1.0 → 1.5): measured curve ×1.0–1.3 →
> 2-round wins (15–33%), ×1.4–1.5 → 3 rounds (80–95%, the multi-round band), ≥×1.6 →
> annihilation. Post-ladder fresh-synth gradient (T1→T6 raider at same power):
> 2r/15% → 2r/18% → 2r/20% → 2–4r/28–38% → 3–9r/60–75% → 3–5r/90–95%. Also fixed live:
> tier resolution now reads `bot_config.tier` — the b[WMSEUL] username marker matches
> nothing on the live map, silently degrading every live bot (ladder AND tier-scaled
> XP/RP) to tier 1. Live E2E: tier-6 base vs endgame raider = 3 rounds / 95% losses;
> fame's real raid = 2 rounds / 8.7% losses. Under-tier raids (T1 army vs T6+) remain
> repelled by level-gap protection — anti-farm design, left as-is.

**Method:** the real `resolveBattle` engine (`lib/battleService.ts`, `applyCasualties: false`
→ zero DB writes), 1,000-sample noise sweep per cell. Both defender profiles the live game
produces: **fresh-synth** (attack route synthesizes a garrison from base defense) and
**real-regrown** (beer-base scheduler regrows `players.units` — band-shaped two-tier mixes,
STR on odd tiers, DEF on even). Attacker armies: band composition at T1/T3/T5/T7.
Full matrices in `scripts/simulateCombatTiers.ts` output (kept, rerunnable).

**Baseline health:** same-power band-vs-band is a 2–5 round fight with 40–70% attacker
losses at every tier — the Phase-3 scale holds its own acceptance criterion.

---

## Flag 1 (CRITICAL, code-confirmed): garrison counter-fire is wired to the wrong stat

The attack route's weight-class floor (`GARRISON_STR_RATIO = 0.6 × attackerSTR`)
inflates the **STR** stat of synthesized garrison units. But the engine's defender damage
is `defenderDEF − attackerSTR/2` — **garrison STR never participates in its own
counter-attack** (`battleService.ts:381` passes `totalDEF` as the counter source; the
FID-20260914-002 comment mis-stated the formula). The floor was a *display* buff and a
*HP-pool* buff (HP = STR + DEF), but contributes zero to the counter that actually repels
raiders.

**Net effect (pre-fix):** synthesized-garrison raids were a pure damage race — every
cell resolved in 1–2 rounds at 0–9% attacker losses regardless of tier mismatch.

**Recommended fix (one seam, both bugs):** `GARRISON_DEF_RATIO = 0.65` in the route — split
the weight-class floor between DEF (counter-fire, the resistance knob the balance doc
intends) and STR (HP pool). Synth algebra stays fully predictable: same floor, same sizes,
different stat split. **→ IMPLEMENTED; see the post-fix section.**

## Flag 2 (HIGH, still open — operator decision): real regrown garrisons have NO weight-class floor

The floor exists only on the synthesis path (`base.units.length === 0`). A mature base's
real `players.units` garrison — regrown by the beer-base scheduler — fights with its raw
stats, so a stronger attacker faces a counter that does not scale with him. Measured
(post-fix sim, mature-band matrix):

- T3 band vs MID base (2.9× STR): win, **0% losses**, 2 rounds
- T5 band vs MID base (19.8×): win, **0%**, 1 round
- T5 band vs STRONG base (3.3×): win, **0%**, 1 round

Tier-mismatch bullying is intended progression, but 0% at 2.9× is degenerate — the same
weight-class logic that now protects fresh bases should arguably apply when a raider
outclasses a real garrison. **Recommended (operator decision):** extend the floor to real
garrisons as *supplemental reinforcement DEF* when `attackerSTR × DEF_RATIO > garrisonDEF`
(same knob, applied at the route, additive to existing units). Left unimplemented — it
governs how profitable farming mature low bases stays.

## Flag 3 (MEDIUM): the stall band still exists (STR ≈ 2× DEF)

Same-magnitude armies where attacker STR ≈ 2× defender DEF grind to the 100-round cap
(mutual min-damage chip). The cap ends it safely, but a 100-round "battle" is a UX smell.
Options: (a) accept — it is provably a narrow band and self-resolves; (b) add a
round-based attrition escalation after round 30 (each side's min damage +5%/round). Cheap
and removes the artifact entirely. Recommend (b) later, not urgent.

## Flag 4 (INFO, doc drift): BASE_RAID_BALANCE.md tuning table is pre-Phase-3

The doc's tuning table still assumes 10-HP garrison units; the "raid outcome by gap" rows
no longer match reality. The tables above supersede it; the doc should be regenerated from
this sim's fixture when the knob set settles.

---

## Post-fix matrices (after `GARRISON_DEF_RATIO = 0.65`)

### Fresh-synth (the fixed path)

| Attacker | vs T1 | vs T3 | vs T5 | vs T7 | rounds |
|---|---|---|---|---|---|
| T1@lv5 (4k STR) | 15% loss | 15% | 15% | 13% | 2→6 |
| T3@lv25 (32k) | 15% | 15% | 15% | 13% | 2→6 |
| T5@lv45 (220k) | 13% | 15% | 15% | 15% | 6→2 |

Every cell: ATTACKER_WIN with **13–15% attacker losses** (pre-fix: 0–9%). Counter now
scales with the raider (`0.15 × attackerSTR` per round — DEF_RATIO − 0.5). The sim's
FREE-WIN flag still fires on ≤2-round cells, but with a real 15% cost that label no longer
describes the economics — the strict predicate is a sim artifact, not a hole. Round count
now varies meaningfully with defender tier (grinding through bigger capped garrisons).

### Mature-band (unchanged by the fix — Flag 2 evidence)

| Attacker | WEAK | MID | STRONG | ELITE | TOP |
|---|---|---|---|---|---|
| T1@lv5 | win 65% | repelled | repelled | repelled | repelled |
| T3@lv25 | **0% / 1r** | **0% / 2r** | repelled | repelled | repelled |
| T5@lv45 | **0% / 1r** | **0% / 1r** | **0% / 1r** | repelled 100%/43% | repelled |

The bolded cells are the open hole: no scaling resistance for real garrisons.

**Verdict after the fix:** matchmaking gradient is healthy and monotonic on the fixed
synth path; the one remaining code-level hole is Flag 2 (real-garrison floor), which is a
profitability-of-farming decision left to the operator. Flags 3–4 unchanged.
