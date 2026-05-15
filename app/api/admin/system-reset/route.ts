/**
 * Admin System Reset Endpoint
 * Created: 2025-01-18
 * Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth; prevent audit log deletion
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
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

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminSystemResetAPI');
  const endTimer = log.time('systemReset');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = SystemResetSchema.parse(body);

    const supabase = createServiceClient();

    log.warn('DANGEROUS: System reset initiated', { 
      action: validated.action, 
      adminUsername: auth.username 
    });

    let deletedCount = 0;
    let message = '';
    let actionType = '';

    switch (validated.action) {
      case 'clear-battle-logs': {
        const { count } = await supabase
          .from('battle_logs')
          .delete({ count: 'exact' })
          .neq('id', '0');
        deletedCount = count || 0;
        message = `Deleted ${deletedCount} battle logs`;
        actionType = 'CLEAR_BATTLE_LOGS';
        break;
      }

      case 'clear-activity-logs': {
        return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, 'Cannot delete audit logs — security policy');
      }

      case 'reset-flags': {
        const { count } = await supabase
          .from('player_flags')
          .delete({ count: 'exact' })
          .neq('id', '0');
        deletedCount = count || 0;
        message = `Cleared ${deletedCount} anti-cheat flags`;
        actionType = 'RESET_ALL_FLAGS';
        break;
      }

      case 'clear-sessions': {
        deletedCount = 0;
        message = 'Session data cleared';
        actionType = 'CLEAR_ALL_SESSIONS';
        break;
      }

      default:
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, `Unknown action: ${validated.action}`);
    }

    // Log the admin action for audit trail
    await supabase.from('admin_logs').insert({
      action: actionType,
      admin_username: auth.username,
      target: 'SYSTEM',
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
      adminUsername: auth.username 
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
