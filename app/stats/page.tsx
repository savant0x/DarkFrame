'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { Trophy, Swords, Shield, Coins, Users, Target, TrendingUp, Award, Crown, ArrowLeft } from 'lucide-react';

interface GameStats {
  totalPlayers: number;
  totalMetal: number;
  totalEnergy: number;
  averageLevel: number;
}

interface TopPlayer {
  _id: string;
  username: string;
  level: number;
  totalPower: number;
  metal: number;
}

export default function StatsPage() {
  const router = useRouter();
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'metal'>('power');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/stats?sort=${sortBy}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setGameStats(data.globalStats);
            setTopPlayers(data.topPlayers || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [sortBy]);

  const renderStatsContent = () => {
    if (loading) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-[--void]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--electric] mx-auto mb-4" />
            <p className="text-white/60">Loading statistics...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-[--void]">
          <div className="text-center max-w-md">
            <div className="text-[--neon-red] text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Error Loading Stats</h1>
            <p className="text-white/60 mb-6">{error}</p>
            <button
              onClick={() => router.push('/game')}
              className="px-6 py-2 bg-[--electric]/15 border border-[--electric]/25 text-[--electric] rounded-lg hover:bg-[--electric]/25 transition-colors"
            >
              Return to Game
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-auto bg-[--void]">
        <div className="bg-[--shadow] border-b border-[--border] p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/game')}
                className="flex items-center gap-2 px-3 py-1.5 bg-[--card] hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Game</span>
              </button>
              <div className="h-8 w-px bg-[--border]" />
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Trophy className="w-7 h-7 text-[--neon-pink]" />
                Game Statistics
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 space-y-4">
          {gameStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[--card] border border-[--border] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5 text-[--neon-pink]" />
                  <h3 className="text-sm font-semibold text-white/60">Total Players</h3>
                </div>
                <p className="text-2xl font-bold text-[--neon-pink]">{gameStats.totalPlayers.toLocaleString()}</p>
              </div>

              <div className="bg-[--card] border border-[--border] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-5 h-5 text-[--solar]" />
                  <h3 className="text-sm font-semibold text-white/60">Total Metal</h3>
                </div>
                <p className="text-2xl font-bold text-[--solar]">{gameStats.totalMetal.toLocaleString()}</p>
              </div>

              <div className="bg-[--card] border border-[--border] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-5 h-5 text-[--electric]" />
                  <h3 className="text-sm font-semibold text-white/60">Total Energy</h3>
                </div>
                <p className="text-2xl font-bold text-[--electric]">{gameStats.totalEnergy.toLocaleString()}</p>
              </div>

              <div className="bg-[--card] border border-[--border] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 text-[--neon-yellow]" />
                  <h3 className="text-sm font-semibold text-white/60">Avg Level</h3>
                </div>
                <p className="text-2xl font-bold text-[--neon-yellow]">{gameStats.averageLevel.toFixed(1)}</p>
              </div>
            </div>
          )}

          <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
            <div className="bg-white/[0.03] border-b border-[--border] p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[--neon-yellow]" />
                  Top Players
                </h2>
                <div className="flex gap-2">
                  {(['power', 'level', 'metal'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        sortBy === s
                          ? 'bg-[--neon-pink]/15 text-[--neon-pink] border border-[--neon-pink]/25'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {s === 'power' && <Swords className="w-3 h-3 inline mr-1" />}
                      {s === 'level' && <Award className="w-3 h-3 inline mr-1" />}
                      {s === 'metal' && <Coins className="w-3 h-3 inline mr-1" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3">
              {topPlayers.length === 0 ? (
                <p className="text-white/50 text-center py-8">No players found</p>
              ) : (
                <div className="space-y-2">
                  {topPlayers.map((player, index) => (
                    <div
                      key={player._id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        index === 0
                          ? 'bg-[--neon-yellow]/5 border-[--neon-yellow]/20'
                          : index === 1
                          ? 'bg-white/[0.02] border-white/10'
                          : index === 2
                          ? 'bg-[--solar]/5 border-[--solar]/20'
                          : 'bg-white/[0.02] border-[--border] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-white/40 w-6 text-center">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold">{player.username}</p>
                          <p className="text-white/40 text-xs">Level {player.level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {sortBy === 'power' && (
                          <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-[--neon-pink]" />
                            <span className="text-white font-bold">{player.totalPower.toLocaleString()}</span>
                          </div>
                        )}
                        {sortBy === 'level' && (
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-[--neon-yellow]" />
                            <span className="text-white font-bold">Level {player.level}</span>
                          </div>
                        )}
                        {sortBy === 'metal' && (
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-[--solar]" />
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
      <TopNavBar onFriendsClick={() => {}} />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={renderStatsContent()}
      />
    </>
  );
}
