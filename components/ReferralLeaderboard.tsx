/**
 * @file components/ReferralLeaderboard.tsx
 * @created 2025-10-24
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
 * - Current player's rank highlighted
 * - Pagination support
 * - Real-time updates
 * - Medal icons for top 3
 * 
 * Dependencies: /api/referral/leaderboard, GameContext
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
          leaderboard: apiData.leaderboard.map((entry: any) => ({
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-[color:var(--nn-magenta)]">
        Failed to load leaderboard. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-6">
        <h2 className="text-2xl font-bold text-[color:var(--nn-violet)] mb-2">Top Recruiters</h2>
        <p className="text-text-primary">
          Hall of fame for the most successful recruiters in DarkFrame
        </p>
        {data.currentPlayerRank && (
          <div className="mt-4 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] rounded-none p-3 inline-block">
            <span className="text-[color:var(--nn-violet)]">Your Rank: </span>
            <span className="text-2xl font-bold text-[color:var(--nn-violet)]">#{data.currentPlayerRank}</span>
            <span className="text-text-secondary ml-2">of {data.totalPlayers}</span>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-glass-dark border-b border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Player</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Referrals</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Validated</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Achievements</th>
              </tr>
            </thead>
            <tbody>
              {!data?.leaderboard || data.leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    No recruiters yet. Be the first!
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((entry) => (
                  <tr
                    key={entry.username}
                    className={`border-b border-glass-border transition-colors ${
                      entry.isCurrentPlayer
                        ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]'
                        : 'hover:bg-glass-light'
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getRankMedal(entry.rank) && (
                          <span className="text-2xl">{getRankMedal(entry.rank)}</span>
                        )}
                        <span
                          className={`text-lg font-bold ${
                            entry.rank <= 3 ? 'text-[color:var(--nn-amber)]' : 'text-text-secondary'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                      </div>
                    </td>

                    {/* Player */}
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2">
                          {entry.username}
                          {entry.isCurrentPlayer && (
                            <span className="text-xs bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-2 py-0.5 rounded-none">
                              YOU
                            </span>
                          )}
                        </div>
                        {entry.titles.length > 0 && (
                          <div className="text-sm text-[color:var(--nn-violet)] mt-1">
                            {entry.titles[entry.titles.length - 1]}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Total Referrals */}
                    <td className="px-4 py-4">
                      <div className="text-lg font-bold text-[color:var(--nn-cyan)]">
                        {entry.totalReferrals}
                      </div>
                      <div className="text-xs text-text-secondary">total</div>
                    </td>

                    {/* Validated */}
                    <td className="px-4 py-4">
                      <div className="text-lg font-bold text-[color:var(--nn-green)]">
                        {entry.validatedReferrals}
                      </div>
                      <div className="text-xs text-text-secondary">validated</div>
                    </td>

                    {/* Badges */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {entry.badges.length === 0 ? (
                          <span className="text-sm text-text-secondary">No badges yet</span>
                        ) : (
                          entry.badges.map((badge, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold"
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
          <button
            onClick={() => setLimit(limit + 50)}
            className="px-6 py-3 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition-colors font-semibold"
          >
            Load More
          </button>
        </div>
      )}

      {/* Milestone Reference */}
      <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-6">
        <h3 className="text-lg font-bold text-[color:var(--nn-cyan)] mb-4">Milestone Achievements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">1 Referral</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">🎖️ Recruiter</div>
          </div>
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">5 Referrals</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">🥉 Talent Scout</div>
          </div>
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">15 Referrals</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">🥈 Elite Recruiter</div>
          </div>
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">25 Referrals</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">👑 Ambassador</div>
          </div>
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">50 Referrals</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">🥇 Legendary Recruiter</div>
          </div>
          <div className="bg-glass-dark rounded-none p-3">
            <div className="text-sm text-text-secondary">100 Referrals</div>
            <div className="text-[color:var(--nn-text-primary)] font-semibold">💎 Empire Builder</div>
          </div>
        </div>
      </div>
    </div>
  );
}
