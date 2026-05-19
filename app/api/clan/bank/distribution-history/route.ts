/**
 * @file app/api/clan/bank/distribution-history/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * API endpoint for viewing distribution history records.
 * Provides audit trail for all clan fund distributions with pagination and filtering.
 * 
 * ROUTES:
 * - GET /api/clan/bank/distribution-history - View clan distribution audit trail
 * 
 * AUTHENTICATION:
 * - requireClanMembership() - View-only access for all clan members
 * 
 * BUSINESS RULES:
 * - History sorted by timestamp (newest first)
 * - Paginated results (default 100, max 500 records)
 * - Shows method, distributor, timestamp, amounts, and recipients
 * - No deletion or modification of historical records
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireClanMembership,
  getDistributionHistory,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;

    const { clanId } = result;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Get distribution history
    const history = await getDistributionHistory(clanId, limit);

    return NextResponse.json({
      success: true,
      history: history.map((record) => ({
        id: record.id?.toString(),
        method: record.method,
        distributedBy: record.distributed_by,
        distributedByUsername: record.distributed_by_username,
        timestamp: record.timestamp,
        totalDistributed: record.total_distributed,
        recipients: record.recipients.map((r) => ({
          playerId: r.player_id,
          username: r.username,
          amount: r.amount,
          percentage: r.percentage,
        })),
        notes: record.notes,
      })),
      count: history.length,
    });
  } catch (error: unknown) {
    logger.error('Distribution history error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch distribution history';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});

