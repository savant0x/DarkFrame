/**
 * @file lib/jobs/botGrowthManager.ts
 * @created 2026-09-10 (FID-20260909-035 cron audit)
 * @overview Hourly bot ecosystem job — wires botGrowthEngine.runGrowthCycle()
 * into the server.ts scheduler family.
 *
 * AUDIT FINDING (FID-20260909-035): runGrowthCycle (resource regeneration,
 * growth patterns, movement, unit building, nest attraction) had NO scheduled
 * caller anywhere — the bot ecosystem could only decay. This manager gives it
 * the same interval treatment as beerBaseManager/flagBotManager.
 *
 * Hourly cadence matches the documented Full Permanence model
 * (lib/botService.ts header: "regenerate resources hourly").
 *
 * Registration follows the beerBaseManager pattern (see server.ts).
 */

import { runGrowthCycle } from '../botGrowthEngine';

interface BotGrowthJobStats {
  lastRun: Date | null;
  lastCycle: Date | null;
  executionCount: number;
  cycleCount: number;
  errorCount: number;
  lastSummary: {
    processed: number;
    regenerated: number;
    moved: number;
    unitsBuilt: number;
  } | null;
}

/**
 * FID-20260909-036 (cross-runtime fix): see beerBaseManager — server.ts (tsx)
 * and Next's bundled API routes keep separate module instances, so job state
 * lives on globalThis where both runtimes see the same counters.
 */
interface BotGrowthJobState {
  stats: BotGrowthJobStats;
  jobInterval: ReturnType<typeof setInterval> | null;
}

const botGrowthJobGlobals = globalThis as unknown as { __darkframeBotGrowthJob?: BotGrowthJobState };
const state: BotGrowthJobState = (botGrowthJobGlobals.__darkframeBotGrowthJob ??= {
  stats: {
    lastRun: null,
    lastCycle: null,
    executionCount: 0,
    cycleCount: 0,
    errorCount: 0,
    lastSummary: null,
  },
  jobInterval: null,
});
const stats = state.stats;

/** Hourly — matches the bots' documented hourly resource-regeneration model. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function botGrowthManagerJob(): Promise<void> {
  stats.lastRun = new Date();
  stats.executionCount++;
  try {
    const result = await runGrowthCycle();
    stats.cycleCount++;
    stats.lastCycle = new Date();
    stats.lastSummary = {
      processed: result.processed,
      regenerated: result.regenerated,
      moved: result.moved,
      unitsBuilt: result.unitsBuilt,
    };
    if (result.errors.length > 0) {
      console.warn(`[Bot Growth Job] ⚠️ ${result.errors.length} per-bot error(s) this cycle`);
    }
    console.log(
      `[Bot Growth Job] ✅ Cycle complete: processed ${result.processed}, regenerated ${result.regenerated}, moved ${result.moved}, unitsBuilt ${result.unitsBuilt}`
    );
  } catch (err) {
    stats.errorCount++;
    console.error('[Bot Growth Job] ❌ Error during growth cycle:', err);
  }
}

export function startBotGrowthJob(): { success: boolean; message: string } {
  if (state.jobInterval) {
    return { success: true, message: 'Bot growth job already running' };
  }
  state.jobInterval = setInterval(() => {
    void botGrowthManagerJob();
  }, CHECK_INTERVAL_MS);
  console.log(`[Bot Growth Job] ✅ Started (interval: ${CHECK_INTERVAL_MS / 60000}min)`);
  return { success: true, message: 'Bot growth scheduler started (hourly)' };
}

export function stopBotGrowthJob(): void {
  if (state.jobInterval) {
    clearInterval(state.jobInterval);
    state.jobInterval = null;
    console.log('[Bot Growth Job] 🛑 Stopped');
  }
}

export function getBotGrowthJobStats(): BotGrowthJobStats {
  return { ...stats };
}

/**
 * Job status for admin dashboards (FID-20260909-035 jobs-status panel).
 * Mirrors getFlagBotJobInfo's shape.
 */
export function getBotGrowthJobInfo(): {
  name: string;
  interval: number;
  isRunning: boolean;
  stats: BotGrowthJobStats;
} {
  return {
    name: 'Bot Growth Cycle (hourly)',
    interval: CHECK_INTERVAL_MS,
    isRunning: state.jobInterval !== null,
    stats: getBotGrowthJobStats(),
  };
}

/**
 * Fire one growth cycle immediately (FID-20260909-036 admin controls)
 * without touching the scheduled interval. The single-flight guard inside
 * botGrowthManagerJob prevents overlap with a scheduled fire.
 */
export async function runBotGrowthJobNow(): Promise<void> {
  await botGrowthManagerJob();
}
