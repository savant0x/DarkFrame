# FID-20260506-BALANCE-P4: Long-Term Health & Content Cadence

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-BALANCE-P4 |
| **Date Created** | 2026-05-06 |
| **Status** | PLANNING |
| **Priority** | MEDIUM |
| **Phase** | Phase 4 — Long-Term Health |
| **Parent FID** | FID-20260506-BALANCE-MASTER |
| **Depends On** | FID-20260506-BALANCE-P1, P2, P3 |

---

## Context

Phase 4 implements the long-term health systems that keep the economy and engagement healthy over months/years. These are the systèmes that prevent stagnation, give players long-term goals, and keep the map dynamic without forced resets.

---

## Changes

### 1. Resource Decay (Rot)

**File:** New `lib/resourceDecayService.ts`

Slow decay on stored resources above a threshold. Prevents infinite hoarding.

```typescript
const DECAY_CONFIG = {
  threshold: 1000000,     // 1M — no decay below this
  rate: 0.0025,           // 0.25% daily decay on amount above threshold (reduced from 0.5%)
  maxDecayPerDay: 250000, // Max 250K decay per day (reduced from 500K)
};

export function calculateResourceDecay(storedAmount: number): number {
  if (storedAmount <= DECAY_CONFIG.threshold) return 0;
  
  const excess = storedAmount - DECAY_CONFIG.threshold;
  const decay = Math.floor(excess * DECAY_CONFIG.rate);
  
  return Math.min(decay, DECAY_CONFIG.maxDecayPerDay);
}

// Applied daily via cron job or on login
export function applyDailyDecay(player: Player): { metalDecay: number; energyDecay: number } {
  return {
    metalDecay: calculateResourceDecay(player.resources_metal),
    energyDecay: calculateResourceDecay(player.resources_energy),
  };
}
```

**Files to update:**
- `types/game.ts` — Add decay config
- `app/api/player/route.ts` — Apply decay on daily login
- `components/StatsPanel.tsx` — Display decay warning when above threshold

### 2. Territory Decay

**File:** New `lib/territoryDecayService.ts`

Uncontested territory slowly reverts to neutral. Prevents map stagnation.

```typescript
const TERRITORY_DECAY_CONFIG = {
  gracePeriodDays: 14,     // No decay for 14 days after capture (increased from 7)
  decayCheckInterval: 24,  // Check every 24 hours
  revertChance: 0.05,      // 5% chance per check after grace period (reduced from 10%)
};

export function checkTerritoryDecay(territory: Territory): boolean {
  const daysSinceCapture = (Date.now() - new Date(territory.capturedAt).getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceCapture < TERRITORY_DECAY_CONFIG.gracePeriodDays) return false;
  
  // Each day after grace period, 10% chance to revert
  return Math.random() < TERRITORY_DECAY_CONFIG.revertChance;
}

// Run as daily cron job
export async function processTerritoryDecay() {
  // Get all territories
  // For each, check if owner is active (logged in within 7 days)
  // If inactive, apply decay check
  // If decay triggers, revert to neutral
}
```

### 3. Cave Difficulty Tiers

**File:** `types/game.ts` and `lib/caveDifficultyService.ts`

```typescript
export enum CaveDifficulty {
  Easy = 'easy',       // Base drop rate (2.5%)
  Medium = 'medium',   // 3.75% drop rate
  Hard = 'hard',       // 5% drop rate
  Elite = 'elite',     // 6.25% drop rate
}

const CAVE_DIFFICULTY_DROP_RATES: Record<CaveDifficulty, number> = {
  [CaveDifficulty.Easy]: 0.025,
  [CaveDifficulty.Medium]: 0.0375,
  [CaveDifficulty.Hard]: 0.05,
  [CaveDifficulty.Elite]: 0.0625,
};

// Higher difficulty caves require minimum player level
const CAVE_DIFFICULTY_LEVEL_REQ: Record<CaveDifficulty, number> = {
  [CaveDifficulty.Easy]: 1,
  [CaveDifficulty.Medium]: 15,
  [CaveDifficulty.Hard]: 30,
  [CaveDifficulty.Elite]: 50,
};
```

**Files to update:**
- `types/game.ts` — Add CaveDifficulty enum
- `lib/caveDifficultyService.ts` — NEW: Difficulty-based drop rates
- `app/api/harvest/route.ts` — Apply difficulty-based rates
- `components/TileRenderer.tsx` — Display difficulty icon on cave tiles

### 4. Combat Shrine Buffs

**File:** Extend shrine system in `components/ShrinePanel.tsx` and shrine API

Add combat-oriented shrine sacrifices:

