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
import { db } from '@/lib/db';
import { battleLogs, playerActivity, playerFlags, playerSessions, modLog } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
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

/** Per-action drizzle delete target (FID-20260906-003 S6: pg-native rewrite). */
const RESET_TARGETS = {
  'clear-battle-logs': { table: battleLogs, idColumn: battleLogs.battleId, actionType: 'CLEAR_BATTLE_LOGS', noun: 'battle logs' },
  'clear-activity-logs': { table: playerActivity, idColumn: playerActivity.id, actionType: 'CLEAR_ACTIVITY_LOGS', noun: 'activity records' },
  'reset-flags': { table: playerFlags, idColumn: playerFlags.id, actionType: 'RESET_ALL_FLAGS', noun: 'anti-cheat flags' },
  'clear-sessions': { table: playerSessions, idColumn: playerSessions.id, actionType: 'CLEAR_ALL_SESSIONS', noun: 'player sessions' },
} as const;

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

    // FID-20260906-003 S6: pg-native rewrite. The Mongo-era version deleted
    // from shim collections (phantom on Postgres — every action deleted
    // NOTHING and reported success) and audited to a phantom adminLogs
    // collection. Drizzle delete + mod_log row now; deletedCount is real.
    const target = RESET_TARGETS[validated.action];
    const deletedRows = await db.delete(target.table).returning({ id: target.idColumn });
    const deletedCount = deletedRows.length;
    const message = `Deleted ${deletedCount} ${target.noun}`;
    const actionType = target.actionType;

    // Audit trail (mod_log — the same table anti-cheat/ban writes).
    await db.insert(modLog).values({
      id: generateId().slice(0, 24),
      moderatorId: user.username.slice(0, 20),
      action: actionType,
      targetId: 'SYSTEM',
      details: JSON.stringify({
        requestedAction: validated.action,
        deletedCount,
        message,
      }),
      createdAt: new Date(),
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
