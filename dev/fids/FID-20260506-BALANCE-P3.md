# FID-20260506-BALANCE-P3: Progression Rebalance

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-BALANCE-P3 |
| **Date Created** | 2026-05-06 |
| **Status** | PLANNING |
| **Priority** | HIGH |
| **Phase** | Phase 3 — Progression |
| **Parent FID** | FID-20260506-BALANCE-MASTER |
| **Depends On** | FID-20260506-BALANCE-P1, FID-20260506-BALANCE-P2 |

---

## Context

Phase 3 rebalances the progression systems — tier unlocks, tech tree, VIP, and shrine. These changes ensure that progression takes months/years instead of days, while keeping VIP clearly valuable for monetization.

---

## Changes

### 1. Tier Unlock Rebalance

**File:** `types/game.ts` and `lib/tierUnlockService.ts`

```typescript
// types/game.ts — New hybrid costs
export const TIER_UNLOCK_REQUIREMENTS: Record<UnitTier, { level: number; rp: number; metal: number }> = {
  [UnitTier.Tier1]: { level: 1,  rp: 0,    metal: 0       },
  [UnitTier.Tier2]: { level: 10, rp: 50,   metal: 100000  },
  [UnitTier.Tier3]: { level: 20, rp: 150,  metal: 500000  },
  [UnitTier.Tier4]: { level: 35, rp: 350,  metal: 2500000 },
  [UnitTier.Tier5]: { level: 50, rp: 750,  metal: 10000000 },
};
```

**Files to update:**
- `lib/tierUnlockService.ts` — Check both RP and metal costs
- `app/api/tier/unlock/route.ts` — Deduct both RP and metal
- `components/TierUnlockPanel.tsx` — Display hybrid costs

### 2. Tech Tree Rebalance

**File:** `app/api/research/route.ts`

Add missing 5 bot-hunter techs and increase all costs:

```typescript
const TECHNOLOGIES: Record<string, Technology> = {
  // Core (existing, costs increased)
  'troop-transport':    { id: 'troop-transport',    name: 'Troop Transport',    cost: 15000,  metalCost: 2000000,  prerequisites: [], levelReq: 10 },
  'advanced-mining':    { id: 'advanced-mining',    name: 'Advanced Mining',    cost: 10000,  metalCost: 1500000,  prerequisites: [], levelReq: 8 },
  'fortification':      { id: 'fortification',      name: 'Fortification',      cost: 12000,  metalCost: 1800000,  prerequisites: [], levelReq: 8 },
  'tactical-warfare':   { id: 'tactical-warfare',   name: 'Tactical Warfare',   cost: 20000,  metalCost: 3000000,  prerequisites: ['fortification'], levelReq: 15 },
  'factory-automation': { id: 'factory-automation', name: 'Factory Automation', cost: 25000,  metalCost: 4000000,  prerequisites: ['advanced-mining'], levelReq: 18 },
  'reconnaissance':     { id: 'reconnaissance',     name: 'Reconnaissance',     cost: 10000,  metalCost: 1500000,  prerequisites: [], levelReq: 8 },
  
  // Bot Hunter Branch (NEW — was missing from API)
  'bot-hunter':              { id: 'bot-hunter',              name: 'Bot Hunter',              cost: 10000,  metalCost: 2000000,  prerequisites: [], levelReq: 12 },
  'advanced-tracking':       { id: 'advanced-tracking',       name: 'Advanced Tracking',       cost: 20000,  metalCost: 3500000,  prerequisites: ['bot-hunter'], levelReq: 20 },
  'bot-magnet':              { id: 'bot-magnet',              name: 'Bot Magnet',              cost: 35000,  metalCost: 6000000,  prerequisites: ['advanced-tracking'], levelReq: 28 },
  'bot-concentration-zones': { id: 'bot-concentration-zones', name: 'Bot Concentration Zones', cost: 50000,  metalCost: 8000000,  prerequisites: ['bot-magnet'], levelReq: 35 },
  'bot-summoning-circle':    { id: 'bot-summoning-circle',    name: 'Bot Summoning Circle',    cost: 65000,  metalCost: 10000000, prerequisites: ['bot-concentration-zones'], levelReq: 40 },
  'fast-travel-network':     { id: 'fast-travel-network',     name: 'Fast Travel Network',     cost: 80000,  metalCost: 12000000, prerequisites: ['bot-summoning-circle'], levelReq: 45 },
};

// Total tech tree: ~337K RP + ~55M metal (achievable over 3-6 months of active play)
```

