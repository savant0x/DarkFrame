/**
 * LeaderboardView Component
 * Created: 2025-01-19
 * Extracted from: LeaderboardPanel.tsx
 * 
 * OVERVIEW:
 * Center-embedded view showing top 100 players ranked by effective power.
 * Displays current player rank, search functionality, and detailed stats.
 * Designed to be embedded in GameLayout center panel (NOT an overlay).
 * 
 * KEY FEATURES:
 * - Top 100 players in table format with rank badges (🥇🥈🥉)
 * - Current player rank card pinned at top
 * - Real-time search/filter by username
 * - Auto-refresh capability
 * 
 * USAGE:
 * <LeaderboardView />
 * 
 * Displayed when currentView === 'LEADERBOARD' in game page.
 */

'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RankedPlayer } from '@/lib/rankingService';
import { formatNumber } from '@/utils/formatting';

/**
 * Leaderboard API response interface
 */
interface LeaderboardResponse {
  leaderboard: RankedPlayer[];
  currentPlayerRank: number | null;
  currentPlayerData: RankedPlayer | null;
  totalPlayers: number;
  lastUpdated: string;
}

/**
 * LeaderboardView Component
 * Embedded center view showing player rankings
 */
export default function LeaderboardView() {
  // State management
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  /**
   * Fetch leaderboard data from API
   */
  const fetchLeaderboard = async () => {
    try {
      setRefreshing(true);
      
      // Get current player username from session storage
      const username = sessionStorage.getItem('username');
      
      // Build API URL
      const params = new URLSearchParams();
      if (username) {
        params.append('username', username);
      }
      
      // Fetch data
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
  
  /**
   * Initial data load
   */
  useEffect(() => {
    fetchLeaderboard();
  }, []);
  
  /**
   * Filter leaderboard by search query
   */
  const filteredLeaderboard = leaderboardData?.leaderboard.filter(player =>
    player.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  /**
   * Get rank display with medal emojis
   */
  const getRankDisplay = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };
  
  /**
   * Get balance status color
   */
  const getBalanceColor = (status: string): string => {
    switch (status) {
      case 'OPTIMAL':
        return 'text-[color:var(--nn-green)]';
      case 'BALANCED':
        return 'text-[color:var(--nn-cyan)]';
      case 'IMBALANCED':
        return 'text-[color:var(--nn-amber)]';
      case 'CRITICAL':
        return 'text-[color:var(--nn-magenta)]';
      default:
        return 'text-[color:var(--nn-text-secondary)]';
    }
  };
  
  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl p-8">
          <div className="text-center">
            <Loader2 className="nn-spin-icon w-16 h-16 text-[color:var(--nn-cyan)] mx-auto mb-4" aria-label="Loading leaderboard" />
            <p className="text-xl text-[color:var(--nn-text-primary)]">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }
  
  /**
   * Error state
   */
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl p-8 max-w-md">
          <div className="text-center">
            <div className="text-[color:var(--nn-magenta)] text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2 text-[color:var(--nn-text-primary)]">Error Loading Leaderboard</h1>
            <p className="text-[color:var(--nn-text-secondary)] mb-6">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none transition-colors text-[color:var(--nn-text-primary)]"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  /**
   * Main leaderboard view (embedded in center panel)
   */
  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-[color:var(--nn-void)] border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-[color:var(--nn-text-primary)] mb-2">🏆 Player Rankings</h1>
            <p className="text-[color:var(--nn-text-secondary)]">
              {leaderboardData?.totalPlayers.toLocaleString()} players | 
              Last updated: {leaderboardData ? new Date(leaderboardData.lastUpdated).toLocaleTimeString() : ''}
            </p>
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={refreshing}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none transition-colors flex items-center gap-2 text-[color:var(--nn-text-primary)]"
          >
            <Loader2 className={`w-4 h-4 ${refreshing ? 'nn-spin-icon' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nn-input w-full"
          />
          {searchQuery && (
            <p className="text-sm text-[color:var(--nn-text-secondary)] mt-2">
              Found {filteredLeaderboard.length} player(s) matching &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
        
        {/* Current Player Rank Card */}
        {leaderboardData?.currentPlayerData && (
          <div className="bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-violet)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Your Rank</p>
                <p className="text-3xl font-bold text-[color:var(--nn-text-primary)]">
                  {getRankDisplay(leaderboardData.currentPlayerRank || 0)} 
                  {leaderboardData.currentPlayerRank && leaderboardData.currentPlayerRank > 3 && 
                    ` #${leaderboardData.currentPlayerRank}`
                  }
                </p>
                <p className="text-xl mt-1 text-[color:var(--nn-text-primary)]">{leaderboardData.currentPlayerData.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Effective Power</p>
                <p className="text-2xl font-bold text-[color:var(--nn-amber)]">
                  {formatNumber(leaderboardData.currentPlayerData.effectivePower)}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <div>
                    <span className="text-[color:var(--nn-violet)]">⭐ Level {leaderboardData.currentPlayerData.level || 1}</span>
                  </div>
                  <div>
                    <span className="text-[color:var(--nn-text-secondary)]">🏭 {formatNumber(leaderboardData.currentPlayerData.factoriesOwned)}</span>
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
      
      {/* Leaderboard Table - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Effective Power
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Level
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[color:var(--nn-text-secondary)] uppercase tracking-wider">
                Referrals
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            {filteredLeaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[color:var(--nn-text-secondary)]">
                  {searchQuery ? 'No players found matching your search' : 'No players yet'}
                </td>
              </tr>
            ) : (
              filteredLeaderboard.map((player) => {
                const isCurrentPlayer = player.username === leaderboardData?.currentPlayerData?.username;
                
                return (
                  <tr 
                    key={`${player.rank}-${player.username}`}
                    className={`
                      ${isCurrentPlayer ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)]'}
                      transition-colors
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-2xl">{getRankDisplay(player.rank)}</span>
                      {player.rank > 3 && (
                        <span className="ml-2 text-lg font-semibold text-[color:var(--nn-text-secondary)]">
                          #{player.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`font-medium ${isCurrentPlayer ? 'text-[color:var(--nn-cyan)]' : 'text-[color:var(--nn-text-primary)]'}`}>
                          {player.username}
                        </span>
                        {isCurrentPlayer && (
                          <span className="ml-2 px-2 py-1 text-xs bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none text-[color:var(--nn-text-primary)]">YOU</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-[color:var(--nn-amber)] font-bold text-lg">
                        {formatNumber(player.effectivePower)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-[color:var(--nn-violet)] font-semibold">
                        ⭐ {player.level || 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-sm ${getBalanceColor(player.balanceStatus)}`}>
                        {player.balanceStatus}
                      </div>
                      <div className="text-xs text-[color:var(--nn-text-secondary)]">
                        {(player.balanceMultiplier * 100).toFixed(0)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-[color:var(--nn-violet)] font-semibold">
                        {player.validatedReferrals !== undefined ? (
                          <>
                            🎁 {player.validatedReferrals}
                          </>
                        ) : (
                          <span className="text-[color:var(--nn-text-secondary)]">—</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="bg-[color:var(--nn-void)] border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-4 text-center text-[color:var(--nn-text-secondary)] text-sm flex-shrink-0">
        <p>Rankings based on Effective Power: (Strength + Defense) × Balance Multiplier</p>
        <p className="mt-1">Maintain balanced armies for optimal ranking position</p>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Center-Embedded Architecture:
 *    - NO fixed overlay positioning
 *    - NO backdrop
 *    - NO click-outside-to-close
 *    - NO ESC key handler (handled by parent)
 *    - Fills GameLayout center panel completely
 * 
 * 2. Differences from LeaderboardPanel:
 *    - Removed all fixed/z-50/absolute positioning
 *    - Removed onClose prop (parent handles via Back button)
 *    - Removed backdrop click handler
 *    - Removed ESC key listener
 *    - Changed container from fixed overlay to flex column
 * 
 * 3. Preserved Features:
 *    - All leaderboard functionality
 *    - Search/filter capability
 *    - Refresh button
 *    - Current player highlighting
 *    - Medal emojis for top 3
 *    - Balance status colors
 *    - Scrollable table with sticky header
 * 
 * 4. User Experience:
 *    - View embedded in GameLayout center
 *    - Game UI wrapper stays visible (StatsPanel, TopNav, Controls)
 *    - Parent provides "Back to Game" button
 *    - No page navigation, maintains game state
 * 
 * 5. Integration:
 *    - Rendered when currentView === 'LEADERBOARD'
 *    - Placed in GameLayout tileView prop
 *    - No props needed (self-contained)
 */
