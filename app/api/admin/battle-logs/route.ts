/**
 * Admin Battle Logs Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Returns list of all battle logs in the game for admin inspection.
 * Provides comprehensive combat data including attacker, defender, outcome,
 * resources transferred, XP gained, and timestamps.
 * 
 * Endpoint: GET /api/admin/battle-logs
 * Rate Limited: 500 req/min (admin dashboard)
 * Auth Required: Admin (FAME account only)
 * 
 * Returns:
 * {
 *   logs: BattleLog[],
 *   total: number
 * }
 * 
 * Battle Log Data Structure:
 * - battleId: Log document ID
 * - timestamp: Battle timestamp (ISO string)
 * - attackerUsername: Username of attacker
 * - defenderUsername: Username of defender
 * - outcome: 'attacker_win' | 'defender_win' | 'draw'
 * - resourcesTransferred: {metal, energy}
 * - xpGained: XP awarded to winner
 * - location: {x, y} coordinates
 * - attackerLosses: Units lost by attacker (optional)
 * - defenderLosses: Units lost by defender (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
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

/** Row → admin wire shape (FID-027 §3.2: extracted so both fetch paths share it). */
function mapBattleLogForAdmin(logEntry: typeof battleLogs.$inferSelect) {
  // Get timestamp as ISO string
  const timestamp = logEntry.timestamp
    ? new Date(logEntry.timestamp).toISOString()
    : new Date().toISOString();

  // Calculate resources transferred (default to 0 if not present)
  const resourcesTransferred = {
    metal: Number(logEntry.resourcesStolenAmount || 0),
    energy: 0,
  };

  // Get XP gained
  const xpGained = logEntry.attackerXP || 0;

  // Get location coordinates
  const location = {
    x: logEntry.locationX || 0,
    y: logEntry.locationY || 0,
  };

  // Determine outcome
  const outcome = logEntry.outcome || 'draw';

  return {
    _id: logEntry.battleId,
    timestamp,
    attackerUsername: logEntry.attackerUsername || 'Unknown',
    defenderUsername: logEntry.defenderUsername || 'Unknown',
    outcome,
    resourcesTransferred,
    xpGained,
    location,
    attackerLosses: logEntry.attackerUnitsLost,
    defenderLosses: logEntry.defenderUnitsLost,
  };
}

/**
 * GET handler - Fetch battle logs (filtered + paginated server-side)
 *
 * FID-20260909-027 §3.2: previously shipped .limit(10000) rows in one response
 * for the modal to filter and paginate client-side (25/page shown). Filters are
 * now pushed into SQL; `page`/`limit` bound the wire payload; `export=all`
 * preserves the full-download case (capped at 10,000 as before).
 *
 * Query params:
 * - player:   substring match on attacker OR defender (case-insensitive)
 * - outcome:  attacker_win | defender_win | draw
 * - dateFrom / dateTo: ISO timestamps (inclusive)
 * - page / limit: 1-based pagination (limit default 50, cap 200)
 * - export=all: return every matching row up to the 10,000 cap (no paging)
 *
 * Response shape preserved: { logs, total } (+ page/limit echo). `total` is
 * the FILTERED count; `logs` is one page unless export=all.
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBattleLogsAPI');
  const endTimer = log.time('battle-logs');

  try {
    // Check admin authentication
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin access (isAdmin flag required)
    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // ---- Parse query params (FID-027 §3.2) ----
    const { searchParams } = new URL(request.url);
    const playerParam = searchParams.get('player')?.trim() || '';
    const outcomeParam = searchParams.get('outcome') || '';
    const dateFromParam = searchParams.get('dateFrom') || '';
    const dateToParam = searchParams.get('dateTo') || '';
    const exportAll = searchParams.get('export') === 'all';

    const isExport = exportAll;
    const limitRaw = Number(searchParams.get('limit') ?? '50');
    const pageRaw = Number(searchParams.get('page') ?? '1');
    const limit = isExport
      ? 10000
      : Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(200, Math.floor(limitRaw)) : 50;
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

    // Outcome is an enum column: an unknown value must 400, not silently match nothing
    const OUTCOMES = ['attacker_win', 'defender_win', 'draw'] as const;
    if (outcomeParam && !(OUTCOMES as readonly string[]).includes(outcomeParam)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
        message: `outcome must be one of: ${OUTCOMES.join(', ')}`,
      });
    }

    const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
    const dateTo = dateToParam ? new Date(dateToParam) : undefined;
    if ((dateFromParam && (dateFrom === undefined || Number.isNaN(dateFrom.getTime()))) ||
        (dateToParam && (dateTo === undefined || Number.isNaN(dateTo.getTime())))) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
        message: 'dateFrom/dateTo must be valid ISO timestamps',
      });
    }

    // ---- SQL WHERE from the filters ----
    const conditions = [];
    if (playerParam) {
      const like = `%${playerParam}%`;
      conditions.push(or(ilike(battleLogs.attackerUsername, like), ilike(battleLogs.defenderUsername, like)));
    }
    if (outcomeParam) {
      conditions.push(eq(battleLogs.outcome, outcomeParam as typeof OUTCOMES[number]));
    }
    if (dateFrom) {
      conditions.push(gte(battleLogs.timestamp, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(battleLogs.timestamp, dateTo));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Export path: every matching row up to the 10,000 cap, no pagination.
    if (isExport) {
      const allRows = await db.select()
        .from(battleLogs)
        .where(where)
        .orderBy(desc(battleLogs.timestamp))
        .limit(10000);
      const logsData = allRows.map(mapBattleLogForAdmin);
      log.info('Battle logs exported', { total: logsData.length, adminUser: user.username });
      return NextResponse.json({ logs: logsData, total: logsData.length });
    }

    // Filtered count for pagination
    const [{ value }] = await db.select({ value: count() }).from(battleLogs).where(where);
    const total = Number(value);

    // One page of rows (sorted by newest first)
    const logs = await db.select()
      .from(battleLogs)
      .where(where)
      .orderBy(desc(battleLogs.timestamp))
      .limit(limit)
      .offset((page - 1) * limit);

    // Transform battle log data for admin view
    const logsData = logs.map(mapBattleLogForAdmin);

    log.info('Battle logs retrieved', {
      total,
      page,
      limit,
      adminUser: user.username,
    });

    return NextResponse.json({
      logs: logsData,
      total,
      page,
      limit,
    });
  } catch (error) {
    log.error('Failed to fetch battle logs', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * 
 * Database Schema Assumptions:
 * - battleLogs table with Drizzle ORM schema fields
 * 
 * Data Transformation:
 * - Converts timestamps to ISO strings for consistency
 * - Provides defaults for missing fields (0 for numbers)
 * 
 * Sorting:
 * - Newest battles first (timestamp: -1)
 * - Makes it easy to see recent combat activity
 * 
 * Future Enhancements:
 * - Query params for server-side filtering
 * - Pagination with skip/limit params
 * - Aggregation for statistics (win rates, resource totals)
 * - Battle detail endpoint for individual log inspection
 * - Real-time updates via WebSocket or polling
 * 
 * Performance:
 * - Limit of 10,000 logs prevents excessive data transfer
 * - Client-side filtering for fast UX
 * - For production, implement server-side pagination
 */
