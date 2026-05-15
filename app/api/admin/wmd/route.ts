/**
 * WMD Admin API Routes
 * 
 * Created: 2025-10-22
 * Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth for both GET and POST
 * 
 * OVERVIEW:
 * RESTful API endpoints for WMD administrative operations.
 * All routes require admin role verification and include comprehensive audit logging.
 * 
 * Endpoints:
 * - GET /api/admin/wmd?action=status — System health and status overview
 * - GET /api/admin/wmd?action=analytics — Global analytics summary
 * - GET /api/admin/wmd?action=impacts — Missile impact report
 * - GET /api/admin/wmd?action=balance — Balance metrics
 * - GET /api/admin/wmd?action=voting-patterns — Voting analysis
 * - GET /api/admin/wmd?action=clan-activity — Clan-specific activity
 * - POST /api/admin/wmd — expire-vote / disarm-missile / adjust-cooldown / flag-activity
 * 
 * Security:
 * - All routes require authentication (JWT token)
 * - Admin role verification via middleware
 * - Rate limiting on sensitive operations
 */

import { requireAdminAuth } from '@/lib/authMiddleware';
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
import { getWMDSystemStatus, forceExpireVote, emergencyDisarmMissile, adjustClanCooldown, flagSuspiciousActivity } from '@/lib/wmd/admin/wmdAdminService';
import { getGlobalWMDStats, getBalanceMetrics, getMissileImpactReport, getVotingPatterns } from '@/lib/wmd/admin/wmdAnalyticsService';

// ============================================================================
// MIDDLEWARE & HELPERS
// ============================================================================

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

