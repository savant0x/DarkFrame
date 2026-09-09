/**
 * @file components/ReferralLeaderboard.tsx
 * @created 2025-10-24
 * @updated 2026-09-08 (FID-20260908-014: NEON NOIR redesign — nn-panel--violet header,
 *   nn-table ledger, nn-chip badges, nn-well milestone grid, gated nn-spin-icon; doubled
 *   bg-[color-mix(...)] in the current-player row ternary fixed to a single tint; rank/medal
 *   emoji retained (game imagery); fetch/pagination logic byte-preserved)
 * @overview Referral leaderboard component showing top recruiters
 *
 * OVERVIEW:
 * Displays ranked list of top recruiters with their referral counts,
 * badges, titles, and achievements. Shows current player's rank and
 * provides filtering/pagination options.
 *
 * Features:
 * - Top recruiters ranked by validated referrals
 * - Badge and title display for each player
 * - Current player's rank highlighted (token violet tint)
 * - Pagination support (Load More)
 * - Medal icons for top 3
 *
 * Dependencies: /api/referral/leaderboard, GameContext
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { showError } from '@/lib/toastService';

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  validatedReferrals: number;
  badges: string[];
  titles: string[];
  isCurrentPlayer?: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  currentPlayerRank: number | null;
  totalPlayers: number;
}

/**
 * Wire shape of a GET /api/referral/leaderboard row: the route maps projected player
 * rows into ranked entries (rank computed server-side; badges/titles copied through).
 */
interface LeaderboardRowPayload {
  rank: number;
  username: string;
  totalReferrals: number;
  pendingReferrals?: number;
  badges?: string[];
  titles?: string[];
}

export default function ReferralLeaderboard() {
  const { player } = useGameContext();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const url = `/api/referral/leaderboard?limit=${limit}${player ? `&username=${player.username}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        // Map the API response to component state
        const apiData = result.data;
        setData({
          leaderboard: apiData.leaderboard.map((entry: LeaderboardRowPayload) => ({
            rank: entry.rank,
            username: entry.username,
            totalReferrals: entry.totalReferrals,
            validatedReferrals: entry.totalReferrals - (entry.pendingReferrals || 0),
            badges: entry.badges || [],
            titles: entry.titles || [],
            isCurrentPlayer: player && entry.username === player.username
          })),
          currentPlayerRank: apiData.currentPlayerRank,
          totalPlayers: apiData.totalRecruiters
        });
      } else {
        showError(result.message || result.error || 'Failed to load leaderboard');
      }
    } catch (error) {
      console.error('Error fetching referral leaderboard:', error);
      showError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [limit, player]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const getBadgeIcon = (badge: string) => {
    if (badge.includes('diamond')) return '💎';
    if (badge.includes('gold')) return '🥇';
    if (badge.includes('silver')) return '🥈';
    if (badge.includes('bronze')) return '🥉';
    return '🏅';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" aria-label="Loading leaderboard" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="nn-note" role="alert">
        <p className="nn-text-magenta text-sm font-semibold">
          Failed to load leaderboard. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="nn-panel nn-panel--violet">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Top Recruiters</span>
          <span className="nn-panel__meta">Hall of Fame</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <p className="nn-text-secondary mb-4">
            Hall of fame for the most successful recruiters in DarkFrame
          </p>
          {data.currentPlayerRank && (
            <div className="nn-row inline-flex nn-well">
              <span className="nn-text-violet text-sm">Your Rank:</span>
              <span className="nn-num text-2xl font-bold nn-text-violet">
                #{data.currentPlayerRank}
              </span>
              <span className="nn-text-secondary text-sm">of {data.totalPlayers}</span>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Rankings</span>
          <span className="nn-panel__meta">{data.totalPlayers} Recruiters</span>
        </div>
        <div className="overflow-x-auto">
          <table className="nn-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Referrals</th>
                <th>Validated</th>
                <th>Achievements</th>
              </tr>
            </thead>
            <tbody>
              {!data?.leaderboard || data.leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center nn-table__dim">
                    No recruiters yet. Be the first!
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((entry) => (
                  <tr
                    key={entry.username}
                    style={
                      entry.isCurrentPlayer
                        ? { background: 'color-mix(in oklab, var(--nn-violet) 14%, transparent)' }
                        : undefined
                    }
                  >
                    {/* Rank */}
                    <td>
                      <div className="flex items-center gap-2">
                        {getRankMedal(entry.rank) && (
                          <span className="text-2xl">{getRankMedal(entry.rank)}</span>
                        )}
                        <span
                          className={`nn-num text-lg font-bold ${
                            entry.rank <= 3 ? 'nn-text-amber' : 'nn-table__dim'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                      </div>
                    </td>

                    {/* Player */}
                    <td>
                      <div>
                        <div className="font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2">
                          {entry.username}
                          {entry.isCurrentPlayer && (
                            <span className="nn-chip nn-chip--violet text-xs">YOU</span>
                          )}
                        </div>
                        {entry.titles.length > 0 && (
                          <div className="nn-footnote nn-text-violet mt-1">
                            {entry.titles[entry.titles.length - 1]}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Total Referrals */}
                    <td>
                      <div className="nn-num text-lg font-bold nn-text-cyan">
                        {entry.totalReferrals}
                      </div>
                      <div className="nn-footnote">total</div>
                    </td>

                    {/* Validated */}
                    <td>
                      <div className="nn-num text-lg font-bold nn-text-green">
                        {entry.validatedReferrals}
                      </div>
                      <div className="nn-footnote">validated</div>
                    </td>

                    {/* Badges */}
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {entry.badges.length === 0 ? (
                          <span className="nn-footnote">No badges yet</span>
                        ) : (
                          entry.badges.map((badge, index) => (
                            <span
                              key={index}
                              className="nn-chip nn-chip--amber"
                              title={badge}
                            >
                              {getBadgeIcon(badge)}
                              {badge.replace('_recruiter', '').toUpperCase()}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      {data.leaderboard.length >= limit && (
        <div className="text-center">
          <button onClick={() => setLimit(limit + 50)} className="nn-btn nn-btn--primary px-6 py-3">
            Load More
          </button>
        </div>
      )}

      {/* Milestone Reference */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Milestone Achievements</span>
          <span className="nn-panel__meta">Badge Track</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">1 Referral</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">🎖️ Recruiter</div>
            </div>
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">5 Referrals</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">🥉 Talent Scout</div>
            </div>
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">15 Referrals</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">🥈 Elite Recruiter</div>
            </div>
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">25 Referrals</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">👑 Ambassador</div>
            </div>
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">50 Referrals</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">🥇 Legendary Recruiter</div>
            </div>
            <div className="nn-well flex-col items-stretch">
              <div className="nn-footnote">100 Referrals</div>
              <div className="text-[color:var(--nn-text-primary)] font-semibold">💎 Empire Builder</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
