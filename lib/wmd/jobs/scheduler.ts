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
 * - Supabase connection
 * 
 * @implements Background Job Scheduler Pattern
 */

// Db type removed — Supabase migration
import { missileTracker } from './missileTracker';
import { spyMissionCompleter } from './spyMissionCompleter';
import { voteExpirationCleaner } from './voteExpirationCleaner';
import { defenseRepairCompleter, defenseRepairCompleterJobInfo } from './defenseRepairCompleter';
import { beerBaseRespawner, beerBaseRespawnerJobInfo } from './beerBaseRespawner';

/**
 * Job execution statistics
 */
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

/**
 * Job scheduler state
 */
interface SchedulerState {
  isRunning: boolean;
  startedAt: Date | null;
  jobs: Map<string, NodeJS.Timeout>;
  stats: Map<string, JobStats>;
}

/**
 * Global scheduler state
 */
const scheduler: SchedulerState = {
  isRunning: false,
  startedAt: null,
  jobs: new Map(),
  stats: new Map(),
};

/**
 * Job configuration
 */
interface JobConfig {
  name: string;
  interval: number;
  handler: () => Promise<void | number>;
}

/**
 * All WMD background jobs
 */
const JOBS: JobConfig[] = [
  {
    name: 'Missile Flight Tracker',
    interval: 60000, // 60 seconds
    handler: missileTracker,
  },
  {
    name: 'Spy Mission Completer',
    interval: 30000, // 30 seconds
    handler: spyMissionCompleter,
  },
  {
    name: 'Vote Expiration Cleaner',
    interval: 60000, // 60 seconds
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

/**
 * Execute a job with error isolation and metrics
 */
async function executeJob(config: JobConfig): Promise<void> {
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
    await config.handler();
    
    stats.executionCount++;
    const executionTime = Date.now() - startTime;
    
    // Update average execution time (rolling average)
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

/**
 * Start all WMD background jobs
 * 
 * @param db - Database connection
 * @returns Success status and message
 */
export function startWMDJobs(): { success: boolean; message: string } {
  try {
    if (scheduler.isRunning) {
      return { success: false, message: 'WMD jobs already running' };
    }
    
    // Initialize stats for all jobs
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
    
    // Start each job with its configured interval
    JOBS.forEach((config) => {
      const intervalId = setInterval(() => {
        executeJob(config);
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

/**
 * Stop all WMD background jobs (graceful shutdown)
 * 
 * @returns Success status and message
 */
export function stopWMDJobs(): { success: boolean; message: string } {
  try {
    if (!scheduler.isRunning) {
      return { success: false, message: 'WMD jobs not running' };
    }
    
    // Clear all intervals
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
 * Get scheduler health check information
 * 
 * @returns Scheduler status and job statistics
 */
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
  const jobStats = Array.from(scheduler.stats.values());
  
  const uptime = scheduler.startedAt
    ? Date.now() - scheduler.startedAt.getTime()
    : null;
  
  return {
    isRunning: scheduler.isRunning,
    uptime,
    jobs: jobStats,
  };
}

/**
 * Restart a specific job
 * 
 * @param db - Database connection
 * @param jobName - Name of job to restart
 * @returns Success status and message
 */
export function restartJob(
  jobName: string
): { success: boolean; message: string } {
  try {
    const jobConfig = JOBS.find((j) => j.name === jobName);
    if (!jobConfig) {
      return { success: false, message: `Job '${jobName}' not found` };
    }
    
    // Stop existing job
    const existingInterval = scheduler.jobs.get(jobName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Restart job
    const intervalId = setInterval(() => {
      executeJob(jobConfig);
    }, jobConfig.interval);
    
    scheduler.jobs.set(jobName, intervalId);
    
    // Reset stats
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
