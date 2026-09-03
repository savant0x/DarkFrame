/**
 * Achievement Stats Modal - Admin Panel
 * Created: 2025-01-18
 * 
 * OVERVIEW:
 * Achievement analytics dashboard for administrators. Displays comprehensive
 * statistics about achievement unlocks, player progress distribution, most
 * common achievements, and rarest achievements. Provides insights into player
 * engagement and progression patterns.
 * 
 * Features:
 * - View all achievements with unlock statistics
 * - Most unlocked achievements (top 10)
 * - Rarest achievements (bottom 10)
 * - Player progress distribution
 * - Unlock percentage calculations
 * - Category filtering
 * - Sort by unlock count or percentage
 * 
 * Achievement Stats Data:
 * - Achievement name and description
 * - Total unlocks count
 * - Unlock percentage (vs total players)
 * - Category (combat, resource, exploration, social, etc.)
 * - First unlock timestamp
 * - Most recent unlock timestamp
 */

'use client';

import React, { useState, useEffect } from 'react';
import { formatDate } from '@/utils/formatting';

/**
 * Achievement stats data structure
 */
interface AchievementStat {
  achievementId: string;
  name: string;
  description: string;
  category: string;
  unlockCount: number;
  unlockPercentage: number;
  firstUnlock?: string; // ISO timestamp
  lastUnlock?: string; // ISO timestamp
}

/**
 * Component props
 */
interface AchievementStatsModalProps {
  onClose: () => void;
}

/**
 * Achievement Stats Modal Component
 * 
 * Provides comprehensive achievement analytics for admins.
 * Fetches all achievement data and displays statistics.
 */