**Files to update:**
- `app/api/research/route.ts` — Full tech tree with costs, level requirements, hybrid payment
- `app/api/research/route.ts` — Use requireAuth instead of body.username
- `app/tech-tree/page.tsx` — Display level requirements, hybrid costs, fix currency display

### 3. VIP Rebalance

**File:** `types/stripe.types.ts` and VIP-related services

```typescript
// VIP benefits (REVISED)
export const VIP_BENEFITS = {
  resourceYieldBonus: 0.50,    // +50% additive (down from 2x multiplicative)
  autoFarmSpeedMultiplier: 2.0, // 2x faster (down from 3x)
  toolTier: 'premium' as ToolTier, // Premium tool instead of basic
  priorityFactorySlots: 5,      // 5 simultaneous productions
  rpMultiplier: 1.5,            // 1.5x RP earning
  cosmetics: ['vip-badge', 'vip-title', 'vip-base-skins'],
  analytics: true,              // Advanced battle analytics
  remoteAuctionHouse: true,      // Access auction house remotely
};
```

### 4. Shrine Rebalance

**File:** `components/ShrinePanel.tsx` and `app/api/shrine/route.ts`

- Sacrifice costs: Spade=2, Heart=5, Diamond=12, Club=25
- Diminishing stacking: +25%/+20%/+15%/+10% = +70% max
- No daily limit — diminishing returns naturally cap stacking

### 5. Harvest Milestone RP Reduction

**File:** `lib/researchPointService.ts`

```typescript
// OLD: 6,000 RP per full day
// NEW: 1,500 RP per full day
const DAILY_HARVEST_MILESTONES: Record<number, number> = {
  2000: 250,   // Was 1000: 500
  5000: 500,   // Was 2500: 750
  10000: 500,  // Was 5000: 1000
  20000: 250,  // Was 10000: 1500
  // Removed 15000 and 22500 milestones
};
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `types/game.ts` | TIER_UNLOCK_REQUIREMENTS with hybrid costs |
| 2 | `lib/tierUnlockService.ts` | Check RP + metal, deduct both |
| 3 | `app/api/tier/unlock/route.ts` | Hybrid cost deduction |
| 4 | `app/api/research/route.ts` | Full tech tree, level reqs, hybrid costs, requireAuth |
| 5 | `app/tech-tree/page.tsx` | Display level reqs, hybrid costs, fix currency |
| 6 | `types/stripe.types.ts` | VIP benefits revised |
| 7 | `lib/vipService.ts` | Apply new VIP benefits |
| 8 | `components/ShrinePanel.tsx` | New costs, diminishing stacking |
| 9 | `app/api/shrine/route.ts` | New sacrifice costs |
| 10 | `lib/researchPointService.ts` | Reduced milestone RP |

---

## Verification Checklist
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Tier 2 requires Level 10 + 50 RP + 100K metal
- [ ] Tier 5 requires Level 50 + 750 RP + 10M metal
- [ ] All 11 techs accessible via API
- [ ] Techs have level requirements
- [ ] VIP gives +50% resources (not 2x)
-  [ ] VIP auto-farm is 2x speed with premium tool
- [ ] Shrine costs: 2/5/12/25 items
- [ ] Shrine max bonus: +70%
- [ ] Harvest milestones give 1,500 RP/day max

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Tier 5 unlock | Level 30, 50 RP | Level 50, 750 RP + 10M metal |
| Tech tree total | ~46K RP | ~400K RP + ~100M metal |
| VIP resource bonus | 2x (multiplicative) | +50% (additive) |
| Shrine max | +100% | +70% |
| Daily RP from milestones | 6,000 | 1,500 |
| Time to max progression | 1-2 days | 6-12 months |
