# 🗺️ DarkFrame — Product Roadmap

> Strategic vision, milestone planning, and feature evolution

**Last Updated:** 2026-05-06
**Project Started:** October 16, 2025
**Current Status:** Economy Rebalance Planning — Research Complete, Implementation Pending

---

## 🎯 Project Vision

Build a **persistent multiplayer tile-based strategy game** where players compete for dominance on a **150×150 grid world**. Players explore, gather resources, build armies, engage in PVP combat, unlock technologies, form powerful clans, and compete for global supremacy.

### Long-Term Goals
1. **Sustainable Economy** — Balanced faucets and sinks for multi-year lifecycle
2. **Engaging Progression** — Months/years to max, not days
3. **Active Engagement Loops** — Shrine, achievements, PvP, not just passive farming
4. **Healthy Monetization** — VIP is valuable (2-3x speed) without being pay-to-win
5. **No Forced Resets** — Territory decay + content cadence instead
6. **Clan Endgame** — WMD system, territory control, clan warfare

---

## 📊 Current Status

### ✅ Completed
- Phase 1-13: Core game systems (map, resources, combat, clans, etc.)
- Supabase migration: 100% complete
- Chat system: Fixed (persistence, online users)
- Forest harvest bug: Fixed
- 15+ FIDs closed and archived

### 🔄 In Progress
- Economy Rebalance: Research complete, implementation pending
- 4-phase balance plan documented and ready to execute

### 📋 Planned
- Phase 1: Critical fixes (multipliers, diggers, base harvest, XP)
- Phase 2: New sinks (upkeep, durability, stamina, PvP burn)
- Phase 3: Progression (tiers, tech tree, VIP, shrine)
- Phase 4: Long-term health (decay, achievements, content cadence)

---

## 🏗️ Implementation Phases

### Phase 1: Critical Economy Fixes (FID-20260506-BALANCE-P1)
**Priority:** CRITICAL
**Focus:** Stop the bleeding — fix the most broken systems first

- Convert multipliers from multiplicative to additive with diminishing returns
- Implement digger exponential decay (0-3 diggers per 12h, not hundreds)
- Reduce base harvest (400-750, down from 800-1,500)
- Reduce XP per harvest (3, down from 20) + polynomial curve
- Preserve inventory on move (bug fix)

**Expected Impact:** Daily income drops from ~193M to ~10-15M resources

### Phase 2: New Resource Sinks (FID-20260506-BALANCE-P2)
**Priority:** HIGH
**Focus:** Add the sinks that were completely missing

- Unit upkeep (exponential scaling past supply cap)
- Auto-farm tool durability (decay + repair costs)
- Stamina system (soft diminishing, never zero)
- PvP resource destruction (20% burn)

**Expected Impact:** Daily sinks of ~200K-1M+ resources

### Phase 3: Progression Rebalance (FID-20260506-BALANCE-P3)
**Priority:** HIGH
**Focus:** Make progression take months/years, not days

- Tier unlock hybrid costs (RP + metal)
- Tech tree rebalance (level requirements, hybrid costs, fix API)
- VIP rebalance (+50% additive, convenience features)
- Shrine rebalance (lower costs, diminishing stacking)
- Harvest milestone RP reduction (1,500/day, down from 6,000)

**Expected Impact:** Time to max progression: 6-12 months, not 1-2 days

### Phase 4: Long-Term Health (FID-20260506-BALANCE-P4)
**Priority:** MEDIUM
**Focus:** Keep the game healthy for years

- Resource decay (0.5% daily above 1M threshold)
- Territory decay (uncontested tiles revert)
- Cave difficulty tiers (harder = better drops)
- Combat shrine buffs (temporary PvP boosts)
- Achievement system (horizontal progression, no permanent stat boosts)
- Content cadence (monthly events, quarterly map events, 6-month expansions)

**Expected Impact:** Sustainable 2-3 year lifecycle without forced resets

---

## 🔥 Key Balance Numbers

| System | Before | After |
|--------|--------|-------|
| Max multiplier | 8.8x+ (unbounded) | ~3-4x (additive diminishing) |
| Diggers per 12h | ~400 | 0-3 |
| Digger bonus cap | Unbounded (+973%) | ~200% asymptotic |
| Base harvest | 800-1,500 | 400-750 |
| XP per harvest | 20 | 3 |
| XP to level 30 | 29K | ~1.23M |
| Tier 5 unlock | Level 30, 50 RP | Level 50, 750 RP + 10M metal |
| Unit upkeep | None | Exponential past supply cap |
| Auto-farm decay | None | Tool durability + repair |
| Stamina | None | Soft diminishing (never zero) |
| VIP resource bonus | 2x multiplicative | +50% additive |
| PvP destruction | None | 20% burned |
| Shrine max | +100% | +70% (diminishing) |
| Daily RP from milestones | 6,000 | 1,500 |
| Daily resources (full sweep) | ~193M | ~10-15M |
| Time to max progression | 1-2 days | 6-12 months |

---

## 📈 Success Metrics

### Economy Health
- **Faucet-to-sink ratio:** Target 5:1 to 10:1 (currently 100:1+)
- **Daily resource accumulation:** Target 8-13M net (currently 193M+)
- **Progression speed:** VIP 2-3x faster than F2P (not 100x)

### Player Progression
- **Level 50:** ~6 months (currently 1 day)
- **Level 100:** ~4 years
- **All tier unlocks:** ~6 months (currently 1 session)
- **All tech tree:** ~3-6 months (currently 1-2 sessions)

### Engagement
- **Shrine loop:** Players log in every 2-4 hours to manage buffs
- **Achievement system:** Constant micro-goals across all gameplay verticals
- **PvP:** Active resource destruction drives conflict
- **Content cadence:** New goals every month, major drops every 6 months

---

## 🚀 Post-Balance Roadmap

After all 4 phases are complete:

1. **Payment Integration** — Stripe for VIP purchases
2. **Production Deployment** — Vercel/Railway hosting
3. **Real-Time Systems** — WebSocket for live updates
4. **Mobile Responsive** — Mobile-friendly UI
5. **Admin Tools** — Economy balancing dashboard, player moderation
6. **World Events** — Server-wide events that create FOMO
7. **Alliance System** — Multi-clan cooperation
8. **Map Expansions** — New terrain types, new areas

---

## 📞 Roadmap Updates

This roadmap is a living document updated after each major milestone.

**Next Review:** After Phase 1 implementation complete

---

*Last Updated: May 6, 2026 — Economy Rebalance Planning Complete*
