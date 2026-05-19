import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  generateReferralCode,
  generateReferralLink,
  getNextMilestone,
  calculateMilestoneProgress,
  logger,
} from '@/lib';
import type { Tables } from '@/types/database';
type PlayerRow = Tables<'players'>;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();

    const { data: initialPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!initialPlayer) {
      return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');
    }

    let player: PlayerRow = initialPlayer;

    if (!player.referral_code || !player.referral_link) {
      let newPlayerCode = generateReferralCode();
      let attempts = 0;

      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('players')
          .select('username')
          .eq('referral_code', newPlayerCode)
          .maybeSingle();
        if (!existing) break;
        newPlayerCode = generateReferralCode();
        attempts++;
      }

      const newPlayerLink = generateReferralLink(newPlayerCode);

      await supabase
        .from('players')
        .update({
          referral_code: newPlayerCode,
          referral_link: newPlayerLink,
        })
        .eq('username', username);

      const { data: refreshed } = await supabase
        .from('players')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (!refreshed) {
        return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update player');
      }
      player = refreshed;
    }

    const { data: pendingReferrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_code', player.referral_code!)
      .eq('validated', false)
      .order('signup_date', { ascending: false });

    const { data: validatedReferrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_code', player.referral_code!)
      .eq('validated', true)
      .order('validation_date', { ascending: false })
      .limit(20);

    const totalReferrals = player.total_referrals || 0;
    const nextMilestone = getNextMilestone(totalReferrals);
    const progress = calculateMilestoneProgress(totalReferrals);

    const recentRewards = (validatedReferrals || []).slice(0, 5).map((ref) => ({
      date: ref.validation_date,
      reward: {
        metal: ref.reward_metal,
        energy: ref.reward_energy,
        rp: ref.reward_rp,
        xp: ref.reward_xp,
        vipDays: ref.reward_vip_days
      },
      newPlayerUsername: ref.new_player_username
    }));

    const dashboardData = {
      playerStats: {
        referralCode: player.referral_code || '',
        referralLink: player.referral_link || '',
        referredBy: player.referred_by || null,
        referredByUsername: player.referred_by_username || null,
        referralValidated: player.referral_validated || false,
        referralValidatedAt: player.referral_validated_at || null,
        totalReferrals: player.total_referrals || 0,
        pendingReferrals: player.pending_referrals || 0,
        totalRewardsEarned: {
          metal: player.referral_rewards_metal || 0,
          energy: player.referral_rewards_energy || 0,
          rp: player.referral_rewards_rp || 0,
          xp: player.referral_rewards_xp || 0,
          vipDays: player.referral_rewards_vip_days || 0,
        },
        referralTitles: [],
        referralBadges: [],
        referralMultiplier: 1.0,
        lastReferralValidated: null,
        milestonesReached: player.referral_milestones_reached || []
      },
      pendingReferrals: pendingReferrals || [],
      validatedReferrals: validatedReferrals || [],
      nextMilestone,
      progressToNextMilestone: progress,
      recentRewards,
      totalValueEarned: {
        metal: player.referral_rewards_metal || 0,
        energy: player.referral_rewards_energy || 0,
        rp: player.referral_rewards_rp || 0,
        xp: player.referral_rewards_xp || 0,
        vipDays: player.referral_rewards_vip_days || 0,
      }
    };

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    logger.error('[Referral Stats] Error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
