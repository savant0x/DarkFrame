# 🗺️ DarkFrame — Product Roadmap

> Strategic vision, milestone planning, and feature evolution

**Last Updated:** 2026-05-11
**Project Started:** October 16, 2025
**Current Status:** Factory & Unit Redesign — Complete, Awaiting DB Reset

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
- None — all current FIDs complete

### 📋 Planned
- DB wipe and re-seed (required for all balance changes to take effect)
- Bot dynamic scaling (new feature)
- Clan bank upgrade RP costs (new feature)
- WMD component RP surcharge (new feature)
- Battle service full multi-phase combat implementation
- After-Action Report text generation
- Factory archetype assignment on map generation
- Shrine sacrifice-digger asymptotic curve testing

---

## 🏗️ Implementation Phases — ALL COMPLETE

### Phase 1-4: Economy Rebalance (FID-20260508-BALANCE-V2) ✅
**Status:** COMPLETE — 16 changes across 14 files
- Additive multipliers with diminishing returns ✅
- Digger exponential decay ✅
- Base harvest 400-750 ✅
- XP per harvest 3 + polynomial curve ✅
- Resource decay, PvP burn, army balance, flag, terrain, auto-farm, banks, forests, achievements ✅

### Factory & Unit Redesign (FID-20260511-FACTORY-UNIT-REDESIGN) ✅
**Status:** COMPLETE — 20+ files modified
- 65 unit types → 20 focused units (4 archetypes × 5 tiers) ✅
- Linear slot regen → Burst+Decay model ✅
- Simple STR vs DEF → Multi-phase combat algorithm ✅
- Map entropy, terrain modifiers, factory archetypes ✅
- Operational Data currency ✅

---

## 🔥 Key Balance Numbers

### Economy (FID-20260508-BALANCE-V2)
| System | Before | After |
|--------|--------|-------|
| Max multiplier | 8.8x+ (unbounded) | ~3-4x (additive diminishing) |
| Diggers per 12h | ~400 | 0-3 |
| Digger bonus cap | Unbounded (+973%) | ~200% asymptotic |
| Base harvest | 800-1,500 | 400-750 |
| XP per harvest | 20 | 3 |
| XP to level 30 | 29K | ~1.23M |
| Tier 5 unlock | Level 30, 50 RP | Level 50, 750 RP + 10M metal |
| VIP resource bonus | 2x multiplicative | +50% additive |
| PvP destruction | None | 20% burned |
| Shrine max | +100% | +70% (diminishing) |
| Daily RP from milestones | 6,000 | 1,500 |
| Daily resources (full sweep) | ~193M | ~10-15M |
| Time to max progression | 1-2 days | 6-12 months |

### Factory & Units (FID-20260511-FACTORY-UNIT-REDESIGN)
| System | Before | After |
|--------|--------|-------|
| Unit types | 65 (mirrored STR/DEF) | 20 (4 archetypes × 5 tiers) |
| Cost scaling | Flat ~33-40 metal/STR | Orthogonal (30-85 metal/STR by tier) |
| Slot scaling | Flat 100-3000 slots | Orthogonal (10-2.5 slots/STR by tier) |
| Factory slots L1→L10 | 5,000→9,500 (linear) | 5,000→~41,000 (polynomial) |
| Slot regen | Linear 416→791/hr | Burst 80% + 20% asymptotic decay |
| Factory defense L10 | 500,000 | ~260,000 (constrained polynomial) |
| Upgrade cost L10 cumulative | 112K metal | ~357K metal |
| Map entropy | None | -1 level per 72h unoccupied |
| Terrain modifiers | None | 5 types (Wasteland/Metal/Energy/Cave/Forest) |
| Combat | STR vs DEF subtraction | Multi-phase (Artillery→Support→Vanguard→Casualties) |
| Prestige currency | None | Operational Data (1 per 100 slots cycled) |

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

## 🚀 Post-Reset Roadmap

After DB reset and testing confirms all systems work:

### Immediate Testing
1. **Factory cycling** — Capture → build → abandon → repeat
2. **Unit production** — All 20 unit types buildable with correct costs/slots
3. **PvP combat** — Multi-phase algorithm with intransitive counters
4. **Map entropy** — Factories degrade after 72h unoccupied
5. **Operational Data** — Earned from factory cycling, displayed in StatsPanel

### Short-Term (Next 1-2 Sessions)
6. **Battle Service Full Implementation** — Complete multi-phase combat
7. **After-Action Report** — Readable combat log text generation
8. **Factory Archetype Assignment** — Based on terrain during map generation
9. **Shrine Sacrifice-Digger Testing** — Asymptotic curve verification

### Medium-Term
10. **Bot Dynamic Scaling** — Bots scale with player progression
11. **Clan Bank Upgrade RP Costs** — New feature
12. **WMD Component RP Surcharge** — New feature
13. **Real-Time Systems** — WebSocket for live updates (replace polling)
14. **Mobile Responsive** — Mobile-friendly UI

### Long-Term
15. **Payment Integration** — Stripe for VIP purchases (route exists)
16. **Production Deployment** — Vercel/Railway hosting
17. **Admin Tools** — Economy balancing dashboard, player moderation
18. **World Events** — Server-wide events that create FOMO
19. **Alliance System** — Multi-clan cooperation
20. **Map Expansions** — New terrain types, new areas

---

## 📞 Roadmap Updates

This roadmap is a living document updated after each major milestone.

**Next Review:** After Phase 1 implementation complete

---

*Last Updated: May 6, 2026 — Economy Rebalance Planning Complete*
