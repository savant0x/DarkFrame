/**
 * @file app/api/admin/jobs-status/route.ts
 * @created 2026-09-10 (FID-20260909-035 jobs-status panel)
 * @overview GET /api/admin/jobs-status — admin-only, read-only aggregation of
 * every background scheduler's live runtime stats.
 *
 * The FID-035 audit fixed four scheduler wiring defects and added a fifth job
 * (bot growth). This endpoint makes scheduler health VISIBLE in-game: last
 * run, cadence, execution/error counts, per-job details, and the persisted
 * weekly-respawn dedup week, so a silently-dead job can no longer hide.
 *
 * Security: admin JWT only (same gate as /api/admin/health). Read-only — no
 * state mutation. The stats live in the server process that RUNS the jobs;
 * under a serverless deployment this reflects the serving instance, which is
 * also flagged in the payload via `serverModel`.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     serverModel: 'custom-server' | 'serverless',
 *     jobs: [{
 *       name, interval, isRunning,
 *       stats: { lastRun, executionCount, errorCount, ...job-specific },
 *       details?: { ... }   // job-specific extras (WMD sub-jobs, respawn week, etc.)
 *     }],
 *     generatedAt: ISO string
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getBeerBaseConfig } from '@/lib/beerBaseService';
import { db } from '@/lib/db';
import { modLog } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import {
  getBeerBaseJobInfo,
  startBeerBaseJob,
  stopBeerBaseJob,
  runBeerBaseJobNow,
} from '@/lib/jobs/beerBaseManager';
import {
  getBotGrowthJobInfo,
  startBotGrowthJob,
  stopBotGrowthJob,
  runBotGrowthJobNow,
} from '@/lib/jobs/botGrowthManager';
import {
  getFlagBotJobInfo,
  startFlagBotJob,
  stopFlagBotJob,
} from '@/lib/jobs/flagBotManager';
import {
  getFactorySlotRegenJobStats,
  startFactorySlotRegenJob,
  stopFactorySlotRegenJob,
} from '@/lib/jobs/factorySlotRegeneration';
import {
  getAuctionSettlementStats,
  startAuctionSettlementJob,
  stopAuctionSettlementJob,
} from '@/lib/jobs/auctionSettlementManager';
import {
  getBotFactoryEconomyStats,
  startBotFactoryEconomyJob,
  stopBotFactoryEconomyJob,
  triggerBotFactoryEconomyCycle,
} from '@/lib/jobs/botFactoryEconomyManager';
import {
  getSchedulerHealth,
  startWMDJobs,
  stopWMDJobs,
  stopSingleWMDJob,
  startSingleWMDJob,
} from '@/lib/wmd/jobs/scheduler';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);
/** Separate budget for job mutations — the 30s health poll shares nothing with it. */
const mutationRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async () => {
  const log = createRouteLogger('AdminJobsStatusAPI');
  const endTimer = log.time('jobsStatus');

  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.isAdmin) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, { message: 'Admin access required' });
    }

    const beerBase = getBeerBaseJobInfo();
    const botGrowth = getBotGrowthJobInfo();
    const flagBot = getFlagBotJobInfo();
    const factoryRegen = getFactorySlotRegenJobStats();
    const wmd = getSchedulerHealth();
    const beerBaseConfig = await getBeerBaseConfig();
    const auctionSettlement = getAuctionSettlementStats();
    const botFactoryEconomy = getBotFactoryEconomyStats();

    const jobs = [
      {
        id: 'beerBase',
        name: beerBase.name,
        interval: beerBase.interval,
        isRunning: beerBase.isRunning,
        stats: beerBase.stats,
        details: {
          // Persisted dedup week: set after a successful weekly respawn
          // (restart-safe, catch-up aware — FID-20260909-035). `undefined`
          // means no respawn has completed since the persistence shipped.
          persistedRespawnWeek: beerBaseConfig.lastRespawnWeek ?? null,
        },
      },
      { id: 'botGrowth', name: botGrowth.name, interval: botGrowth.interval, isRunning: botGrowth.isRunning, stats: botGrowth.stats },
      { id: 'flagBot', name: flagBot.name, interval: flagBot.interval, isRunning: flagBot.isRunning, stats: flagBot.stats },
      {
        id: 'factorySlotRegen',
        name: 'Factory Slot Regeneration (hourly)',
        interval: 3_600_000,
        isRunning: factoryRegen.isRunning,
        stats: factoryRegen,
      },
      {
        id: 'auctionSettlement',
        name: 'Auction Settlement (5 min)',
        interval: 300_000,
        isRunning: auctionSettlement.running,
        stats: {
          lastRun: auctionSettlement.lastRun,
          executionCount: auctionSettlement.runCount,
          errorCount: auctionSettlement.errorCount,
          soldTotal: auctionSettlement.soldTotal,
          expiredTotal: auctionSettlement.expiredTotal,
        },
      },
      {
        id: 'botFactoryEconomy',
        name: 'Bot Factory Economy (hourly)',
        interval: 3_600_000,
        isRunning: botFactoryEconomy.running,
        stats: {
          lastRun: botFactoryEconomy.lastRun,
          executionCount: botFactoryEconomy.runCount,
          errorCount: botFactoryEconomy.errorCount,
          totalUpgraded: botFactoryEconomy.totalUpgraded,
          totalInvestedMetal: botFactoryEconomy.totalInvestedMetal,
          seeded: botFactoryEconomy.seeded,
        },
      },
      ...wmd.jobs.map((j) => ({
        id: `wmd:${j.name}`,
        name: `WMD · ${j.name}`,
        interval: j.interval,
        isRunning: j.isRunning,
        stats: {
          lastRun: j.lastRun,
          executionCount: j.executionCount,
          errorCount: j.errorCount,
          averageExecutionTime: j.averageExecutionTime,
        },
      })),
    ];

    return NextResponse.json({
      success: true,
      data: {
        serverModel: 'custom-server',
        schedulerUptime: wmd.uptime,
        jobs,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Admin jobs-status failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * Stable job ids for the POST contract. Display names live with the
 * managers; these ids are what the UI sends and what the audit log records.
 * `wmd:`-prefixed ids address individual WMD sub-jobs by their exact
 * scheduler names (e.g. `wmd:Missile Flight Tracker`).
 */
const TOP_LEVEL_JOB_IDS = [
  'beerBase',
  'botGrowth',
  'flagBot',
  'factorySlotRegen',
  'auctionSettlement',
  'botFactoryEconomy',
  'wmd',
] as const;
const ACTIONS = ['start', 'stop', 'restart', 'run-now'] as const;

type JobAction = (typeof ACTIONS)[number];

interface JobMutationResult {
  success: boolean;
  message: string;
}

/**
 * Route one validated mutation to its manager. Every branch returns a
 * { success, message } result; async managers are awaited so the response
 * and audit row reflect the real outcome.
 */
async function dispatchJobMutation(job: string, action: JobAction): Promise<JobMutationResult> {
  // Per-job WMD controls (stop/restart/start on a single scheduler entry).
  if (job.startsWith('wmd:')) {
    const jobName = job.slice('wmd:'.length);
    switch (action) {
      case 'stop': return stopSingleWMDJob(jobName);
      case 'start': return startSingleWMDJob(jobName);
      case 'restart': {
        const stop = stopSingleWMDJob(jobName);
        if (!stop.success && !stop.message.endsWith('is not running')) return stop;
        return startSingleWMDJob(jobName);
      }
      case 'run-now':
        return { success: false, message: 'run-now is not available for WMD sub-jobs' };
    }
  }

  // Family-level WMD controls.
  if (job === 'wmd') {
    switch (action) {
      case 'stop': return stopWMDJobs();
      case 'start': return startWMDJobs();
      case 'restart': {
        stopWMDJobs();
        return startWMDJobs();
      }
      case 'run-now':
        return { success: false, message: 'run-now is not available for the WMD family — address a sub-job' };
    }
  }

  switch (job) {
    case 'beerBase': {
      if (action === 'run-now') {
        await runBeerBaseJobNow();
        return { success: true, message: 'Beer Base respawn scheduler tick executed' };
      }
      return action === 'stop' ? noResult(stopBeerBaseJob(), 'Beer Base job stopped') : startBeerBaseJob();
    }
    case 'botGrowth': {
      if (action === 'run-now') {
        await runBotGrowthJobNow();
        return { success: true, message: 'Bot growth cycle executed' };
      }
      return action === 'stop' ? noResult(stopBotGrowthJob(), 'Bot growth job stopped') : startBotGrowthJob();
    }
    case 'flagBot':
      return action === 'stop' ? await stopFlagBotJob() : await startFlagBotJob();
    case 'factorySlotRegen':
      return action === 'stop' ? await stopFactorySlotRegenJob() : await startFactorySlotRegenJob();
    case 'auctionSettlement': {
      if (action === 'run-now') {
        const { settleExpiredAuctions } = await import('@/lib/auctionService');
        const result = await settleExpiredAuctions();
        return { success: result.success, message: result.message };
      }
      return action === 'stop' ? noResult(stopAuctionSettlementJob(), 'Auction settlement job stopped') : startAuctionSettlementJob();
    }
    case 'botFactoryEconomy': {
      if (action === 'run-now') {
        const result = await triggerBotFactoryEconomyCycle();
        return result;
      }
      return action === 'stop' ? noResult(stopBotFactoryEconomyJob(), 'Bot factory economy job stopped') : startBotFactoryEconomyJob();
    }
    default:
      return { success: false, message: `Unknown job '${job}'` };
  }
}

/** void stoppers need a result object for the uniform response shape. */
function noResult(_void: void, message: string): JobMutationResult {
  return { success: true, message };
}

/** Restart = stop (ignore not-running) then start. */
async function restartFamily(job: string): Promise<JobMutationResult> {
  switch (job) {
    case 'beerBase':
      stopBeerBaseJob();
      return startBeerBaseJob();
    case 'botGrowth':
      stopBotGrowthJob();
      return startBotGrowthJob();
    case 'flagBot': {
      await stopFlagBotJob();
      return await startFlagBotJob();
    }
    case 'factorySlotRegen': {
      await stopFactorySlotRegenJob();
      return await startFactorySlotRegenJob();
    }
    default:
      return { success: false, message: `Restart not supported for '${job}'` };
  }
}

export const POST = withRequestLogging(mutationRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminJobsStatusAPI');
  const endTimer = log.time('jobsStatusMutation');

  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.isAdmin) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, { message: 'Admin access required' });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, { message: 'Body must be JSON' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, { message: 'Body must be a JSON object' });
    }

    const job = typeof (body as { job?: unknown }).job === 'string' ? (body as { job: string }).job : null;
    const action = typeof (body as { action?: unknown }).action === 'string' ? (body as { action: string }).action : null;

    if (!job || !action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, { message: 'Fields job and action are required' });
    }
    if (!(TOP_LEVEL_JOB_IDS as readonly string[]).includes(job) && !job.startsWith('wmd:')) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, { message: `Unknown job '${job}'` });
    }
    if (!(ACTIONS as readonly string[]).includes(action)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, { message: `Unknown action '${action}'` });
    }

    const result =
      action === 'restart' && TOP_LEVEL_JOB_IDS.includes(job as (typeof TOP_LEVEL_JOB_IDS)[number])
        ? await restartFamily(job)
        : await dispatchJobMutation(job, action as JobAction);

    // Audit trail (mod_log convention, FID-20260906-003) — every scheduler
    // mutation is attributable.
    await db.insert(modLog).values({
      id: generateId().slice(0, 24),
      moderatorId: auth.username.slice(0, 20),
      action: 'ADMIN_JOB_CONTROL',
      targetId: job.slice(0, 24),
      details: JSON.stringify({
        job,
        action,
        outcome: result.success,
        message: result.message,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    log.error('Admin job mutation failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
