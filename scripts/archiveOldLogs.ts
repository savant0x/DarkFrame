#!/usr/bin/env ts-node
/**
 * Archive Old Logs Script
 * Created: 2025-10-18 09:25
 * Rewritten: 2026-09-19 (shim-exit commit 2 of 3: lib/mongodb → drizzle/pg)
 *
 * OVERVIEW:
 * Background job script for automated log cleanup and archival.
 * Designed to run as a scheduled task (cron job, Windows Task Scheduler, or CI/CD pipeline).
 * Enforces retention policies: 90 days activity logs, 180 days battle logs.
 *
 * USAGE:
 * - Node.js: node --loader ts-node/esm scripts/archiveOldLogs.ts
 * - ts-node: ts-node scripts/archiveOldLogs.ts
 * - npm script: npm run archive:logs
 *
 * SCHEDULE RECOMMENDATIONS:
 * - Daily: 2:00 AM server time (low traffic period)
 * - Weekly: Sunday 3:00 AM for deeper cleanup
 * - Monthly: 1st of month for archival and reporting
 *
 * ENVIRONMENT VARIABLES:
 * - ACTIVITY_RETENTION_DAYS: Override default 90 days
 * - BATTLE_RETENTION_DAYS: Override default 180 days
 * - DRY_RUN: Set to "true" to preview without deleting
 * - ARCHIVE_TO_FILE: Set to "true" to export before deletion
 * - ARCHIVE_PATH: Directory path for archived log exports
 *
 * DEPENDENCIES:
 * - lib/activityLogService: Activity log cleanup
 * - lib/db/connection: PostgreSQL (drizzle) connection
 *
 * NOTE: The Mongo era split activity retention into an extended admin tier
 * (ADMIN_RETENTION_DAYS). player_activity carries no category column in pg —
 * the live service's cleanupOldLogs deletes past the activity window
 * regardless — so this script mirrors that single-window semantic.
 */

