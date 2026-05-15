# DarkFrame — Planned Features

> Future enhancements and potential features

**Last Updated:** 2026-05-11
**Status:** Factory & Unit Redesign Complete — Awaiting DB Reset & Testing

---

## ✅ COMPLETED — May 11, 2026

### Factory & Unit System Overhaul (FID-20260511-FACTORY-UNIT-REDESIGN)
- 65 unit types → 20 focused units (4 archetypes × 5 tiers)
- Linear slot regen → Burst+Decay model
- Simple STR vs DEF combat → Multi-phase algorithm
- Map entropy, terrain modifiers, factory archetypes
- Operational Data currency
- TSC 0 errors, Next.js build passes

### Economy Rebalance V2 (FID-20260508-BALANCE-V2)
- 16 changes across XP, factory defense, resource decay, diggers, RP, PvP, army balance, flag, terrain, auto-farm, banks, forests, achievements

### Page Structure & Synth Palette (FID-20260508-PAGE-STRUCTURE)
- All 20 pages under GameLayout wrapper
- Synth palette applied globally

### Digger Balance (FID-20260510-DIGGER-BALANCE)
- Exponential decay formula corrected
- Asymptotic cost curve implemented

### Inventory Redesign (FID-20260510-INVENTORY-REDESIGN)
- Visual hierarchy, item grouping, sacrifice values

---

## 📋 IMMEDIATE (Before Next Session)

These must be done before the game is playable with the new systems:

1. **DB Wipe & Re-seed** — Required for all balance changes to take effect
   - Run `supabase db reset` or apply migration `20260511000001_factory_unit_redesign.sql`
   - Run `npx tsx scripts/reset-and-seed.ts`
2. **Test factory capture → build → abandon cycle**
3. **Test unit production with new UNIT_CONFIGS**
4. **Test PvP combat with multi-phase algorithm**
5. **Verify map entropy degrades unoccupied factories after 72h**

---

## 📋 POST-RESET PLANNING

After DB reset and testing confirms systems work:

### High Priority
- **Battle Service Full Implementation** — Multi-phase combat algorithm partially implemented (phase structure exists, needs full resolution logic + After-Action Report text generation)
- **After-Action Report** — Generate readable text from combat results
- **Factory Archetype Assignment** — Assign archetypes during map generation based on terrain
- **Shrine Sacrifice-Digger Route** — Asymptotic curve route exists, needs testing

### Medium Priority
- **Bot Dynamic Scaling** — Bots should scale with player progression
- **Clan Bank Upgrade RP Costs** — New feature
- **WMD Component RP Surcharge** — New feature
- **Real-Time Systems** — WebSocket for live updates (replace polling)
- **Mobile Responsive** — Mobile-friendly UI

### Lower Priority
- **World Events** — Server-wide events that create FOMO
- **Alliance System** — Multi-clan cooperation
- **Map Expansions** — New terrain types, new areas
- **Admin Tools** — Economy balancing dashboard, player moderation
- **Payment Integration** — Stripe for VIP purchases (route exists)
- **Production Deployment** — Vercel/Railway hosting

---

## 🆕 NEW FEATURE REQUESTS

Describe what you need and I'll enter planning mode:

1. **Feature Description** — What should it do?
2. **Business Value** — Why is it important?
3. **Technical Details** — Any specific requirements?

I'll create a detailed FID with:
- Implementation approach
- File changes needed
- Time estimate
- Acceptance criteria
