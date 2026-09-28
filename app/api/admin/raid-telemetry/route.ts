/**
 * @file app/api/admin/raid-telemetry/route.ts
 * @created 2026-09-28 (FID-20260928-008)
 * @overview Admin raid telemetry — the aggregates feeding the tuning loop for
 * docs/design/PVP_BASE_RAID_DESIGN.md's balancing constants:
 *   - outcome / loot / casualty aggregates over battle_logs (BASE_RAID rows)
 *   - hostility-refusal counts per attacker→defender pair (player_activity)
 * GET params: windowHours (1..2160, default 168), limit (1..200, default 50).
 * Admin-gated (tokenPayload.isAdmin — the admin-route pattern). Both readers
 * are best-effort: a telemetry read failure returns a structured error row,
 * never a 500 that takes the admin panel down.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { createErrorResponse, createErrorFromException, ErrorCode, createRouteLogger, withRequestLogging } from '@/lib';
import { getRaidTelemetry, getRaidRefusalPairs, RAID_REFUSAL_ACTION } from '@/lib/raidTelemetry';

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('AdminRaidTelemetry');
  try {
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }
    if (tokenPayload.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, { message: 'Admin privileges required' });
    }

    const windowRaw = Number(request.nextUrl.searchParams.get('windowHours') ?? 168);
    const windowHours = Number.isFinite(windowRaw) ? Math.min(2160, Math.max(1, Math.floor(windowRaw))) : 168;
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;

    const [outcomes, refusals] = await Promise.all([
      getRaidTelemetry(windowHours),
      getRaidRefusalPairs(windowHours, limit),
    ]);

    log.debug('raid telemetry read', { windowHours, ok: outcomes !== null, refusals: refusals.length });

    return NextResponse.json({
      success: true,
      data: {
        windowHours,
        outcomes, // null ⇒ reader failed (structured, not a 500)
        refusalPairs: refusals,
        refusalAction: RAID_REFUSAL_ACTION,
        tuningTargets: {
          // PVP_BASE_RAID_DESIGN.md §4 — which knob each metric informs.
          pvpLootCapPerLevel: 'lootMetal/lootEnergy vs the 5,000×level ceiling',
          defenderLossFloor: 'avgDefenderLosses — the 25% floor\u2019s real-world bite',
          raidPeriodLock: 'uniqueAttackers/uniqueDefenders pacing',
        },
      },
    });
  } catch (error) {
    log.error('raid telemetry failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
