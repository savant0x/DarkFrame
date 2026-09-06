/**
 * WMD Admin API Routes
 * 
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * RESTful API endpoints for WMD administrative operations.
 * All routes require admin role verification and include comprehensive audit logging.
 * 
 * Endpoints:
 * - GET /api/admin/wmd/status - System health and status overview
 * - POST /api/admin/wmd/vote/:voteId/expire - Force expire a vote
 * - POST /api/admin/wmd/missile/:missileId/disarm - Emergency disarm missile
 * - POST /api/admin/wmd/clan/:clanId/cooldown - Adjust clan cooldown
 * - GET /api/admin/wmd/analytics - Global analytics summary
 * - GET /api/admin/wmd/clan/:clanId/activity - Clan-specific activity
 * - GET /api/admin/wmd/impacts - Missile impact report
 * - GET /api/admin/wmd/voting-patterns - Voting analysis
 * - GET /api/admin/wmd/balance - Balance metrics
 * - POST /api/admin/wmd/flag-activity - Flag suspicious activity
 * 
 * Security:
 * - All routes require authentication (JWT token)
 * - Admin role verification via middleware
 * - Rate limiting on sensitive operations
 * - IP logging for audit trail
 * 
 * Related Files:
 * - lib/wmd/admin/wmdAdminService.ts - Admin operations
 * - lib/wmd/admin/wmdAnalyticsService.ts - Analytics functions
 * - middleware.ts - Auth and role verification
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWMDSystemStatus,
  forceExpireVote,
  emergencyDisarmMissile,
  adjustClanCooldown,
  flagSuspiciousActivity,
} from '@/lib/wmd/admin/wmdAdminService';
import {
  getGlobalWMDStats,
  getClanWMDActivity,
  getMissileImpactReport,
  getVotingPatterns,
  getBalanceMetrics,
} from '@/lib/wmd/admin/wmdAnalyticsService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';

async function verifyAdminAccess(_request: NextRequest): Promise<{
  isAdmin: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  try {
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return { isAdmin: false, error: 'Not authenticated' };
    }

    const playerRecord = await db.select().from(players).where(eq(players.username, user.username)).limit(1);
    
    if (!playerRecord || playerRecord.length === 0) {
      return { isAdmin: false, error: 'User not found in database' };
    }
    
    const player = playerRecord[0];
    
    const isAdmin = player.isAdmin === 1 || 
                    player.rank || 1 >= 5 ||
                    (player.email && process.env.ADMIN_EMAILS?.split(',').includes(player.email));
    
    if (!isAdmin) {
      return { isAdmin: false, error: 'Insufficient permissions - admin role required' };
    }
    
    return {
      isAdmin: true,
      userId: player.username,
      username: player.username || player.email || 'Admin'
    };
  } catch (error) {
    console.error('Error verifying admin access:', error);
    return { isAdmin: false, error: 'Authentication verification failed' };
  }
}

function parseDateRange(request: NextRequest): { start: Date; end: Date } {
  const searchParams = request.nextUrl.searchParams;
  
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const rangeParam = searchParams.get('range');

  let start: Date;
  let end: Date = new Date();

  if (startParam && endParam) {
    start = new Date(startParam);
    end = new Date(endParam);
  } else if (rangeParam) {
    const days = parseInt(rangeParam.replace('d', ''));
    start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  } else {
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin-wmd-get');
  const endTimer = log.time('admin-wmd-get');

  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, auth.error || 'Admin access required');
    }

    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    switch (action) {
      case 'analytics': {
        const { start, end } = parseDateRange(request);
        const analytics = await getGlobalWMDStats(start, end);
        // FID-20260906-003 S2: adapt to the admin UI's contract (AdminView.tsx
        // reads missiles.hit/successRate/avgDamage, votes.approvalRate as a 0..1
        // fraction). Service fields are kept (additive) so modals don't regress.
        const missileTotal = analytics.missiles?.total ?? 0;
        const impacted = analytics.missiles?.impacted ?? 0;
        const adaptedAnalytics = {
          ...analytics,
          missiles: {
            ...analytics.missiles,
            hit: impacted,
            successRate: missileTotal > 0 ? impacted / missileTotal : 0,
            avgDamage: impacted > 0 ? (analytics.missiles.totalDamage ?? 0) / impacted : 0,
          },
          votes: {
            ...analytics.votes,
            approvalRate: (analytics.votes.avgApprovalRate ?? 0) / 100,
          },
        };
        log.info('WMD analytics retrieved', { action, startDate: start, endDate: end });
        return NextResponse.json({ success: true, data: adaptedAnalytics });
      }

      case 'impacts': {
        const { start, end } = parseDateRange(request);
        const impacts = await getMissileImpactReport(start, end);
        log.info('WMD impacts retrieved', { action, startDate: start, endDate: end });
        return NextResponse.json({ success: true, data: impacts });
      }

      case 'voting-patterns': {
        const { start, end } = parseDateRange(request);
        const patterns = await getVotingPatterns(start, end);
        log.info('WMD voting patterns retrieved', { action, startDate: start, endDate: end });
        return NextResponse.json({ success: true, data: patterns });
      }

      case 'balance': {
        const { start, end } = parseDateRange(request);
        const balance = await getBalanceMetrics(start, end);
        log.info('WMD balance metrics retrieved', { action, startDate: start, endDate: end });
        return NextResponse.json({ success: true, data: balance });
      }

      case 'clan-activity': {
        const clanId = searchParams.get('clanId');
        if (!clanId) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'clanId parameter required');
        }
        const { start, end } = parseDateRange(request);
        const activity = await getClanWMDActivity(clanId, start, end);
        log.info('WMD clan activity retrieved', { action, clanId, startDate: start, endDate: end });
        return NextResponse.json({ success: true, data: activity });
      }

      default: {
        const status = await getWMDSystemStatus();
        // FID-20260906-003 S2: adapt to the admin UI's contract (AdminView.tsx
        // reads activeOperations{missiles,votes}, jobs.scheduled, alerts[]).
        // Previously zero key overlap → the tab rendered 0 everywhere.
        const adaptedStatus = {
          ...status,
          activeOperations: {
            missiles: status.activeMissiles,
            votes: status.activeVotes,
          },
          jobs: {
            ...status.scheduler,
            scheduled: Object.values(status.scheduler.jobs).filter((j) => j.running).length,
          },
          alerts: status.recentAlerts.map((a) => ({
            type: a.type,
            message: a.message,
            severity: a.severity,
            acknowledged: a.acknowledged,
            createdAt: a.timestamp,
          })),
        };
        log.info('WMD system status retrieved', { action: 'status' });
        return NextResponse.json({ success: true, data: adaptedStatus });
      }
    }
  } catch (error) {
    log.error('WMD admin GET error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin-wmd-post');
  const endTimer = log.time('admin-wmd-post');

  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, auth.error || 'Admin access required');
    }

    const adminId = auth.userId || 'UNKNOWN_ADMIN';
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Action parameter required');
    }

    switch (action) {
      case 'expire-vote': {
        const { voteId, reason } = body;
        if (!voteId || !reason) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'voteId and reason required');
        }

        const result = await forceExpireVote(voteId, adminId, reason);
        log.info('WMD vote expired by admin', { action, voteId, adminId, success: result.success });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      case 'disarm-missile': {
        const { missileId, reason } = body;
        if (!missileId || !reason) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'missileId and reason required');
        }

        const result = await emergencyDisarmMissile(missileId, adminId, reason);
        log.info('WMD missile disarmed by admin', { action, missileId, adminId, success: result.success });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      case 'adjust-cooldown': {
        const { clanId, adjustmentHours, reason } = body;
        if (!clanId || adjustmentHours === undefined || !reason) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'clanId, adjustmentHours, and reason required');
        }

        const result = await adjustClanCooldown(clanId, adjustmentHours, adminId, reason);
        log.info('WMD clan cooldown adjusted by admin', { action, clanId, adjustmentHours, adminId, success: result.success });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      case 'flag-activity': {
        const { playerId, clanId, activityType, details, evidence, severity } = body;
        if (!playerId || !clanId || !activityType || !details) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'playerId, clanId, activityType, and details required');
        }

        const result = await flagSuspiciousActivity({
          playerId,
          clanId,
          activityType,
          details,
          evidence: evidence || {},
          severity: severity || 'MEDIUM',
        });

        log.info('WMD suspicious activity flagged by admin', { action, playerId, clanId, activityType, severity, adminId, success: result.success });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      default:
        log.warn('Unknown WMD admin action', { action });
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, `Unknown action: ${action}`);
    }
  } catch (error) {
    log.error('WMD admin POST error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
