/**
 * @file app/api/clan/bank/distribute/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Refactored to use centralized auth + JSDoc)
 * 
 * OVERVIEW:
 * Clan fund distribution endpoint. Distributes clan bank resources to members.
 * Supports 4 distribution methods: equal split, percentage-based, merit-based, and direct grant.
 * 
 * ROUTES:
 * - POST /api/clan/bank/distribute - Distribute clan funds
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Only leaders and co-leaders can distribute funds
 * - Co-leaders have daily distribution limits
 * - Percentage distributions must total 100%
 * - Merit-based uses contribution metrics
 * - All distributions logged for accountability
 * 
 * DISTRIBUTION METHODS:
 * 1. EQUAL_SPLIT: Divide equally among all members
 * 2. PERCENTAGE: Custom percentage per role or player (must total 100%)
 * 3. MERIT: Based on contribution metrics (territories, wars, donations)
 * 4. DIRECT_GRANT: Transfer to specific players
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib';
import {
  distributeEqualSplit,
  distributeByPercentage,
  distributeByMerit,
  directGrant,
  DistributionMethod,
  MeritWeights,
  DEFAULT_MERIT_WEIGHTS,
} from '@/lib/clanDistributionService';

/**
 * POST /api/clan/bank/distribute
 * Distribute clan funds to members
 * 
 * @param request - NextRequest with authentication cookie and distribution data in body
 * @returns NextResponse with distribution results
 * 
 * @example
 * POST /api/clan/bank/distribute (Equal Split)
 * Body: { method: "EQUAL_SPLIT", resourceType: "metal", totalAmount: 100000 }
 * Response: { success: true, distribution: { method: "EQUAL_SPLIT", totalDistributed: {...}, recipients: [...] } }
 * 
 * @example
 * POST /api/clan/bank/distribute (Percentage)
 * Body: { method: "PERCENTAGE", resourceType: "metal", totalAmount: 100000, percentageMap: { player1: 40, player2: 60 } }
 * 
 * @example
 * POST /api/clan/bank/distribute (Merit)
 * Body: { method: "MERIT", resourceType: "rp", totalAmount: 5000, weights: { territoriesClaimed: 0.5, ... } }
 * 
 * @example
 * POST /api/clan/bank/distribute (Direct Grant)
 * Body: { method: "DIRECT_GRANT", grants: [{ playerId: "abc", metal: 10000, energy: 5000 }] }
 * 
 * @throws {400} Invalid distribution method or missing parameters
 * @throws {401} Unauthorized
 * @throws {403} Insufficient permissions
 * @throws {500} Failed to distribute funds
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { method, resourceType, totalAmount, percentageMap, weights, grants } = body;

    if (!Object.values(DistributionMethod).includes(method)) {
      return NextResponse.json({ error: 'Invalid distribution method' }, { status: 400 });
    }

    let distributionResult;

    switch (method) {
      case DistributionMethod.EQUAL_SPLIT:
        if (!resourceType || totalAmount === undefined) {
          return NextResponse.json(
            { error: 'resourceType and totalAmount are required for equal split' },
            { status: 400 }
          );
        }
        distributionResult = await distributeEqualSplit(clanId, auth.playerId, resourceType, totalAmount);
        break;

      case DistributionMethod.PERCENTAGE:
        if (!resourceType || totalAmount === undefined || !percentageMap) {
          return NextResponse.json(
            { error: 'resourceType, totalAmount, and percentageMap are required for percentage distribution' },
            { status: 400 }
          );
        }
        distributionResult = await distributeByPercentage(clanId, auth.playerId, resourceType, percentageMap, totalAmount);
        break;

      case DistributionMethod.MERIT:
        if (!resourceType || totalAmount === undefined) {
          return NextResponse.json(
            { error: 'resourceType and totalAmount are required for merit distribution' },
            { status: 400 }
          );
        }
        const meritWeights: MeritWeights = weights || DEFAULT_MERIT_WEIGHTS;
        distributionResult = await distributeByMerit(clanId, auth.playerId, resourceType, totalAmount, meritWeights);
        break;

      case DistributionMethod.DIRECT_GRANT:
        if (!grants || !Array.isArray(grants) || grants.length === 0) {
          return NextResponse.json(
            { error: 'grants array is required for direct grant' },
            { status: 400 }
          );
        }
        distributionResult = await directGrant(clanId, auth.playerId, grants);
        break;

      default:
        return NextResponse.json({ error: 'Unsupported distribution method' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      distribution: {
        method: distributionResult.method,
        totalDistributed: distributionResult.total_distributed,
        recipients: distributionResult.recipients.map((r) => ({
          playerId: r.player_id,
          username: r.username,
          amount: r.amount,
          percentage: r.percentage,
        })),
        timestamp: distributionResult.timestamp,
        notes: distributionResult.notes,
      },
    });
  } catch (error: any) {
    console.error('Distribution error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to distribute funds' },
      { status: 500 }
    );
  }
}

