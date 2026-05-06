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
        return 'text-green-400';
      case 'BALANCED':
        return 'text-blue-400';
      case 'IMBALANCED':
        return 'text-yellow-400';
      case 'CRITICAL':
        return 'text-red-400';
      default:
        return 'text-gray-400';
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
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-xl text-white">Loading leaderboard...</p>
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
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2 text-white">Error Loading Leaderboard</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchLeaderboard}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-white"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-white"
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🏆 Player Rankings</h1>
              <p className="text-gray-400">
                {leaderboardData?.totalPlayers.toLocaleString()} players | 
                Last updated: {leaderboardData ? new Date(leaderboardData.lastUpdated).toLocaleTimeString() : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchLeaderboard}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded transition-colors flex items-center gap-2 text-white"
              >
                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                Refresh
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-white"
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
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 transition-colors text-white"
            />
            {searchQuery && (
              <p className="text-sm text-gray-400 mt-2">
                Found {filteredLeaderboard.length} player(s) matching "{searchQuery}"
              </p>
            )}
          </div>
          
          {/* Current Player Rank Card */}
          {leaderboardData?.currentPlayerData && (
            <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Your Rank</p>
                  <p className="text-3xl font-bold text-white">
                    {getRankDisplay(leaderboardData.currentPlayerRank || 0)} 
                    {leaderboardData.currentPlayerRank && leaderboardData.currentPlayerRank > 3 && 
                      ` #${leaderboardData.currentPlayerRank}`
                    }
                  </p>
                  <p className="text-xl mt-1 text-white">{leaderboardData.currentPlayerData.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Effective Power</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {formatNumber(leaderboardData.currentPlayerData.effectivePower)}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <div>
                      <span className="text-purple-400">⭐ Level {leaderboardData.currentPlayerData.level || 1}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">🏭 {formatNumber(leaderboardData.currentPlayerData.factoriesOwned)}</span>
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
            <thead className="bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Effective Power
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
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
                        ${isCurrentPlayer ? 'bg-blue-900/30' : 'hover:bg-gray-750'}
                        transition-colors
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-2xl">{getRankDisplay(player.rank)}</span>
                        {player.rank > 3 && (
                          <span className="ml-2 text-lg font-semibold text-gray-400">
                            #{player.rank}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`font-medium ${isCurrentPlayer ? 'text-blue-400' : 'text-white'}`}>
                            {player.username}
                          </span>
                          {isCurrentPlayer && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-600 rounded text-white">YOU</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-yellow-400 font-bold text-lg">
                          {formatNumber(player.effectivePower)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-purple-400 font-semibold">
                          ⭐ {player.level || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-sm ${getBalanceColor(player.balanceStatus)}`}>
                          {player.balanceStatus}
                        </div>
                        <div className="text-xs text-gray-500">
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
        <div className="bg-gray-900 border-t border-gray-700 p-4 text-center text-gray-500 text-sm flex-shrink-0">
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
