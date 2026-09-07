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
      combat: 'text-[color:var(--nn-magenta)]',
      resource: 'text-[color:var(--nn-cyan)]',
      exploration: 'text-[color:var(--nn-green)]',
      social: 'text-[color:var(--nn-violet)]',
      progression: 'text-[color:var(--nn-amber)]',
      special: 'text-[color:var(--nn-magenta)]',
    };
    return colors[category.toLowerCase()] || 'text-[color:var(--nn-text-secondary)]';
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
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] mx-auto mb-4"></div>
            <p className="text-[color:var(--nn-text-secondary)]">Loading achievement stats...</p>
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
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <h3 className="text-xl font-bold text-[color:var(--nn-magenta)] mb-4">Error Loading Stats</h3>
          <p className="text-[color:var(--nn-text-secondary)] mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition"
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
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">🎯 Achievement Statistics</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              {stats.length} achievements · {totalPlayers} total players
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Top Achievement */}
            <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
              <h3 className="text-[color:var(--nn-green)] font-bold mb-2">🏆 Most Unlocked</h3>
              {topAchievements[0] ? (
                <>
                  <p className="text-[color:var(--nn-text-primary)] font-medium">{topAchievements[0].name}</p>
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">{topAchievements[0].unlockCount} players ({topAchievements[0].unlockPercentage.toFixed(1)}%)</p>
                </>
              ) : (
                <p className="text-[color:var(--nn-text-secondary)]">No data</p>
              )}
            </div>

            {/* Rarest Achievement */}
            <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-4">
              <h3 className="text-[color:var(--nn-violet)] font-bold mb-2">💎 Rarest</h3>
              {rarestAchievements[0] ? (
                <>
                  <p className="text-[color:var(--nn-text-primary)] font-medium">{rarestAchievements[0].name}</p>
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">{rarestAchievements[0].unlockCount} players ({rarestAchievements[0].unlockPercentage.toFixed(1)}%)</p>
                </>
              ) : (
                <p className="text-[color:var(--nn-text-secondary)]">No data</p>
              )}
            </div>

            {/* Average Completion */}
            <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
              <h3 className="text-[color:var(--nn-cyan)] font-bold mb-2">📊 Average Completion</h3>
              <p className="text-[color:var(--nn-text-primary)] font-medium text-2xl">
                {stats.length > 0 
                  ? (stats.reduce((sum, stat) => sum + stat.unlockPercentage, 0) / stats.length).toFixed(1)
                  : '0.0'}%
              </p>
              <p className="text-sm text-[color:var(--nn-text-secondary)]">Across all achievements</p>
            </div>
          </div>

          {/* Top 10 Most Unlocked */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[color:var(--nn-green)] mb-3">🏆 Top 10 Most Unlocked</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAchievements.map((stat, index) => (
                <div key={stat.achievementId} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-[color:var(--nn-text-secondary)] text-sm">#{index + 1}</span>
                      <p className="text-[color:var(--nn-text-primary)] font-medium">{stat.name}</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">{stat.description}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-[color:var(--nn-green)] font-bold">{stat.unlockPercentage.toFixed(1)}%</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-xs">{stat.unlockCount} unlocks</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rarest 10 Achievements */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[color:var(--nn-violet)] mb-3">💎 Rarest 10 Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rarestAchievements.map((stat, index) => (
                <div key={stat.achievementId} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-[color:var(--nn-text-secondary)] text-sm">#{index + 1}</span>
                      <p className="text-[color:var(--nn-text-primary)] font-medium">{stat.name}</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">{stat.description}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-[color:var(--nn-violet)] font-bold">{stat.unlockPercentage.toFixed(1)}%</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-xs">{stat.unlockCount} unlocks</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All Achievements Table */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)]">All Achievements</h3>
              <div className="flex gap-3">
                {/* Category filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
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
                  className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                >
                  <option value="unlocks">Sort by Unlocks</option>
                  <option value="percentage">Sort by Percentage</option>
                </select>

                {/* Sort order */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-sm transition"
                >
                  {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredStats.map((stat) => (
                <div
                  key={stat.achievementId}
                  className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] transition"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Name and Description */}
                    <div className="md:col-span-2">
                      <p className="text-[color:var(--nn-text-primary)] font-medium">{stat.name}</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">{stat.description}</p>
                      <span className={`text-xs ${getCategoryColor(stat.category)}`}>
                        {stat.category}
                      </span>
                    </div>

                    {/* Unlock Stats */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Unlocks</p>
                      <p className="text-[color:var(--nn-text-primary)] font-bold text-lg">{stat.unlockCount.toLocaleString()}</p>
                      <p className="text-[color:var(--nn-green)] text-sm">{stat.unlockPercentage.toFixed(2)}%</p>
                    </div>

                    {/* Dates */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">First/Last Unlock</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">{formatAchievementDate(stat.firstUnlock)}</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-xs">{formatAchievementDate(stat.lastUnlock)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredStats.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[color:var(--nn-text-secondary)]">No achievements found</p>
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

