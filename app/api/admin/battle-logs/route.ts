/**
 * Admin Battle Logs Endpoint
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
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBattleLogsAPI');
  const endTimer = log.time('battle-logs');

  try {
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    const supabase = createServiceClient();

    const { data: logs, error } = await supabase
      .from('battle_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    const logsData = (logs || []).map((log: Record<string, unknown>) => {
      const timestamp = log.created_at || new Date().toISOString();
      const resourcesTransferred = (log.resources_stolen as Record<string, number>) || {};
      const outcome = log.outcome || 'draw';

      return {
        _id: log.id,
        timestamp,
        attackerUsername: log.attacker_username || 'Unknown',
        defenderUsername: log.defender_username || 'Unknown',
        outcome,
        resourcesTransferred,
        xpGained: 0,
        location: { x: 0, y: 0 },
      };
    });

    log.info('Battle logs retrieved', {
      total: logsData.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      logs: logsData,
      total: logsData.length,
    });
  } catch (error) {
    log.error('Failed to fetch battle logs', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
