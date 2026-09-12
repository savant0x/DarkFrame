/**
 * @file lib/jobs/botFactoryEconomyManager.ts
 * @created 2026-09-12
 * @overview FID-20260912-067 — bot factory economy scheduler.
 *
 * Runs the bot investment cycle hourly (seed pass fires on the first run when
 * the game_config marker is absent). State on globalThis per the FID-20260909-036
 * cross-runtime lesson. Admin panel reads getBotFactoryEconomyStats().
 */

import { runBotFactoryEconomyCycle } from '../botFactoryEconomy';

interface BotFactoryJobStats {
  lastRun: Date | null;
  runCount: number;
  lastUpgraded: number;
  totalUpgraded: number;
  totalInvestedMetal: number;
  seeded: boolean;
  errorCount: number;
}

interface BotFactoryJobState {
  stats: BotFactoryJobStats;
  jobInterval: ReturnType<typeof setInterval> | null;
  running: boolean;
}

const globalForBotFactoryJob = globalThis as unknown as {
  __botFactoryEconomyJob?: BotFactoryJobState;
};

const state: BotFactoryJobState = (globalForBotFactoryJob.__botFactoryEconomyJob ??= {
  stats: {
    lastRun: null,
    runCount: 0,
    lastUpgraded: 0,
    totalUpgraded: 0,
    totalInvestedMetal: 0,
    seeded: false,
    errorCount: 0,
  },
  jobInterval: null,
  running: false,
});

const RUN_INTERVAL_MS = 60 * 60 * 1000;

async function runPass(): Promise<void> {
  if (state.running) return; // overlapping passes would double-invest
  state.running = true;
  try {
    const result = await runBotFactoryEconomyCycle();
    state.stats.lastRun = new Date();
    state.stats.runCount += 1;
    state.stats.lastUpgraded = result.upgraded;
    state.stats.totalUpgraded += result.upgraded;
    state.stats.totalInvestedMetal += result.investedMetal;
    if (result.seeded) state.stats.seeded = true;
    if (!result.success) state.stats.errorCount += 1;
    console.log(`[BotFactoryEconomy] ${result.message}`);
  } catch (err) {
    state.stats.errorCount += 1;
    console.error('[BotFactoryEconomy] pass threw:', err);
  } finally {
    state.running = false;
  }
}

export function startBotFactoryEconomyJob(): { success: boolean; message: string } {
  if (state.jobInterval) {
    return { success: true, message: 'Bot factory economy job already running' };
  }
  // First pass fires immediately (seeds history on a fresh world).
  void runPass();
  state.jobInterval = setInterval(() => void runPass(), RUN_INTERVAL_MS);
  console.log('[BotFactoryEconomy] ✅ Economy job started (hourly)');
  return { success: true, message: 'Bot factory economy job started' };
}

export function stopBotFactoryEconomyJob(): void {
  if (state.jobInterval) {
    clearInterval(state.jobInterval);
    state.jobInterval = null;
    console.log('[BotFactoryEconomy] ⏹️ Economy job stopped');
  }
}

export function getBotFactoryEconomyStats(): BotFactoryJobStats & { running: boolean } {
  return { ...state.stats, running: state.jobInterval !== null };
}

/** Admin-panel trigger: run one cycle on demand. Serialized with the scheduler. */
export async function triggerBotFactoryEconomyCycle(): Promise<{ success: boolean; message: string }> {
  await runPass();
  return { success: true, message: 'Bot factory economy cycle executed' };
}
