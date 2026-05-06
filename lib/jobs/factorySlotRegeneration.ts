/**
 * @file lib/jobs/factorySlotRegeneration.ts
 * @created 2024-11-04
 * @overview Factory Slot Regeneration Background Job - Passive MMO Slot Recovery
 * 
 * OVERVIEW:
 * Manages automated factory slot regeneration via scheduled background job.
 * Runs every 60 seconds to regenerate factory slots based on time elapsed
 * and factory level, enabling passive gameplay for MMO environment.
 * 
 * Features:
 * - 60-second interval slot regeneration (time-based calculation)
 * - Level-based regeneration rates (1 + level × 0.1 slots/hour)
 * - Bulk update operations for database efficiency
 * - Error isolation (doesn't crash server on failure)
 * - Execution metrics and logging
 * - Graceful handling of edge cases (negative slots, over-capacity)
 * 
 * Regeneration Formula:
 * - Regen Rate: 416.67 + ((level - 1) × 41.67) slots per hour
 * - Level 1: 416.67 slots/hour = 5,000 slots in ~12 hours
 * - Level 5: 583.33 slots/hour = 7,000 slots in ~12 hours
 * - Level 10: 791.67 slots/hour = 9,500 slots in ~12 hours
 * 
 * Integration:
 * - Called by server.ts on startup
 * - Uses factoryUpgradeService for regeneration rate calculations
 * - Uses Supabase for factory state persistence
 * 
 * Related Files:
 * - /lib/factoryUpgradeService.ts - Regeneration rate formulas
 * - /lib/jobs/flagBotManager.ts - Similar job pattern
 * - /server.ts - Job initialization
 * 
 * @implements Background Job Pattern
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getRegenRate } from '@/lib/factoryUpgradeService';

/**
 * Job execution statistics
 */
interface FactorySlotRegenJobStats {
  lastRun: Date | null;
  nextRun: Date | null;
  executionCount: number;
  errorCount: number;
  factoriesRegenerated: number;
  totalSlotsRegenerated: number;
  averageExecutionTime: number;
}

/**
 * Global job state
 */
let jobInterval: NodeJS.Timeout | null = null;
let jobStats: FactorySlotRegenJobStats = {
  lastRun: null,
  nextRun: null,
  executionCount: 0,
  errorCount: 0,
  factoriesRegenerated: 0,
  totalSlotsRegenerated: 0,
  averageExecutionTime: 0,
};

/**
 * Job configuration
 */
const FACTORY_SLOT_REGEN_JOB_CONFIG = {
  name: 'Factory Slot Regeneration',
  interval: 60 * 1000, // 60 seconds in milliseconds
  // interval: 10 * 1000, // 10 seconds for testing - UNCOMMENT FOR TESTING
};

// ============================================================
// MAIN JOB HANDLER
// ============================================================

/**
 * Factory Slot Regeneration Job Handler
 * Executes every 60 seconds to regenerate factory slots
 * 
 * Process:
 * 1. Query all factories where used_slots < slots (below max capacity)
 * 2. For each factory, calculate time elapsed since last_slot_regen
 * 3. Calculate slots to regenerate based on time × regen rate
 * 4. Decrement used_slots (capped at 0 minimum)
 * 5. Update last_slot_regen timestamp
 * 6. Execute all updates in parallel
 * 
 * @returns Number of factories regenerated
 * 
 * @example
 * ```typescript
 * const factoriesRegenerated = await factorySlotRegenerationJob();
 * console.log(`Regenerated slots for ${factoriesRegenerated} factories`);
 * ```
 */
