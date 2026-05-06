/**
 * @file app/api/referral/leaderboard/route.ts
 * Created: 2025-10-24
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Get top recruiters leaderboard showing players ranked by total validated referrals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const username = auth.playerId;
    
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;
    
    const supabase = createServiceClient();
    
    // Get top recruiters
    const { data: topRecruiters } = await supabase
      .from('players')
      .select('username, total_referrals, pending_referrals, level, referral_milestones_reached, created_at')
      .eq('is_bot', false)
      .gt('total_referrals', 0)
      .order('total_referrals', { ascending: false })
      .limit(limit);
    
    const leaderboard = (topRecruiters || []).map((player, index) => ({
      rank: index + 1,
      username: player.username,
      totalReferrals: player.total_referrals || 0,
      pendingReferrals: player.pending_referrals || 0,
      level: player.level || 1,
      titles: [],
      badges: [],
      joinedDate: player.created_at || new Date().toISOString()
    }));
    
    let currentPlayerRank: number | null = null;
    let currentPlayerData: typeof leaderboard[0] | null = null;
    
    if (username) {
      const playerEntry = leaderboard.find(entry => entry.username === username);
      
      if (playerEntry) {
        currentPlayerRank = playerEntry.rank;
        currentPlayerData = playerEntry;
      } else {
        // Player not in top list - get their stats
        const { data: player } = await supabase
          .from('players')
          .select('username, total_referrals, pending_referrals, level, created_at')
          .eq('username', username)
          .eq('is_bot', false)
          .maybeSingle();
        
        if (player && (player.total_referrals || 0) > 0) {
          // Count players ahead
          const { count: playersAhead } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('is_bot', false)
            .gt('total_referrals', player.total_referrals || 0);
          
          currentPlayerRank = (playersAhead || 0) + 1;
          currentPlayerData = {
            rank: currentPlayerRank,
            username: player.username,
            totalReferrals: player.total_referrals || 0,
            pendingReferrals: player.pending_referrals || 0,
            level: player.level || 1,
            titles: [],
            badges: [],
            joinedDate: player.created_at || new Date().toISOString()
          };
        }
      }
    }
    
    // Get total count of players with referrals
    const { count: totalRecruiters } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot', false)
      .gt('total_referrals', 0);
    
    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        currentPlayerRank,
        currentPlayerData,
        totalRecruiters: totalRecruiters || 0,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Referral Leaderboard] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
