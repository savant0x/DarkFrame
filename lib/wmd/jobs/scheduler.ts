/**
 * @file lib/wmd/jobs/scheduler.ts
 * @created 2025-10-22
 * @overview WMD Background Jobs Master Scheduler
 * 
 * OVERVIEW:
 * Orchestrates all WMD background jobs with configurable intervals,
 * health checks, and graceful shutdown capabilities. Ensures reliable
 * execution of time-based WMD operations.
 * 
 * Features:
 * - Centralized job management
 * - Individual job intervals (missile:60s, spy:30s, vote:60s, repair:60s)
 * - Health check endpoint for monitoring
 * - Graceful shutdown with cleanup
 * - Error isolation (one job failure doesn't stop others)
 * - Job execution metrics
 * 
 * Jobs Managed:
 * - Missile Flight Tracker (60s) - Processes missile impacts
 * - Spy Mission Completer (30s) - Completes spy missions
 * - Vote Expiration Cleaner (60s) - Expires clan votes
 * - Defense Repair Completer (60s) - Completes battery repairs
 * - Beer Base Respawner (60s) - Weekly Beer Base respawn (Sunday 4 AM)
 * 
 * Dependencies:
 * - Individual job modules
 * - Drizzle ORM connection
 * 
 * @implements Background Job Scheduler Pattern
 */

import { db } from '@/lib/db';
import { missileTracker } from './missileTracker';
import { spyMissionCompleter } from './spyMissionCompleter';
import { voteExpirationCleaner } from './voteExpirationCleaner';
import { defenseRepairCompleter, defenseRepairCompleterJobInfo } from './defenseRepairCompleter';
import { beerBaseRespawner, beerBaseRespawnerJobInfo } from './beerBaseRespawner';

type Database = typeof db;

interface JobStats {
  name: string;
  interval: number;
  lastRun: Date | null;
  nextRun: Date | null;
  executionCount: number;
  errorCount: number;
  averageExecutionTime: number;
  isRunning: boolean;
}

interface SchedulerState {
  isRunning: boolean;
  startedAt: Date | null;
  jobs: Map<string, NodeJS.Timeout>;
  stats: Map<string, JobStats>;
}

/**
 * FID-20260909-036 (cross-runtime fix): server.ts (tsx) and Next's bundled
 * API routes keep separate module registries, so module-level scheduler state
 * exists twice — the jobs-status panel read the empty instance while the
 * real jobs ran in the server's. State lives on globalThis, shared by every
 * runtime in the process.
 */
const wmdSchedulerGlobals = globalThis as unknown as { __darkframeWMDScheduler?: SchedulerState };
const scheduler: SchedulerState = (wmdSchedulerGlobals.__darkframeWMDScheduler ??= {
  isRunning: false,
  startedAt: null,
  jobs: new Map(),
  stats: new Map(),
});

interface JobConfig {
  name: string;
  interval: number;
  handler: (db: Database) => Promise<void | number>;
}

const JOBS: JobConfig[] = [
  {
    name: 'Missile Flight Tracker',
    interval: 60000,
    handler: missileTracker,
  },
  {
    name: 'Spy Mission Completer',
    interval: 30000,
    handler: spyMissionCompleter,
  },
  {
    name: 'Vote Expiration Cleaner',
    interval: 60000,
    handler: voteExpirationCleaner,
  },
  {
    name: defenseRepairCompleterJobInfo.name,
    interval: defenseRepairCompleterJobInfo.interval,
    handler: defenseRepairCompleter,
  },
  {
    name: beerBaseRespawnerJobInfo.name,
    interval: beerBaseRespawnerJobInfo.interval,
    handler: beerBaseRespawner,
  },
];

async function executeJob(dbConn: Database, config: JobConfig): Promise<void> {
  const stats = scheduler.stats.get(config.name);
  if (!stats) return;
  
  if (stats.isRunning) {
    console.warn(`[WMD Scheduler] ${config.name} still running, skipping this cycle`);
    return;
  }
  
  stats.isRunning = true;
  stats.lastRun = new Date();
  const startTime = Date.now();
  
  try {
    await config.handler(dbConn);
    
    stats.executionCount++;
    const executionTime = Date.now() - startTime;
    
    stats.averageExecutionTime =
      stats.averageExecutionTime === 0
        ? executionTime
        : (stats.averageExecutionTime * 0.9 + executionTime * 0.1);
    
    stats.nextRun = new Date(Date.now() + config.interval);
    
  } catch (error) {
    console.error(`[WMD Scheduler] Error in ${config.name}:`, error);
    stats.errorCount++;
  } finally {
    stats.isRunning = false;
  }
}

export function startWMDJobs(): { success: boolean; message: string } {
  try {
    if (scheduler.isRunning) {
      return { success: false, message: 'WMD jobs already running' };
    }
    
    JOBS.forEach((config) => {
      scheduler.stats.set(config.name, {
        name: config.name,
        interval: config.interval,
        lastRun: null,
        nextRun: new Date(Date.now() + config.interval),
        executionCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        isRunning: false,
      });
    });
    
    JOBS.forEach((config) => {
      const intervalId = setInterval(() => {
        executeJob(db, config);
      }, config.interval);
      
      scheduler.jobs.set(config.name, intervalId);
      
      console.log(`[WMD Scheduler] Started: ${config.name} (every ${config.interval / 1000}s)`);
    });
    
    scheduler.isRunning = true;
    scheduler.startedAt = new Date();
    
    console.log(`[WMD Scheduler] All ${JOBS.length} jobs started successfully`);
    
    return {
      success: true,
      message: `${JOBS.length} WMD background jobs started`,
    };
    
  } catch (error) {
    console.error('[WMD Scheduler] Failed to start jobs:', error);
    return { success: false, message: 'Failed to start WMD jobs' };
  }
}

