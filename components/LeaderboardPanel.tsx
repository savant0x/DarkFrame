/**
 * LeaderboardPanel Component
 * Created: 2025-01-19
 * Converted from: /app/leaderboard/page.tsx
 * 
 * OVERVIEW:
 * In-game panel showing top 100 players ranked by effective power.
 * Displays current player rank, search functionality, and detailed stats.
 * Designed to be shown as overlay panel within game UI.
 * 
 * KEY FEATURES:
 * - Top 100 players in table format with rank badges (🥇🥈🥉)
 * - Current player rank card pinned at top
 * - Real-time search/filter by username
 * - Close button to return to game
 * - Auto-refresh capability
 * 
 * PROPS:
 * - onClose: Callback to close the panel
 */

'use client';

import { useEffect, useState } from 'react';
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

interface LeaderboardPanelProps {
  onClose: () => void;
}

/**
 * LeaderboardPanel Component
 * Panel overlay showing player rankings
 */
export default function LeaderboardPanel({ onClose }: LeaderboardPanelProps) {
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
   * Handle ESC key to close panel
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] mx-auto mb-4"></div>
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
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-[color:var(--nn-magenta)] text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2 text-[color:var(--nn-text-primary)]">Error Loading Leaderboard</h1>
            <p className="text-[color:var(--nn-text-secondary)] mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchLeaderboard}
                className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none transition-colors text-[color:var(--nn-text-primary)]"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-none transition-colors text-[color:var(--nn-text-primary)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  /**
   * Main leaderboard panel
   */
  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
            <div className="flex gap-3">
              <button
                onClick={fetchLeaderboard}
                disabled={refreshing}
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none transition-colors flex items-center gap-2 text-[color:var(--nn-text-primary)]"
              >
                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                Refresh
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-none transition-colors text-[color:var(--nn-text-primary)]"
              >
                ✕ Close
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none focus:outline-none focus:border-blue-500 transition-colors text-[color:var(--nn-text-primary)]"
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
              </tr>
            </thead>
            <tbody className="divide-y divide-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[color:var(--nn-text-secondary)]">
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
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Panel Architecture:
 *    - Fixed overlay with backdrop blur
 *    - Click outside to close
 *    - ESC key to close
 *    - Scrollable table with sticky header
 *    - Current player card always visible in header
 * 
 * 2. Conversion Changes from Page:
 *    - Removed router.push('/game') → replaced with onClose callback
 *    - Added fixed overlay container with z-50
 *    - Added click-outside-to-close functionality
 *    - Added ESC key handler
 *    - Converted full-page layout to panel modal
 * 
 * 3. Preserved Features:
 *    - All original leaderboard functionality
 *    - Search/filter capability
 *    - Refresh button
 *    - Current player highlighting
 *    - Medal emojis for top 3
 *    - Balance status colors
 * 
 * 4. User Experience:
 *    - Panel appears over game UI
 *    - No page navigation required
 *    - Maintains game state
 *    - Quick access via keyboard shortcut
 *    - Smooth transitions
 */
