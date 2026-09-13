/**
 * Beer Base Service
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages special "Beer Base" bots with bonus loot rewards. Beer Bases are high-value targets
 * that disappear when defeated (NOT Full Permanence) and respawn weekly on Sundays at 4 AM.
 * 
 * FEATURES:
 * - 5-10% of bot population are Beer Bases
 * - 3x resource rewards (compared to normal bots)
 * - Disappear completely when defeated (removed from database)
 * - Weekly respawn schedule (Sunday 4 AM)
 * - Random spawn locations across map
 * - Special icon in scanner (🍺)
 * - Admin controls for spawn rate and reward multiplier
 * 
 * ARCHITECTURE:
 * - Beer Bases are regular bots with isSpecialBase: true flag
 * - Spawn rate configurable (default 5-10%)
 * - Reward multiplier configurable (default 3x)
 * - Cron job for weekly respawn
 * - Integration with bot spawner and combat service
 */

import { connectToDatabase } from './mongodb';
import type { Player } from '@/types/game.types';
import { recordSpawnEvent } from './beerBaseAnalytics';
import { createBotPlayer, generateBeerBaseName, claimBotBaseTile, releaseBotBaseTile } from './botService';
import { generatePredictiveDistribution, PredictiveDistribution } from './playerHistoryService';
import { BotSpecialization, UnitType, PlayerUnit, UNIT_CONFIGS, UnitTier } from '@/types/game.types';
// FID-20260906-006a R4: drizzle-native config reads/writes (game_config table).
import { db as drizzleDb } from '@/lib/db';
import { gameConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/** game_config rows use varchar(24) ids — 24-char uuid-hex slice (FID-006a R4). */
function generateConfigId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

/**
 * Beer Base Configuration
 */
export interface BeerBaseConfig {
  spawnRateMin: number; // Minimum % of population (default 5)
  spawnRateMax: number; // Maximum % of population (default 10)
  resourceMultiplier: number; // Resource reward multiplier (default 3)
  respawnDay: number; // Day of week (0=Sunday, default 0) - LEGACY, kept for backward compatibility
  respawnHour: number; // Hour of day (default 4 AM) - LEGACY, kept for backward compatibility
  enabled: boolean; // Master switch (default true)
  
  // Variety Settings (FID-20251025-001)
  varietyEnabled?: boolean; // Enable variety enforcement (default true)
  minWeakPercent?: number; // Min % of WEAK bases (default 15)
  minMediumPercent?: number; // Min % of MEDIUM bases (default 20)
  minStrongPercent?: number; // Min % of STRONG bases (default 15)
  minElitePercent?: number; // Min % of ELITE bases (default 10)
  maxSameTierPercent?: number; // Max % from single tier (default 60)
  
  // Dynamic Schedules (FID-20251025-003)
  schedulesEnabled?: boolean; // Use dynamic schedules (default false for backward compat)
  schedules?: RespawnSchedule[]; // Array of respawn schedules
  
  // Predictive Spawning (FID-20251025-002)
  usePredictiveSpawning?: boolean; // Use predictive tier distribution based on projected player levels (default false)
  predictiveWeeksAhead?: number; // Weeks to project ahead for predictions (default 2)

  // Scheduler bookkeeping (FID-20260909-035): the weekly respawn job persists
  // the ISO week of its last run so a server restart inside the scheduled
  // window cannot double-respawn, and a skipped window catches up on the
  // next tick within the same week.
  lastRespawnWeek?: number;
}

/**
 * Respawn Schedule
 * Defines when Beer Bases should respawn and what percentage to spawn
 * 
 * Example:
 * {
 *   id: 'schedule-1',
 *   enabled: true,
 *   dayOfWeek: 0, // Sunday
 *   hour: 4, // 4 AM
 *   spawnPercentage: 50, // Spawn 50% of total Beer Bases
 *   timezone: 'America/New_York', // EST
 *   name: 'Sunday Morning Spawn'
 * }
 */
export interface RespawnSchedule {
  id: string; // Unique schedule ID
  enabled: boolean; // Active/inactive
  dayOfWeek: number; // 0-6 (0=Sunday, 6=Saturday)
  hour: number; // 0-23 (in specified timezone)
  spawnPercentage: number; // % of total Beer Bases to spawn (1-100, can combine >100%)
  timezone: string; // IANA timezone (e.g., 'America/New_York', 'UTC')
  name?: string; // Optional friendly name
  lastRun?: Date; // Last time this schedule triggered
}

/**
 * Variety Configuration
 * Ensures minimum variety across power tiers even with homogeneous player base
 * 
 * Example: If all players are Level 15 (Mid tier), pure player-based distribution
 * would spawn 100% Mid Beer Bases. With variety enforcement:
 * - 15% WEAK (easy targets)
 * - 20% MEDIUM (appropriate challenges)
 * - 40% STRONG (growth opportunities) 
 * - 15% ELITE (aspirational content)
 * - 10% ULTRA (prestige targets)
 */
export interface VarietyConfig {
  enabled: boolean; // Enable variety enforcement (default: true)
  minWeakPercent: number; // Min % of WEAK bases (default: 15%)
  minMediumPercent: number; // Min % of MEDIUM bases (default: 20%)
  minStrongPercent: number; // Min % of STRONG bases (default: 15%)
  minElitePercent: number; // Min % of ELITE bases (default: 10%)
  minUltraPercent: number; // Min % of ULTRA bases (default: 5%)
  maxSameTierPercent: number; // Max % from single tier (default: 60%)
}

/**
 * Default Beer Base configuration
 * 
 * With ~2,000-5,000 total bots on a 150x150 map:
 * - 5-10% spawn rate = 100-500 Beer Bases (realistic distribution)
 * - Provides varied hunting opportunities across all power tiers
 * - Ensures players always have targets without oversaturation
 * 
 * Variety Settings (FID-20251025-001):
 * - Ensures minimum distribution across all tiers (prevent 100% single tier)
 * - Defaults provide balanced variety while respecting player levels
 * - Can be disabled to use pure player-based distribution
 * 
 * Dynamic Schedules (FID-20251025-003):
 * - Backward compatible: Legacy respawnDay/respawnHour still work when schedulesEnabled=false
 * - Modern: Multiple respawn times per week with flexible percentages
 * - Default: Single Sunday 4 AM EST schedule spawning 100%
 */
const DEFAULT_CONFIG: BeerBaseConfig = {
  spawnRateMin: 5,  // 5% minimum (100+ bases with 2000 bots)
  spawnRateMax: 10, // 10% maximum (500 bases with 5000 bots)
  resourceMultiplier: 3, // 3x resource rewards
  respawnDay: 0, // Sunday (LEGACY - kept for backward compatibility)
  respawnHour: 4, // 4 AM (LEGACY - kept for backward compatibility)
  enabled: true,
  
  // Variety Settings
  varietyEnabled: true,
  minWeakPercent: 15,
  minMediumPercent: 20,
  minStrongPercent: 15,
  minElitePercent: 10,
  maxSameTierPercent: 60,
  
  // Dynamic Schedules
  schedulesEnabled: false, // Use legacy single schedule by default
  schedules: [
    {
      id: 'default-schedule',
      enabled: true,
      dayOfWeek: 0, // Sunday
      hour: 4, // 4 AM
      spawnPercentage: 100, // Spawn 100% of Beer Bases
      timezone: 'America/New_York', // EST
      name: 'Sunday Morning Spawn'
    }
  ],
  
  // Predictive Spawning (FID-20251025-002)
  usePredictiveSpawning: false, // Use current player levels by default (not predictions)
  predictiveWeeksAhead: 2, // Project 2 weeks ahead when enabled
};

/**
 * Get Beer Base configuration from database or return defaults
 */
/**
 * Get Beer Base configuration — FID-20260906-006a R4: drizzle-native read of the
 * `game_config` row (type='beerBase', jsonb config). Falls back to defaults on any
 * failure so spawn/loot paths never break because of a config read.
 *
 * FID-20260912-081: spawnRateMin/Max are healed on read — an AdminView regression
 * (fixed same-FID) posted the slider values /100, storing 0.05/0.1 where the canon
 * unit is a percent integer (5/10). getTargetBeerBaseCount divided by 100 again,
 * computing a target of 1 base and the weekly respawn trimmed the population to it.
 * Healing on read self-corrects the poisoned row without a data migration; values
 * ≥ 0 are treated as fractions only when max ≤ 1 (a legit percent config of 0/0 is
 * a no-op anyway).
 */
/** Exported for the FID-20260912-081 config-healing tests. */
export function normalizeSpawnRateConfig(config: Partial<BeerBaseConfig>): Partial<BeerBaseConfig> {
  const { spawnRateMin, spawnRateMax } = config;
  if (
    spawnRateMin !== undefined &&
    spawnRateMax !== undefined &&
    spawnRateMin >= 0 &&
    spawnRateMax <= 1 &&
    (spawnRateMin > 0 || spawnRateMax > 0)
  ) {
    return {
      ...config,
      spawnRateMin: Math.min(100, Math.max(0, spawnRateMin * 100)),
      spawnRateMax: Math.min(100, Math.max(0, spawnRateMax * 100)),
    };
  }
  return config;
}

export async function getBeerBaseConfig(): Promise<BeerBaseConfig> {
  try {
    const rows = await drizzleDb.select().from(gameConfig).where(eq(gameConfig.type, 'beerBase')).limit(1);
    const config = rows[0]?.config as Partial<BeerBaseConfig> | undefined;
    if (config) {
      const healed = normalizeSpawnRateConfig(config);
      return {
        spawnRateMin: healed.spawnRateMin ?? DEFAULT_CONFIG.spawnRateMin,
        spawnRateMax: healed.spawnRateMax ?? DEFAULT_CONFIG.spawnRateMax,
        resourceMultiplier: config.resourceMultiplier ?? DEFAULT_CONFIG.resourceMultiplier,
        respawnDay: config.respawnDay ?? DEFAULT_CONFIG.respawnDay,
        respawnHour: config.respawnHour ?? DEFAULT_CONFIG.respawnHour,
        enabled: config.enabled ?? DEFAULT_CONFIG.enabled,

        // Variety settings (FID-20251025-001)
        varietyEnabled: config.varietyEnabled ?? DEFAULT_CONFIG.varietyEnabled,
        minWeakPercent: config.minWeakPercent ?? DEFAULT_CONFIG.minWeakPercent,
        minMediumPercent: config.minMediumPercent ?? DEFAULT_CONFIG.minMediumPercent,
        minStrongPercent: config.minStrongPercent ?? DEFAULT_CONFIG.minStrongPercent,
        minElitePercent: config.minElitePercent ?? DEFAULT_CONFIG.minElitePercent,
        maxSameTierPercent: config.maxSameTierPercent ?? DEFAULT_CONFIG.maxSameTierPercent,

        // Dynamic Schedules (FID-20251025-003)
        schedulesEnabled: config.schedulesEnabled ?? DEFAULT_CONFIG.schedulesEnabled,
        schedules: config.schedules ?? DEFAULT_CONFIG.schedules,

        // Predictive Spawning (FID-20251025-002)
        usePredictiveSpawning: config.usePredictiveSpawning ?? DEFAULT_CONFIG.usePredictiveSpawning,
        predictiveWeeksAhead: config.predictiveWeeksAhead ?? DEFAULT_CONFIG.predictiveWeeksAhead,

        // Scheduler bookkeeping (FID-20260909-035)
        lastRespawnWeek: config.lastRespawnWeek,
      };
    }

    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Failed to load Beer Base config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Update Beer Base configuration — FID-20260906-006a R4: race-safe drizzle upsert
 * on the unique `type` index (migration 0009/0017 pattern), jsonb merge preserves
 * fields not included in the patch.
 */
export async function updateBeerBaseConfig(config: Partial<BeerBaseConfig>): Promise<void> {
  const current = await getBeerBaseConfig();
  // Spread merge preserves the persisted lastRespawnWeek unless the caller
  // explicitly supplies a new one (setLastRespawnWeek).
  const merged = { ...current, ...config };
  await drizzleDb
    .insert(gameConfig)
    .values({ id: generateConfigId(), type: 'beerBase', config: merged })
    .onConflictDoUpdate({
      target: gameConfig.type,
      set: { config: merged },
    });
}

/**
 * Persist the ISO week of the last completed respawn (FID-20260909-035).
 * Survives server restarts so the weekly respawn can neither double-fire
 * within one week (restart inside the window) nor stay stuck when a window
 * is missed entirely (catch-up: a past week triggers on the next tick).
 */
export async function setLastRespawnWeek(week: number): Promise<void> {
  await updateBeerBaseConfig({ lastRespawnWeek: week });
}

/**
 * Get all respawn schedules
 * Returns active schedules array or empty array if none configured
 */
export async function getSchedules(): Promise<RespawnSchedule[]> {
  const config = await getBeerBaseConfig();
  return config.schedules || [];
}

/**
 * Add a new respawn schedule
 * @param schedule - Schedule to add (id will be generated if not provided)
 * @returns The added schedule with generated ID
 */
export async function addSchedule(schedule: Omit<RespawnSchedule, 'id'> & { id?: string }): Promise<RespawnSchedule> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  // Generate unique ID if not provided
  const newSchedule: RespawnSchedule = {
    ...schedule,
    id: schedule.id || `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  
  // Add to schedules array
  const updatedSchedules = [...(config.schedules || []), newSchedule];
  
  await db.collection('gameConfig').updateOne(
    { type: 'beerBase' },
    { 
      $set: { 
        schedules: updatedSchedules,
        updatedAt: new Date() 
      } 
    },
    { upsert: true }
  );
  
  return newSchedule;
}

/**
 * Update an existing respawn schedule
 * @param id - Schedule ID to update
 * @param updates - Fields to update
 * @returns Updated schedule or null if not found
 */
export async function updateSchedule(
  id: string, 
  updates: Partial<Omit<RespawnSchedule, 'id'>>
): Promise<RespawnSchedule | null> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  const schedules = config.schedules || [];
  const index = schedules.findIndex(s => s.id === id);
  
  if (index === -1) {
    return null; // Schedule not found
  }
  
  // Update the schedule
  const updatedSchedule = { ...schedules[index], ...updates };
  schedules[index] = updatedSchedule;
  
  await db.collection('gameConfig').updateOne(
    { type: 'beerBase' },
    { 
      $set: { 
        schedules,
        updatedAt: new Date() 
      } 
    }
  );
  
  return updatedSchedule;
}

/**
 * Delete a respawn schedule
 * @param id - Schedule ID to delete
 * @returns True if deleted, false if not found
 */
export async function deleteSchedule(id: string): Promise<boolean> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  const schedules = config.schedules || [];
  const initialLength = schedules.length;
  const filteredSchedules = schedules.filter(s => s.id !== id);
  
  if (filteredSchedules.length === initialLength) {
    return false; // Schedule not found
  }
  
  await db.collection('gameConfig').updateOne(
    { type: 'beerBase' },
    { 
      $set: { 
        schedules: filteredSchedules,
        updatedAt: new Date() 
      } 
    }
  );
  
  return true;
}

/**
 * Calculate target number of Beer Bases based on total bot population
 * 
 * FIXED 2025-10-25: Exclude Beer Bases from count to prevent infinite feedback loop
 * - OLD BUG: Counted ALL bots including Beer Bases → infinite growth
 * - NEW FIX: Only count regular bots (exclude isSpecialBase: true)
 * - SAFETY CAPS: Respect botConfig.totalBotCap and absolute max of 1000
 */
export async function getTargetBeerBaseCount(): Promise<number> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  if (!config.enabled) {
    return 0;
  }
  
  // Get total REGULAR bot count (EXCLUDE Beer Bases to prevent infinite loop)
  const regularBots = await db.collection<Player>('players').countDocuments({ 
    isBot: true,
    isSpecialBase: { $ne: true } // CRITICAL: Don't count Beer Bases in calculation
  });
  
  // Get bot system config for totalBotCap
  const botConfig = await db.collection<{ totalBotCap?: number }>('botConfig').findOne({});
  const totalBotCap = botConfig?.totalBotCap || 1000;
  
  // Use average spawn rate (no need for random variance every check)
  const spawnRate = (config.spawnRateMin + config.spawnRateMax) / 2;
  
  // Calculate target count based on REGULAR bots only
  let targetCount = Math.floor(regularBots * (spawnRate / 100));
  
  // SAFETY CAP #1: Never exceed 10% of total bot cap
  const maxAllowed = Math.floor(totalBotCap * 0.10);
  targetCount = Math.min(targetCount, maxAllowed);
  
  // SAFETY CAP #2: Absolute maximum of 1000 Beer Bases
  targetCount = Math.min(targetCount, 1000);
  
  // Return 0 if no regular bots exist yet (prevent spawning before bot population)
  if (regularBots === 0) {
    return 0;
  }
  
  return Math.max(1, targetCount); // At least 1 Beer Base if enabled and bots exist
}

/**
 * Get current Beer Base count
 */
export async function getCurrentBeerBaseCount(): Promise<number> {
  const db = await connectToDatabase();
  return await db.collection('players').countDocuments({ 
    isBot: true, 
    isSpecialBase: true 
  });
}

/**
 * Power tier classification for Beer Bases
 * Realistic power ranges aligned with endgame player capabilities.
 * Bands describe TOTAL army power (strength + defense, the sum the UI
 * displays) and are calibrated against the post-FID-20260909-033 unified
 * unit roster (T1 Infantry = 100 power).
 */
export enum PowerTier {
  Weak = 'WEAK',           // 15K-50K total power (early targets; floor raised from 1K — post-unification a T1 unit costs 100, so sub-15K armies cannot exist)
  Mid = 'MID',             // 50K-500K total power (mid-game targets)
  Strong = 'STRONG',       // 500K-2M total power (late-game targets)
  Elite = 'ELITE',         // 2M-10M total power (endgame targets)
  Ultra = 'ULTRA',         // 10M-50M total power (veteran targets)
  Legendary = 'LEGENDARY'  // 50M-100M total power (ultimate challenges)
}

/**
 * Convert PowerTier to numeric tier (0-5) for analytics
 */
function powerTierToNumber(tier: PowerTier): number {
  switch (tier) {
    case PowerTier.Weak: return 0;
    case PowerTier.Mid: return 1;
    case PowerTier.Strong: return 2;
    case PowerTier.Elite: return 3;
    case PowerTier.Ultra: return 4;
    case PowerTier.Legendary: return 5;
    default: return 0;
  }
}

/**
 * Get target total power for a given power tier
 */
function getTargetPowerForTier(tier: PowerTier): number {
  switch (tier) {
    case PowerTier.Weak:
      return 15_000 + Math.floor(Math.random() * 35_000); // 15K-50K (floor: minimum viable 10-slot army post-unification)
    case PowerTier.Mid:
      return 50_000 + Math.floor(Math.random() * 450_000); // 50K-500K
    case PowerTier.Strong:
      return 500_000 + Math.floor(Math.random() * 1_500_000); // 500K-2M
    case PowerTier.Elite:
      return 2_000_000 + Math.floor(Math.random() * 8_000_000); // 2M-10M
    case PowerTier.Ultra:
      return 10_000_000 + Math.floor(Math.random() * 40_000_000); // 10M-50M
    case PowerTier.Legendary:
      return 50_000_000 + Math.floor(Math.random() * 50_000_000); // 50M-100M
  }
}

/**
 * Unit pools for bot army generation — FID-20260909-033: DERIVED from
 * UNIT_CONFIGS (which is itself derived from the canonical UNIT_BLUEPRINTS
 * roster). No hand-copied stats: a bot Sniper is the same Sniper a player
 * builds, so bot power and player power are computed on identical numbers.
 * FID-20260909-034: band integrity (min ≤ Σ(quantity × (str+def)) ≤ max for
 * every draw) is pinned by regression; generation filters to PURE entries.
 */
export const POWER_BANDS = {
  weak:      { key: PowerTier.Weak,      min: 15_000,     max: 50_000 },
  mid:       { key: PowerTier.Mid,       min: 50_000,     max: 500_000 },
  strong:    { key: PowerTier.Strong,    min: 500_000,    max: 2_000_000 },
  elite:     { key: PowerTier.Elite,     min: 2_000_000,  max: 10_000_000 },
  ultra:     { key: PowerTier.Ultra,     min: 10_000_000, max: 50_000_000 },
  legendary: { key: PowerTier.Legendary, min: 50_000_000, max: 100_000_000 },
} as const;

/**
 * Bot tier → power band (FID-20260909-035 repopulation). Mirrors the
 * player-bracket alignment: bot T1 ≈ player levels 1-10 ≈ WEAK, and so on;
 * bot tiers 6-7 (levels 51+) both map to LEGENDARY.
 */
export const POWER_TIER_FOR_BOT_TIER: Record<number, PowerTier> = {
  1: PowerTier.Weak,
  2: PowerTier.Mid,
  3: PowerTier.Strong,
  4: PowerTier.Elite,
  5: PowerTier.Ultra,
  6: PowerTier.Legendary,
  7: PowerTier.Legendary,
};

export const UNIT_POOLS = Object.fromEntries(
  ([1, 2, 3, 4, 5] as UnitTier[]).map((tier) => [
    tier,
    Object.values(UNIT_CONFIGS)
      .filter((c) => c.tier === tier)
      .map((c) => ({ type: c.type, name: c.name, str: c.strength, def: c.defense }))
  ])
) as Record<UnitTier, { type: UnitType; name: string; str: number; def: number }[]>;

/**
 * Generate realistic progressive unit composition for Beer Base
 * 
 * Builds armies progressively across all tiers (T1-T5) like real players.
 * - T1: 10% of power (foundation units built early)
 * - T2: 20% of power (bulk army)
 * - T3: 30% of power (backbone of force)
 * - T4: 60% of remaining power (heavy hitters)
 * - T5: Rest (endgame power units)
 * 
 * @param specialization - Bot specialization affecting STR/DEF ratio
 * @param powerTier - Target power tier for this Beer Base
 * @returns Array of PlayerUnits with realistic progressive composition
 *
 * FID-20260909-034 power-band contract:
 * - Budgets are TOTAL power (strength + defense). The previous generator
 *   budgeted only the picked axis and ignored the other stat, so dual-stat
 *   SPEC_TAC/PRESTIGE units leaked unbudgeted power (Silent_Citadel spawned
 *   11.56M actual against the 10M ELITE ceiling).
 * - Pools are PURE units (one nonzero stat) per tier, so quantity × stat cost
 *   lands exactly on the tier's budget. Dual-stat units are excluded; the
 *   fallback counts their full str+def into the quantity math so even a
 *   dual-only pool stays inside the band.
 * - Every tier slot delivers ≥1 unit: post-unification unit costs (T1 = 100)
 *   exceed the smallest WEAK band slices, and a plain floor() emptied every
 *   tier for small budgets (zero-STR hollow bases).
 * - Result: Σ(quantity × (str + def)) stays within the tier band for every
 *   (specialization, tier draw) — pinned by regression test.
 */
export function generateBeerBaseUnits(
  specialization: BotSpecialization,
  powerTier: PowerTier
): PlayerUnit[] {
  const units: PlayerUnit[] = [];
  
  // Get total target power for this tier
  const totalTargetPower = getTargetPowerForTier(powerTier);
  
  // Determine STR/DEF ratio based on specialization
  let strRatio = 0.5; // Default balanced
  
  switch (specialization) {
    case BotSpecialization.Raider:
      strRatio = 0.7; // 70% STR, 30% DEF
      break;
    case BotSpecialization.Fortress:
      strRatio = 0.3; // 30% STR, 70% DEF
      break;
    case BotSpecialization.Balanced:
      strRatio = 0.5; // 50/50
      break;
    case BotSpecialization.Ghost:
      strRatio = 0.6; // 60% STR, 40% DEF
      break;
    case BotSpecialization.Hoarder:
      strRatio = 0.4; // 40% STR, 60% DEF (defensive hoarder)
      break;
  }
  
  // Split total power into STR and DEF, then allocate progressively across
  // tiers (T1: 10%, T2: 20%, T3: 30%, T4: 60% of remaining, T5: rest).
  const allocateTiers = (target: number): [number, number, number, number, number] => {
    const t1 = Math.floor(target * 0.10);
    const t2 = Math.floor(target * 0.20);
    const t3 = Math.floor(target * 0.30);
    const remaining = target - t1 - t2 - t3;
    const t4 = Math.floor(remaining * 0.60);
    const t5 = remaining - t4;
    return [t1, t2, t3, t4, t5];
  };
  const strPowerByTier = allocateTiers(Math.floor(totalTargetPower * strRatio));
  const defPowerByTier = allocateTiers(Math.floor(totalTargetPower * (1 - strRatio)));
  
  // Helper to pick random unit from pool
  const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  // Helper to create PlayerUnit
  const createUnit = (unit: { type: UnitType; str: number; def: number; name: string }, quantity: number): PlayerUnit => {
    const rarity = unit.str + unit.def >= 500 ? 'legendary' : 
                   unit.str + unit.def >= 200 ? 'epic' :
                   unit.str + unit.def >= 100 ? 'rare' :
                   unit.str + unit.def >= 30 ? 'uncommon' : 'common';
    
    return {
      id: `${unit.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      unitId: `${unit.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      unitType: unit.type,
      name: unit.name,
      category: unit.str > 0 ? 'STR' : 'DEF',
      rarity: rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary',
      strength: unit.str,
      defense: unit.def,
      quantity,
      createdAt: new Date()
    };
  };
  
  // Generate units progressively across all tiers — FID-20260909-034:
  // pure units only (one nonzero stat), so quantity × stat lands exactly on
  // the tier budget. FID-20260909-035: a slot the budget cannot afford is
  // SKIPPED, not forced to 1 unit — the old ≥1 guarantee dumped up to one
  // full unit cost of unbudgeted power per slot and could push WEAK-band
  // armies past the ceiling (51,155 vs 50,000 caught by the sweep). Small
  // bases legitimately field no T5 units; the floor top-up below keeps the
  // ARMY total at or above the band minimum, and the 15K WEAK floor keeps
  // the T1 slots always affordable (no hollow armies).
  const tierBudgets: Array<{ tier: UnitTier; budget: number; stat: 'str' | 'def' }> = [
    ...strPowerByTier.map((budget, i) => ({ tier: (i + 1) as UnitTier, budget, stat: 'str' as const })),
    ...defPowerByTier.map((budget, i) => ({ tier: (i + 1) as UnitTier, budget, stat: 'def' as const })),
  ];
  
  for (const { tier, budget, stat } of tierBudgets) {
    if (budget <= 0) continue;
    // Pure units only: a dual-stat unit budgeted on one axis delivers its
    // other stat unbudgeted (the 1.9M STR leak that pushed Silent_Citadel
    // to 11.56M against the 10M ELITE ceiling).
    const pool = UNIT_POOLS[tier].filter((u) => u[stat] > 0 && u[stat === 'str' ? 'def' : 'str'] === 0);
    // Fallback (dual-only pool): count the FULL str+def into the quantity
    // math so the delivered total power still respects the budget.
    const unit = pool.length > 0
      ? pickRandom(pool)
      : pickRandom(UNIT_POOLS[tier].filter((u) => u[stat] > 0));
    const unitPower = unit.str + unit.def;
    const quantity = Math.floor(budget / unitPower);
    if (quantity < 1) continue;
    units.push(createUnit(unit, quantity));
  }
  
  // FID-20260909-034: floor() granularity can undershoot the band floor
  // (e.g. a T5 slot budgeting 1,500 delivers a single 1,200 Sniper). Top up
  // with the cheapest pure T1 STR unit so no army lands below its band's
  // minimum. The overshoot is bounded by one unit cost (< min for every band),
  // so the top-up can never breach the ceiling.
  const band = Object.values(POWER_BANDS).find((b) => b.key === powerTier);
  if (band) {
    const delivered = units.reduce((s, u) => s + (u.strength + u.defense) * u.quantity, 0);
    if (delivered < band.min) {
      const t1Pure = UNIT_POOLS[UnitTier.Tier1]
        .filter((u) => u.str > 0 && u.def === 0)
        .sort((a, b) => a.str - b.str)[0];
      const deficit = band.min - delivered;
      const topUpQty = Math.ceil(deficit / t1Pure.str);
      units.push(createUnit(t1Pure, topUpQty));
    }
  }
  
  return units;
}

/**
 * Player level distribution for smart spawning
 * Maps player levels to power tiers
 */
interface PlayerLevelDistribution {
  weak: number;      // % of players level 1-10
  mid: number;       // % of players level 11-20
  strong: number;    // % of players level 21-30
  elite: number;     // % of players level 31-40
  ultra: number;     // % of players level 41-50
  legendary: number; // % of players level 51+
  totalPlayers: number;
}

/**
 * Analyze active player level distribution
 * Only counts players active in last 7 days
 * Returns percentage distribution across power tiers
 * 
 * @returns Player level distribution by power tier
 */
async function analyzePlayerLevelDistribution(): Promise<PlayerLevelDistribution> {
  const db = await connectToDatabase();
  
  // Get active players (logged in within last 7 days OR no lastLoginDate set)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const activePlayers = await db.collection<Player>('players').find({
    isBot: { $ne: true }, // Only real players (handles missing isBot field)
    $or: [
      { lastLoginDate: { $gte: sevenDaysAgo } }, // Logged in recently
      { lastLoginDate: { $exists: false } }       // No login tracking yet (assume active)
    ]
  }).toArray();
  
  const totalPlayers = activePlayers.length;
  
  if (totalPlayers === 0) {
    // No active players - return default distribution
    return {
      weak: 10,
      mid: 30,
      strong: 30,
      elite: 20,
      ultra: 8,
      legendary: 2,
      totalPlayers: 0
    };
  }
  
  // Count players in each level range
  let weakCount = 0;
  let midCount = 0;
  let strongCount = 0;
  let eliteCount = 0;
  let ultraCount = 0;
  let legendaryCount = 0;
  
  for (const player of activePlayers) {
    const level = player.level || 1;
    
    if (level <= 10) weakCount++;
    else if (level <= 20) midCount++;
    else if (level <= 30) strongCount++;
    else if (level <= 40) eliteCount++;
    else if (level <= 50) ultraCount++;
    else legendaryCount++;
  }
  
  // Convert to percentages
  return {
    weak: Math.round((weakCount / totalPlayers) * 100),
    mid: Math.round((midCount / totalPlayers) * 100),
    strong: Math.round((strongCount / totalPlayers) * 100),
    elite: Math.round((eliteCount / totalPlayers) * 100),
    ultra: Math.round((ultraCount / totalPlayers) * 100),
    legendary: Math.round((legendaryCount / totalPlayers) * 100),
    totalPlayers
  };
}

/**
 * Apply variety enforcement to power tier distribution
 * Ensures minimum percentages across all tiers regardless of player distribution
 * 
 * Algorithm:
 * 1. Calculate current tier percentages from distribution
 * 2. Compare against configured minimums
 * 3. Boost tiers below minimum to reach minimum
 * 4. Reduce dominant tier if exceeds max same-tier percentage
 * 5. Normalize to ensure total = 100%
 * 
 * Example:
 * - Player-based: 100% Mid tier (homogeneous Level 15 players)
 * - After variety: 15% WEAK, 25% MEDIUM, 40% STRONG, 15% ELITE, 5% ULTRA
 * 
 * @param tiers - Original tier distribution from player analysis
 * @param config - Beer Base configuration with variety settings
 * @returns Variety-enforced tier distribution
 */
function applyVarietyEnforcement(tiers: PowerTier[], config: BeerBaseConfig): PowerTier[] {
  // If variety disabled, return original distribution
  if (!config.varietyEnabled) {
    return tiers;
  }
  
  // Count current tier distribution
  const tierCounts = {
    [PowerTier.Weak]: tiers.filter((t) => t === PowerTier.Weak).length,
    [PowerTier.Mid]: tiers.filter((t) => t === PowerTier.Mid).length,
    [PowerTier.Strong]: tiers.filter((t) => t === PowerTier.Strong).length,
    [PowerTier.Elite]: tiers.filter((t) => t === PowerTier.Elite).length,
    [PowerTier.Ultra]: tiers.filter((t) => t === PowerTier.Ultra).length,
    [PowerTier.Legendary]: tiers.filter((t) => t === PowerTier.Legendary).length,
  };
  
  const total = tiers.length;
  
  // Calculate current percentages
  const currentPercentages = {
    [PowerTier.Weak]: (tierCounts[PowerTier.Weak] / total) * 100,
    [PowerTier.Mid]: (tierCounts[PowerTier.Mid] / total) * 100,
    [PowerTier.Strong]: (tierCounts[PowerTier.Strong] / total) * 100,
    [PowerTier.Elite]: (tierCounts[PowerTier.Elite] / total) * 100,
    [PowerTier.Ultra]: (tierCounts[PowerTier.Ultra] / total) * 100,
    [PowerTier.Legendary]: (tierCounts[PowerTier.Legendary] / total) * 100,
  };
  
  // Get configured minimums (with fallback to defaults)
  const minWeakPercent = config.minWeakPercent ?? 15;
  const minMediumPercent = config.minMediumPercent ?? 20;
  const minStrongPercent = config.minStrongPercent ?? 15;
  const minElitePercent = config.minElitePercent ?? 10;
  const maxSameTierPercent = config.maxSameTierPercent ?? 60;
  
  // Build target percentages with minimums enforced
  const targetPercentages = {
    [PowerTier.Weak]: Math.max(currentPercentages[PowerTier.Weak], minWeakPercent),
    [PowerTier.Mid]: Math.max(currentPercentages[PowerTier.Mid], minMediumPercent),
    [PowerTier.Strong]: Math.max(currentPercentages[PowerTier.Strong], minStrongPercent),
    [PowerTier.Elite]: Math.max(currentPercentages[PowerTier.Elite], minElitePercent),
    [PowerTier.Ultra]: currentPercentages[PowerTier.Ultra], // No minimum for ULTRA/LEGENDARY
    [PowerTier.Legendary]: currentPercentages[PowerTier.Legendary],
  };
  
  // Check if any tier exceeds max same-tier percentage
  const maxTier = (Object.entries(targetPercentages) as [PowerTier, number][]).reduce((max, [tier, pct]) => 
    pct > max[1] ? [tier, pct] : max
  );
  
  if (maxTier[1] > maxSameTierPercent) {
    // Cap the dominant tier
    targetPercentages[maxTier[0]] = maxSameTierPercent;
  }
  
  // Normalize to ensure total = 100%
  const sumPercentages = Object.values(targetPercentages).reduce((sum, pct) => sum + pct, 0);
  
  if (sumPercentages !== 100) {
    // Distribute difference proportionally
    const multiplier = 100 / sumPercentages;
    Object.keys(targetPercentages).forEach(tier => {
      targetPercentages[tier as PowerTier] *= multiplier;
    });
  }
  
  // Build new tier array based on target percentages
  const newTiers: PowerTier[] = [];
  const targetTotal = 100; // Work with 100 items for easy percentage conversion
  
  Object.entries(targetPercentages).forEach(([tier, percentage]) => {
    const count = Math.round((percentage / 100) * targetTotal);
    for (let i = 0; i < count; i++) {
      newTiers.push(tier as PowerTier);
    }
  });
  
  // Ensure we have at least targetTotal items (handle rounding errors)
  while (newTiers.length < targetTotal) {
    // Add from tier with highest target percentage
    const maxTier = (Object.entries(targetPercentages) as [PowerTier, number][]).reduce((max, [tier, pct]) => 
      pct > max[1] ? [tier, pct] : max
    );
    newTiers.push(maxTier[0]);
  }
  
  // Trim if we went over (rounding up)
  while (newTiers.length > targetTotal) {
    newTiers.pop();
  }
  
  return newTiers;
}

/**
 * Generate smart power tier distribution based on player population
 * Uses "spread" approach: distributes spawns across adjacent tiers for variety
 * 
 * Enhanced with Variety Enforcement (FID-20251025-001):
 * - Ensures minimum percentages across all tiers
 * - Prevents homogeneous spawns when player base is uniform
 * - Can be toggled on/off via config.varietyEnabled
 * 
 * Example: If 80% of players are level 21-30 (Strong tier):
 * - 40% Strong Beer Bases (same tier)
 * - 30% Elite Beer Bases (one tier up - challenge)
 * - 10% Mid Beer Bases (one tier down - easier targets)
 * - 20% Ultra Beer Bases (two tiers up - rare challenge)
 * 
 * @param distribution - Player level distribution from analysis
 * @param config - Beer Base configuration (includes variety settings)
 * @returns Weighted array of power tiers for random selection
 */
function generateSmartPowerTierDistribution(
  distribution: PlayerLevelDistribution,
  config: BeerBaseConfig
): PowerTier[] {
  const tiers: PowerTier[] = [];
  
  // Helper to add tiers with spread distribution
  const addTierWithSpread = (
    primaryTier: PowerTier,
    lowerTier: PowerTier | null,
    upperTier: PowerTier | null,
    upperTier2: PowerTier | null,
    percentage: number
  ) => {
    if (percentage === 0) return;
    
    // Spread approach: 40% same tier, 30% upper tier, 10% lower tier, 20% upper tier 2
    const count = Math.round(percentage);
    
    // 40% primary tier (same as player range)
    const primaryCount = Math.round(count * 0.40);
    for (let i = 0; i < primaryCount; i++) {
      tiers.push(primaryTier);
    }
    
    // 30% upper tier (challenge)
    if (upperTier) {
      const upperCount = Math.round(count * 0.30);
      for (let i = 0; i < upperCount; i++) {
        tiers.push(upperTier);
      }
    }
    
    // 10% lower tier (easier targets)
    if (lowerTier) {
      const lowerCount = Math.round(count * 0.10);
      for (let i = 0; i < lowerCount; i++) {
        tiers.push(lowerTier);
      }
    }
    
    // 20% upper tier 2 (rare challenge)
    if (upperTier2) {
      const upper2Count = Math.round(count * 0.20);
      for (let i = 0; i < upper2Count; i++) {
        tiers.push(upperTier2);
      }
    }
  };
  
  // Build distribution based on player levels
  addTierWithSpread(PowerTier.Weak, null, PowerTier.Mid, PowerTier.Strong, distribution.weak);
  addTierWithSpread(PowerTier.Mid, PowerTier.Weak, PowerTier.Strong, PowerTier.Elite, distribution.mid);
  addTierWithSpread(PowerTier.Strong, PowerTier.Mid, PowerTier.Elite, PowerTier.Ultra, distribution.strong);
  addTierWithSpread(PowerTier.Elite, PowerTier.Strong, PowerTier.Ultra, PowerTier.Legendary, distribution.elite);
  addTierWithSpread(PowerTier.Ultra, PowerTier.Elite, PowerTier.Legendary, null, distribution.ultra);
  addTierWithSpread(PowerTier.Legendary, PowerTier.Ultra, null, null, distribution.legendary);
  
  // Ensure we have at least some tiers (fallback)
  if (tiers.length === 0) {
    // Default distribution if no players
    return [
      PowerTier.Weak,
      PowerTier.Mid, PowerTier.Mid, PowerTier.Mid,
      PowerTier.Strong, PowerTier.Strong, PowerTier.Strong,
      PowerTier.Elite, PowerTier.Elite,
      PowerTier.Ultra,
    ];
  }
  
  // Apply variety enforcement (FID-20251025-001)
  return applyVarietyEnforcement(tiers, config);
}

/**
 * Cached player distribution (refreshed every 15 minutes)
 */
let cachedDistribution: PlayerLevelDistribution | null = null;
let cachedSmartTiers: PowerTier[] | null = null;
let cachedPredictiveTiers: PowerTier[] | null = null; // Cache for predictive distribution
let lastDistributionUpdate: Date | null = null;

/**
 * Convert predictive distribution to PowerTier array
 * Maps predictive tier percentages (0-5) to PowerTier enum
 * 
 * @param predictiveDistribution - Predictive distribution from playerHistoryService
 * @returns Array of power tiers for weighted random selection
 */
function convertPredictiveToTiers(predictiveDistribution: PredictiveDistribution): PowerTier[] {
  const tiers: PowerTier[] = [];
  const percentages = predictiveDistribution.tierDistribution;
  
  // Map numeric tiers (0-5) to PowerTier enum
  const tierMap = [
    PowerTier.Weak,      // tier 0
    PowerTier.Mid,       // tier 1
    PowerTier.Strong,    // tier 2
    PowerTier.Elite,     // tier 3
    PowerTier.Ultra,     // tier 4
    PowerTier.Legendary, // tier 5
  ];
  
  // Build weighted array (100 items total for easy percentage mapping)
  percentages.forEach((percentage, index) => {
    const count = Math.round(percentage); // percentage is already 0-100
    for (let i = 0; i < count; i++) {
      tiers.push(tierMap[index]);
    }
  });
  
  // Ensure we have at least 100 items (handle rounding errors)
  while (tiers.length < 100) {
    // Add from highest percentage tier
    const maxIndex = percentages.indexOf(Math.max(...percentages));
    tiers.push(tierMap[maxIndex]);
  }
  
  return tiers;
}

/**
 * Select smart power tier based on active player levels
 * Analyzes player population and spawns appropriate Beer Bases
 * 
 * Enhanced with Predictive Spawning (FID-20251025-002):
 * - Can use projected future player levels (2 weeks ahead) when enabled
 * - Falls back to current player levels if predictive disabled or fails
 * - Graceful error handling ensures spawning never breaks
 * 
 * Cache refreshed every 15 minutes to avoid constant DB queries
 * 
 * @returns Power tier selected via weighted random from smart distribution
 */
async function selectSmartPowerTier(): Promise<PowerTier> {
  const now = new Date();
  const fifteenMinutes = 15 * 60 * 1000;
  
  // Get config for variety enforcement and predictive spawning
  const config = await getBeerBaseConfig();
  
  // Refresh cache if older than 15 minutes or doesn't exist
  if (
    !lastDistributionUpdate ||
    (!cachedDistribution && !config.usePredictiveSpawning) ||
    (!cachedPredictiveTiers && config.usePredictiveSpawning) ||
    (now.getTime() - lastDistributionUpdate.getTime()) > fifteenMinutes
  ) {
    console.log('[BeerBase] 🔄 Refreshing distribution for smart spawning...');
    
    // Use predictive distribution if enabled
    if (config.usePredictiveSpawning) {
      try {
        const weeksAhead = config.predictiveWeeksAhead ?? 2;
        const predictiveDistribution = await generatePredictiveDistribution(weeksAhead);
        cachedPredictiveTiers = convertPredictiveToTiers(predictiveDistribution);
        lastDistributionUpdate = now;
        
        console.log('[BeerBase] 🔮 Predictive distribution updated:', {
          weeksAhead,
          totalProjectedPlayers: predictiveDistribution.projectedPlayerLevels.length,
          tierDistribution: predictiveDistribution.tierDistribution.map(v => `${v.toFixed(1)}%`),
          spawnPoolSize: cachedPredictiveTiers.length,
          varietyEnabled: config.varietyEnabled ?? true,
          mode: 'PREDICTIVE'
        });
      } catch (error) {
        console.error('[BeerBase] ⚠️ Predictive distribution failed, falling back to current levels:', error);
        // Fallback to current distribution
        cachedDistribution = await analyzePlayerLevelDistribution();
        cachedSmartTiers = generateSmartPowerTierDistribution(cachedDistribution, config);
        lastDistributionUpdate = now;
      }
    } else {
      // Use current player level distribution
      cachedDistribution = await analyzePlayerLevelDistribution();
      cachedSmartTiers = generateSmartPowerTierDistribution(cachedDistribution, config);
      lastDistributionUpdate = now;
      
      console.log('[BeerBase] 📊 Current player distribution updated:', {
        totalActivePlayers: cachedDistribution.totalPlayers,
        distribution: {
          weak: `${cachedDistribution.weak}%`,
          mid: `${cachedDistribution.mid}%`,
          strong: `${cachedDistribution.strong}%`,
          elite: `${cachedDistribution.elite}%`,
          ultra: `${cachedDistribution.ultra}%`,
          legendary: `${cachedDistribution.legendary}%`
        },
        spawnPoolSize: cachedSmartTiers?.length || 0,
        varietyEnabled: config.varietyEnabled ?? true,
        mode: 'CURRENT'
      });
    }
  }
  
  // Select from appropriate cache (predictive or current)
  const tierPool = config.usePredictiveSpawning ? cachedPredictiveTiers : cachedSmartTiers;
  
  if (!tierPool || tierPool.length === 0) {
    // Fallback to random if no cache available
    console.warn('[BeerBase] ⚠️ No tier pool available, using random fallback');
    return selectRandomPowerTier();
  }
  
  // Select random tier from weighted distribution
  const randomIndex = Math.floor(Math.random() * tierPool.length);
  return tierPool[randomIndex];
}

/**
 * Select random power tier with weighted distribution (LEGACY)
 * Most Beer Bases are Mid-Strong, fewer Weak/Elite, rare Ultra/Legendary
 * 
 * NOTE: This is now ONLY used as a fallback if smart spawning fails
 */
function selectRandomPowerTier(): PowerTier {
  const roll = Math.random() * 100;
  
  if (roll < 10) return PowerTier.Weak;        // 10%
  if (roll < 40) return PowerTier.Mid;         // 30%
  if (roll < 70) return PowerTier.Strong;      // 30%
  if (roll < 90) return PowerTier.Elite;       // 20%
  if (roll < 98) return PowerTier.Ultra;       // 8%
  return PowerTier.Legendary;                  // 2%
}

/**
 * Spawn a single Beer Base
 */
export async function spawnBeerBase(): Promise<string> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  // Generate random specialization (weighted toward high-value types)
  const specializations = [
    BotSpecialization.Hoarder, // 30% - Most valuable
    BotSpecialization.Hoarder,
    BotSpecialization.Hoarder,
    BotSpecialization.Fortress, // 20% - High defense
    BotSpecialization.Fortress,
    BotSpecialization.Raider, // 20% - High offense
    BotSpecialization.Raider,
    BotSpecialization.Balanced, // 20% - Balanced
    BotSpecialization.Balanced,
    BotSpecialization.Ghost, // 10% - Rare, hard to find
  ];
  
  const specialization = specializations[Math.floor(Math.random() * specializations.length)];
  
  // Select smart power tier based on active player levels
  let powerTier: PowerTier;
  try {
    powerTier = await selectSmartPowerTier();
  } catch (error) {
    console.error('[BeerBase] ⚠️ Smart tier selection failed, using random fallback:', error);
    powerTier = selectRandomPowerTier();
  }
  
  // Generate base bot using createBotPlayer service
  // FID-20260909-030: createBotPlayer now claims a spawn-legal tile itself
  // (Wasteland ∧ unoccupied, per docs/README_NEW.md) under its generated
  // player-style name. The Beer Base name is assigned below, so the claim is
  // re-attributed to the final themed name — and on a collision retry the
  // re-attribution repeats, keeping tiles and names in sync.
  const bot = await createBotPlayer(null, specialization, true); // null zone = random, true = is Beer Base
  let position = { x: bot.base!.x, y: bot.base!.y };
  
  // Generate realistic unit composition
  const units = generateBeerBaseUnits(specialization, powerTier);
  
  // Calculate total strength and defense from units
  const totalStrength = units.reduce((sum, unit) => sum + (unit.strength * unit.quantity), 0);
  const totalDefense = units.reduce((sum, unit) => sum + (unit.defense * unit.quantity), 0);
  
  // Update bot with units and calculated power
  bot.units = units;
  bot.totalStrength = totalStrength;
  bot.totalDefense = totalDefense;
  
  // Themed place-style identity for Beer Bases (FID-20260906-007): replaces the
  // legacy b<tier><timestamp><rand> slug. The old tier-letter encoding is dropped —
  // grep-verified that no code ever parsed it; the scanner marks Beer Bases via
  // bot.isSpecialBase (BotScannerPanel 🍺), and tier stays visible via level/rank.
  // Collision safety: generateBotName's username column is varchar(20) PK, so on a
  // PK conflict the spawn retries with a numeric variant ("Crimson Bastion 2").
  const tempName = bot.username!; // base tile is currently claimed under this name
  bot.username = generateBeerBaseName();
  // FID-20260909-030: re-attribute the tile claim to the final themed name so
  // the map renders it and defeat/respawn release the right tile.
  await releaseBotBaseTile(position.x, position.y, tempName);
  const reclaimed = await claimBotBaseTile({ zone: null, ownerUsername: bot.username });
  position = { x: reclaimed.x, y: reclaimed.y };
  bot.base = position;
  bot.currentPosition = position;
  
  // Set appropriate level based on power tier
  switch (powerTier) {
    case PowerTier.Weak:
      bot.level = 1 + Math.floor(Math.random() * 5); // 1-5
      bot.rank = 1;
      break;
    case PowerTier.Mid:
      bot.level = 5 + Math.floor(Math.random() * 5); // 5-10
      bot.rank = 2;
      break;
    case PowerTier.Strong:
      bot.level = 10 + Math.floor(Math.random() * 10); // 10-20
      bot.rank = 3;
      break;
    case PowerTier.Elite:
      bot.level = 20 + Math.floor(Math.random() * 10); // 20-30
      bot.rank = 4;
      break;
    case PowerTier.Ultra:
      bot.level = 30 + Math.floor(Math.random() * 10); // 30-40
      bot.rank = 5;
      break;
    case PowerTier.Legendary:
      bot.level = 40 + Math.floor(Math.random() * 20); // 40-60
      bot.rank = 6;
      break;
  }
  
  // Boost resources based on power tier (Beer Bases are high-value targets)
  const resourceMultipliers: Record<PowerTier, number> = {
    [PowerTier.Weak]: 2,
    [PowerTier.Mid]: 3,
    [PowerTier.Strong]: 5,
    [PowerTier.Elite]: 8,
    [PowerTier.Ultra]: 12,
    [PowerTier.Legendary]: 20,
  };
  
  const multiplier = resourceMultipliers[powerTier] * config.resourceMultiplier;
  bot.resources = {
    metal: Math.floor((bot.resources?.metal || 1000) * multiplier),
    energy: Math.floor((bot.resources?.energy || 1000) * multiplier),
  };
  
  // CRITICAL FIX: Add top-level isSpecialBase field for easier querying
  // createBotPlayer() sets it in botConfig, but we need it at top level too
  bot.isSpecialBase = true;
  
  // Insert into database — on a username PK collision (rare: themed space is
  // large but finite), retry with a numeric variant ("Crimson Bastion 2").
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.collection<Player>('players').insertOne(bot);
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isUsernameConflict = message.includes('duplicate key');
      if (!isUsernameConflict || attempt === 4) {
        throw error;
      }
      // FID-20260909-030: keep the tile claim in sync with the renamed base.
      await releaseBotBaseTile(position.x, position.y, bot.username);
      bot.username = generateBeerBaseName(attempt + 1);
      const reclaimed = await claimBotBaseTile({ zone: null, ownerUsername: bot.username });
      position = { x: reclaimed.x, y: reclaimed.y };
      bot.base = position;
      bot.currentPosition = position;
    }
  }
  
  // Record spawn event for analytics
  await recordSpawnEvent(
    powerTierToNumber(powerTier),
    position,
    'auto' // Will be overridden by schedule or manual spawn functions
  );
  
  // console.log(`🍺 Spawned Beer Base: ${bot.username} (${powerTier}) | STR: ${totalStrength} | DEF: ${totalDefense} | Units: ${units.length}`); // Commented out to reduce console spam
  
  return bot.username;
}

/**
 * Spawn multiple Beer Bases to reach target count
 */
export async function spawnBeerBases(count: number): Promise<string[]> {
  const spawned: string[] = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const username = await spawnBeerBase();
      spawned.push(username);
    } catch (error) {
      console.error(`Failed to spawn Beer Base ${i + 1}:`, error);
    }
  }
  
  return spawned;
}

/**
 * Remove a defeated Beer Base from database
 * Called by combat service when Beer Base is defeated
 */
export async function removeBeerBase(username: string): Promise<void> {
  const db = await connectToDatabase();
  
  // Verify it's actually a Beer Base
  const bot = await db.collection<Player>('players').findOne({ 
    username, 
    isBot: true, 
    isSpecialBase: true 
  });
  
  if (!bot) {
    throw new Error('Bot is not a Beer Base or does not exist');
  }
  
  // Remove completely from database — and release the base tile claim so the
  // Wasteland returns to the spawn pool (FID-20260909-030: despawned bases
  // previously leaked claims forever, leaving ghost map entries).
  const baseX = Number(bot.base?.x ?? 0);
  const baseY = Number(bot.base?.y ?? 0);
  if (baseX > 0 && baseY > 0) {
    try {
      await releaseBotBaseTile(baseX, baseY, username);
    } catch (releaseError) {
      console.warn(`⚠️ Beer Base tile release failed for ${username}:`, releaseError);
    }
  }
  await db.collection('players').deleteOne({ username });
  
  console.log(`🍺 Beer Base removed: ${username}`);
}

/**
 * Weekly respawn - Replace all Beer Bases
 * Called by cron job on Sunday at 4 AM
 */
export async function weeklyBeerBaseRespawn(): Promise<{
  removed: number;
  spawned: number;
  beerBases: string[];
}> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  
  if (!config.enabled) {
    return { removed: 0, spawned: 0, beerBases: [] };
  }
  
  // Remove all existing Beer Bases — releasing each base's tile claim first
  // (FID-20260909-030 leak class: the bulk deleteMany skipped the tile
  // release that removeBeerBase performs, leaving ghost base_owner rows on
  // the map and permanently draining Wasteland tiles from the spawn pool).
  const existingBases = await db.collection<Player>('players')
    .find({ isBot: true, isSpecialBase: true }, { projection: { username: 1, base: 1 } })
    .toArray();
  for (const base of existingBases) {
    const baseX = Number(base.base?.x ?? 0);
    const baseY = Number(base.base?.y ?? 0);
    if (baseX > 0 && baseY > 0) {
      try {
        await releaseBotBaseTile(baseX, baseY, base.username);
      } catch (releaseError) {
        console.warn(`⚠️ Respawn tile release failed for ${base.username}:`, releaseError);
      }
    }
  }
  const deleteResult = await db.collection('players').deleteMany({ 
    isBot: true, 
    isSpecialBase: true 
  });
  
  const removed = deleteResult.deletedCount || 0;
  
  // Calculate target count
  const targetCount = await getTargetBeerBaseCount();
  
  // Spawn new Beer Bases
  const beerBases = await spawnBeerBases(targetCount);
  
  console.log(`🍺 Weekly Beer Base respawn: Removed ${removed}, Spawned ${beerBases.length}`);
  
  return {
    removed,
    spawned: beerBases.length,
    beerBases,
  };
}

/**
 * Get next scheduled Beer Base respawn time
 * Supports both legacy single schedule and dynamic multiple schedules
 * 
 * @param config - Beer Base configuration
 * @returns Next respawn date
 */
export function getNextRespawnTime(config: BeerBaseConfig = DEFAULT_CONFIG): Date {
  const now = new Date();
  
  // Use dynamic schedules if enabled
  if (config.schedulesEnabled && config.schedules && config.schedules.length > 0) {
    const enabledSchedules = config.schedules.filter(s => s.enabled);
    
    if (enabledSchedules.length === 0) {
      // Fallback to legacy if no enabled schedules
      return calculateLegacyNextRespawn(now, config);
    }
    
    // Find next occurrence for each schedule
    const nextTimes = enabledSchedules.map(schedule => {
      const { dayOfWeek, hour, timezone } = schedule;
      
      // Get current time in schedule's timezone
      const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentDay = tzNow.getDay();
      const currentHour = tzNow.getHours();
      
      // Calculate days until next occurrence
      let daysUntil = dayOfWeek - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && currentHour >= hour)) {
        daysUntil += 7; // Next week
      }
      
      // Create next occurrence date
      const next = new Date(tzNow);
      next.setDate(next.getDate() + daysUntil);
      next.setHours(hour, 0, 0, 0);
      
      return next;
    });
    
    // Return earliest next time
    return new Date(Math.min(...nextTimes.map(d => d.getTime())));
  }
  
  // Fallback to legacy single schedule
  return calculateLegacyNextRespawn(now, config);
}

/**
 * Calculate next respawn using legacy single schedule
 * @private
 */
function calculateLegacyNextRespawn(now: Date, config: BeerBaseConfig): Date {
  const nextRespawn = new Date();
  
  // Set to target day and hour
  nextRespawn.setHours(config.respawnHour, 0, 0, 0);
  
  // Calculate days until target day
  const currentDay = now.getDay();
  let daysUntilRespawn = config.respawnDay - currentDay;
  
  // If target day has passed this week, go to next week
  if (daysUntilRespawn < 0 || (daysUntilRespawn === 0 && now.getHours() >= config.respawnHour)) {
    daysUntilRespawn += 7;
  }
  
  nextRespawn.setDate(now.getDate() + daysUntilRespawn);
  
  return nextRespawn;
}

/**
 * Get Beer Base statistics
 */
export async function getBeerBaseStats(): Promise<{
  current: number;
  target: number;
  config: BeerBaseConfig;
  nextRespawn: Date;
  beerBases: Array<{
    username: string;
    specialization: BotSpecialization;
    tier: number;
    position: { x: number; y: number };
    resources: { metal: number; energy: number };
    totalStrength: number;
    totalDefense: number;
  }>;
}> {
  const db = await connectToDatabase();
  const config = await getBeerBaseConfig();
  const current = await getCurrentBeerBaseCount();
  const target = await getTargetBeerBaseCount();
  const nextRespawn = getNextRespawnTime(config);
  
  // Get all Beer Bases with key info
  const beerBases = await db.collection<Player>('players').find(
    { isBot: true, isSpecialBase: true },
    { 
      projection: { 
        username: 1, 
        specialization: 1, 
        tier: 1, 
        currentPosition: 1, 
        resources: 1,
        totalStrength: 1,
        totalDefense: 1,
      } 
    }
  ).toArray();
  
  return {
    current,
    target,
    config,
    nextRespawn,
    beerBases: beerBases.map((bb: Player) => ({
      username: bb.username,
      specialization: (bb.specialization ?? 'Balanced') as BotSpecialization,
      tier: (bb as Player & { tier?: number }).tier ?? 0,
      position: bb.currentPosition,
      resources: bb.resources,
      totalStrength: bb.totalStrength || 0,
      totalDefense: bb.totalDefense || 0,
    })),
  };
}

/**
 * Check if it's time for weekly respawn
 * Returns true if current time matches respawn schedule
 */
/**
 * Is `now` inside a scheduled respawn hour window?
 *
 * FID-20260909-035: honors BOTH the legacy single schedule (respawnDay +
 * respawnHour in server-local time) and the dynamic multi-schedule feature
 * (schedulesEnabled + per-schedule weekday/hour/timezone, matching
 * getNextRespawnTime's tz evaluation). The previous implementation checked
 * only the legacy fields, so dynamic schedules were dead behind the
 * scheduler no matter what the admin configured.
 */
export function isRespawnTime(config: BeerBaseConfig = DEFAULT_CONFIG, now: Date = new Date()): boolean {
  if (config.schedulesEnabled && config.schedules && config.schedules.length > 0) {
    return config.schedules.some((schedule) => {
      if (!schedule.enabled) return false;
      const tzNow = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone }));
      return tzNow.getDay() === schedule.dayOfWeek && tzNow.getHours() === schedule.hour;
    });
  }
  return now.getDay() === config.respawnDay && now.getHours() === config.respawnHour;
}

/**
 * Manual trigger for Beer Base respawn (admin only)
 */
export async function manualBeerBaseRespawn(): Promise<{
  success: boolean;
  removed: number;
  spawned: number;
  beerBases: string[];
}> {
  try {
    const result = await weeklyBeerBaseRespawn();
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('Manual Beer Base respawn failed:', error);
    return {
      success: false,
      removed: 0,
      spawned: 0,
      beerBases: [],
    };
  }
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
// Beer Bases are designed as high-value, temporary targets:
// 1. Spawn Rate: 5-10% of bot population (configurable via admin)
// 2. Resources: 3x multiplier (configurable via admin)
// 3. Lifecycle: Spawn weekly → Exist until defeated → Removed
// 4. Weekly Reset: Sunday 4 AM removes ALL and spawns new ones
// 5. Specialization: Weighted toward Hoarders (most valuable)
// 6. Smart Spawning: Analyzes active player levels (last 7 days)
// 7. Power Tier Distribution: Spread approach (40% same tier, 30% upper, 10% lower, 20% upper+2)
// 8. Integration: isSpecialBase flag used by scanner, combat
// 9. Admin: Full control via /api/admin/beer-bases/config
// 10. Caching: Player distribution cached 15min to reduce DB load
// 
// SMART SPAWNING ALGORITHM:
// - Analyzes active players (last 7 days) by level
// - Maps levels to power tiers:
//   * Levels 1-10  → Weak/Mid tiers
//   * Levels 11-20 → Mid/Strong tiers
//   * Levels 21-30 → Strong/Elite tiers
//   * Levels 31-40 → Elite/Ultra tiers
//   * Levels 41-50 → Ultra/Legendary tiers
//   * Levels 51+   → Legendary tier
// - Spread distribution ensures variety:
//   * 40% spawn at player's tier (fair targets)
//   * 30% spawn one tier up (challenge)
//   * 10% spawn one tier down (easier targets)
//   * 20% spawn two tiers up (rare challenges)
// - Example: 80% of players level 21-30 (Strong tier):
//   * 32% Strong Beer Bases (same tier)
//   * 24% Elite Beer Bases (one up)
//   * 8% Mid Beer Bases (one down)
//   * 16% Ultra Beer Bases (two up)
// 
// ADMIN CONFIGURATION:
// - Config stored in gameConfig collection (type: 'beerBase')
// - Admin can control via POST /api/admin/beer-bases/config:
//   * spawnRateMin/Max (default 5-10%)
//   * resourceMultiplier (default 3x, range 1-20x)
//   * respawnDay (0=Sunday through 6=Saturday)
//   * respawnHour (0-23, default 4 AM)
//   * enabled (master on/off switch)
// - Admin can manually trigger respawn via POST /api/admin/beer-bases/respawn
// 
// FUTURE ENHANCEMENTS:
// - Per-tier resource multipliers (Legendary = 10x, Weak = 1.5x)
// - Bounty system integration (bonus rewards for challenging targets)
// - Achievement for defeating Beer Bases (by tier)
// - Leaderboard for most Beer Bases defeated
// - Special loot tables (rare items, blueprints)
// - Notification when Beer Base spawns nearby (VIP feature)
// - Regional Beer Base distribution (avoid clustering)
// ============================================================

// ============================================================
// FID-20260909-034 test seam — exposes internal band/generation
// machinery to the regression sweep without widening the public API.
// ============================================================
export const __testing = {
  getTargetPowerForTier,
  POWER_BANDS,
};