```typescript
export interface ShrineCombatBuff {
  tier: 'offense' | 'defense' | 'speed';
  itemCost: number;
  duration: number; // minutes
  bonus: number; // percentage
}

const COMBAT_SHRINE_BUFFS: ShrineCombatBuff[] = [
  { tier: 'offense', itemCost: 5,  duration: 60, bonus: 0.10 },  // +10% attack, 1hr, 5 items
  { tier: 'defense', itemCost: 5,  duration: 60, bonus: 0.10 },  // +10% defense, 1hr, 5 items
  { tier: 'speed',   itemCost: 3,  duration: 30, bonus: 0.15 },  // +15% move speed, 30min, 3 items
];
```

**Files to update:**
- `app/api/shrine/route.ts` — Add combat buff endpoints
- `components/ShrinePanel.tsx` — Add combat buff tab
- `lib/balanceService.ts` — Apply combat buffs to combat calculations

### 5. Achievement System

**File:** New `lib/achievementService.ts` and related files

```typescript
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'harvest' | 'exploration' | 'combat' | 'collection' | 'social' | 'time' | 'seasonal';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  requirement: number;
  currentProgress: number;
  completed: boolean;
  reward: AchievementReward;
}

export interface AchievementReward {
  metal?: number;
  energy?: number;
  rp?: number;
  xp?: number;
  vipDays?: number;
  cosmeticId?: string;
  buffId?: string; // Temporary buff
  buffDuration?: number; // hours
}

// Achievement definitions (sample)
export const ACHIEVEMENTS: Achievement[] = [
  // Harvest
  { id: 'harvest_1k',    name: 'First Harvest',     description: 'Harvest 1,000 tiles',       category: 'harvest', tier: 'bronze',   requirement: 1000,   reward: { metal: 10000, xp: 500 } },
  { id: 'harvest_10k',   name: 'Dedicated Farmer',   description: 'Harvest 10,000 tiles',     category: 'harvest', tier: 'silver',   requirement: 10000,  reward: { metal: 50000, rp: 10, xp: 2000 } },
  { id: 'harvest_100k',  name: 'Master Harvester',   description: 'Harvest 100,000 tiles',    category: 'harvest', tier: 'gold',     requirement: 100000, reward: { metal: 250000, rp: 50, xp: 10000, vipDays: 1 } },
  { id: 'harvest_1m',    name: 'Legendary Farmer',   description: 'Harvest 1,000,000 tiles',  category: 'harvest', tier: 'platinum', requirement: 1000000, reward: { metal: 1000000, rp: 200, xp: 50000, vipDays: 7, cosmeticId: 'harvest-legend' } },
  
  // Exploration
  { id: 'cave_100',     name: 'Cave Explorer',      description: 'Explore 100 caves',        category: 'exploration', tier: 'bronze',   requirement: 100,   reward: { metal: 15000, xp: 1000 } },
  { id: 'cave_500',     name: 'Spelunker',          description: 'Explore 500 caves',        category: 'exploration', tier: 'silver',   requirement: 500,   reward: { metal: 75000, rp: 15, xp: 5000 } },
  { id: 'cave_2000',    name: 'Cave Master',        description: 'Explore 2,000 caves',      category: 'exploration', tier: 'gold',     requirement: 2000,  reward: { metal: 300000, rp: 75, xp: 25000, vipDays: 3 } },
  
  // Combat
  { id: 'attack_10',    name: 'First Blood',        description: 'Win 10 attacks',           category: 'combat', tier: 'bronze',   requirement: 10,    reward: { metal: 20000, xp: 2000 } },
  { id: 'attack_50',    name: 'Warrior',            description: 'Win 50 attacks',           category: 'combat', tier: 'silver',   requirement: 50,    reward: { metal: 100000, rp: 20, xp: 10000 } },
  { id: 'factory_5',    name: 'Factory Capturer',   description: 'Capture 5 factories',      category: 'combat', tier: 'gold',     requirement: 5,     reward: { metal: 500000, rp: 100, xp: 50000, vipDays: 5 } },
  
  // Collection
  { id: 'diggers_10',   name: 'Digger Collector',   description: 'Collect 10 diggers',       category: 'collection', tier: 'bronze',  requirement: 10,    reward: { metal: 25000, xp: 1500 } },
  { id: 'diggers_50',   name: 'Digger Hoarder',     description: 'Collect 50 diggers',       category: 'collection', tier: 'silver',  requirement: 50,    reward: { metal: 150000, rp: 30, xp: 7500 } },
  { id: 'diggers_200',  name: 'Digger Baron',       description: 'Collect 200 diggers',      category: 'collection', tier: 'gold',    requirement: 200,   reward: { metal: 750000, rp: 150, xp: 30000, vipDays: 7 } },
  
  // Social
  { id: 'referral_1',   name: 'Recruiter',          description: 'Refer 1 player (level 5)',  category: 'social', tier: 'bronze',    requirement: 1,     reward: { metal: 10000, rp: 5 } },
  { id: 'referral_5',   name: 'Networker',          description: 'Refer 5 players (level 15)', category: 'social', tier: 'silver',   requirement: 5,     reward: { metal: 50000, rp: 25, vipDays: 3 } },
  { id: 'referral_25',  name: 'Growth Hacker',      description: 'Refer 25 players (level 25)', category: 'social', tier: 'gold', requirement: 25, reward: { metal: 250000, rp: 100, vipDays: 14, cosmeticId: 'recruiter-gold' } },
  
  // Time
  { id: 'streak_7',     name: 'Weekly Warrior',     description: 'Play 7 days in a row',      category: 'time', tier: 'bronze',      requirement: 7,     reward: { metal: 25000, xp: 3000 } },
  { id: 'streak_30',    name: 'Monthly Master',     description: 'Play 30 days in a row',     category: 'time', tier: 'silver',      requirement: 30,    reward: { metal: 150000, rp: 50, xp: 15000, vipDays: 3 } },
  { id: 'streak_100',   name: 'Centurion',          description: 'Play 100 days in a row',    category: 'time', tier: 'gold',        requirement: 100,   reward: { metal: 1000000, rp: 200, xp: 100000, vipDays: 30, cosmeticId: 'centurion' } },
];
```

