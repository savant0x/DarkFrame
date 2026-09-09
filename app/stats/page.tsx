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
import { GameLayout, StatsPanel, ControlsPanel, BattleLogLinks } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { useGameContext } from '@/context/GameContext';
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
  const { player } = useGameContext();
  const [topPlayers, setTopPlayers] = useState<PlayerStat[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'metal'>('power');
  const [chatTab, setChatTab] = useState<'CHAT' | 'DM'>('CHAT');
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

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
            <div
              className="mx-auto mb-4 h-10 w-10"
              style={{
                border: '2px solid color-mix(in oklab, var(--nn-violet) 45%, transparent)',
                borderBottomColor: 'transparent',
                borderRadius: 0,
                animation: 'nn-spin 0.9s linear infinite',
              }}
              aria-hidden
            />
            <p className="nn-lab">Loading statistics…</p>
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
          <div className="nn-panel nn-panel--x-pad max-w-md" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
            <div className="nn-panel__header nn-panel__header--bleed nn-panel__header--magenta">
              <span className="nn-panel__title">Telemetry Error</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)', padding: '10px 0 16px' }}>{error}</p>
            <button
              onClick={() => router.push('/game')}
              className="nn-btn nn-btn--ghost"
            >
              Return to Game
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col overflow-auto" style={{ background: 'var(--nn-void)' }}>
      {/* Header — full-bleed strip, pinned below the TopNav; content shares
          the body's max-w container so strip and grid align on one axis */}
      <div
        className="sticky top-0 z-20 border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] px-6 py-5"
        style={{ background: 'color-mix(in oklab, var(--nn-void) 92%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
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

      <div className="mx-auto w-full max-w-7xl flex-none p-6 space-y-6">
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

          {/* Player List — ledger rows, not stacked wells */}
          <div className="nn-panel__body">
            {topPlayers.length === 0 ? (
              <p className="nn-lab py-8 text-center">No players found</p>
            ) : (
              <div>
                {topPlayers.map((player, index) => {
                  const rankAccent =
                    index === 0 ? 'var(--nn-amber)' :
                    index === 1 ? 'var(--nn-cyan)' :
                    index === 2 ? 'var(--nn-violet)' :
                    'var(--nn-text-tertiary)';
                  return (
                    <div
                      key={player._id}
                      className="nn-row"
                      style={index < 3 ? { background: `color-mix(in oklab, ${rankAccent} 5%, transparent)` } : undefined}
                    >
                      <span className="nn-row__label">
                        <span className="nn-num" style={{ color: rankAccent, width: 34, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
                          #{index + 1}
                        </span>
                        <span style={{ color: 'var(--nn-text-primary)', fontWeight: 600 }}>{player.username}</span>
                        <span className="nn-lab">LVL {player.level}</span>
                      </span>
                      <span className="nn-row__value nn-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: rankAccent === 'var(--nn-text-tertiary)' ? 'var(--nn-text-primary)' : rankAccent }}>
                        {sortBy === 'power' && <><Swords style={{ width: 13, height: 13 }} />{(player.totalPower ?? 0).toLocaleString()}</>}
                        {sortBy === 'level' && <><Award style={{ width: 13, height: 13 }} />{player.level}</>}
                        {sortBy === 'metal' && <><Coins style={{ width: 13, height: 13 }} />{(player.metal ?? 0).toLocaleString()}</>}
                      </span>
                    </div>
                  );
                })}
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
      <TopNavBar
        onDMClick={() => setChatTab('DM')}
        dmUnreadCount={dmUnreadCount}
        metal={player?.resources.metal ?? 0}
        energy={player?.resources.energy ?? 0}
      />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        battleLogs={<BattleLogLinks />}
        chatUser={player ? {
          userId: player.username,
          username: player.username,
          level: player.level,
          isVIP: player.vip || false,
          clanId: player.clanId,
          clanName: player.clanName,
        } : undefined}
        initialChatTab={chatTab}
        onChatTabChange={setChatTab}
        onDMUnreadCountChange={setDmUnreadCount}
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
