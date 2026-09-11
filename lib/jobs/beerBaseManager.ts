/**
 * @file lib/jobs/beerBaseManager.ts
 * @created 2026-09-04
 * @overview Weekly Beer Base respawn scheduler job (SCOPE #21/#24 finding 8)
 *
 * The respawn functions (weeklyBeerBaseRespawn, isRespawnTime) existed in
 * beerBaseService with no scheduler calling them — the weekly respawn only
 * ever fired via manual admin endpoints. This module registers an interval
 * job that checks the schedule and triggers the respawn during the scheduled
 * hour, deduplicating so the respawn runs at most once per scheduled window.
 *
 * Registration follows the flagBotManager pattern (see server.ts).
 */

import {
  isRespawnTime,
  weeklyBeerBaseRespawn,
  getBeerBaseConfig,
  setLastRespawnWeek,
} from '../beerBaseService';

interface BeerBaseJobStats {
  lastRun: Date | null;
  lastRespawn: Date | null;
  executionCount: number;
  respawnCount: number;
  errorCount: number;
}

/**
 * FID-20260909-036 (cross-runtime fix): server.ts runs under tsx while API
 * routes compile through Next's bundler — the two runtimes keep SEPARATE
 * module registries, so module-level state here exists twice. The scheduled
 * job runs in the server.ts instance while API routes (jobs-status panel)
 * read the other, empty one. State therefore lives on globalThis, which is
 * shared by every runtime in the process.
 */
interface BeerBaseJobState {
  stats: BeerBaseJobStats;
  jobInterval: ReturnType<typeof setInterval> | null;
}

const beerBaseJobGlobals = globalThis as unknown as { __darkframeBeerBaseJob?: BeerBaseJobState };
const state: BeerBaseJobState = (beerBaseJobGlobals.__darkframeBeerBaseJob ??= {
  stats: {
    lastRun: null,
    lastRespawn: null,
    executionCount: 0,
    respawnCount: 0,
    errorCount: 0,
  },
  jobInterval: null,
});
const stats = state.stats;

/** Check cadence: every 10 minutes is plenty for a weekly hour-window trigger. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * FID-20260909-035: the dedup week is PERSISTED (gameConfig.lastRespawnWeek
 * via setLastRespawnWeek), not held in memory. The in-memory variable caused
 * two production failure modes:
 *  - a server restart inside the scheduled window re-respawned the same week
 *    (double tile churn, double base population);
 *  - a server down for the whole scheduled hour skipped the week silently.
 * With persistence: same week → skip (no double-fire); a PAST week inside
 * the window → catch-up fire (missed schedules heal on the next tick).
 */
/** Exported for the FID-20260909-035 scheduler regression tests. */
export async function beerBaseManagerJob(): Promise<void> {
  stats.lastRun = new Date();
  stats.executionCount++;
  try {
    const config = await getBeerBaseConfig();
    if (!isRespawnTime(config)) return;

    // One respawn per ISO week — persisted across restarts.
    const now = new Date();
    const week = getISOWeek(now);
    if (config.lastRespawnWeek === week) return;

    console.log('[Beer Base Job] 🍺 Scheduled respawn window — executing weekly respawn...');
    const result = await weeklyBeerBaseRespawn();
    stats.respawnCount++;
    stats.lastRespawn = new Date();
    // Persist AFTER success: a crashed respawn leaves the old week recorded,
    // so the next tick re-attempts (catch-up) instead of skipping the week.
    try {
      await setLastRespawnWeek(week);
    } catch (persistError) {
      console.error('[Beer Base Job] ⚠️ Failed to persist respawn week (double-fire risk on restart):', persistError);
    }
    console.log(
      `[Beer Base Job] ✅ Respawn complete: removed ${result.removed}, spawned ${result.spawned}`
    );
  } catch (err) {
    stats.errorCount++;
    console.error('[Beer Base Job] ❌ Error during respawn check:', err);
  }
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function startBeerBaseJob(): { success: boolean; message: string } {
  if (state.jobInterval) {
    return { success: true, message: 'Beer Base job already running' };
  }
  state.jobInterval = setInterval(() => {
    void beerBaseManagerJob();
  }, CHECK_INTERVAL_MS);
  console.log(`[Beer Base Job] ✅ Started (check interval: ${CHECK_INTERVAL_MS / 60000}min)`);
  return { success: true, message: 'Beer Base respawn scheduler started' };
}

export function stopBeerBaseJob(): void {
  if (state.jobInterval) {
    clearInterval(state.jobInterval);
    state.jobInterval = null;
    console.log('[Beer Base Job] 🛑 Stopped');
  }
}

export function getBeerBaseJobStats(): BeerBaseJobStats {
  return { ...stats };
}

/**
 * Job status for admin dashboards (FID-20260909-035 jobs-status panel).
 * Mirrors getFlagBotJobInfo's shape.
 */
export function getBeerBaseJobInfo(): {
  name: string;
  interval: number;
  isRunning: boolean;
  stats: BeerBaseJobStats;
} {
  return {
    name: 'Beer Base Weekly Respawn',
    interval: CHECK_INTERVAL_MS,
    isRunning: state.jobInterval !== null,
    stats: getBeerBaseJobStats(),
  };
}

/**
 * Fire one respawn-scheduler tick immediately (FID-20260909-036 admin
 * controls) without touching the scheduled interval. The single-flight guard
 * inside beerBaseManagerJob prevents overlap with a scheduled fire.
 */
export async function runBeerBaseJobNow(): Promise<void> {
  await beerBaseManagerJob();
}
