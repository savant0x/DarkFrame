/**
 * autoFarmPersistence.ts
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * LocalStorage persistence layer for auto-farm statistics.
 * Manages both per-session stats (reset on stop) and all-time cumulative
 * stats (persisted forever across all sessions).
 * 
 * Features:
 * - Save/load all-time statistics
 * - Merge session stats into all-time totals
 * - Reset session stats
 * - Error handling for localStorage failures
 * - Type-safe operations
 */

import {
  AutoFarmSessionStats,
  AutoFarmAllTimeStats,
  DEFAULT_ALL_TIME_STATS
} from '@/types/autoFarm.types';

const ALL_TIME_STATS_KEY = 'darkframe_autofarm_alltime_stats';

/**
 * Load all-time statistics from localStorage
 */
export function loadAllTimeStats(): AutoFarmAllTimeStats {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_ALL_TIME_STATS };
  }

  try {
    const saved = localStorage.getItem(ALL_TIME_STATS_KEY);
    if (saved) {
      const stats = JSON.parse(saved) as AutoFarmAllTimeStats;
      return stats;
    }
  } catch (error) {
    console.error('Failed to load all-time auto-farm stats:', error);
  }

  return { ...DEFAULT_ALL_TIME_STATS };
}

/**
 * Save all-time statistics to localStorage
 */
export function saveAllTimeStats(stats: AutoFarmAllTimeStats): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const updated = {
      ...stats,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(ALL_TIME_STATS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save all-time auto-farm stats:', error);
  }
}

/**
 * Merge session stats into all-time totals
 * Call this when a session completes (on Stop)
 */
export function mergeSessionIntoAllTime(sessionStats: AutoFarmSessionStats): AutoFarmAllTimeStats {
  const allTime = loadAllTimeStats();

  const updated: AutoFarmAllTimeStats = {
    totalTimeElapsed: allTime.totalTimeElapsed + sessionStats.timeElapsed,
    totalMetalCollected: allTime.totalMetalCollected + sessionStats.metalCollected,
    totalEnergyCollected: allTime.totalEnergyCollected + sessionStats.energyCollected,
    totalTilesVisited: allTime.totalTilesVisited + sessionStats.tilesVisited,
    totalCaveItemsFound: allTime.totalCaveItemsFound + sessionStats.caveItemsFound,
    totalForestItemsFound: allTime.totalForestItemsFound + sessionStats.forestItemsFound,
    totalAttacksLaunched: allTime.totalAttacksLaunched + sessionStats.attacksLaunched,
    totalAttacksWon: allTime.totalAttacksWon + sessionStats.attacksWon,
    totalAttacksLost: allTime.totalAttacksLost + sessionStats.attacksLost,
    totalSessionsCompleted: allTime.totalSessionsCompleted + 1,
    lastUpdated: Date.now()
  };

  saveAllTimeStats(updated);
  return updated;
}

/**
 * Reset all-time statistics (for testing or user request)
 */
export function resetAllTimeStats(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(ALL_TIME_STATS_KEY);
  } catch (error) {
    console.error('Failed to reset all-time auto-farm stats:', error);
  }
}

/**
 * Get formatted statistics summary
 */
export function getStatsSummary(allTime: AutoFarmAllTimeStats): string {
  const hours = Math.floor(allTime.totalTimeElapsed / (1000 * 60 * 60));
  const sessions = allTime.totalSessionsCompleted;
  const totalResources = allTime.totalMetalCollected + allTime.totalEnergyCollected;
  
  return `${sessions} sessions | ${hours}h | ${totalResources.toLocaleString()} resources`;
}

/**
 * Calculate efficiency metrics
 */
export interface EfficiencyMetrics {
  resourcesPerHour: number;
  tilesPerHour: number;
  combatWinRate: number;
  averageSessionTime: number; // minutes
}

export function calculateEfficiency(allTime: AutoFarmAllTimeStats): EfficiencyMetrics {
  const hours = allTime.totalTimeElapsed / (1000 * 60 * 60);
  const totalResources = allTime.totalMetalCollected + allTime.totalEnergyCollected;
  
  return {
    resourcesPerHour: hours > 0 ? totalResources / hours : 0,
    tilesPerHour: hours > 0 ? allTime.totalTilesVisited / hours : 0,
    combatWinRate: allTime.totalAttacksLaunched > 0 
      ? (allTime.totalAttacksWon / allTime.totalAttacksLaunched) * 100 
      : 0,
    averageSessionTime: allTime.totalSessionsCompleted > 0
      ? (allTime.totalTimeElapsed / allTime.totalSessionsCompleted) / (1000 * 60)
      : 0
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. STORAGE STRATEGY:
 *    - All-time stats: Persistent in localStorage
 *    - Session stats: In-memory only (managed by AutoFarmEngine)
 *    - Merged on session completion
 * 
 * 2. ERROR HANDLING:
 *    - Try/catch for all localStorage operations
 *    - Graceful fallback to defaults on failure
 *    - Console logging for debugging
 * 
 * 3. DATA INTEGRITY:
 *    - Type-safe operations with TypeScript
 *    - Timestamp tracking (lastUpdated)
 *    - Session counter for analytics
 * 
 * 4. MERGE LOGIC:
 *    - Adds session totals to all-time totals
 *    - Increments session counter
 *    - Updates timestamp
 *    - Saves immediately
 * 
 * 5. UTILITY FUNCTIONS:
 *    - Summary string for quick display
 *    - Efficiency metrics calculation
 *    - Reset capability for testing
 * 
 * FUTURE ENHANCEMENTS:
 * - Export stats to JSON/CSV
 * - Import stats from file
 * - Cloud sync (requires backend)
 * - Historical session tracking
 * - Comparative analytics
 */
