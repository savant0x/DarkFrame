/**
 * @file lib/wmd/jobs/beerBaseRespawner.ts
 * @created 2025-10-23
 * @overview Beer Base Continuous Population Manager
 * 
 * OVERVIEW:
 * Background job that maintains a constant population of Beer Bases across the map.
 * Automatically spawns new Beer Bases when population drops below target levels.
 * 
 * FEATURES:
 * - Continuous population management (not just weekly)
 * - Configurable target population (5-10% of bots)
 * - Automatic spawn when Beer Bases are defeated
 * - Weekly full respawn for freshness (Sunday 4 AM)
 * - Prevents overpopulation
 * 
 * ARCHITECTURE:
 * - Checks every 60 seconds
 * - Spawns deficit up to target
 * - Weekly reset for variety
 * - Idempotent and error-resistant
 */

import { weeklyBeerBaseRespawn, getBeerBaseConfig, getCurrentBeerBaseCount, getTargetBeerBaseCount, spawnBeerBases } from '@/lib/beerBaseService';

/**
 * Last respawn timestamp to track weekly resets
 */
let lastWeeklyRespawn: Date | null = null;

/**
 * Check if current time matches weekly respawn schedule
 * 
 * @returns True if it's time for weekly full respawn
 */
async function isWeeklyRespawnTime(): Promise<boolean> {
  const config = await getBeerBaseConfig();
  
  if (!config.enabled) {
    return false;
  }
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  // Check if current day/hour matches config
  const isScheduledTime = 
    currentDay === config.respawnDay && 
    currentHour === config.respawnHour;
  
  if (!isScheduledTime) {
    return false;
  }
  
  // Prevent duplicate respawns within same hour
  if (lastWeeklyRespawn) {
    const hoursSinceLastRespawn = 
      (now.getTime() - lastWeeklyRespawn.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastRespawn < 1) {
      return false; // Already respawned this hour
    }
  }
  
  return true;
}

/**
 * Beer Base Population Manager
 * 
 * Maintains constant Beer Base population by:
 * 1. Checking current vs target population
 * 2. Spawning deficit to reach target
 * 3. Performing weekly full respawn for variety
 * 
 * Runs every 60 seconds to ensure Beer Bases are always available.
 * 
 * @returns Number of Beer Bases spawned this cycle
 * 
 * @example
 * ```typescript
 * // Called by scheduler every 60 seconds
 * const spawned = await beerBaseRespawner();
 * if (spawned > 0) {
 *   console.log(`Spawned ${spawned} Beer Bases to maintain population`);
 * }
 * ```
 */
export async function beerBaseRespawner(): Promise<number> {
  try {
    // Check if it's time for weekly full respawn
    const shouldWeeklyRespawn = await isWeeklyRespawnTime();
    
    if (shouldWeeklyRespawn) {
      console.log('[BeerBase] 🍺 Weekly respawn time! Clearing all and respawning fresh...');
      
      const result = await weeklyBeerBaseRespawn();
      lastWeeklyRespawn = new Date();
      
      console.log('[BeerBase] ✅ Weekly respawn complete!', {
        removed: result.removed,
        spawned: result.spawned,
        nextWeeklyRespawn: await getNextWeeklyRespawnTime(),
      });
      
      return result.spawned;
    }
    
    // Otherwise, maintain population by spawning deficit
    const config = await getBeerBaseConfig();
    
    if (!config.enabled) {
      return 0; // Beer Bases disabled
    }
    
    const currentCount = await getCurrentBeerBaseCount();
    const targetCount = await getTargetBeerBaseCount();
    const deficit = targetCount - currentCount;
    
    if (deficit <= 0) {
      return 0; // Population at or above target
    }
    
    // SAFETY CAP #1: Never spawn more than 100 Beer Bases in a single cycle
    // This prevents catastrophic spawn events if calculation goes wrong
    const safeDeficit = Math.min(deficit, 100);
    
    // SAFETY CAP #2: Double-check we're not over absolute max (1000 total)
    const absoluteMax = 1000;
    if (currentCount >= absoluteMax) {
      console.warn('[BeerBase] ⚠️ Already at absolute maximum (1000), skipping spawn');
      return 0;
    }
    
    // SAFETY CAP #3: Don't exceed absolute max with this spawn
    const allowedToSpawn = Math.min(safeDeficit, absoluteMax - currentCount);
    
    if (allowedToSpawn <= 0) {
      console.warn('[BeerBase] ⚠️ Spawn would exceed safety limits, skipping', {
        current: currentCount,
        target: targetCount,
        deficit,
        absoluteMax,
      });
      return 0;
    }
    
    console.log('[BeerBase] 🍺 Population deficit detected, spawning Beer Bases...', {
      current: currentCount,
      target: targetCount,
      deficit,
      safeDeficit,
      allowedToSpawn,
    });
    
    // Spawn Beer Bases to reach target (with safety caps applied)
    const spawned = await spawnBeerBases(allowedToSpawn);
    
    console.log('[BeerBase] ✅ Population maintenance complete!', {
      spawned: spawned.length,
      newTotal: currentCount + spawned.length,
      target: targetCount,
    });
    
    return spawned.length;
    
  } catch (error) {
    console.error('[BeerBase] ❌ Population management failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return 0;
  }
}

/**
 * Get next weekly respawn time
 * 
 * @returns Next weekly respawn date/time
 */
async function getNextWeeklyRespawnTime(): Promise<Date> {
  try {
    const config = await getBeerBaseConfig();
    const now = new Date();
    const next = new Date();
    next.setHours(config.respawnHour, 0, 0, 0);
    
    const currentDay = now.getDay();
    let daysUntil = config.respawnDay - currentDay;
    
    if (daysUntil < 0 || (daysUntil === 0 && now.getHours() >= config.respawnHour)) {
      daysUntil += 7;
    }
    
    next.setDate(now.getDate() + daysUntil);
    return next;
  } catch {
    // Fallback: next Sunday at 4 AM
    const now = new Date();
    const next = new Date();
    next.setHours(4, 0, 0, 0);
    let daysUntil = 0 - now.getDay();
    if (daysUntil < 0 || (daysUntil === 0 && now.getHours() >= 4)) {
      daysUntil += 7;
    }
    next.setDate(now.getDate() + daysUntil);
    return next;
  }
}

/**
 * Beer Base Respawner Job Info
 * Metadata for scheduler integration
 */
export const beerBaseRespawnerJobInfo = {
  name: 'Beer Base Population Manager',
  description: 'Maintains constant Beer Base population + weekly full respawn',
  interval: 60000, // Check every 60 seconds
  criticalityLevel: 'medium' as const,
} as const;

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Lightweight check runs every 60s
// - Heavy respawn only runs weekly
// - Idempotent (safe to run multiple times)
// - lastRespawnTime prevents duplicates
// - Configurable via admin panel
// - Error recovery (doesn't crash scheduler)
// - Returns spawn count for metrics
// ============================================================
