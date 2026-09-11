/**
 * @file lib/jobs/factorySlotRegeneration.ts
 * @created 2025-11-04
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview Background job that regenerates factory production slots over time
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema/factories';

const FACTORY_SLOT_REGEN_JOB_CONFIG = {
  interval: 3600000,
  slotsPerHour: 10,
} as const;

interface JobStats {
  lastRun: Date | null;
  nextRun: Date | null;
  executionCount: number;
  factoriesRegenerated: number;
  totalSlotsRegenerated: number;
  averageExecutionTime: number;
  isRunning: boolean;
}

/**
 * FID-20260909-036 (cross-runtime fix): see flagBotManager — job state lives
 * on globalThis so the tsx server runtime and Next's bundled route runtime
 * share one instance of the counters and interval handles.
 */
interface FactoryRegenJobState {
  jobInterval: NodeJS.Timeout | null;
  jobStats: JobStats;
}

const factoryRegenGlobals = globalThis as unknown as { __darkframeFactoryRegenJob?: FactoryRegenJobState };
const state: FactoryRegenJobState = (factoryRegenGlobals.__darkframeFactoryRegenJob ??= {
  jobInterval: null,
  jobStats: {
    lastRun: null,
    nextRun: null,
    executionCount: 0,
    factoriesRegenerated: 0,
    totalSlotsRegenerated: 0,
    averageExecutionTime: 0,
    isRunning: false,
  },
});

function getRegenRate(level: number): number {
  return FACTORY_SLOT_REGEN_JOB_CONFIG.slotsPerHour * (1 + (level - 1) * 0.1);
}

async function factorySlotRegenerationJob(): Promise<number> {
  const startTime = Date.now();
  let factoriesProcessed = 0;
  let totalSlotsRegenerated = 0;

  try {
    console.log('[Factory Slot Regen] Starting regeneration cycle...');

    const allFactories = await db.select().from(factories);
    const now = new Date();

    for (const factory of allFactories) {
      try {
        const lastRegen = factory.lastSlotRegen ? new Date(factory.lastSlotRegen) : new Date(0);
        const timeSinceLastRegen = now.getTime() - lastRegen.getTime();
        const hoursElapsed = timeSinceLastRegen / (1000 * 60 * 60);
        const regenRate = getRegenRate(factory.level || 1);
        const slotsToRegen = Math.floor(hoursElapsed * regenRate);

        if (slotsToRegen > 0) {
          const currentUsedSlots = factory.usedSlots || 0;
          const newUsedSlots = Math.max(0, currentUsedSlots - slotsToRegen);

          if (newUsedSlots !== currentUsedSlots) {
            await db.update(factories)
              .set({ usedSlots: newUsedSlots, lastSlotRegen: now })
              .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
            factoriesProcessed++;
            totalSlotsRegenerated += currentUsedSlots - newUsedSlots;
          }
        }
      } catch (factoryError) {
        console.error('[Factory Slot Regen] Error processing factory:', factoryError);
      }
    }

    console.log(`[Factory Slot Regen] Regenerated ${totalSlotsRegenerated} slots across ${factoriesProcessed} factories`);

    const executionTime = Date.now() - startTime;
    state.jobStats.lastRun = new Date();
    state.jobStats.executionCount++;
    state.jobStats.factoriesRegenerated += factoriesProcessed;
    state.jobStats.totalSlotsRegenerated += totalSlotsRegenerated;
    state.jobStats.averageExecutionTime =
      (state.jobStats.averageExecutionTime * (state.jobStats.executionCount - 1) + executionTime) /
      state.jobStats.executionCount;

    console.log(`[Factory Slot Regen] Execution time: ${executionTime}ms`);
    return factoriesProcessed;
  } catch (error) {
    console.error('[Factory Slot Regen] Job error:', error);
    return 0;
  }
}

export async function startFactorySlotRegenJob(): Promise<{ success: boolean; message: string }> {
  try {
    if (state.jobInterval) {
      return { success: false, message: 'Factory slot regeneration job already running' };
    }

    console.log('[Factory Slot Regen] Starting background job...');

    state.jobInterval = setInterval(async () => {
      await factorySlotRegenerationJob();
    }, FACTORY_SLOT_REGEN_JOB_CONFIG.interval);

    state.jobStats.nextRun = new Date(Date.now() + FACTORY_SLOT_REGEN_JOB_CONFIG.interval);
    state.jobStats.isRunning = true;

    console.log(`[Factory Slot Regen] Started with ${FACTORY_SLOT_REGEN_JOB_CONFIG.interval / 1000}s interval`);
    return { success: true, message: `Factory slot regeneration job started (interval: ${FACTORY_SLOT_REGEN_JOB_CONFIG.interval / 1000}s)` };
  } catch (error) {
    console.error('[Factory Slot Regen] Failed to start job:', error);
    return { success: false, message: 'Failed to start factory slot regeneration job' };
  }
}

export async function stopFactorySlotRegenJob(): Promise<{ success: boolean; message: string }> {
  if (!state.jobInterval) {
    return { success: false, message: 'Factory slot regeneration job is not running' };
  }

  clearInterval(state.jobInterval);
  state.jobInterval = null;
  state.jobStats.isRunning = false;
  state.jobStats.nextRun = null;

  console.log('[Factory Slot Regen] Job stopped');
  return { success: true, message: 'Factory slot regeneration job stopped' };
}

export function getFactorySlotRegenJobStats(): JobStats {
  return { ...state.jobStats };
}