async function factorySlotRegenerationJob(): Promise<number> {
  const startTime = Date.now();
  let factoriesProcessed = 0;
  let totalSlotsRegenerated = 0;

  try {
    console.log(`[Factory Slot Regen] 🔄 Starting regeneration cycle...`);

    const supabase = createServiceClient();

    // Query all factories
    const { data: allFactories, error: fetchError } = await supabase
      .from('factories')
      .select('*');

    if (fetchError) {
      console.error('[Factory Slot Regen] ❌ Failed to fetch factories:', fetchError);
      return 0;
    }

    if (!allFactories || allFactories.length === 0) {
      console.log('[Factory Slot Regen] ℹ️  No factories found');
      return 0;
    }

    // Filter factories with occupied slots needing regeneration
    const factories = allFactories.filter(f => f.used_slots > 0);

    if (factories.length === 0) {
      console.log('[Factory Slot Regen] ℹ️  No factories have occupied slots — nothing to regenerate');
      return 0;
    }

    console.log(
      `[Factory Slot Regen] 📊 Found ${factories.length} factories with occupied slots`
    );

    const now = new Date();
    const updatePromises: any[] = [];

    for (const factory of factories) {
      try {
        // Calculate time elapsed since last regeneration
        const lastRegen = factory.last_slot_regen
          ? new Date(factory.last_slot_regen)
          : new Date(0); // Default to epoch if never regenerated
        const timeSinceLastRegen = now.getTime() - lastRegen.getTime();
        const hoursElapsed = timeSinceLastRegen / (1000 * 60 * 60);

        // Get regeneration rate for factory level
        const regenRate = getRegenRate(factory.level || 1);

        // Calculate slots to regenerate (floor to get whole slots)
        const slotsToRegen = Math.floor(hoursElapsed * regenRate);

        if (slotsToRegen > 0) {
          // Calculate new used_slots (ensure it doesn't go below 0)
          const currentUsedSlots = factory.used_slots || 0;
          const newUsedSlots = Math.max(0, currentUsedSlots - slotsToRegen);

          // Only update if there's an actual change
          if (newUsedSlots !== currentUsedSlots) {
            updatePromises.push(
              supabase
                .from('factories')
                .update({
                  used_slots: newUsedSlots,
                  last_slot_regen: now.toISOString(),
                })
                .eq('id', factory.id)
            );

            factoriesProcessed++;
            totalSlotsRegenerated += currentUsedSlots - newUsedSlots;
          }
        }
      } catch (factoryError) {
        console.error(
          `[Factory Slot Regen] ⚠️  Error processing factory at (${factory.x}, ${factory.y}):`,
          factoryError
        );
        // Continue processing other factories
      }
    }

    // Execute all updates in parallel
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(
        `[Factory Slot Regen] ✅ Regenerated ${totalSlotsRegenerated} slots across ${factoriesProcessed} factories`
      );
    } else {
      console.log(
        '[Factory Slot Regen] ℹ️  No factories ready for regeneration this cycle'
      );
    }

    // Update statistics
    const executionTime = Date.now() - startTime;
    jobStats.lastRun = new Date();
    jobStats.executionCount++;
    jobStats.factoriesRegenerated += factoriesProcessed;
    jobStats.totalSlotsRegenerated += totalSlotsRegenerated;
    jobStats.averageExecutionTime =
      (jobStats.averageExecutionTime * (jobStats.executionCount - 1) + executionTime) /
      jobStats.executionCount;

    console.log(
      `[Factory Slot Regen] ✅ Cycle complete in ${executionTime}ms (${factoriesProcessed} factories, ${totalSlotsRegenerated} slots)`
    );

    return factoriesProcessed;
  } catch (error) {
    jobStats.errorCount++;
    console.error('[Factory Slot Regen] ❌ Error during regeneration:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't throw - let job continue on next interval
    return factoriesProcessed;
  }
}

// ============================================================
// JOB LIFECYCLE MANAGEMENT
// ============================================================

/**
 * Start the Factory Slot Regeneration job
 * Initializes 60-second interval job for passive slot recovery
 * 
 * @returns Success status with message
 * 
 * @example
 * ```typescript
 * const result = await startFactorySlotRegenJob();
 * if (result.success) {
 *   console.log('Factory slot regen job started:', result.message);
 * }
 * ```
 */
