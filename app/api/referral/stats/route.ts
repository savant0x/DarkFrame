/**
 * @file app/api/referral/stats/route.ts
 * Created: 2025-10-24
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * Get referral statistics and dashboard data for authenticated player.
 * Returns total/pending referrals, rewards earned, milestone progress, and recent activity.
 *
 * FID-20260917-017 note: the shim read `player.referralRewardsEarned` as a
 * nested JSON object — a phantom field (FID-009 class). pg persists referral
 * rewards as the flat `referral_rewards_{metal,energy,rp,xp,vip_days}`
 * columns; the dashboard derives the totals from those columns, and generate
 * no longer writes defaults for counters that live solely in the service
 * layer.
 *
 * ENDPOINTS:
 * GET /api/referral/stats
 *   - Requires: Authentication (JWT)
 *   - Returns: Complete referral dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, referrals } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import {
  getNextMilestone,
  calculateMilestoneProgress,
  generateReferralCode,
  generateReferralLink
} from '@/lib/referralService';
import type { ReferralDashboardData, ReferralRecord } from '@/types/referral.types';

/** The dashboard's rewards shape, derived from the flat pg columns. */
function rewardsFromColumns(row: {
  referralRewardsMetal: number | null;
  referralRewardsEnergy: number | null;
  referralRewardsRp: number | null;
  referralRewardsXp: number | null;
  referralRewardsVipDays: number | null;
}) {
  return {
    metal: row.referralRewardsMetal || 0,
    energy: row.referralRewardsEnergy || 0,
    rp: row.referralRewardsRp || 0,
    xp: row.referralRewardsXp || 0,
    vipDays: row.referralRewardsVipDays || 0,
  };
}

/** Recent-rewards entry shape (referrals.rewards_data_* flattened). */
function rewardFromReferral(ref: typeof referrals.$inferSelect) {
  return {
    date: ref.validationDate,
    reward: {
      metal: ref.rewardsDataMetal || 0,
      energy: ref.rewardsDataEnergy || 0,
      rp: ref.rewardsDataRp || 0,
      xp: ref.rewardsDataXp || 0,
      vipDays: ref.rewardsDataVipDays || 0,
    },
    newPlayerUsername: ref.newPlayerUsername,
  };
}

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

    const username = tokenPayload.username;

    // Get player data
    let [player] = await db.select().from(players).where(eq(players.username, username)).limit(1);

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
        const [existing] = await db
          .select({ username: players.username })
          .from(players)
          .where(eq(players.referralCode, newPlayerCode))
          .limit(1);
        if (!existing) break;
        newPlayerCode = generateReferralCode();
        attempts++;
      }

      const newPlayerLink = generateReferralLink(newPlayerCode);

      // Update player with new codes
      const [updated] = await db
        .update(players)
        .set({ referralCode: newPlayerCode, referralLink: newPlayerLink })
        .where(eq(players.username, username))
        .returning();

      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Failed to update player' },
          { status: 500 }
        );
      }
      player = updated;
    }

    // Get pending referrals (most recent signups first)
    const pendingReferralRows = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerCode, player.referralCode || ''), eq(referrals.validated, 0)))
      .orderBy(desc(referrals.signupDate));

    // Get validated referrals (recent 20)
    const validatedReferralRows = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerCode, player.referralCode || ''), eq(referrals.validated, 1)))
      .orderBy(desc(referrals.validationDate))
      .limit(20);

    // Calculate milestone progress
    const totalReferrals = player.totalReferrals || 0;
    const nextMilestone = getNextMilestone(totalReferrals);
    const progress = calculateMilestoneProgress(totalReferrals);

    // Build recent rewards
    const recentRewards = validatedReferralRows.slice(0, 5).map(rewardFromReferral);

    const rewardsEarned = rewardsFromColumns(player);

    const dashboardData: ReferralDashboardData = {
      playerStats: {
        referralCode: player.referralCode || '',
        referralLink: player.referralLink || '',
        referredBy: player.referredBy || null,
        referredByUsername: player.referredByUsername || null,
        referralValidated: Boolean(player.referralValidated),
        referralValidatedAt: player.referralValidatedAt || null,
        totalReferrals: player.totalReferrals || 0,
        pendingReferrals: player.pendingReferrals || 0,
        totalRewardsEarned: rewardsEarned,
        referralTitles: player.referralTitles || [],
        referralBadges: player.referralBadges || [],
        referralMultiplier: Number(player.referralMultiplier) || 1.0,
        lastReferralValidated: player.lastReferralValidated || null,
        milestonesReached: player.referralMilestonesReached || []
      },
      // Wire-shape preservation: the client expects Mongo-era documents with
      // `validated` as a boolean; pg stores it as a smallint flag.
      pendingReferrals: pendingReferralRows.map((r) => ({ ...r, validated: Boolean(r.validated) })) as unknown as ReferralRecord[],
      validatedReferrals: validatedReferralRows.map((r) => ({ ...r, validated: Boolean(r.validated) })) as unknown as ReferralRecord[],
      nextMilestone,
      progressToNextMilestone: progress,
      recentRewards,
      totalValueEarned: rewardsEarned
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
        error: 'Unable to complete the request. Please try again.'
      },
      { status: 500 }
    );
  }
}
