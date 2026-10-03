/**
 * @file lib/jobs/factorySlotRegeneration.ts
 * @created 2025-11-04
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @updated 2026-10-02 (FID-20261002-011: canonical regen curve + shared helper +
 *            FID-20261002-002 transaction boundary + batched owner stats)
 *
 * @overview Background job that regenerates factory production slots over time
 *
 * FID-20261002-011: the job no longer carries its own 10×level curve (which
 * recovered 19 slots/hour on a Level 10 factory versus the canonical 120).
 * It now delegates to lib/slotRegenService.applySlotRegeneration — the same
 * helper the build/status/list request paths use — so background and on-demand
 * regeneration are the same curve, the same clock contract and the same
 * army-balance multiplier. All rows are locked FOR UPDATE inside ONE
 * transaction (FID-20261002-002), so the job can never overwrite a slot
 * snapshot a concurrent build just consumed, and owner stats are read in ONE
 * batched query instead of once per factory.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { Factory } from '@/types';
import { applySlotRegeneration, getSlotRegenBalanceMultiplier } from '@/lib/slotRegenService';
import { withTransactionRetry } from '@/lib/db/treasuryLock';

const FACTORY_SLOT_REGEN_JOB_CONFIG = {
  interval: 3600000,
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

/** Result of one regeneration cycle. */
export interface FactoryRegenCycleResult {
  factoriesProcessed: number;
  totalSlotsRegenerated: number;
}

/**
 * One regeneration cycle (exported for the interval callback and the
 * integration suite): lock every factory row, batch-read owner army totals,
 * apply the shared regeneration helper at one explicit `now`, and persist
 * only rows whose usedSlots actually changed — all inside one retried
 * transaction.
 */
export async function runFactorySlotRegenerationCycle(
  now: Date = new Date(),
): Promise<FactoryRegenCycleResult> {
  return withTransactionRetry('factorySlotRegenerationJob', () =>
    db.transaction(async (tx): Promise<FactoryRegenCycleResult> => {
      const allFactories = await tx.select().from(factories).for('update');

      // FID-20261002-011 §5.5: batch owner-stat reads — one query for every
      // distinct owner instead of one per factory.
      const ownerNames = Array.from(
        new Set(allFactories.map((f) => f.owner).filter((o): o is string => Boolean(o))),
      );
      const ownerRows = ownerNames.length
        ? await tx
            .select({
              username: players.username,
              totalStrength: players.totalStrength,
              totalDefense: players.totalDefense,
            })
            .from(players)
            .where(inArray(players.username, ownerNames))
        : [];
      const statsByOwner = new Map(ownerRows.map((row) => [row.username, row]));

      let factoriesProcessed = 0;
      let totalSlotsRegenerated = 0;

      for (const factory of allFactories) {
        try {
          // Ownerless factories use the neutral multiplier; a missing owner row
          // degrades to neutral as well (fail safe, never a fabricated penalty).
          const stats = factory.owner ? statsByOwner.get(factory.owner) : undefined;
          const balanceMultiplier =
            factory.owner && stats
              ? getSlotRegenBalanceMultiplier(stats.totalStrength, stats.totalDefense)
              : 1;

          const regenerated = applySlotRegeneration(factory as unknown as Factory, {
            now,
            balanceMultiplier,
          });

          // Persist when the recovered count OR the checkpoint moved: the
          // empty-idle rebase must be durable, or a later build would inherit
          // the discarded idle time from the stale checkpoint (FID-20261002-011
          // §5.4).
          const checkpointMoved =
            regenerated.lastSlotRegen.getTime() !==
            new Date(factory.lastSlotRegen).getTime();
          if (regenerated.usedSlots !== factory.usedSlots || checkpointMoved) {
            await tx
              .update(factories)
              .set({
                usedSlots: regenerated.usedSlots,
                lastSlotRegen: regenerated.lastSlotRegen,
              })
              .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
            factoriesProcessed += 1;
            totalSlotsRegenerated += factory.usedSlots - regenerated.usedSlots;
          }
        } catch (factoryError) {
          console.error('[Factory Slot Regen] Error processing factory:', factoryError);
        }
      }

      return { factoriesProcessed, totalSlotsRegenerated };
    }),
  );
}

async function factorySlotRegenerationJob(): Promise<number> {
  const startTime = Date.now();

  try {
    console.log('[Factory Slot Regen] Starting regeneration cycle...');

    const { factoriesProcessed, totalSlotsRegenerated } =
      await runFactorySlotRegenerationCycle();

    console.log(`[Factory Slot Regen] Regenerated ${totalSlotsRegenerated} slots across ${factoriesProcessed} factories`);

    const executionTime = Date.now() - startTime;
    state.jobStats.lastRun = new Date();
    state.jobStats.executionCount += 1;
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