export async function startFactorySlotRegenJob(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Prevent duplicate job instances
    if (jobInterval) {
      return {
        success: false,
        message: 'Factory slot regeneration job already running',
      };
    }

    console.log('[Factory Slot Regen] 🚀 Starting background job...');

    // Start interval job
    jobInterval = setInterval(async () => {
      await factorySlotRegenerationJob();
    }, FACTORY_SLOT_REGEN_JOB_CONFIG.interval);

    // Calculate next run time
    jobStats.nextRun = new Date(Date.now() + FACTORY_SLOT_REGEN_JOB_CONFIG.interval);

    console.log(
      `[Factory Slot Regen] ✅ Started with ${FACTORY_SLOT_REGEN_JOB_CONFIG.interval / 1000}s interval`
    );

    return {
      success: true,
      message: `Factory slot regeneration job started (interval: ${FACTORY_SLOT_REGEN_JOB_CONFIG.interval / 1000}s)`,
    };
  } catch (error) {
    console.error('[Factory Slot Regen] ❌ Failed to start:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stop the Factory Slot Regeneration job
 * Clears interval and resets state
 * 
 * @returns Success status with message
 * 
 * @example
 * ```typescript
 * const result = stopFactorySlotRegenJob();
 * console.log('Factory slot regen job stopped:', result.message);
 * ```
 */
export function stopFactorySlotRegenJob(): {
  success: boolean;
  message: string;
} {
  try {
    if (!jobInterval) {
      return {
        success: false,
        message: 'Factory slot regeneration job not running',
      };
    }

    clearInterval(jobInterval);
    jobInterval = null;
    jobStats.nextRun = null;

    console.log('[Factory Slot Regen] 🛑 Stopped');

    return {
      success: true,
      message: 'Factory slot regeneration job stopped successfully',
    };
  } catch (error) {
    console.error('[Factory Slot Regen] ❌ Error stopping job:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current job statistics
 * Used for health checks and monitoring
 * 
 * @returns Current job execution statistics
 * 
 * @example
 * ```typescript
 * const stats = getFactorySlotRegenJobStats();
 * console.log(`Total regenerated: ${stats.totalSlotsRegenerated} slots`);
 * ```
 */
export function getFactorySlotRegenJobStats(): FactorySlotRegenJobStats {
  return { ...jobStats };
}

/**
 * Get job status information
 * Used for admin dashboards and debugging
 * 
 * @returns Job status and configuration
 */
export function getFactorySlotRegenJobInfo(): {
  name: string;
  interval: number;
  isRunning: boolean;
  stats: FactorySlotRegenJobStats;
} {
  return {
    name: FACTORY_SLOT_REGEN_JOB_CONFIG.name,
    interval: FACTORY_SLOT_REGEN_JOB_CONFIG.interval,
    isRunning: jobInterval !== null,
    stats: getFactorySlotRegenJobStats(),
  };
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// 
// Job Pattern:
// - Follows Flag Bot job pattern (lib/jobs/flagBotManager.ts)
// - Separate start/stop functions for lifecycle management
// - Error isolation (one failure doesn't crash server)
// - Execution metrics for monitoring
// 
// Timing Strategy:
// - 60-second interval balances responsiveness and performance
// - Time-based calculation (not tick-based) for accurate regeneration
// - Handles server downtime gracefully (calculates full elapsed time)
// - Updates last_slot_regen only when slots actually regenerate
// 
// Database Optimization:
// - Fetches all factories, filters in JS (used_slots < slots)
// - Parallel updates via Promise.all
// - Single fetch + parallel writes per cycle
// - Skips factories with no regeneration needed
// 
// Edge Case Handling:
// - Factories without last_slot_regen default to epoch (regenerate immediately)
// - used_slots capped at 0 minimum (no negative slots)
// - Handles missing or invalid level (defaults to 1)
// - Continues processing if individual factory fails
// 
// Error Handling:
// - Try/catch around entire job execution
// - Try/catch around individual factory processing
// - Errors logged but don't stop job
// - Error count tracked in statistics
// - Graceful degradation (continues on next interval)
// 
// Testing:
// - Change interval to 10 seconds for testing (line 81)
// - Monitor console logs for execution confirmations
// - Check Supabase factories table for used_slots changes
// - Verify Max button in UI increases as slots regenerate
// 
// Production Considerations:
// - Job runs continuously in server process
// - Graceful shutdown via stopFactorySlotRegenJob()
// - Statistics available for health monitoring
// - Can be integrated with external monitoring tools
// - Parallel updates minimize database round trips
// 
// Related Lessons:
// - Complete file reading before implementation (ECHO v7.0)
// - Background jobs for MMO passive gameplay
// - Time-based calculations for accurate game mechanics
// 
// ============================================================
// END OF FILE
// ============================================================
