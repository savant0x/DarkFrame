/**
 * @file app/api/clan/research/contribute/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan research contribution endpoint. Allows members to contribute personal RP to clan pool.
 * Validates membership, balance, and updates both player and clan research points.
 * 
 * ROUTES:
 * - POST /api/clan/research/contribute - Contribute RP to clan research fund
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Any clan member can contribute RP
 * - Player must have sufficient personal RP
 * - Contribution amount must be positive
 * - All contributions logged to activity feed
 * - Updates both player (deduct) and clan (add) RP totals
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib';
import { contributeRP } from '@/lib/clanResearchService';

/**
 * POST /api/clan/research/contribute
 * Contribute RP to clan research pool
 * 
 * @param request - NextRequest with authentication cookie and contribution amount in body
 * @returns NextResponse with updated clan RP total
 * 
 * @example
 * POST /api/clan/research/contribute
 * Body: { amount: 500 }
 * Response: { success: true, newTotal: 12500, contributed: 500, message: "Successfully contributed..." }
 * 
 * @throws {400} Invalid amount (must be positive number)
 * @throws {400} Insufficient research points
 * @throws {401} Unauthorized
 * @throws {500} Failed to contribute RP
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid contribution amount (must be positive number)' },
        { status: 400 }
      );
    }

    try {
      const contributionResult = await contributeRP(clanId, auth.username, amount);

      return NextResponse.json({
        success: true,
        newTotal: contributionResult.newTotal,
        contributed: contributionResult.contributed,
        message: `Successfully contributed ${amount} RP to clan research fund`,
      });
    } catch (err: any) {
      if (err.message.includes('not a member')) {
        return NextResponse.json(
          { error: 'You are not a member of this clan' },
          { status: 400 }
        );
      }
      if (err.message.includes('Insufficient research points')) {
        return NextResponse.json(
          { error: `Insufficient RP (you have ${auth.player.research_points || 0})` },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error contributing RP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to contribute RP' },
      { status: 500 }
    );
  }
}