**Files to create:**
- `lib/achievementService.ts` — Achievement tracking, progress, completion
- `app/api/achievements/route.ts` — GET achievements, POST claim reward
- `components/AchievementPanel.tsx` — Achievement UI with categories, progress bars
- `components/AchievementNotification.tsx` — Toast notification on completion

### 6. Content Cadence Plan

**File:** `dev/roadmap.md` — Update with content cadence

```
Content Drop Schedule:
- Monthly: New achievement categories, limited-time events
- Quarterly: Map events (Resource Rush, Flag Frenzy, Cave Exploration Event)
- 6 Months: Major content drops (new terrain types, unit tiers, mechanics)
- 12 Months: Expansion content (new map areas, new shrine mechanics, new cave types)

NO forced resets. Ever.
- Territory decay keeps map dynamic
- New content gives veterans something to chase
- Referral system constantly feeds new players
- Seasonal leaderboards (cosmetics only) create competition without wipes
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `lib/resourceDecayService.ts` | NEW: Resource decay calculation |
| 2 | `lib/territoryDecayService.ts` | NEW: Territory decay system |
| 3 | `lib/caveDifficultyService.ts` | NEW: Cave difficulty tiers |
| 4 | `lib/achievementService.ts` | NEW: Achievement tracking |
| 5 | `types/game.ts` | Add decay config, cave difficulty enum |
| 6 | `app/api/player/route.ts` | Apply resource decay on login |
| 7 | `app/api/achievements/route.ts` | NEW: Achievement endpoints |
| 8 | `app/api/shrine/route.ts` | Add combat buff endpoints |
| 9 | `app/api/harvest/route.ts` | Apply difficulty-based drop rates |
| 10 | `components/StatsPanel.tsx` | Display decay warning |
| 11 | `components/AchievementPanel.tsx` | NEW: Achievement UI |
| 12 | `components/AchievementNotification.tsx` | NEW: Achievement toast |
| 13 | `components/ShrinePanel.tsx` | Add combat buff tab |
| 14 | `components/TileRenderer.tsx` | Display cave difficulty |
| 15 | `dev/roadmap.md` | Update content cadence |

---

## Verification Checklist
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Resource decay applies only above 1M threshold
- [ ] Territory decay reverts uncontested tiles
- [ ] Cave difficulty tiers have different drop rates
- [ ] Combat shrine buffs apply to combat calculations
- [ ] Achievements track progress correctly
- [ ] Achievement rewards are claimable
- [ ] No permanent stat boosts from achievements (only temp buffs + cosmetics)
- [ ] Content cadence documented in roadmap

---

## Expected Impact

| System | Effect |
|--------|--------|
| Resource decay | Prevents infinite hoarding, forces spending |
| Territory decay | Keeps map dynamic, prevents stagnation |
| Cave difficulty | Gives exploration loop long-term scaling |
| Combat shrine | Links PvE exploration to PvP dominance |
| Achievements | Constant micro-goals, long-term engagement |
| Content cadence | Regular reasons to return, no forced resets |

---

## No Forced Resets — Ever

The game will NOT have seasonal resets or wipes. Instead:
- **Territory decay** keeps the map dynamic
- **New content drops** every 3-6 months give veterans something to chase
- **Referral system** constantly feeds new players into the ecosystem
- **Seasonal leaderboards** (cosmetics only) create competition without wipes
- **Achievement system** provides infinite horizontal progression
- **WMD system** provides clan-level megaprojects that take months

The game naturally evolves. Veterans become the "endgame bosses." New players organize to take them down. The economy breathes. All without anyone losing their progress.
