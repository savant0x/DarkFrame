/**
 * Admin System Reset Endpoint
 * Created: 2025-01-18
 * Updated: 2026-05-03 — Migrated to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
    const body = await request.json();
    const username = (body as Record<string, unknown>).username as string;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const validated = SystemResetSchema.parse(body);

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      log.warn('Non-admin system reset attempt', { username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Access denied - Admin only'
      });
    }

    log.warn('DANGEROUS: System reset initiated', { 
      action: validated.action, 
      adminUsername: username 
    });

    let deletedCount = 0;
    let message = '';
    let actionType = '';

    switch (validated.action) {
      case 'clear-battle-logs': {
        const { error, count } = await supabase
          .from('battle_logs')
          .delete({ count: 'exact' })
          .neq('id', '0');
        deletedCount = count || 0;
        message = `Deleted ${deletedCount} battle logs`;
        actionType = 'CLEAR_BATTLE_LOGS';
        break;
      }

      case 'clear-activity-logs': {
        const { error, count } = await supabase
          .from('admin_logs')
          .delete({ count: 'exact' })
          .neq('id', '0');
        deletedCount = count || 0;
        message = `Deleted ${deletedCount} activity records`;
        actionType = 'CLEAR_ACTIVITY_LOGS';
        break;
      }

      case 'reset-flags': {
        const { error, count } = await supabase
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
    }

    // Log the admin action for audit trail
    await supabase.from('admin_logs').insert({
      action: actionType,
      admin_username: username,
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
      adminUsername: username 
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