export function stopWMDJobs(): { success: boolean; message: string } {
  try {
    if (!scheduler.isRunning) {
      return { success: false, message: 'WMD jobs not running' };
    }
    
    scheduler.jobs.forEach((intervalId, jobName) => {
      clearInterval(intervalId);
      console.log(`[WMD Scheduler] Stopped: ${jobName}`);
    });
    
    scheduler.jobs.clear();
    scheduler.isRunning = false;
    
    console.log('[WMD Scheduler] All jobs stopped successfully');
    
    return {
      success: true,
      message: 'All WMD background jobs stopped',
    };
    
  } catch (error) {
    console.error('[WMD Scheduler] Error stopping jobs:', error);
    return { success: false, message: 'Error stopping WMD jobs' };
  }
}

/**
 * Stop a single WMD job (FID-20260909-036 admin controls). Clears its
 * interval without touching the rest of the scheduler family.
 */
export function stopSingleWMDJob(jobName: string): { success: boolean; message: string } {
  try {
    const config = JOBS.find((j) => j.name === jobName);
    if (!config) {
      return { success: false, message: `Job '${jobName}' not found` };
    }
    
    const existingInterval = scheduler.jobs.get(jobName);
    if (!existingInterval) {
      return { success: false, message: `Job '${jobName}' is not running` };
    }
    
    clearInterval(existingInterval);
    scheduler.jobs.delete(jobName);
    if (scheduler.jobs.size === 0) scheduler.isRunning = false;
    
    const stats = scheduler.stats.get(jobName);
    if (stats) stats.nextRun = null;
    
    console.log(`[WMD Scheduler] Stopped single job: ${jobName}`);
    return { success: true, message: `Job '${jobName}' stopped` };
  } catch (error) {
    console.error(`[WMD Scheduler] Error stopping ${jobName}:`, error);
    return { success: false, message: `Failed to stop job '${jobName}'` };
  }
}

/**
 * Start a single WMD job (FID-20260909-036 admin controls). Initializes its
 * stats entry if the family was never started, then registers the interval.
 */
export function startSingleWMDJob(jobName: string): { success: boolean; message: string } {
  try {
    const config = JOBS.find((j) => j.name === jobName);
    if (!config) {
      return { success: false, message: `Job '${jobName}' not found` };
    }
    
    if (scheduler.jobs.has(jobName)) {
      return { success: false, message: `Job '${jobName}' already running` };
    }
    
    if (!scheduler.stats.has(jobName)) {
      scheduler.stats.set(jobName, {
        name: jobName,
        interval: config.interval,
        lastRun: null,
        nextRun: new Date(Date.now() + config.interval),
        executionCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        isRunning: false,
      });
    }
    
    const intervalId = setInterval(() => {
      executeJob(db, config);
    }, config.interval);
    scheduler.jobs.set(jobName, intervalId);
    scheduler.isRunning = true;
    if (!scheduler.startedAt) scheduler.startedAt = new Date();
    
    console.log(`[WMD Scheduler] Started single job: ${jobName}`);
    return { success: true, message: `Job '${jobName}' started` };
  } catch (error) {
    console.error(`[WMD Scheduler] Error starting ${jobName}:`, error);
    return { success: false, message: `Failed to start job '${jobName}'` };
  }
}

export function getSchedulerHealth(): {
  isRunning: boolean;
  uptime: number | null;
  jobs: Array<{
    name: string;
    interval: number;
    lastRun: Date | null;
    nextRun: Date | null;
    executionCount: number;
    errorCount: number;
    averageExecutionTime: number;
    isRunning: boolean;
  }>;
} {
  // FID-20260909-036: report the FULL job roster — a family that was never
  // started (or is fully stopped) must still appear in health views with
  // zeroed stats, not vanish from the panel. Per-job isRunning means
  // "scheduled" (an interval is registered), matching the other job
  // families' semantics in the admin health panel — not the transient
  // "currently executing" flag executeJob toggles mid-run.
  const jobStats = JOBS.map((config) => {
    const scheduled = scheduler.jobs.has(config.name);
    const existing = scheduler.stats.get(config.name);
    if (existing) return { ...existing, isRunning: scheduled };
    return {
      name: config.name,
      interval: config.interval,
      lastRun: null,
      nextRun: null,
      executionCount: 0,
      errorCount: 0,
      averageExecutionTime: 0,
      isRunning: scheduled,
    };
  });
  
  const uptime = scheduler.startedAt
    ? Date.now() - scheduler.startedAt.getTime()
    : null;
  
  return {
    isRunning: scheduler.isRunning,
    uptime,
    jobs: jobStats,
  };
}

export function restartJob(
  jobName: string
): { success: boolean; message: string } {
  try {
    const jobConfig = JOBS.find((j) => j.name === jobName);
    if (!jobConfig) {
      return { success: false, message: `Job '${jobName}' not found` };
    }
    
    const existingInterval = scheduler.jobs.get(jobName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    const intervalId = setInterval(() => {
      executeJob(db, jobConfig);
    }, jobConfig.interval);
    
    scheduler.jobs.set(jobName, intervalId);
    
    const stats = scheduler.stats.get(jobName);
    if (stats) {
      stats.executionCount = 0;
      stats.errorCount = 0;
      stats.averageExecutionTime = 0;
    }
    
    console.log(`[WMD Scheduler] Restarted: ${jobName}`);
    
    return { success: true, message: `Job '${jobName}' restarted` };
    
  } catch (error) {
    console.error(`[WMD Scheduler] Error restarting ${jobName}:`, error);
    return { success: false, message: 'Failed to restart job' };
  }
}
