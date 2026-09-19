/**
 * @file app/api/referral/leaderboard/route.ts
 * Created: 2025-10-24
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
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
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { and, count, desc, eq, gt, ne, or } from 'drizzle-orm';
import type { ReferralLeaderboardEntry } from '@/types/referral.types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const username = searchParams.get('username');

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    // Get top recruiters (bots excluded — isBot smallint default 0)
    const topRecruiterRows = await db
      .select({
        username: players.username,
        totalReferrals: players.totalReferrals,
        pendingReferrals: players.pendingReferrals,
        level: players.level,
        referralTitles: players.referralTitles,
        referralBadges: players.referralBadges,
        createdAt: players.createdAt,
      })
      .from(players)
      .where(and(ne(players.isBot, 1), gt(players.totalReferrals, 0)))
      .orderBy(desc(players.totalReferrals), desc(players.lastReferralValidated))
      .limit(limit);

    // Build leaderboard entries with ranks
    const leaderboard: ReferralLeaderboardEntry[] = topRecruiterRows.map((player, index) => ({
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
      const playerEntry = leaderboard.find((entry) => entry.username === username);

      if (playerEntry) {
        currentPlayerRank = playerEntry.rank;
        currentPlayerData = playerEntry;
      } else {
        // Player not in top list — calculate actual rank
        const [player] = await db
          .select({
            username: players.username,
            totalReferrals: players.totalReferrals,
            pendingReferrals: players.pendingReferrals,
            level: players.level,
            referralTitles: players.referralTitles,
            referralBadges: players.referralBadges,
            createdAt: players.createdAt,
            lastReferralValidated: players.lastReferralValidated,
          })
          .from(players)
          .where(and(eq(players.username, username), ne(players.isBot, 1)))
          .limit(1);

        if (player && (player.totalReferrals || 0) > 0) {
          // Players ranked ahead: strictly more referrals, or equal referrals
          // with a later validation (the same ORDER BY semantics, as a count)
          const [ahead] = await db
            .select({ count: count() })
            .from(players)
            .where(
              and(
                ne(players.isBot, 1),
                or(
                  gt(players.totalReferrals, player.totalReferrals || 0),
                  and(
                    eq(players.totalReferrals, player.totalReferrals || 0),
                    gt(
                      players.lastReferralValidated,
                      player.lastReferralValidated || new Date(0)
                    )
                  )
                )
              )
            );

          currentPlayerRank = Number(ahead?.count ?? 0) + 1;
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
    const [totalRow] = await db
      .select({ count: count() })
      .from(players)
      .where(and(ne(players.isBot, 1), gt(players.totalReferrals, 0)));

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        currentPlayerRank,
        currentPlayerData,
        totalRecruiters: Number(totalRow?.count ?? 0),
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
