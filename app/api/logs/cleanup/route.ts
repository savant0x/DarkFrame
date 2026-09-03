/**
 * Log Cleanup API Route
 * Created: 2025-10-18 09:20
 * 
 * OVERVIEW:
 * Administrative endpoint for manually triggering log cleanup and archival.
 * Enforces retention policies: 90 days for activity logs, 180 days for battle logs,
 * 365 days for admin action logs. Only accessible by administrators.
 * 
 * ENDPOINTS:
 * - POST /api/logs/cleanup - Trigger manual cleanup of old logs
 * 
 * QUERY PARAMETERS:
 * - dryRun: "true" | "false" (default: false) - Preview deletions without executing
 * - type: "activity" | "battle" | "all" (default: "all") - Which logs to clean
 * 
 * REQUEST BODY (optional):
 * {
 *   activityRetentionDays?: number (default: 90),
 *   battleRetentionDays?: number (default: 180),
 *   adminRetentionDays?: number (default: 365)
 * }
 * 
 * DEPENDENCIES:
 * - lib/activityLogService: Activity log cleanup
 * - lib/battleLogService: Battle log cleanup (TBD)
 * - lib/authService: Admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/authService';
import { cleanupOldLogs } from '@/lib/activityLogService';
import clientPromise from '@/lib/mongodb';
import { BattleLog } from '@/types/activityLog.types';

/**
 * POST /api/logs/cleanup
 * 
 * Manually trigger cleanup of old activity and battle logs based on retention policies.
 * Requires administrator authentication. Supports dry-run mode for preview.
 * 
 * @param req - Next.js request object
 * @returns Cleanup statistics (deleted counts, errors)
 * 
 * @example
 * POST /api/logs/cleanup?dryRun=true
 * Response: {
 *   dryRun: true,
 *   activityLogsToDelete: 1250,
 *   battleLogsToDelete: 380,
 *   totalToDelete: 1630,
 *   retentionPolicies: { activity: 90, battle: 180, admin: 365 }
 * }
 * 
 * @example
 * POST /api/logs/cleanup
 * Body: { activityRetentionDays: 60 }
 * Response: {
 *   dryRun: false,
 *   activityLogsDeleted: 1250,
 *   battleLogsDeleted: 380,
 *   totalDeleted: 1630,
 *   errors: []
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Extract and verify authentication token
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Authorization: Only administrators can trigger cleanup
    // TODO: Implement proper admin role check from user profile/database
    const isAdmin = false; // Placeholder - implement admin check
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') === 'true';
    const cleanupType = searchParams.get('type') || 'all'; // "activity" | "battle" | "all"

    // Validate cleanup type
    if (!['activity', 'battle', 'all'].includes(cleanupType)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "activity", "battle", or "all".' },
        { status: 400 }
      );
    }

    // Parse request body for custom retention days
    const body = await req.json().catch(() => ({}));
    const activityRetentionDays = body.activityRetentionDays || 90;
    const battleRetentionDays = body.battleRetentionDays || 180;
    const adminRetentionDays = body.adminRetentionDays || 365;

    // Validate retention periods (minimum 1 day, maximum 3650 days / ~10 years)
    if (
      activityRetentionDays < 1 || activityRetentionDays > 3650 ||
      battleRetentionDays < 1 || battleRetentionDays > 3650 ||
      adminRetentionDays < 1 || adminRetentionDays > 3650
    ) {
      return NextResponse.json(
        { error: 'Retention days must be between 1 and 3650' },
        { status: 400 }
      );
    }

    const results: {
      dryRun: boolean;
      activityLogsDeleted?: number;
      activityLogsToDelete?: number;
      battleLogsDeleted?: number;
      battleLogsToDelete?: number;
      totalDeleted?: number;
      totalToDelete?: number;
      retentionPolicies: {
        activity: number;
        battle: number;
        admin: number;
      };
      errors: string[];
    } = {
      dryRun,
      retentionPolicies: {
        activity: activityRetentionDays,
        battle: battleRetentionDays,
        admin: adminRetentionDays,
      },
      errors: [],
    };

    // Clean up activity logs
    if (cleanupType === 'activity' || cleanupType === 'all') {
      try {
        if (dryRun) {
          // Count logs that would be deleted
          const activityCount = await countOldActivityLogs(
            activityRetentionDays,
            adminRetentionDays
          );
          results.activityLogsToDelete = activityCount;
        } else {
          // Execute cleanup with custom retention policy
          const deletedCount = await cleanupOldLogs({
            activityLogDays: activityRetentionDays,
            battleLogDays: battleRetentionDays,
            adminLogDays: adminRetentionDays,
            archiveEnabled: false
          });
          results.activityLogsDeleted = deletedCount;
        }
      } catch (error) {
        results.errors.push(
          `Activity log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Clean up battle logs
    if (cleanupType === 'battle' || cleanupType === 'all') {
      try {
        if (dryRun) {
          // Count battle logs that would be deleted
          const battleCount = await countOldBattleLogs(battleRetentionDays);
          results.battleLogsToDelete = battleCount;
        } else {
          // Execute battle log cleanup
          const deletedCount = await cleanupOldBattleLogs(battleRetentionDays);
          results.battleLogsDeleted = deletedCount;
        }
      } catch (error) {
        results.errors.push(
          `Battle log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Calculate totals
    if (dryRun) {
      results.totalToDelete =
        (results.activityLogsToDelete || 0) + (results.battleLogsToDelete || 0);
    } else {
      results.totalDeleted =
        (results.activityLogsDeleted || 0) + (results.battleLogsDeleted || 0);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('Error during log cleanup:', error);
    return NextResponse.json(
      {
        error: 'Log cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Count old activity logs that would be deleted
 * 
 * @param activityRetentionDays - Days to retain regular activity logs
 * @param adminRetentionDays - Days to retain admin action logs
 * @returns Promise resolving to count of logs to delete
 */
