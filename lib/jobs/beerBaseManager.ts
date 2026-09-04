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
} from '../beerBaseService';

interface BeerBaseJobStats {
  lastRun: Date | null;
  lastRespawn: Date | null;
  executionCount: number;
  respawnCount: number;
  errorCount: number;
}

const stats: BeerBaseJobStats = {
  lastRun: null,
  lastRespawn: null,
  executionCount: 0,
  respawnCount: 0,
  errorCount: 0,
};

/** Check cadence: every 10 minutes is plenty for a weekly hour-window trigger. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

let jobInterval: ReturnType<typeof setInterval> | null = null;

/** Tracks the ISO week of the last respawn so the window fires at most once. */
let lastRespawnWeek = -1;

async function beerBaseManagerJob(): Promise<void> {
  stats.lastRun = new Date();
  stats.executionCount++;
  try {
    if (!isRespawnTime(await getBeerBaseConfig())) return;

    // Deduplicate within the scheduled hour: one respawn per ISO week
    const now = new Date();
    const week = getISOWeek(now);
    if (week === lastRespawnWeek) return;

    console.log('[Beer Base Job] 🍺 Scheduled respawn window — executing weekly respawn...');
    const result = await weeklyBeerBaseRespawn();
    stats.respawnCount++;
    stats.lastRespawn = new Date();
    lastRespawnWeek = week;
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
  if (jobInterval) {
    return { success: true, message: 'Beer Base job already running' };
  }
  jobInterval = setInterval(() => {
    void beerBaseManagerJob();
  }, CHECK_INTERVAL_MS);
  console.log(`[Beer Base Job] ✅ Started (check interval: ${CHECK_INTERVAL_MS / 60000}min)`);
  return { success: true, message: 'Beer Base respawn scheduler started' };
}

export function stopBeerBaseJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[Beer Base Job] 🛑 Stopped');
  }
}

export function getBeerBaseJobStats(): BeerBaseJobStats {
  return { ...stats };
}
