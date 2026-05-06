// ============================================================
// FILE: app/stats/page.tsx
// CREATED: 2025-01-18
// LAST MODIFIED: 2025-01-18
// ============================================================
// OVERVIEW:
// Global game statistics page showing player rankings, resource totals,
// and game-wide metrics. Displays top players by various categories,
// total game statistics, and recent achievements.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { 
  Trophy, 
  Swords, 
  Shield, 
  Coins, 
  Users, 
  Target,
  TrendingUp,
  Award,
  Crown,
  ArrowLeft
} from 'lucide-react';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface PlayerStat {
  _id: string;
  username: string;
  level: number;
  totalPower: number;
  totalStrength: number;
  totalDefense: number;
  metal: number;
  rank: number;
}

interface GameStats {
  totalPlayers: number;
  totalMetal: number;
  totalEnergy: number;
  totalPower: number;
  averageLevel: number;
  totalBattles: number;
  totalTerritories: number;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Stats Page Component
 * 
 * Displays comprehensive game statistics including:
 * - Top players by power, level, and wealth
 * - Global game metrics
 * - Recent achievements
 * - Historical trends
 */
export default function StatsPage() {
  const router = useRouter();
  const [topPlayers, setTopPlayers] = useState<PlayerStat[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'metal'>('power');

  // ============================================================
  // DATA FETCHING
  // ============================================================

  useEffect(() => {
    fetchStats();
  }, [sortBy]);

  /**
   * Fetch game statistics from API
   */
  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stats?sortBy=${sortBy}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setTopPlayers(data.topPlayers || []);
      setGameStats(data.gameStats || null);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  /**
   * Render stats content
   */
  const renderStatsContent = () => {
    /**
     * Render loading state
     */
    if (isLoading) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white/70">Loading statistics...</p>
          </div>
        </div>
      );
    }

    /**
     * Render error state
     */
    if (error) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-red-500/20 border-2 border-red-500/50 rounded-lg p-6 max-w-md">
            <p className="text-red-400 text-center">{error}</p>
            <button
              onClick={() => router.push('/game')}
              className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Return to Game
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-auto bg-gradient-to-b from-gray-900 to-black">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b-2 border-purple-500/30 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/game')}
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Game</span>
            </button>
            <div className="h-8 w-px bg-purple-500/30"></div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-purple-400" />
              Game Statistics
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Global Stats Overview */}
        {gameStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Total Players</h3>
              </div>
              <p className="text-3xl font-bold text-purple-400">{gameStats.totalPlayers.toLocaleString()}</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-6 h-6 text-orange-400" />
                <h3 className="text-lg font-bold text-white">Total Metal</h3>
              </div>
              <p className="text-3xl font-bold text-orange-400">{gameStats.totalMetal.toLocaleString()}</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Total Energy</h3>
              </div>
              <p className="text-3xl font-bold text-cyan-400">{gameStats.totalEnergy.toLocaleString()}</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Avg Level</h3>
              </div>
              <p className="text-3xl font-bold text-purple-400">{gameStats.averageLevel.toFixed(1)}</p>
            </div>
          </div>
        )}

        {/* Top Players Section */}
        <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg overflow-hidden">
          {/* Header with Sort Options */}
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border-b border-purple-500/30 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                Top Players
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('power')}
                  className={`px-3 py-1 rounded ${
                    sortBy === 'power'
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-gray-800/50 text-white/70 hover:bg-gray-700/50'
                  }`}
                >
                  <Swords className="w-4 h-4 inline mr-1" />
                  Power
                </button>
                <button
                  onClick={() => setSortBy('level')}
                  className={`px-3 py-1 rounded ${
                    sortBy === 'level'
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-gray-800/50 text-white/70 hover:bg-gray-700/50'
                  }`}
                >
                  <Award className="w-4 h-4 inline mr-1" />
                  Level
                </button>
                <button
                  onClick={() => setSortBy('metal')}
                  className={`px-3 py-1 rounded ${
                    sortBy === 'metal'
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-gray-800/50 text-white/70 hover:bg-gray-700/50'
                  }`}
                >
                  <Coins className="w-4 h-4 inline mr-1" />
                  Metal
                </button>
              </div>
            </div>
          </div>

          {/* Player List */}
          <div className="p-4">
            {topPlayers.length === 0 ? (
              <p className="text-white/70 text-center py-8">No players found</p>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((player, index) => (
                  <div
                    key={player._id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      index === 0
                        ? 'bg-yellow-500/10 border-yellow-500/50'
                        : index === 1
                        ? 'bg-gray-400/10 border-gray-400/50'
                        : index === 2
                        ? 'bg-orange-500/10 border-orange-500/50'
                        : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-white/50 w-8 text-center">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg">{player.username}</p>
                        <p className="text-white/50 text-sm">Level {player.level}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {sortBy === 'power' && (
                        <div className="flex items-center gap-2">
                          <Swords className="w-4 h-4 text-purple-400" />
                          <span className="text-white font-bold">{player.totalPower.toLocaleString()}</span>
                        </div>
                      )}
                      {sortBy === 'level' && (
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-purple-400" />
                          <span className="text-white font-bold">Level {player.level}</span>
                        </div>
                      )}
                      {sortBy === 'metal' && (
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-orange-400" />
                          <span className="text-white font-bold">{player.metal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    );
  };

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={renderStatsContent()}
      />
    </>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Fetches top players and global statistics from /api/stats
// - Supports sorting by power, level, or gold
// - Displays top 3 players with special highlighting (gold, silver, bronze)
// - Shows global game metrics (total players, gold, average level)
// - Glassmorphism design matching game theme
// - Back button for easy navigation to game
// - Loading and error states with proper UI feedback
// - Responsive layout with grid for stats cards
// ============================================================
// END OF FILE
// ============================================================
