'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatNumber } from '@/utils/formatting';
import { RankedPlayer } from '@/lib/rankingService';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar, BackButton } from '@/components';

interface LeaderboardResponse {
  leaderboard: RankedPlayer[];
  currentPlayerRank: number | null;
  currentPlayerData: RankedPlayer | null;
  totalPlayers: number;
  lastUpdated: string;
}

export default function LeaderboardPage() {
  const router = useRouter();

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      setRefreshing(true);
      const username = sessionStorage.getItem('username');
      const params = new URLSearchParams();
      if (username) {
        params.append('username', username);
      }
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }
      const data: LeaderboardResponse = await response.json();
      setLeaderboardData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const filteredLeaderboard = leaderboardData?.leaderboard.filter(player =>
    player.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getRankDisplay = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getBalanceColor = (status: string): string => {
    switch (status) {
      case 'OPTIMAL':
        return 'text-[--synth]';
      case 'BALANCED':
        return 'text-[--electric]';
      case 'IMBALANCED':
        return 'text-[--neon-yellow]';
      case 'CRITICAL':
        return 'text-[--neon-red]';
      default:
        return 'text-white/60';
    }
  };

  if (loading) {
    return (
      <>
        <TopNavBar onFriendsClick={() => {}} />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[--electric] mx-auto mb-4"></div>
                <p className="text-xl">Loading leaderboard...</p>
              </div>
            </div>
          }
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopNavBar onFriendsClick={() => {}} />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-[--neon-red] text-6xl mb-4">⚠️</div>
                <h1 className="text-2xl font-bold mb-2">Error Loading Leaderboard</h1>
                <p className="text-white/60 mb-6">{error}</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={fetchLeaderboard}
                    className="px-6 py-2 bg-[--electric] hover:opacity-80 rounded transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => router.push('/game')}
                    className="px-6 py-2 bg-[--card] hover:opacity-80 rounded transition-colors"
                  >
                    Back to Game
                  </button>
                </div>
              </div>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <TopNavBar onFriendsClick={() => {}} />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-4">
            <div className="max-w-7xl mx-auto mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <BackButton />
                  <div className="h-8 w-px bg-[--border]" />
                  <div>
                    <h1 className="text-4xl font-bold">🏆 Player Rankings</h1>
                    <p className="text-white/60">
                      {leaderboardData?.totalPlayers.toLocaleString()} players |
                      Last updated: {leaderboardData ? new Date(leaderboardData.lastUpdated).toLocaleTimeString() : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={fetchLeaderboard}
                    disabled={refreshing}
                    className="px-4 py-2 bg-[--electric] hover:opacity-80 disabled:bg-[--card] rounded transition-colors flex items-center gap-2"
                  >
                    <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-[--card] border border-[--border] rounded focus:outline-none focus:border-[--electric] transition-colors"
                />
                {searchQuery && (
                  <p className="text-sm text-white/60 mt-2">
                    Found {filteredLeaderboard.length} player(s) matching "{searchQuery}"
                  </p>
                )}
              </div>

              {leaderboardData?.currentPlayerData && (
                <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/60 mb-1">Your Rank</p>
                      <p className="text-3xl font-bold">
                        {getRankDisplay(leaderboardData.currentPlayerRank || 0)}
                      </p>
                      <p className="text-xl mt-1">{leaderboardData.currentPlayerData.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white/60 mb-1">Effective Power</p>
                      <p className="text-2xl font-bold text-[--neon-yellow]">
                        {formatNumber(leaderboardData.currentPlayerData.effectivePower)}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-[--neon-pink]">⭐ Level {leaderboardData.currentPlayerData.level || 1}</span>
                        </div>
                        <div>
                          <span className="text-white/60">🏭 {formatNumber(leaderboardData.currentPlayerData.factoriesOwned)}</span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${getBalanceColor(leaderboardData.currentPlayerData.balanceStatus)}`}>
                        {leaderboardData.currentPlayerData.balanceStatus}
                        ({(leaderboardData.currentPlayerData.balanceMultiplier * 100).toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="max-w-7xl mx-auto">
              <div className="bg-[--card] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[--card]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Player</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Effective Power</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-white/60 uppercase tracking-wider">Level</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-white/60 uppercase tracking-wider">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      {filteredLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-white/60">
                            {searchQuery ? 'No players found matching your search' : 'No players yet'}
                          </td>
                        </tr>
                      ) : (
                        filteredLeaderboard.map((player, index) => {
                          const isCurrentPlayer = player.username === leaderboardData?.currentPlayerData?.username;
                          return (
                            <tr
                              key={`${player.rank}-${player.username}`}
                              className={`${isCurrentPlayer ? 'bg-[--electric]/10' : 'hover:bg-[--card]'} transition-colors`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-2xl">{getRankDisplay(player.rank)}</span>
                                {player.rank > 3 && (
                                  <span className="ml-2 text-lg font-semibold text-white/60">
                                    #{player.rank}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className={`font-medium ${isCurrentPlayer ? 'text-[--electric]' : 'text-white'}`}>
                                    {player.username}
                                  </span>
                                  {isCurrentPlayer && (
                                    <span className="ml-2 px-2 py-1 text-xs bg-[--electric] rounded">YOU</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="text-[--neon-yellow] font-bold text-lg">
                                  {formatNumber(player.effectivePower)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-[--neon-pink] font-semibold">
                                  ⭐ {player.level || 1}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className={`text-sm ${getBalanceColor(player.balanceStatus)}`}>
                                  {player.balanceStatus}
                                </div>
                                <div className="text-xs text-white/40">
                                  {(player.balanceMultiplier * 100).toFixed(0)}%
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 text-center text-white/40 text-sm">
                <p>Rankings based on Effective Power: (Strength + Defense) × Balance Multiplier</p>
                <p className="mt-1">Maintain balanced armies for optimal ranking position</p>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
