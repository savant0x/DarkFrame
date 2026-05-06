/**
 * @file app/api/referral/stats/route.ts
 * Created: 2025-10-24
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Get referral statistics and dashboard data for authenticated player.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import type { Tables } from '@/types/database';
import { 
  getNextMilestone, 
  calculateMilestoneProgress,
  generateReferralCode,
  generateReferralLink 
} from '@/lib/referralService';

type PlayerRow = Tables<'players'>;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();
    
    // Get player data
    const { data: initialPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (!initialPlayer) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    let player: PlayerRow = initialPlayer;

    // Generate referral code/link if player doesn't have one
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
      
      // Refresh player data
      const { data: refreshed } = await supabase
        .from('players')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      
      if (!refreshed) {
        return NextResponse.json({ success: false, error: 'Failed to update player' }, { status: 500 });
      }
      player = refreshed;
    }
    
    // Get pending referrals
    const { data: pendingReferrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_code', player.referral_code!)
      .eq('validated', false)
      .order('signup_date', { ascending: false });
    
    // Get validated referrals (recent 20)
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
    console.error('[Referral Stats] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
