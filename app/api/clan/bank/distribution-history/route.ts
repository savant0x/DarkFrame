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
import { requireClanMembership } from '@/lib/authMiddleware';
import { getDistributionHistory } from '@/lib/clanDistributionService';

/**
 * GET /api/clan/bank/distribution-history
 * View distribution history for player's clan
 * 
 * @param request - NextRequest with auth cookie and optional query params
 * @returns NextResponse with distribution history or error
 * 
 * @example
 * GET /api/clan/bank/distribution-history?limit=50
 * Response: {
 *   success: true,
 *   history: [
 *     {
 *       _id: "...",
 *       method: "EQUAL_SPLIT",
 *       distributedBy: "playerId",
 *       distributedByUsername: "PlayerName",
 *       timestamp: "2025-10-18T10:30:00Z",
 *       totalDistributed: { metal: 100000, energy: 0, rp: 0 },
 *       recipients: [{ playerId: "...", username: "...", amount: 10000 }],
 *       notes: "Equal split: 10000 metal per member"
 *     }
 *   ],
 *   count: 25
 * }
 * 
 * @throws {400} Not in clan
 * @throws {401} Not authenticated
 * @throws {403} Not a clan member
 * @throws {500} Server error
 */
export async function GET(request: NextRequest) {
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
  } catch (error: any) {
    console.error('Distribution history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch distribution history' },
      { status: 500 }
    );
  }
}