import { cleanupOldLogs } from '../lib/activityLogService';
import { connectToDatabase } from '@/lib/db/connection';
import { battleLogs, playerActivity } from '@/lib/db/schema';
import { lt, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ArchiveConfig {
  activityRetentionDays: number;
  battleRetentionDays: number;
  dryRun: boolean;
  archiveToFile: boolean;
  archivePath: string;
}

/**
 * Load configuration from environment variables with defaults
 */
function loadConfig(): ArchiveConfig {
  return {
    activityRetentionDays: parseInt(process.env.ACTIVITY_RETENTION_DAYS || '90'),
    battleRetentionDays: parseInt(process.env.BATTLE_RETENTION_DAYS || '180'),
    dryRun: process.env.DRY_RUN === 'true',
    archiveToFile: process.env.ARCHIVE_TO_FILE === 'true',
    archivePath: process.env.ARCHIVE_PATH || './archives',
  };
}

// ============================================================================
// ARCHIVAL FUNCTIONS
// ============================================================================

/**
 * Archive activity logs to JSON file before deletion
 *
 * @param retentionDays - Days to retain logs
 * @param archivePath - Directory to save archived files
 * @returns Promise resolving to count of archived logs
 */
async function archiveActivityLogsToFile(
  retentionDays: number,
  archivePath: string
): Promise<number> {
  const db = await connectToDatabase();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const logsToArchive = await db
    .select()
    .from(playerActivity)
    .where(lt(playerActivity.timestamp, cutoffDate));

  if (logsToArchive.length === 0) {
    console.log('[Archive] No activity logs to archive');
    return 0;
  }

  // Ensure archive directory exists
  if (!fs.existsSync(archivePath)) {
    fs.mkdirSync(archivePath, { recursive: true });
  }

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `activity-logs-${timestamp}.json`;
  const filepath = path.join(archivePath, filename);

  // Write logs to file
  fs.writeFileSync(filepath, JSON.stringify(logsToArchive, null, 2), 'utf-8');

  console.log(`[Archive] Archived ${logsToArchive.length} activity logs to ${filepath}`);
  return logsToArchive.length;
}

/**
 * Archive battle logs to JSON file before deletion
 *
 * @param retentionDays - Days to retain battle logs
 * @param archivePath - Directory to save archived files
 * @returns Promise resolving to count of archived battle logs
 */
async function archiveBattleLogsToFile(
  retentionDays: number,
  archivePath: string
): Promise<number> {
  const db = await connectToDatabase();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const logsToArchive = await db
    .select()
    .from(battleLogs)
    .where(lt(battleLogs.timestamp, cutoffDate));

  if (logsToArchive.length === 0) {
    console.log('[Archive] No battle logs to archive');
    return 0;
  }

  // Ensure archive directory exists
  if (!fs.existsSync(archivePath)) {
    fs.mkdirSync(archivePath, { recursive: true });
  }

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `battle-logs-${timestamp}.json`;
  const filepath = path.join(archivePath, filename);

  // Write logs to file
  fs.writeFileSync(filepath, JSON.stringify(logsToArchive, null, 2), 'utf-8');

  console.log(`[Archive] Archived ${logsToArchive.length} battle logs to ${filepath}`);
  return logsToArchive.length;
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Clean up old battle logs
 *
 * @param battleRetentionDays - Days to retain battle logs
 * @returns Promise resolving to count of deleted battle logs
 */
async function cleanupOldBattleLogs(battleRetentionDays: number): Promise<number> {
  const db = await connectToDatabase();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - battleRetentionDays);

  const result = await db
    .delete(battleLogs)
    .where(lt(battleLogs.timestamp, cutoffDate));

  console.log(
    `[Cleanup] Deleted ${result.rowCount ?? 0} battle logs older than ${battleRetentionDays} days`
  );

  return result.rowCount ?? 0;
}

/**
 * Count old logs that would be deleted (dry run)
 *
 * @param config - Archive configuration
 * @returns Promise resolving to counts of logs to delete
 */
async function previewCleanup(config: ArchiveConfig): Promise<{
  activityLogs: number;
  battleLogs: number;
  total: number;
}> {
  const db = await connectToDatabase();

  const activityCutoffDate = new Date();
  activityCutoffDate.setDate(activityCutoffDate.getDate() - config.activityRetentionDays);

  const battleCutoffDate = new Date();
  battleCutoffDate.setDate(battleCutoffDate.getDate() - config.battleRetentionDays);

  const [activityCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(playerActivity)
    .where(lt(playerActivity.timestamp, activityCutoffDate));

  const [battleCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(battleLogs)
    .where(lt(battleLogs.timestamp, battleCutoffDate));

  return {
    activityLogs: activityCount?.n ?? 0,
    battleLogs: battleCount?.n ?? 0,
    total: (activityCount?.n ?? 0) + (battleCount?.n ?? 0),
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main script execution
 */
async function main() {
  console.log('========================================');
  console.log('DarkFrame Log Archive & Cleanup Script');
  console.log('========================================');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const config = loadConfig();

  // Display configuration
  console.log('Configuration:');
  console.log(`- Activity Retention: ${config.activityRetentionDays} days`);
  console.log(`- Battle Retention: ${config.battleRetentionDays} days`);
  console.log(`- Dry Run: ${config.dryRun ? 'YES (no deletion)' : 'NO (will delete)'}`);
  console.log(`- Archive to File: ${config.archiveToFile ? 'YES' : 'NO'}`);
  if (config.archiveToFile) {
    console.log(`- Archive Path: ${config.archivePath}`);
  }
  console.log('');

  try {
    // Preview cleanup
    console.log('Analyzing logs...');
    const preview = await previewCleanup(config);
    console.log(`Found ${preview.activityLogs} activity logs to cleanup`);
    console.log(`Found ${preview.battleLogs} battle logs to cleanup`);
    console.log(`Total: ${preview.total} logs\n`);

    if (preview.total === 0) {
      console.log('✓ No logs require cleanup. Exiting.');
      process.exit(0);
    }

    // Exit if dry run
    if (config.dryRun) {
      console.log('✓ DRY RUN COMPLETE - No logs were deleted.');
      console.log('Set DRY_RUN=false to execute cleanup.');
      process.exit(0);
    }

    // Archive logs if enabled
    if (config.archiveToFile) {
      console.log('Archiving logs to files...');
      const activityArchived = await archiveActivityLogsToFile(
        config.activityRetentionDays,
        config.archivePath
      );
      const battleArchived = await archiveBattleLogsToFile(
        config.battleRetentionDays,
        config.archivePath
      );
      console.log(`✓ Archived ${activityArchived + battleArchived} logs\n`);
    }

    // Execute cleanup
    console.log('Executing cleanup...');
    const activityDeleted = await cleanupOldLogs({
      activityLogDays: config.activityRetentionDays,
      battleLogDays: config.battleRetentionDays,
      adminLogDays: 365,
      archiveEnabled: config.archiveToFile,
    });
    const battleDeleted = await cleanupOldBattleLogs(config.battleRetentionDays);

    console.log(`\n✓ CLEANUP COMPLETE`);
    console.log(`- Activity logs deleted: ${activityDeleted}`);
    console.log(`- Battle logs deleted: ${battleDeleted}`);
    console.log(`- Total deleted: ${activityDeleted + battleDeleted}`);

    console.log(`\nFinished at: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (error) {
    console.error('\n✗ CLEANUP FAILED');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error);
    process.exit(1);
  }
}

// Execute main function
main();

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Scheduling Recommendations:
 *    - Linux/Mac (cron): 0 2 * * * cd /path/to/darkframe && npm run archive:logs
 *    - Windows (Task Scheduler): Create task to run daily at 2 AM
 *    - Docker: Use cron container or scheduled jobs
 *    - Kubernetes: Use CronJob resource
 *
 * 2. npm Script Setup (package.json):
 *    "scripts": {
 *      "archive:logs": "ts-node scripts/archiveOldLogs.ts",
 *      "archive:logs:dry-run": "DRY_RUN=true ts-node scripts/archiveOldLogs.ts",
 *      "archive:logs:export": "ARCHIVE_TO_FILE=true ts-node scripts/archiveOldLogs.ts"
 *    }
 *
 * 3. Monitoring Integration:
 *    - Add health check ping after successful cleanup
 *    - Send email/Slack notification on failures
 *    - Log cleanup metrics to monitoring dashboard
 *
 * 4. Archive File Management:
 *    - Compress archives to .tar.gz or .zip to save space
 *    - Upload to cloud storage (S3, Azure Blob, GCS)
 *    - Implement archive file retention (e.g., delete archives > 2 years old)
 *
 * 5. Performance Optimization:
 *    - Run during off-peak hours (2-4 AM)
 *    - Implement progressive cleanup (e.g., 1000 logs per batch)
 *
 * 6. Error Handling:
 *    - Retry logic for transient database errors
 *    - Partial success tracking (archive succeeded, cleanup failed)
 *
 * 7. Compliance Considerations:
 *    - Document retention policy in privacy policy
 *    - Provide mechanism for data export requests (GDPR)
 *    - Log all cleanup operations for audit trail
 */