export default function AchievementStatsModal({ onClose }: AchievementStatsModalProps) {
  // Data state
  const [stats, setStats] = useState<AchievementStat[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'unlocks' | 'percentage'>('unlocks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /**
   * Fetch achievement stats on mount
   */
  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/achievement-stats');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setStats(data.achievements || []);
        setTotalPlayers(data.totalPlayers || 0);
      } catch (err) {
        console.error('[AchievementStats] Failed to fetch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load achievement stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  /**
   * Filter and sort achievements
   */
  const filteredStats = React.useMemo(() => {
    let filtered = [...stats];

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(stat => stat.category === filterCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      const compareValue = sortBy === 'unlocks' 
        ? a.unlockCount - b.unlockCount
        : a.unlockPercentage - b.unlockPercentage;
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [stats, filterCategory, sortBy, sortOrder]);

  /**
   * Get top 10 most unlocked achievements
   */
  const topAchievements = React.useMemo(() => {
    return [...stats].sort((a, b) => b.unlockCount - a.unlockCount).slice(0, 10);
  }, [stats]);

  /**
   * Get bottom 10 rarest achievements
   */
  const rarestAchievements = React.useMemo(() => {
    return [...stats]
      .filter(stat => stat.unlockCount > 0)
      .sort((a, b) => a.unlockCount - b.unlockCount)
      .slice(0, 10);
  }, [stats]);

  /**
   * Get unique categories
   */
  const categories = React.useMemo(() => {
    const cats = new Set(stats.map(stat => stat.category));
    return Array.from(cats).sort();
  }, [stats]);

  /**
   * Get category color
   */
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      combat: 'text-red-400',
      resource: 'text-blue-400',
      exploration: 'text-green-400',
      social: 'text-purple-400',
      progression: 'text-yellow-400',
      special: 'text-pink-400',
    };
    return colors[category.toLowerCase()] || 'text-gray-400';
  };

  /**
   * Format date for achievements
   */
  const formatAchievementDate = (isoString?: string): string => {
    if (!isoString) return 'Never';
    return formatAchievementDate(isoString);
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-purple-500 rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Loading achievement stats...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-red-500 rounded-lg p-8 max-w-md w-full">
          <h3 className="text-xl font-bold text-red-500 mb-4">Error Loading Stats</h3>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render main modal
   */
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-purple-500 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-purple-500">
          <div>
            <h2 className="text-2xl font-bold text-purple-400">🎯 Achievement Statistics</h2>
            <p className="text-gray-400 text-sm mt-1">
              {stats.length} achievements · {totalPlayers} total players
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Top Achievement */}
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <h3 className="text-green-400 font-bold mb-2">🏆 Most Unlocked</h3>
              {topAchievements[0] ? (
                <>
                  <p className="text-white font-medium">{topAchievements[0].name}</p>
                  <p className="text-sm text-gray-400">{topAchievements[0].unlockCount} players ({topAchievements[0].unlockPercentage.toFixed(1)}%)</p>
                </>
              ) : (
                <p className="text-gray-400">No data</p>
              )}
            </div>

            {/* Rarest Achievement */}
            <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
              <h3 className="text-purple-400 font-bold mb-2">💎 Rarest</h3>
              {rarestAchievements[0] ? (
                <>
                  <p className="text-white font-medium">{rarestAchievements[0].name}</p>
                  <p className="text-sm text-gray-400">{rarestAchievements[0].unlockCount} players ({rarestAchievements[0].unlockPercentage.toFixed(1)}%)</p>
                </>
              ) : (
                <p className="text-gray-400">No data</p>
              )}
            </div>

            {/* Average Completion */}
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <h3 className="text-blue-400 font-bold mb-2">📊 Average Completion</h3>
              <p className="text-white font-medium text-2xl">
                {stats.length > 0 
                  ? (stats.reduce((sum, stat) => sum + stat.unlockPercentage, 0) / stats.length).toFixed(1)
                  : '0.0'}%
              </p>
              <p className="text-sm text-gray-400">Across all achievements</p>
            </div>
          </div>

          {/* Top 10 Most Unlocked */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-green-400 mb-3">🏆 Top 10 Most Unlocked</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAchievements.map((stat, index) => (
                <div key={stat.achievementId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">#{index + 1}</span>
                      <p className="text-white font-medium">{stat.name}</p>
                      <p className="text-gray-400 text-sm">{stat.description}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-green-400 font-bold">{stat.unlockPercentage.toFixed(1)}%</p>
                      <p className="text-gray-400 text-xs">{stat.unlockCount} unlocks</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rarest 10 Achievements */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-purple-400 mb-3">💎 Rarest 10 Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rarestAchievements.map((stat, index) => (
                <div key={stat.achievementId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">#{index + 1}</span>
                      <p className="text-white font-medium">{stat.name}</p>
                      <p className="text-gray-400 text-sm">{stat.description}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-purple-400 font-bold">{stat.unlockPercentage.toFixed(1)}%</p>
                      <p className="text-gray-400 text-xs">{stat.unlockCount} unlocks</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All Achievements Table */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-white">All Achievements</h3>
              <div className="flex gap-3">
                {/* Category filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Sort by */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'unlocks' | 'percentage')}
                  className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                  <option value="unlocks">Sort by Unlocks</option>
                  <option value="percentage">Sort by Percentage</option>
                </select>

                {/* Sort order */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm transition"
                >
                  {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredStats.map((stat) => (
                <div
                  key={stat.achievementId}
                  className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Name and Description */}
                    <div className="md:col-span-2">
                      <p className="text-white font-medium">{stat.name}</p>
                      <p className="text-gray-400 text-sm">{stat.description}</p>
                      <span className={`text-xs ${getCategoryColor(stat.category)}`}>
                        {stat.category}
                      </span>
                    </div>

                    {/* Unlock Stats */}
                    <div>
                      <p className="text-xs text-gray-500">Unlocks</p>
                      <p className="text-white font-bold text-lg">{stat.unlockCount.toLocaleString()}</p>
                      <p className="text-green-400 text-sm">{stat.unlockPercentage.toFixed(2)}%</p>
                    </div>

                    {/* Dates */}
                    <div>
                      <p className="text-xs text-gray-500">First/Last Unlock</p>
                      <p className="text-gray-300 text-sm">{formatAchievementDate(stat.firstUnlock)}</p>
                      <p className="text-gray-400 text-xs">{formatAchievementDate(stat.lastUnlock)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredStats.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No achievements found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Features Implemented:
 * - Top 10 most unlocked achievements
 * - Rarest 10 achievements
 * - Average completion percentage
 * - All achievements list with details
 * - Category filtering
 * - Sorting by unlocks or percentage
 * - Ascending/descending sort order
 * - Color-coded categories
 * - First and last unlock timestamps
 * 
 * Future Enhancements:
 * - Achievement unlock timeline chart
 * - Player progress distribution histogram
 * - Category comparison charts
 * - Export statistics to CSV
 * - Individual achievement detail modal
 * - Unlock velocity (unlocks per day/week)
 * 
 * Dependencies:
 * - /api/admin/achievement-stats endpoint (must return achievements array and totalPlayers)
 * - Admin authentication in parent component
 * 
 * Performance:
 * - Client-side filtering and sorting for instant feedback
 * - Memoized calculations for top/rarest lists
 * - Optimized re-renders with React.useMemo
 */

