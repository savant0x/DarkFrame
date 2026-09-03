/**
 * Admin System Reset Endpoint
 * Created: 2025-01-18
 * 
 * OVERVIEW:
 * ⚠️ DANGEROUS OPERATIONS ⚠️
 * 
 * Executes system-wide reset operations. All actions are irreversible
 * and permanently delete data. Every operation is logged to adminLogs
 * collection for audit trail.
 * 
 * Endpoint: POST /api/admin/system-reset
 * Auth Required: Admin (FAME account only)
 * 
 * Body:
 * {
 *   action: 'clear-battle-logs' | 'clear-activity-logs' | 'reset-flags' | 'clear-sessions'
 * }
 * 
 * Returns:
 * {
 *   success: boolean,
 *   message: string,
 *   deletedCount: number
 * }
 * 
 * Available Actions:
 * - clear-battle-logs: Delete all battle history
 * - clear-activity-logs: Delete all player activity records
 * - reset-flags: Clear all anti-cheat flags (not bans)
 * - clear-sessions: Delete all player session data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  SystemResetSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.ADMIN_OPERATIONS);

/**
 * POST handler - Execute system reset
 * 
 * ⚠️ DANGEROUS: Admin-only endpoint that performs irreversible data deletion.
 * All actions are logged to adminLogs collection for audit trail.
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminSystemResetAPI');
  const endTimer = log.time('systemReset');

  try {
    // Check admin authentication
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      log.warn('Unauthenticated system reset attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Not authenticated'
      });
    }

    // Check admin access (isAdmin flag required)
    if (user.isAdmin !== true) {
      log.warn('Non-admin system reset attempt', { username: user.username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Access denied - Admin only'
      });
    }

    // Parse and validate request
    const body = await request.json();
    const validated = SystemResetSchema.parse(body);

    log.warn('DANGEROUS: System reset initiated', { 
      action: validated.action, 
      adminUsername: user.username 
    });

    // Get admin logs collection for audit trail
    const adminLogsCollection = await getCollection('adminLogs');

    let deletedCount = 0;
    let message = '';
    let actionType = '';

    // Execute the requested action
    switch (validated.action) {
      case 'clear-battle-logs': {
        const battleLogsCollection = await getCollection('battleLogs');
        const result = await battleLogsCollection.deleteMany({});
        deletedCount = result.deletedCount || 0;
        message = `Deleted ${deletedCount} battle logs`;
        actionType = 'CLEAR_BATTLE_LOGS';
        break;
      }

      case 'clear-activity-logs': {
        const activityCollection = await getCollection('playerActivity');
        const result = await activityCollection.deleteMany({});
        deletedCount = result.deletedCount || 0;
        message = `Deleted ${deletedCount} activity records`;
        actionType = 'CLEAR_ACTIVITY_LOGS';
        break;
      }

      case 'reset-flags': {
        const flagsCollection = await getCollection('playerFlags');
        const result = await flagsCollection.deleteMany({});
        deletedCount = result.deletedCount || 0;
        message = `Cleared ${deletedCount} anti-cheat flags`;
        actionType = 'RESET_ALL_FLAGS';
        break;
      }

      case 'clear-sessions': {
        const sessionsCollection = await getCollection('playerSessions');
        const result = await sessionsCollection.deleteMany({});
        deletedCount = result.deletedCount || 0;
        message = `Deleted ${deletedCount} player sessions`;
        actionType = 'CLEAR_ALL_SESSIONS';
        break;
      }
    }

    // Log the admin action for audit trail
    await adminLogsCollection.insertOne({
      timestamp: new Date(),
      adminUsername: user.username,
      actionType,
      targetUsername: 'SYSTEM',
      details: {
        action: validated.action,
        deletedCount,
        message,
      },
    });

    log.warn('System reset completed', { 
      action: validated.action, 
      deletedCount, 
      actionType,
      adminUsername: user.username 
    });

    return NextResponse.json({
      success: true,
      message,
      deletedCount,
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('System reset validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('System reset failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * 
 * Safety Considerations:
 * - Admin-only access (FAME account verification)
 * - All operations logged to adminLogs for audit trail
 * - No database backup verification (should be added for production)
 * - Irreversible operations - use with extreme caution
 * 
 * Available Actions:
 * 1. clear-battle-logs: Deletes entire battleLogs collection
 * 2. clear-activity-logs: Deletes entire playerActivity collection
 * 3. reset-flags: Deletes entire playerFlags collection (not bans)
 * 4. clear-sessions: Deletes entire playerSessions collection
 * 
 * Admin Logging:
 * - Logs: timestamp, adminUsername, actionType, deletedCount
 * - Provides audit trail for all system modifications
 * - Cannot be undone once logged
 * 
 * Operations NOT Included:
 * These are too dangerous without backup verification:
 * - Reset player progress (players collection modification)
 * - Regenerate map (tiles collection reset)
 * - Reset tech tree (playerTech collection reset)
 * - Delete all factories (factories collection reset)
 * 
 * Future Enhancements:
 * - Database backup verification before execution
 * - Rollback capability with transaction support
 * - Partial deletion (by date range, specific criteria)
 * - Export-before-delete option
 * - Email notifications for destructive operations
 * - Require multiple admin confirmations for critical actions
 * - Rate limiting to prevent accidental rapid deletions
 * 
 * Production Recommendations:
 * 1. Implement automatic backups before any reset
 * 2. Add transaction support for rollback capability
 * 3. Require secondary admin approval for destructive operations
 * 4. Add IP logging for security audit
 * 5. Implement cooldown period between resets
 * 6. Add restore functionality from backups
 */
