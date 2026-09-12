/**
 * @file lib/jobs/clanWarSettlementManager.ts
 * @created 2026-09-12
 * @overview FID-20260912-076 — hourly war settlement scheduler.
 *
 * Every hour: settleDueWars() ends ACTIVE wars past the 48h minimum duration,
 * pays spoils (treasury transfer + RP split + clan XP swings) and notifies
 * both clans. State on globalThis per the FID-20260909-036 cross-runtime
 * lesson. Admin panel reads getClanWarSettlementStats().
 */

import { settleDueWars } from '../clanWarfareService';

interface WarJobStats {
  lastRun: Date | null;
  runCount: number;
  warsSettled: number;
  totalSettled: number;
  errorCount: number;
  running: boolean;
}

interface WarJobState {
  stats: WarJobStats;
  jobInterval: ReturnType<typeof setInterval> | null;
  running: boolean;
}

const globalForWarJob = globalThis as unknown as {
  __clanWarSettlementJob?: WarJobState;
};

const state: WarJobState = (globalForWarJob.__clanWarSettlementJob ??= {
  stats: {
    lastRun: null,
    runCount: 0,
    warsSettled: 0,
    totalSettled: 0,
    errorCount: 0,
    running: false,
  },
  jobInterval: null,
  running: false,
});

const RUN_INTERVAL_MS = 60 * 60 * 1000;

async function runPass(): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    const result = await settleDueWars();
    state.stats.lastRun = new Date();
    state.stats.runCount += 1;
    state.stats.warsSettled = result.settled;
    state.stats.totalSettled += result.settled;
    if (result.settled > 0) {
      console.log(`[WarSettlement] Settled ${result.settled} war(s):`, result.results.map((r) => `${r.warId} -> ${r.outcome}`).join(', '));
    }
  } catch (err) {
    state.stats.errorCount += 1;
    console.error('[WarSettlement] pass threw:', err);
  } finally {
    state.running = false;
  }
}

export function startClanWarSettlementJob(): void {
  if (state.jobInterval) return;
  console.log('[WarSettlement] ✅ Settlement job started (hourly, 48h minimum war duration)');
  void runPass(); // first pass immediately
  state.jobInterval = setInterval(() => void runPass(), RUN_INTERVAL_MS);
}

export function stopClanWarSettlementJob(): void {
  if (state.jobInterval) {
    clearInterval(state.jobInterval);
    state.jobInterval = null;
    console.log('[WarSettlement] 🛑 Settlement job stopped');
  }
}

export function isClanWarSettlementJobRunning(): boolean {
  return state.jobInterval !== null;
}

export function getClanWarSettlementStats(): WarJobStats {
  return { ...state.stats };
}

export async function runClanWarSettlementOnce(): Promise<{ settled: number }> {
  const before = state.stats.totalSettled;
  await runPass();
  return { settled: state.stats.totalSettled - before };
}