// ============================================================================
// GET ROUTES
// ============================================================================

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin-wmd-get');
  const endTimer = log.time('admin-wmd-get');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const supabase = createServiceClient();
    const action = searchParams.get('action');

    switch (action) {
      case 'status': {
        const status = await getWMDSystemStatus();
        const scheduledJobCount = [
          status.scheduler.jobs.missileTracker.running,
          status.scheduler.jobs.spyMissionCompleter.running,
          status.scheduler.jobs.voteExpirationCleaner.running,
          status.scheduler.jobs.defenseRepairCompleter.running,
        ].filter(Boolean).length;

        return NextResponse.json({
          success: true,
          data: {
            activeOperations: {
              missiles: status.activeMissiles,
              votes: status.activeVotes,
            },
            jobs: {
              scheduled: scheduledJobCount,
            },
            alerts: status.recentAlerts.map(a => ({
              type: a.type,
              severity: a.severity,
              message: a.message,
              playerId: a.details?.player_id || null,
              clanId: a.details?.clan_id || null,
              createdAt: a.timestamp,
            })),
          },
        });
      }

      case 'analytics': {
        const range = searchParams.get('range') || '7d';
        const days = parseInt(range.replace('d', '')) || 7;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const endDate = now.toISOString();

        const [stats, balance] = await Promise.all([
          getGlobalWMDStats(supabase, startDate, endDate),
          getBalanceMetrics(supabase, startDate, endDate),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            missiles: {
              total: stats.missiles.total,
              intercepted: stats.missiles.intercepted,
              hit: stats.missiles.impacted,
              successRate: stats.missiles.total > 0 ? stats.missiles.impacted / stats.missiles.total : 0,
              avgDamage: stats.missiles.total > 0 ? stats.missiles.totalDamage / stats.missiles.total : 0,
            },
            votes: {
              total: stats.votes.total,
              passed: stats.votes.passed,
              failed: stats.votes.failed,
              approvalRate: stats.votes.total > 0 ? stats.votes.passed / stats.votes.total : 0,
            },
            defense: {
              researchAttempts: stats.defense.batteriesBuilt,
              researchSuccesses: stats.defense.batteriesOperational,
              activeSpyOps: stats.spyOps.missionsCompleted,
            },
            economy: {
              totalSpent: stats.economy.totalResourcesSpent,
              avgCost: stats.economy.avgCostPerMissile,
              uniqueClans: balance.activityDistribution.activeClans,
            },
            balance: {
              warnings: balance.warnings,
            },
          },
        });
      }

      case 'impacts': {
        const range = searchParams.get('range') || '7d';
        const days = parseInt(range.replace('d', '')) || 7;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const endDate = now.toISOString();
        const report = await getMissileImpactReport(supabase, startDate, endDate);
        return NextResponse.json({ success: true, data: report });
      }

      case 'balance': {
        const range = searchParams.get('range') || '7d';
        const days = parseInt(range.replace('d', '')) || 7;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const endDate = now.toISOString();
        const balance = await getBalanceMetrics(supabase, startDate, endDate);
        return NextResponse.json({ success: true, data: balance });
      }

      case 'voting-patterns': {
        const range = searchParams.get('range') || '7d';
        const days = parseInt(range.replace('d', '')) || 7;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const endDate = now.toISOString();
        const patterns = await getVotingPatterns(supabase, startDate, endDate);
        return NextResponse.json({ success: true, data: patterns });
      }

      case 'clan-activity': {
        const clanId = searchParams.get('clanId');
        if (!clanId) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'clanId parameter required');
        const { data: notifications } = await supabase
          .from('wmd_notifications')
          .select('*')
          .eq('player_id', clanId)
          .limit(50);
        return NextResponse.json({ success: true, data: notifications || [] });
      }

      default: {
        const status = await getWMDSystemStatus();
        const scheduledJobCount = [
          status.scheduler.jobs.missileTracker.running,
          status.scheduler.jobs.spyMissionCompleter.running,
          status.scheduler.jobs.voteExpirationCleaner.running,
          status.scheduler.jobs.defenseRepairCompleter.running,
        ].filter(Boolean).length;

        return NextResponse.json({
          success: true,
          data: {
            activeOperations: {
              missiles: status.activeMissiles,
              votes: status.activeVotes,
            },
            jobs: {
              scheduled: scheduledJobCount,
            },
            alerts: status.recentAlerts.map(a => ({
              type: a.type,
              severity: a.severity,
              message: a.message,
              playerId: a.details?.player_id || null,
              clanId: a.details?.clan_id || null,
              createdAt: a.timestamp,
            })),
          },
        });
      }
    }
  } catch (error) {
    log.error('WMD admin GET error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// POST ROUTES
// ============================================================================

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin-wmd-post');
  const endTimer = log.time('admin-wmd-post');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action } = body;

    const supabase = createServiceClient();
    const adminId = auth.username;

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
        if (!result.success) {
          return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: result.message });
        }

        log.info('WMD vote expired', { action, voteId, adminId });
        return NextResponse.json({ success: true, data: { message: result.message } }, { status: 200 });
      }

      case 'disarm-missile': {
        const { missileId, reason } = body;
        if (!missileId || !reason) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'missileId and reason required');
        }

        const result = await emergencyDisarmMissile(missileId, adminId, reason);
        if (!result.success) {
          return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: result.message });
        }

        log.info('WMD missile disarmed', { action, missileId, adminId });
        return NextResponse.json({
          success: true,
          data: { message: result.message, refunded: result.refunded },
        }, { status: 200 });
      }

      case 'adjust-cooldown': {
        const { clanId, adjustmentHours, reason } = body;
        if (!clanId || adjustmentHours === undefined || !reason) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'clanId, adjustmentHours, and reason required');
        }

        const result = await adjustClanCooldown(clanId, adjustmentHours, adminId, reason);
        if (!result.success) {
          return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: result.message });
        }

        log.info('WMD cooldown adjusted', { action, clanId, adjustmentHours, adminId });
        return NextResponse.json({
          success: true,
          data: { message: result.message, newCooldownExpiry: result.newCooldownUntil },
        }, { status: 200 });
      }

      case 'flag-activity': {
        const { playerId, clanId, activityType, details, evidence, severity } = body;
        if (!playerId || !clanId || !activityType || !details) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'playerId, clanId, activityType, and details required');
        }

        const result = await flagSuspiciousActivity({
          player_id: playerId,
          clan_id: clanId,
          activity_type: activityType,
          details,
          evidence: evidence || {},
          severity: severity || 'MEDIUM',
        });

        log.info('WMD activity flagged', { action, playerId, clanId, activityType, adminId });
        return NextResponse.json({
          success: true,
          data: { message: 'Activity flagged successfully', alertId: result.alert_id },
        }, { status: 200 });
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
