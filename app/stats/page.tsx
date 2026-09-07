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

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { 
  Swords, 
  Coins, 
  Users, 
  Target,
  Award,
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

  /**
   * Fetch game statistics from API
   */
  const fetchStats = useCallback(async () => {
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
  }, [sortBy]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
            <div className="animate-spin mx-auto mb-4 h-14 w-14 rounded-none border-2 border-b-0 border-[color-mix(in_oklab,var(--nn-violet)_45%,transparent)]"></div>
            <p className="nn-lab">Loading statistics...</p>
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
          <div className="nn-panel max-w-md p-6" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
            <p className="nn-msg__text text-center">{error}</p>
            <button
              onClick={() => router.push('/game')}
              className="nn-btn nn-btn--ghost mt-4 w-full"
            >
              Return to Game
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-auto" style={{ background: 'var(--nn-void)' }}>
      {/* Header — sample .sec-label */}
      <div className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] px-6 py-5" style={{ background: 'color-mix(in oklab, var(--nn-void) 88%, transparent)' }}>
        <div className="mx-auto max-w-7xl">
          <div className="nn-sec">
            <span className="nn-sec__title">Game Statistics</span>
            <span className="nn-sec__note">Global ▸ Server Telemetry</span>
            <button
              onClick={() => router.push('/game')}
              className="nn-link nn-sec__end flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Game</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Global Stats Overview */}
        {gameStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Total Players
              </p>
              <p className="nn-stat__num nn-stat__num--glow-violet">{gameStats.totalPlayers.toLocaleString()}</p>
            </div>

            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Coins className="h-3.5 w-3.5" />
                Total Metal
              </p>
              <p className="nn-stat__num nn-stat__num--glow-amber">{gameStats.totalMetal.toLocaleString()}</p>
            </div>

            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Coins className="h-3.5 w-3.5" />
                Total Energy
              </p>
              <p className="nn-stat__num nn-stat__num--glow-cyan">{gameStats.totalEnergy.toLocaleString()}</p>
            </div>

            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Target className="h-3.5 w-3.5" />
                Avg Level
              </p>
              <p className="nn-stat__num nn-stat__num--glow-green">{gameStats.averageLevel.toFixed(1)}</p>
            </div>
          </div>
        )}

        {/* Top Players Section */}
        <div className="nn-panel overflow-hidden">
          {/* Scanline header strip with sort instrument */}
          <div className="nn-panel__header">
            <span className="nn-panel__title">Top Players</span>
            <span className="nn-panel__meta">Ranked ▸ By {sortBy}</span>
            <div className="nn-sz ml-4">
              <button onClick={() => setSortBy('power')} className={sortBy === 'power' ? 'on' : ''}>
                Power
              </button>
              <button onClick={() => setSortBy('level')} className={sortBy === 'level' ? 'on' : ''}>
                Level
              </button>
              <button onClick={() => setSortBy('metal')} className={sortBy === 'metal' ? 'on' : ''}>
                Metal
              </button>
            </div>
          </div>

          {/* Player List */}
          <div className="p-4">
            {topPlayers.length === 0 ? (
              <p className="nn-lab py-8 text-center">No players found</p>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((player, index) => (
                  <div
                    key={player._id}
                    className={`nn-well !mx-0 p-4 transition-colors ${
                      index === 0
                        ? '!border-[color-mix(in_oklab,var(--nn-amber)_45%,transparent)]'
                        : index === 1
                        ? '!border-[color-mix(in_oklab,var(--nn-cyan)_35%,transparent)]'
                        : index === 2
                        ? '!border-[color-mix(in_oklab,var(--nn-violet)_35%,transparent)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`nn-num w-8 text-center text-xl font-bold ${
                        index === 0
                          ? 'text-[color:var(--nn-amber)]'
                          : index === 1
                          ? 'text-[color:var(--nn-cyan)]'
                          : index === 2
                          ? 'text-[color:var(--nn-violet)]'
                          : 'text-[color:var(--nn-text-tertiary)]'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[color:var(--nn-cyan)]">{player.username}</p>
                        <p className="nn-msg__time">Level {player.level}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {sortBy === 'power' && (
                        <div className="nn-num flex items-center justify-end gap-2 font-bold text-[color:var(--nn-violet)]">
                          <Swords className="w-4 h-4" />
                          {(player.totalPower ?? 0).toLocaleString()}
                        </div>
                      )}
                      {sortBy === 'level' && (
                        <div className="nn-num flex items-center justify-end gap-2 font-bold text-[color:var(--nn-violet)]">
                          <Award className="w-4 h-4" />
                          Level {player.level}
                        </div>
                      )}
                      {sortBy === 'metal' && (
                        <div className="nn-num flex items-center justify-end gap-2 font-bold text-[color:var(--nn-amber)]">
                          <Coins className="w-4 h-4" />
                          {(player.metal ?? 0).toLocaleString()}
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
