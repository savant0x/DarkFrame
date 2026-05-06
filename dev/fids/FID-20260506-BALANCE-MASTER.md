# FID-20260506-BALANCE-MASTER: Comprehensive Economy Rebalance

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-BALANCE-MASTER |
| **Date Created** | 2026-05-06 |
| **Status** | PLANNING |
| **Priority** | CRITICAL |
| **Phase** | Planning — Awaiting Research Validation |

---

## Context

The game economy is critically broken. A single player reached level 36 in one session, accumulated 4M metal / 3M energy, built 710K STR / 830K DEF, and achieved a +973% gathering bonus from diggers. The economy has runaway faucets with almost no sinks. Comprehensive rebalancing is required before the game can sustain long-term player engagement.

This FID is the **master document** for the economy rebalance. Sub-FIDs break the work into implementable phases.

---

## Research Summary

Two rounds of deep research were conducted using Gemini Deep Research. Key findings:

### Root Cause Analysis
- **Multiplicative stacking is the primary killer.** VIP (2x) × Flag Bearer (2x) × Shrine (2x) × Diggers (10x+) compounds to game-breaking numbers. Must convert to additive with diminishing returns.
- **Digger drop rate is 10-15x too high.** 30% drop rate × 60% digger chance = ~400 diggers per reset. Players collect thousands per week. Must reduce to ~0-3 diggers per 12h session.
- **XP curve is too flat.** 20 XP per harvest × 9,000 harvests = 180K XP per sweep. Level 30+ in one session. Must reduce XP/polynomial curve.
- **No resource sinks exist.** The research explicitly states: "The game lacks sufficient hard sinks — mechanisms that permanently destroy value, such as maintenance costs, exponential upkeep, or resource burn."
- **Auto-farm has no decay or cost.** Players can sweep 22,500 tiles per day with zero friction.

### Developer Philosophy (Confirmed)
- P2W is acceptable and desired — VIP should be clearly valuable (2-3x progression speed)
- Diminishing returns over hard caps (always feel like you're progressing)
- Shrine should be the core engagement loop (time-limited boosts from active cave exploration)
- Diggers should be rare and special (0-3 per 12h session, not hundreds)
- No forced resets — long-cycle content + territory decay instead
- Referrals should drive growth (light gating, anti-fraud via fingerprinting)
- New mechanics should be fun and add engagement, not just restrictions

---

## Approved Balance Changes

### Multiplier System
- Convert ALL multipliers from multiplicative to additive with soft diminishing returns
- First +100%: full value. Next +100%: 75%. Next +100%: 50%. Beyond +300%: 10% per +100%
- VIP: +50% additive (down from 2x multiplicative)
- Flag Bearer: +50% additive (down from 2x multiplicative)
- Shrine: Diminishing stacking (+25/+20/+15/+10 = +70% max, down from +100%)

### Digger System
- Drop rate: 2.5% (down from 30%)
- Digger chance: 20% of drops (down from 60%)
- Tradeable chance: 80% of drops (up from 40%)
- Bonus formula: Exponential decay `M × (1 - e^(-C×x))` where M=200%, C=0.008
- Guaranteed digger every 50-100 cave explorations (anti-bad-luck)
- Expected: 0-3 diggers per 12h full sweep

### Base Harvest
- Reduce from 800-1,500 to 400-750 (2x reduction)

### XP System
- Reduce harvest XP from 20 to 3
- Polynomial curve: `250 × L^2.5`
- Level 50: ~441K XP (~6 months). Level 100: ~26.7M XP (~4 years)

### Tier Unlocks
- Hybrid RP + metal costs (not just RP)
- Tier 2: 500 RP + 100K metal (Level 10)
- Tier 3: 2,500 RP + 500K metal (Level 20)
- Tier 4: 10,000 RP + 2.5M metal (Level 35)
- Tier 5: 35,000 RP + 10M metal (Level 50)
- Total: 1,300 RP + 13.1M metal

### New Sinks
- **Unit upkeep:** Hourly maintenance cost, exponential scaling past supply cap
- **Auto-farm tool durability:** Condition decays with use, repair costs scale exponentially
- **PvP resource destruction:** 20% of stolen resources permanently burned
- **Resource decay:** 0.5-1% daily on stored resources above threshold

### New Mechanics
- **Auto-farm maintenance system:** Tool durability, repair costs, tool tier progression
- **Stamina system:** Soft diminishing (100% → 75% → 50% → 25%, never zero)
- **Achievement system:** Tiered rewards (no permanent stat boosts)
- **Cave difficulty tiers:** Harder caves with slightly better drops
- **Combat shrine buffs:** Temporary PvP boosts from shrine
- **Territory decay:** Uncontested tiles revert to neutral

### No Forced Resets
- Long-cycle content drops (3-6 months) instead of seasonal wipes
- Voluntary prestige system for players who want to start fresh
- Territory decay keeps map dynamic

---

## Sub-FIDs (Implementation Phases)

| Phase | FID | Focus | Priority |
|-------|-----|-------|----------|
| 1 | FID-20260506-BALANCE-P1 | Critical fixes: multipliers, diggers, base harvest, XP | CRITICAL |
| 2 | FID-20260506-BALANCE-P2 | New sinks: upkeep, durability, stamina, PvP burn | HIGH |
| 3 | FID-20260506-BALANCE-P3 | Progression: tiers, tech tree, VIP, shrine | HIGH |
| 4 | FID-20260506-BALANCE-P4 | Long-term: achievements, cave tiers, territory decay, content cadence | MEDIUM |

---

## Verification Checklist (All Phases)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] No TypeScript `as any` assertions added
- [ ] All new code follows ECHO v1.3.4 standards
- [ ] All files read completely (1-EOF) before editing
- [ ] Pattern discovery completed before generating code
- [ ] DRY principle enforced — no code duplication
- [ ] Contract matrix generated for any UI/API changes

---

## Files to Modify (Preliminary)
- `types/game.ts` — GAME_CONSTANTS (harvest amounts, digger tiers, XP rewards)
- `lib/harvestService.ts` — canHarvestTile (add Forest), harvest formula
- `lib/xpService.ts` — XP curve formula, harvest XP amount
- `lib/tierUnlockService.ts` — Tier unlock costs
- `lib/diggerService.ts` — NEW: digger bonus calculation with exponential decay
- `lib/balanceService.ts` — Multiplier stacking formula
- `components/ShrinePanel.tsx` — Sacrifice costs, diminishing stacking
- `app/api/harvest/route.ts` — Drop rates, digger distribution
- `app/api/research/route.ts` — Tech tree costs, add missing 5 techs
- `app/api/tier/unlock/route.ts` — Tier unlock costs
- `context/GameContext.tsx` — Preserve inventory on move
- Plus new files for: unit upkeep, auto-farm durability, stamina, achievements

---

## Notes
- Research files: `dev/research/BALANCE_RESEARCH_V2.md`, `dev/research/Dark Frame Game Rebalance Research.md`
- Developer confirmed: P2W is fine, diminishing returns over hard caps, no forced resets
- Shrine is the core engagement loop — time-limited boosts from active cave exploration
- Diggers should be rare and special — finding one should feel exciting
- Auto-farm maintenance adds engagement sink without hard restrictions
