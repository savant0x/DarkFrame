/**
 * @file lib/jobs/auctionSettlementManager.ts
 * @created 2026-09-12
 * @overview FID-20260912-065 — auction settlement scheduler.
 *
 * Expired auctions previously sat Active forever: the board filled with zombie
 * listings whose goods/metal were already escrowed, and no one was ever paid.
 * This job settles every overdue auction (sold-at-hammer or expired-refund)
 * every 5 minutes. Registration follows the flagBotManager pattern; state lives
 * on globalThis so the server.ts runtime and the API-route runtime share it
 * (FID-20260909-036 cross-runtime lesson).
 */

import { settleExpiredAuctions } from '../auctionService';

interface SettlementJobStats {
  lastRun: Date | null;
  runCount: number;
  soldTotal: number;
  expiredTotal: number;
  errorCount: number;
}

interface SettlementJobState {
  stats: SettlementJobStats;
  jobInterval: ReturnType<typeof setInterval> | null;
}

const globalForAuctionJob = globalThis as unknown as {
  __auctionSettlementJob?: SettlementJobState;
};

const state: SettlementJobState = (globalForAuctionJob.__auctionSettlementJob ??= {
  stats: { lastRun: null, runCount: 0, soldTotal: 0, expiredTotal: 0, errorCount: 0 },
  jobInterval: null,
});

const RUN_INTERVAL_MS = 5 * 60 * 1000;

async function runSettlementPass(): Promise<void> {
  try {
    const result = await settleExpiredAuctions();
    state.stats.lastRun = new Date();
    state.stats.runCount += 1;
    state.stats.soldTotal += result.sold;
    state.stats.expiredTotal += result.expired;
    if (!result.success || result.errors > 0) {
      state.stats.errorCount += result.errors;
      console.warn('[AuctionSettlement] pass had errors:', result.message);
    }
    if (result.checked > 0) {
      console.log(`[AuctionSettlement] ✅ ${result.message}`);
    }
  } catch (err) {
    state.stats.errorCount += 1;
    console.error('[AuctionSettlement] pass threw:', err);
  }
}

export function startAuctionSettlementJob(): { success: boolean; message: string } {
  if (state.jobInterval) {
    return { success: true, message: 'Auction settlement job already running' };
  }

  // Settle any backlog immediately on boot (e.g. downtime-spanning expiries),
  // then keep a steady cadence.
  void runSettlementPass();
  state.jobInterval = setInterval(() => void runSettlementPass(), RUN_INTERVAL_MS);

  console.log('[AuctionSettlement] ✅ Settlement job started (every 5 min)');
  return { success: true, message: 'Auction settlement job started' };
}

export function stopAuctionSettlementJob(): void {
  if (state.jobInterval) {
    clearInterval(state.jobInterval);
    state.jobInterval = null;
    console.log('[AuctionSettlement] ⏹️ Settlement job stopped');
  }
}

export function getAuctionSettlementStats(): SettlementJobStats & { running: boolean } {
  return { ...state.stats, running: state.jobInterval !== null };
}