async function countOldActivityLogs(
  activityRetentionDays: number,
  adminRetentionDays: number
): Promise<number> {
  const client = await clientPromise;
  const db = client.db();
  const collection = db.collection('ActionLog');

  const activityCutoffDate = new Date();
  activityCutoffDate.setDate(activityCutoffDate.getDate() - activityRetentionDays);

  const adminCutoffDate = new Date();
  adminCutoffDate.setDate(adminCutoffDate.getDate() - adminRetentionDays);

  const count = await collection.countDocuments({
    $or: [
      {
        timestamp: { $lt: activityCutoffDate },
        category: { $ne: 'ADMIN' },
      },
      {
        timestamp: { $lt: adminCutoffDate },
        category: 'ADMIN',
      },
    ],
  });

  return count;
}

/**
 * Count old battle logs that would be deleted
 * 
 * @param battleRetentionDays - Days to retain battle logs
 * @returns Promise resolving to count of battle logs to delete
 */
async function countOldBattleLogs(battleRetentionDays: number): Promise<number> {
  const client = await clientPromise;
  const db = client.db();
  const collection = db.collection<BattleLog>('BattleLog');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - battleRetentionDays);

  const count = await collection.countDocuments({
    timestamp: { $lt: cutoffDate },
  });

  return count;
}

/**
 * Clean up old battle logs
 * 
 * @param battleRetentionDays - Days to retain battle logs
 * @returns Promise resolving to count of deleted battle logs
 */
async function cleanupOldBattleLogs(battleRetentionDays: number): Promise<number> {
  const client = await clientPromise;
  const db = client.db();
  const collection = db.collection<BattleLog>('BattleLog');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - battleRetentionDays);

  const result = await collection.deleteMany({
    timestamp: { $lt: cutoffDate },
  });

  console.log(`[BattleLog Cleanup] Deleted ${result.deletedCount} battle logs older than ${battleRetentionDays} days`);

  return result.deletedCount || 0;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Retention Policy Defaults:
 *    - Activity logs: 90 days (standard player actions)
 *    - Battle logs: 180 days (combat history, longer for analytics)
 *    - Admin logs: 365 days (compliance and audit trail)
 *    - All configurable via request body parameters
 * 
 * 2. Dry Run Mode:
 *    - dryRun=true counts logs without deletion
 *    - Useful for administrators to preview impact
 *    - Returns activityLogsToDelete, battleLogsToDelete
 * 
 * 3. Authorization Strategy:
 *    - Requires valid authentication token
 *    - TODO: Implement admin role check from user database
 *    - Returns 403 Forbidden for non-admin users
 * 
 * 4. Cleanup Strategy:
 *    - Separate retention for activity vs battle logs
 *    - Admin action logs retained longer for compliance
 *    - Deletion uses MongoDB deleteMany for efficiency
 *    - Returns detailed statistics per log type
 * 
 * 5. Error Handling:
 *    - Independent cleanup operations (activity/battle)
 *    - Partial success possible (one fails, other succeeds)
 *    - Errors array includes specific failure messages
 *    - Total counts include successful operations only
 * 
 * 6. Performance Considerations:
 *    - Use MongoDB indexes on timestamp field
 *    - Consider batching for very large deletions (>100k logs)
 *    - Run during off-peak hours for production
 *    - Monitor database performance during cleanup
 * 
 * 7. Future Enhancements:
 *    - Archive logs to cold storage (S3, Azure Blob) before deletion
 *    - Add scheduled cleanup via cron job (scripts/archiveOldLogs.ts)
 *    - Export deleted logs to CSV/JSON for compliance
 *    - Add cleanup history tracking (who triggered, when, results)
 *    - Implement progressive deletion for large datasets
 *    - Add webhook notifications for cleanup completion
 */
