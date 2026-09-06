/**
 * @file app/api/referral/generate/route.ts
 * Created: 2025-10-24
 * 
 * OVERVIEW:
 * API endpoint to generate unique referral code for authenticated player.
 * Automatically called once when player registers, but can regenerate if needed.
 * 
 * ENDPOINTS:
 * POST /api/referral/generate
 *   - Requires: Authentication (JWT)
 *   - Returns: { code, link }
 *   - Idempotent: Returns existing code if already generated
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { generateReferralCode, generateReferralLink } from '@/lib/referralService';
import type { Player } from '@/types/game.types';

export async function POST(_request: NextRequest) {
  try {
    // Verify authentication
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload || !tokenPayload.username) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    
    // Check if player already has referral code
    const player = await db.collection<Player>('players').findOne({
      username: tokenPayload.username
    });
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    // If already has code, return it (idempotent)
    if (player.referralCode) {
      return NextResponse.json({
        success: true,
        data: {
          code: player.referralCode,
          link: player.referralLink || generateReferralLink(player.referralCode)
        }
      });
    }
    
    // Generate new unique code
    let code = generateReferralCode();
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure code is unique (very unlikely to collide, but check anyway)
    while (attempts < maxAttempts) {
      const existing = await db.collection<Player>('players').findOne({ referralCode: code });
      if (!existing) {
        break; // Code is unique
      }
      code = generateReferralCode();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate unique referral code' },
        { status: 500 }
      );
    }
    
    const link = generateReferralLink(code);
    
    // Update player with referral code
    await db.collection<Player>('players').updateOne(
      { username: tokenPayload.username },
      {
        $set: {
          referralCode: code,
          referralLink: link,
          totalReferrals: player.totalReferrals || 0,
          pendingReferrals: player.pendingReferrals || 0,
          referralRewardsEarned: player.referralRewardsEarned || {
            metal: 0,
            energy: 0,
            rp: 0,
            xp: 0,
            vipDays: 0
          },
          referralTitles: player.referralTitles || [],
          referralBadges: player.referralBadges || [],
          referralMultiplier: player.referralMultiplier || 1.0,
          referralMilestonesReached: player.referralMilestonesReached || []
        }
      }
    );
    
    return NextResponse.json({
      success: true,
      data: {
        code,
        link
      }
    });
  } catch (error) {
    console.error('[Referral Generate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete the request. Please try again.'
      },
      { status: 500 }
    );
  }
}
