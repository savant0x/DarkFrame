/**
 * @file app/api/referral/leaderboard/route.ts
 * Created: 2025-10-24
 * 
 * OVERVIEW:
 * Get top recruiters leaderboard showing players ranked by total validated referrals.
 * Public endpoint (no auth required).
 * 
 * ENDPOINTS:
 * GET /api/referral/leaderboard?limit=100
 *   - Returns: Top recruiters with stats
 *   - Optional: username param to get specific player's rank
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import type { ReferralLeaderboardEntry } from '@/types/referral.types';
import type { Player } from '@/types/game.types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const username = searchParams.get('username');
    
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;
    
    const db = await getDatabase();
    
    // Get top recruiters
    const topRecruiters = await db.collection<Player>('players').find({
      isBot: { $ne: true },
      totalReferrals: { $gt: 0 }
    })
    .sort({ totalReferrals: -1, lastReferralValidated: -1 })
    .limit(limit)
    .project({
      username: 1,
      totalReferrals: 1,
      pendingReferrals: 1,
      level: 1,
      referralTitles: 1,
      referralBadges: 1,
      createdAt: 1
    })
    .toArray();
    
    // Build leaderboard entries with ranks
    const leaderboard: ReferralLeaderboardEntry[] = topRecruiters.map((player: any, index: any) => ({
      rank: index + 1,
      username: player.username,
      totalReferrals: player.totalReferrals || 0,
      pendingReferrals: player.pendingReferrals || 0,
      level: player.level || 1,
      titles: player.referralTitles || [],
      badges: player.referralBadges || [],
      joinedDate: player.createdAt || new Date()
    }));
    
    // If username provided, get their rank
    let currentPlayerRank: number | null = null;
    let currentPlayerData: ReferralLeaderboardEntry | null = null;
    
    if (username) {
      const playerEntry = leaderboard.find((entry: any) => entry.username === username);
      
      if (playerEntry) {
        currentPlayerRank = playerEntry.rank;
        currentPlayerData = playerEntry;
      } else {
        // Player not in top list - calculate actual rank
        const player = await db.collection<Player>('players').findOne({
          username,
          isBot: { $ne: true }
        });
        
        if (player && (player.totalReferrals || 0) > 0) {
          const playersAhead = await db.collection<Player>('players').countDocuments({
            isBot: { $ne: true },
            $or: [
              { totalReferrals: { $gt: player.totalReferrals || 0 } },
              {
                totalReferrals: player.totalReferrals || 0,
                lastReferralValidated: { $gt: player.lastReferralValidated || new Date(0) }
              }
            ]
          });
          
          currentPlayerRank = playersAhead + 1;
          currentPlayerData = {
            rank: currentPlayerRank,
            username: player.username,
            totalReferrals: player.totalReferrals || 0,
            pendingReferrals: player.pendingReferrals || 0,
            level: player.level || 1,
            titles: player.referralTitles || [],
            badges: player.referralBadges || [],
            joinedDate: player.createdAt || new Date()
          };
        }
      }
    }
    
    // Get total count of players with referrals
    const totalRecruiters = await db.collection('players').countDocuments({
      isBot: { $ne: true },
      totalReferrals: { $gt: 0 }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        currentPlayerRank,
        currentPlayerData,
        totalRecruiters,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Referral Leaderboard] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
