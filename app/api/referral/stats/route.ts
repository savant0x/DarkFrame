/**
 * @file app/api/referral/stats/route.ts
 * Created: 2025-10-24
 * 
 * OVERVIEW:
 * Get referral statistics and dashboard data for authenticated player.
 * Returns total/pending referrals, rewards earned, milestone progress, and recent activity.
 * 
 * ENDPOINTS:
 * GET /api/referral/stats
 *   - Requires: Authentication (JWT)
 *   - Returns: Complete referral dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { 
  getNextMilestone, 
  calculateMilestoneProgress,
  generateReferralCode,
  generateReferralLink 
} from '@/lib/referralService';
import type { ReferralDashboardData, ReferralRecord } from '@/types/referral.types';
import type { Player } from '@/types/game.types';

export async function GET(_request: NextRequest) {
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
    
    // Get player data
    let player = await db.collection<Player>('players').findOne({
      username: tokenPayload.username
    });
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Generate referral code/link if player doesn't have one (legacy players)
    if (!player.referralCode || !player.referralLink) {
      let newPlayerCode = generateReferralCode();
      let attempts = 0;
      
      // Ensure unique code
      while (attempts < 10) {
        const existing = await db.collection<Player>('players').findOne({ referralCode: newPlayerCode });
        if (!existing) break;
        newPlayerCode = generateReferralCode();
        attempts++;
      }
      
      const newPlayerLink = generateReferralLink(newPlayerCode);
      
      // Update player with new codes
      await db.collection<Player>('players').updateOne(
        { username: tokenPayload.username },
        {
          $set: {
            referralCode: newPlayerCode,
            referralLink: newPlayerLink,
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
      
      // Refresh player data
      player = await db.collection<Player>('players').findOne({
        username: tokenPayload.username
      });
      
      if (!player) {
        return NextResponse.json(
          { success: false, error: 'Failed to update player' },
          { status: 500 }
        );
      }
    }
    
    // Get pending referrals
    const pendingReferrals = await db.collection<ReferralRecord>('referrals').find({
      referrerCode: player.referralCode,
      validated: false
    }).sort({ signupDate: -1 }).toArray();
    
    // Get validated referrals (recent 20)
    const validatedReferrals = await db.collection<ReferralRecord>('referrals').find({
      referrerCode: player.referralCode,
      validated: true
    }).sort({ validationDate: -1 }).limit(20).toArray();
    
    // Calculate milestone progress
    const totalReferrals = player.totalReferrals || 0;
    const nextMilestone = getNextMilestone(totalReferrals);
    const progress = calculateMilestoneProgress(totalReferrals);
    
    // Build recent rewards
    const recentRewards = validatedReferrals.slice(0, 5).map((ref: ReferralRecord) => ({
      date: ref.validationDate,
      reward: ref.rewardsData,
      newPlayerUsername: ref.newPlayerUsername
    }));
    
    const dashboardData: ReferralDashboardData = {
      playerStats: {
        referralCode: player.referralCode || '',
        referralLink: player.referralLink || '',
        referredBy: player.referredBy || null,
        referredByUsername: player.referredByUsername || null,
        referralValidated: player.referralValidated || false,
        referralValidatedAt: player.referralValidatedAt || null,
        totalReferrals: player.totalReferrals || 0,
        pendingReferrals: player.pendingReferrals || 0,
        totalRewardsEarned: player.referralRewardsEarned || {
          metal: 0,
          energy: 0,
          rp: 0,
          xp: 0,
          vipDays: 0
        },
        referralTitles: player.referralTitles || [],
        referralBadges: player.referralBadges || [],
        referralMultiplier: player.referralMultiplier || 1.0,
        lastReferralValidated: player.lastReferralValidated || null,
        milestonesReached: player.referralMilestonesReached || []
      },
      pendingReferrals,
      validatedReferrals,
      nextMilestone,
      progressToNextMilestone: progress,
      recentRewards,
      totalValueEarned: player.referralRewardsEarned || {
        metal: 0,
        energy: 0,
        rp: 0,
        xp: 0,
        vipDays: 0
      }
    };
    
    return NextResponse.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('[Referral Stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
