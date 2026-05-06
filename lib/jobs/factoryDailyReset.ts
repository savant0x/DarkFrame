/**
 * @file lib/jobs/factoryDailyReset.ts
 * @created 2026-05-05
 * @overview Daily factory reset — resets used_slots to 0 and last_resource_generation to now
 *
 * DESIGN: Factories accumulate used_slots as units are built. Slots regenerate over time
 * via factorySlotRegeneration job. Once per day (server reset), all factories get a full
 * slot refresh — used_slots reset to 0, last_resource_generation bumped.
 *
 * This runs as a background job every 24 hours. On server startup, it schedules the
 * next run at the configured DAILY_RESET_HOUR (default 3 AM server time).
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getRegenRate, getMaxSlots } from '@/lib/factoryUpgradeService';

const DAILY_RESET_HOUR = 3; // 3 AM server time
const MS_PER_HOUR = 60 * 60 * 1000;

interface DailyResetStats {
  lastRun: Date | null;
  nextRun: Date | null;
  executionCount: number;
  totalFactoriesReset: number;
  totalSlotsRestored: number;
  errorCount: number;
  averageExecutionTime: number;
}

const jobStats: DailyResetStats = {
  lastRun: null,
  nextRun: null,
  executionCount: 0,
  totalFactoriesReset: 0,
  totalSlotsRestored: 0,
  errorCount: 0,
  averageExecutionTime: 0,
};

/**
 * Calculate next reset time (DAILY_RESET_HOUR UTC)
 */
function getNextResetTime(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(DAILY_RESET_HOUR, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

/**
 * Execute the daily factory reset
 * - Resets used_slots to 0 for all owned factories
 * - Bumps last_resource_generation to now
 * - Logs statistics
 */
export async function executeFactoryDailyReset(): Promise<number> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // Get all owned factories with used_slots > 0
    const { data: factories, error: fetchError } = await supabase
      .from('factories')
      .select('id, x, y, owner, level, slots, used_slots, last_resource_generation')
      .not('owner', 'is', null)
      .gt('used_slots', 0);

    if (fetchError) throw fetchError;

    if (!factories || factories.length === 0) {
      console.log('[Factory Daily Reset] ℹ️ No factories need reset');
      return 0;
    }

    const now = new Date().toISOString();
    let factoriesReset = 0;
    let slotsRestored = 0;

    // Batch reset in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < factories.length; i += chunkSize) {
      const chunk = factories.slice(i, i + chunkSize);
      const ids = chunk.map(f => f.id);

      const { error: updateError } = await supabase
        .from('factories')
        .update({
          used_slots: 0,
          last_resource_generation: now,
        })
        .in('id', ids);

      if (updateError) throw updateError;

      for (const f of chunk) {
        slotsRestored += f.used_slots || 0;
      }
      factoriesReset += chunk.length;
    }

    const executionTime = Date.now() - startTime;
    jobStats.lastRun = new Date();
    jobStats.nextRun = getNextResetTime();
    jobStats.executionCount++;
    jobStats.totalFactoriesReset += factoriesReset;
    jobStats.totalSlotsRestored += slotsRestored;
    jobStats.averageExecutionTime =
      (jobStats.averageExecutionTime * (jobStats.executionCount - 1) + executionTime) /
      jobStats.executionCount;

    console.log(
      `[Factory Daily Reset] ✅ Reset ${factoriesReset} factories, restored ${slotsRestored.toLocaleString()} slots in ${executionTime}ms`
    );

    return factoriesReset;
  } catch (error) {
    jobStats.errorCount++;
    console.error('[Factory Daily Reset] ❌ Error:', error);
    throw error;
  }
}

/**
 * Schedule the next daily reset
 */
export function startFactoryDailyReset(): NodeJS.Timeout {
  const nextRun = getNextResetTime();
  const msUntilNextRun = nextRun.getTime() - Date.now();

  console.log(
    `[Factory Daily Reset] ⏰ Scheduled next run at ${nextRun.toISOString()} (in ${Math.round(msUntilNextRun / MS_PER_HOUR)}h)`
  );

  // Execute immediately if we missed a run (server was down past reset time)
  const lastRun = jobStats.lastRun;
  const missedRun = lastRun === null || (Date.now() - lastRun.getTime()) > 25 * MS_PER_HOUR;
  if (missedRun) {
    console.log('[Factory Daily Reset] ⚡ Missed run detected, executing immediately');
    executeFactoryDailyReset().catch(err =>
      console.error('[Factory Daily Reset] Immediate run failed:', err)
    );
  }

  // Schedule recurring 24-hour interval
  return setInterval(() => {
    executeFactoryDailyReset().catch(err =>
      console.error('[Factory Daily Reset] Scheduled run failed:', err)
    );
    jobStats.nextRun = getNextResetTime();
  }, 24 * MS_PER_HOUR);
}

export { jobStats as dailyResetStats, getNextResetTime };
