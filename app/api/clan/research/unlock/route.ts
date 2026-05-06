/**
 * @file app/api/clan/research/unlock/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Refactored to use centralized auth + JSDoc)
 * 
 * OVERVIEW:
 * Clan research unlock endpoint. Unlocks research nodes in clan tech tree.
 * Validates prerequisites, level requirements, and RP cost before unlocking.
 * 
 * ROUTES:
 * - POST /api/clan/research/unlock - Unlock research node
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Only Leader, Co-Leader, and Officer can unlock research
 * - Must meet prerequisite research requirements
 * - Must meet clan level requirements
 * - Must have sufficient clan RP for cost
 * - All unlocks logged to activity feed
 * - Updates total clan bonuses after unlock
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib';
import { unlockResearch } from '@/lib/clanResearchService';

/**
 * POST /api/clan/research/unlock
 * Unlock a research node in the clan tech tree
 * 
 * @param request - NextRequest with authentication cookie and research ID in body
 * @returns NextResponse with unlocked research details and updated bonuses
 * 
 * @example
 * POST /api/clan/research/unlock
 * Body: { researchId: "resource_efficiency_1" }
 * Response: { success: true, research: {...}, totalBonuses: { harvestBonus: 5 }, message: "Successfully unlocked..." }
 * 
 * @throws {400} Research ID required
 * @throws {400} Already unlocked
 * @throws {400} Prerequisites not met
 * @throws {400} Insufficient research points
 * @throws {400} Level requirement not met
 * @throws {401} Unauthorized
 * @throws {403} Insufficient permissions (Leader/Officer only)
 * @throws {404} Research not found
 * @throws {500} Failed to unlock research
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { researchId } = body;

    if (!researchId || typeof researchId !== 'string') {
      return NextResponse.json(
        { error: 'Research ID is required' },
        { status: 400 }
      );
    }

    try {
      const unlockResult = await unlockResearch(clanId, auth.username, researchId);

      return NextResponse.json({
        success: true,
        research: unlockResult.research,
        totalBonuses: unlockResult.totalBonuses,
        message: `Successfully unlocked ${unlockResult.research.name}`,
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Research node not found' },
          { status: 404 }
        );
      }
      if (err.message.includes('not a member')) {
        return NextResponse.json(
          { error: 'You are not a member of this clan' },
          { status: 400 }
        );
      }
      if (err.message.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Only Leaders, Co-Leaders, and Officers can unlock research' },
          { status: 403 }
        );
      }
      if (err.message.includes('already unlocked')) {
        return NextResponse.json(
          { error: 'Research already unlocked' },
          { status: 400 }
        );
      }
      if (err.message.includes('level') && err.message.includes('required')) {
        return NextResponse.json(
          { error: err.message },
          { status: 400 }
        );
      }
      if (err.message.includes('Prerequisite not met')) {
        return NextResponse.json(
          { error: err.message },
          { status: 400 }
        );
      }
      if (err.message.includes('Insufficient research points')) {
        return NextResponse.json(
          { error: err.message },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error unlocking research:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unlock research' },
      { status: 500 }
    );
  }
}
