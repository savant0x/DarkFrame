// ============================================================
// FILE: components/StatsViewWrapper.tsx
// CREATED: 2025-01-23 (FID-20250123-001)
// ============================================================
// OVERVIEW:
// Three-tab statistics interface embedded in game center view:
// 1. Personal Stats - Player's individual achievements and metrics
// 2. Game Stats - Global leaderboards (power, level, resources)
// 3. Economy - Placeholder for auction house and trade data
//
// Replaces tile view when opened, auto-closes on player movement
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TileHarvestStatus from './TileHarvestStatus';
import type { Tile } from '@/types/game.types';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface StatsViewWrapperProps {
  currentTile: Tile | null;
  playerUsername: string;
}

interface PlayerStats {
  battlesWon: number;
  totalUnitsBuilt: number;
  totalResourcesGathered: number;
  totalResourcesBanked: number;
  shrineTradeCount: number;
  cavesExplored: number;
}

interface PersonalStatsData {
  stats: PlayerStats;
  username: string;
  level: number;
  combatPower: number;
  powerBreakdown?: {
    rawStrength: number;
    rawDefense: number;
    balanceMultiplier: number;
    balanceStatus: string;
    bonuses: {
      clanMilitary: number;
      discoveries: number;
      specialization: number;
    };
    finalCombatPower: number;
  };
  resources: {
    metal: number;
    energy: number;
  };
}

interface LeaderboardPlayer {
  _id: string;
  username: string;
  level: number;
  combatPower: number;
  totalStrength?: number;
  totalDefense?: number;
  resources?: {
    metal: number;
    energy: number;
  };
  rank?: string;
}

interface GameStatsData {
  totalPlayers: number;
  totalMetal: number;
  totalEnergy: number;
  combatPower: number;
  averageLevel: number;
  totalBattles: number;
  totalTerritories: number;
}

interface LeaderboardData {
  topPlayers: LeaderboardPlayer[];
  gameStats: GameStatsData;
  sortBy: string;
}

type TabType = 'personal' | 'game' | 'economy' | 'harvest';

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function StatsViewWrapper({ currentTile, playerUsername }: StatsViewWrapperProps) {
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [personalData, setPersonalData] = useState<PersonalStatsData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [sortBy, setSortBy] = useState<string>('combatPower');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches personal player statistics from API
   */
  const fetchPersonalStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/player/stats');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch personal stats');
      }

      setPersonalData(data);
    } catch (err) {
      console.error('❌ Error fetching personal stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches game leaderboard statistics from API
   */
  const fetchLeaderboardStats = useCallback(async (newSortBy?: string) => {
    try {
      setLoading(true);
      setError(null);

      const sortField = newSortBy || sortBy;
      const response = await fetch(`/api/stats?sortBy=${sortField}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error('Failed to fetch leaderboard stats');
      }

      setLeaderboardData(data);
      setSortBy(sortField);
    } catch (err) {
      console.error('❌ Error fetching leaderboard stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'personal') {
      fetchPersonalStats();
    } else if (activeTab === 'game') {
      fetchLeaderboardStats();
    } else {
      setLoading(false);
    }
  }, [activeTab, fetchLeaderboardStats, fetchPersonalStats]);

  /**
   * Handles sort button click for leaderboards
   */
  const handleSort = (field: string) => {
    if (activeTab === 'game') {
      fetchLeaderboardStats(field);
    }
  };

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-[color:var(--nn-void)] border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[color:var(--nn-cyan)]">📊 Statistics</h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] px-6 py-3 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] flex gap-2">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-6 py-2 rounded-none font-semibold transition-all ${
            activeTab === 'personal'
              ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] shadow-lg'
              : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
          }`}
        >
          📈 Personal Stats
        </button>
        <button
          onClick={() => setActiveTab('game')}
          className={`px-6 py-2 rounded-none font-semibold transition-all ${
            activeTab === 'game'
              ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] shadow-lg'
              : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
          }`}
        >
          🏆 Game Stats
        </button>
        <button
          onClick={() => setActiveTab('harvest')}
          className={`px-6 py-2 rounded-none font-semibold transition-all ${
            activeTab === 'harvest'
              ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] shadow-lg'
              : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
          }`}
        >
          ⛏️ Harvest Calculator
        </button>
        <button
          onClick={() => setActiveTab('economy')}
          className={`px-6 py-2 rounded-none font-semibold transition-all ${
            activeTab === 'economy'
              ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] shadow-lg'
              : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
          }`}
        >
          💰 Economy
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-xl text-[color:var(--nn-cyan)]">Loading statistics...</div>
          </div>
        )}

        {error && (
          <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 text-[color:var(--nn-magenta)]">
            ⚠️ Error: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Personal Stats Tab */}
            {activeTab === 'personal' && personalData && (
              <>
                {/* Harvest Status Calculator */}
                {currentTile && playerUsername && (
                  <div className="mb-6">
                    <TileHarvestStatus 
                      currentTile={currentTile}
                      playerUsername={playerUsername}
                    />
                  </div>
                )}
                
                <PersonalStatsTab data={personalData} />
              </>
            )}

            {/* Game Stats Tab */}
            {activeTab === 'game' && leaderboardData && (
              <GameStatsTab 
                data={leaderboardData} 
                sortBy={sortBy}
                onSort={handleSort}
              />
            )}

            {/* Harvest Calculator Tab */}
            {activeTab === 'harvest' && (
              <HarvestCalculatorTab />
            )}

            {/* Economy Tab */}
            {activeTab === 'economy' && (
              <EconomyTab />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PERSONAL STATS TAB COMPONENT
// ============================================================

interface PersonalStatsTabProps {
  data: PersonalStatsData;
}

function PersonalStatsTab({ data }: PersonalStatsTabProps) {
  const { stats, username, level, combatPower, powerBreakdown, resources } = data;

  return (
    <div className="space-y-6">
      {/* Player Overview */}
      <div className="bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-violet)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
        <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">⚔️ {username}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Level</div>
            <div className="text-2xl font-bold text-[color:var(--nn-amber)]">{level}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Combat Power</div>
            <div className="text-2xl font-bold text-[color:var(--nn-magenta)]">{combatPower.toLocaleString()}</div>
            {powerBreakdown && (
              <div className="text-xs text-[color:var(--nn-text-secondary)] mt-1">{powerBreakdown.balanceStatus}</div>
            )}
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Metal</div>
            <div className="text-2xl font-bold text-[color:var(--nn-text-secondary)]">{resources.metal.toLocaleString()}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Energy</div>
            <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">{resources.energy.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Achievement Stats */}
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <h3 className="text-xl font-bold text-[color:var(--nn-cyan)] mb-4">🏆 Achievements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            icon="⚔️"
            label="Battles Won"
            value={stats.battlesWon}
            color="red"
          />
          <StatCard
            icon="🏭"
            label="Units Built"
            value={stats.totalUnitsBuilt}
            color="blue"
          />
          <StatCard
            icon="⛏️"
            label="Resources Gathered"
            value={stats.totalResourcesGathered}
            color="yellow"
          />
          <StatCard
            icon="🏦"
            label="Resources Banked"
            value={stats.totalResourcesBanked}
            color="green"
          />
          <StatCard
            icon="🛕"
            label="Shrine Trades"
            value={stats.shrineTradeCount}
            color="purple"
          />
          <StatCard
            icon="🗺️"
            label="Caves Explored"
            value={stats.cavesExplored}
            color="orange"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GAME STATS TAB COMPONENT
// ============================================================

interface GameStatsTabProps {
  data: LeaderboardData;
  sortBy: string;
  onSort: (field: string) => void;
}

function GameStatsTab({ data, sortBy, onSort }: GameStatsTabProps) {
  const { topPlayers, gameStats } = data;

  return (
    <div className="space-y-6">
      {/* Global Statistics */}
      <div className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-cyan)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
        <h2 className="text-2xl font-bold text-[color:var(--nn-violet)] mb-4">🌍 Global Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Total Players</div>
            <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">{gameStats.totalPlayers.toLocaleString()}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Total Metal</div>
            <div className="text-2xl font-bold text-[color:var(--nn-text-secondary)]">{gameStats.totalMetal.toLocaleString()}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Total Energy</div>
            <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">{gameStats.totalEnergy.toLocaleString()}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Average Level</div>
            <div className="text-2xl font-bold text-[color:var(--nn-amber)]">{gameStats.averageLevel.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-3">Sort By:</h3>
        <div className="flex flex-wrap gap-2">
          <SortButton
            label="⚡ Top Power"
            field="combatPower"
            active={sortBy === 'combatPower'}
            onClick={() => onSort('combatPower')}
          />
          <SortButton
            label="🎖️ Top Level"
            field="level"
            active={sortBy === 'level'}
            onClick={() => onSort('level')}
          />
          <SortButton
            label="⚙️ Top Metal"
            field="resources.metal"
            active={sortBy === 'resources.metal'}
            onClick={() => onSort('resources.metal')}
          />
          <SortButton
            label="⚡ Top Energy"
            field="resources.energy"
            active={sortBy === 'resources.energy'}
            onClick={() => onSort('resources.energy')}
          />
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <h3 className="text-xl font-bold text-[color:var(--nn-cyan)] mb-4">🏆 Top 10 Players</h3>
        <div className="space-y-2">
          {topPlayers.map((player, index) => (
            <LeaderboardRow
              key={player._id}
              player={player}
              rank={index + 1}
              sortBy={sortBy}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ECONOMY TAB COMPONENT
// ============================================================

// ============================================================
// HARVEST CALCULATOR TAB COMPONENT
// ============================================================

function HarvestCalculatorTab() {
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [baseAmount, setBaseAmount] = useState<number>(1000);
  const [diggerBonus, setDiggerBonus] = useState<number>(0);
  const [shrineBonus, setShrineBonus] = useState<number>(0);
  const [balanceBonus, setBalanceBonus] = useState<number>(0);
  const [isVIP, setIsVIP] = useState<boolean>(false);

  // Fetch player's actual stats
  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/player');
        if (response.ok) {
          const data = await response.json();
          setPlayerData(data);
          
          // Auto-populate with player's actual bonuses
          // Calculate digger bonus from inventory
          let totalDiggerBonus = 0;
          if (data.inventory) {
            data.inventory.forEach((item: any) => {
              if (item.name?.toLowerCase().includes('digger') && item.equipped) {
                totalDiggerBonus += item.yieldBonus || 0;
              }
            });
          }
          setDiggerBonus(totalDiggerBonus);

          // Calculate active shrine bonuses
          let totalShrineBonus = 0;
          if (data.shrineBoosts && data.shrineBoosts.length > 0) {
            const now = new Date();
            data.shrineBoosts.forEach((boost: any) => {
              if (new Date(boost.expiresAt) > now) {
                totalShrineBonus += (boost.yieldBonus * 100); // Convert to percentage
              }
            });
          }
          setShrineBonus(totalShrineBonus);

          // Calculate balance effect
          const str = data.totalStrength || 0;
          const def = data.totalDefense || 0;
          const totalPower = str + def;
          
          if (totalPower > 0) {
            const ratio = str / totalPower;
            let balanceEffect = 0;
            
            if (ratio < 0.45) {
              balanceEffect = -20; // Too defensive
            } else if (ratio > 0.55) {
              balanceEffect = -20; // Too aggressive
            } else if (ratio >= 0.49 && ratio <= 0.51) {
              balanceEffect = 20; // Perfect balance
            } else if (ratio >= 0.47 && ratio <= 0.53) {
              balanceEffect = 10; // Good balance
            }
            setBalanceBonus(balanceEffect);
          }

          // Set VIP status
          const hasActiveVIP = data.vip && data.vipExpiration && new Date(data.vipExpiration) > new Date();
          setIsVIP(hasActiveVIP);
        }
      } catch (error) {
        console.error('Error fetching player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, []);

  // Calculate final harvest amount
  const calculateHarvest = () => {
    // Step 1: Apply percentage bonuses
    const multiplier = 1 + (diggerBonus / 100) + (shrineBonus / 100);
    let finalAmount = Math.floor(baseAmount * multiplier);

    // Step 2: Apply balance effects
    const balanceMultiplier = 1 + (balanceBonus / 100);
    finalAmount = Math.floor(finalAmount * balanceMultiplier);

    // Step 3: Apply VIP 2x multiplier
    if (isVIP) {
      finalAmount = Math.floor(finalAmount * 2);
    }

    return finalAmount;
  };

  const finalAmount = calculateHarvest();
  const totalBonus = finalAmount - baseAmount;
  const bonusPercentage = baseAmount > 0 ? ((finalAmount / baseAmount - 1) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-[color:var(--nn-cyan)]">Loading player stats...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[color:var(--nn-green)] to-[color:var(--nn-cyan)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]">
        <h2 className="text-2xl font-bold text-[color:var(--nn-green)] mb-4">⛏️ Harvest Calculator</h2>
        <p className="text-[color:var(--nn-text-secondary)] mb-6">Your current harvest bonuses (auto-populated from your stats)</p>

        {/* VIP Status Alert */}
        {isVIP ? (
          <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <p className="text-[color:var(--nn-amber)] font-bold text-lg">VIP Status Active</p>
                <p className="text-[color:var(--nn-amber)] text-sm">All harvests receive 2x multiplier (doubles your final amount)</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💎</span>
              <div>
                <p className="text-[color:var(--nn-text-secondary)] font-bold text-lg">VIP Not Active</p>
                <p className="text-[color:var(--nn-text-secondary)] text-sm">Purchase VIP to receive 2x harvest multiplier on all resources</p>
              </div>
            </div>
          </div>
        )}

        {/* Player Stats Summary */}
        {playerData && (
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 mb-6 border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">Total Strength</p>
                <p className="text-lg font-bold text-[color:var(--nn-magenta)]">{playerData.totalStrength || 0}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">Total Defense</p>
                <p className="text-lg font-bold text-[color:var(--nn-cyan)]">{playerData.totalDefense || 0}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">Total Power</p>
                <p className="text-lg font-bold text-[color:var(--nn-violet)]">{(playerData.totalStrength || 0) + (playerData.totalDefense || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">VIP Status</p>
                <p className="text-lg font-bold text-[color:var(--nn-amber)]">{isVIP ? '⚡ ACTIVE' : '❌ Inactive'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Base Amount */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <label className="text-sm text-[color:var(--nn-text-secondary)] mb-2 block">Base Harvest Amount</label>
            <input
              type="number"
              min="800"
              max="1500"
              value={baseAmount}
              onChange={(e) => setBaseAmount(parseInt(e.target.value) || 0)}
              className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Normal range: 800-1500</p>
          </div>

          {/* Digger Bonus */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <label className="text-sm text-[color:var(--nn-text-secondary)] mb-2 block">
              Digger Bonus (%) 
              <span className="text-[color:var(--nn-green)] ml-2">✓ Auto-detected</span>
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={diggerBonus}
              onChange={(e) => setDiggerBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">From equipped diggers (0-30%)</p>
          </div>

          {/* Shrine Bonus */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <label className="text-sm text-[color:var(--nn-text-secondary)] mb-2 block">
              Shrine Boost (%)
              <span className="text-[color:var(--nn-green)] ml-2">✓ Auto-detected</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={shrineBonus}
              onChange={(e) => setShrineBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Active shrine boosts</p>
          </div>

          {/* Balance Bonus */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <label className="text-sm text-[color:var(--nn-text-secondary)] mb-2 block">
              Balance Effect (%)
              <span className="text-[color:var(--nn-green)] ml-2">✓ Auto-calculated</span>
            </label>
            <input
              type="number"
              min="-20"
              max="20"
              value={balanceBonus}
              onChange={(e) => setBalanceBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">STR/DEF balance (-20% to +20%)</p>
          </div>

          {/* VIP Toggle */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isVIP}
                onChange={(e) => setIsVIP(e.target.checked)}
                className="w-5 h-5 text-[color:var(--nn-amber)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none focus:ring-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]"
              />
              <span className="text-sm text-[color:var(--nn-text-secondary)]">
                ⚡ VIP Status (2x Multiplier)
                <span className="text-[color:var(--nn-green)] ml-2">✓ Auto-detected</span>
              </span>
            </label>
          </div>
        </div>

        {/* Results Display */}
        <div className="bg-[color:var(--nn-void)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Base Amount</p>
              <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">{baseAmount.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Total Bonus</p>
              <p className="text-2xl font-bold text-[color:var(--nn-green)]">+{totalBonus.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Final Harvest</p>
              <p className="text-3xl font-bold text-[color:var(--nn-amber)]">{finalAmount.toLocaleString()}</p>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <p className="text-lg text-[color:var(--nn-text-secondary)]">
              Total Increase: <span className="text-[color:var(--nn-green)] font-bold">{bonusPercentage}%</span>
            </p>
          </div>

          {/* Breakdown */}
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-[color:var(--nn-text-secondary)]">Calculation Breakdown:</p>
            <div className="text-sm text-[color:var(--nn-text-secondary)] space-y-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
              <p>1. Base Amount: {baseAmount.toLocaleString()}</p>
              {diggerBonus > 0 && <p>2. + Digger Bonus ({diggerBonus}%): +{Math.floor(baseAmount * (diggerBonus / 100)).toLocaleString()}</p>}
              {shrineBonus > 0 && <p>3. + Shrine Boost ({shrineBonus}%): +{Math.floor(baseAmount * (shrineBonus / 100)).toLocaleString()}</p>}
              {balanceBonus !== 0 && (
                <p>4. {balanceBonus > 0 ? '+' : ''} Balance Effect ({balanceBonus}%): {balanceBonus > 0 ? '+' : ''}{Math.floor(baseAmount * (balanceBonus / 100)).toLocaleString()}</p>
              )}
              {isVIP && <p className="text-[color:var(--nn-amber)] font-bold">5. ⚡ VIP 2x Multiplier: ×2</p>}
              <p className="pt-2 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] font-bold text-[color:var(--nn-green)]">= {finalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ECONOMY TAB COMPONENT
// ============================================================

function EconomyTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[color:var(--nn-green)] to-[color:var(--nn-cyan)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]">
        <h2 className="text-2xl font-bold text-[color:var(--nn-green)] mb-4">💰 Economy Statistics</h2>
        <div className="text-[color:var(--nn-text-secondary)] text-center py-12">
          <p className="text-xl mb-2">🚧 Coming Soon</p>
          <p>Economy tracking and auction house statistics will be available here.</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    red: 'text-[color:var(--nn-magenta)]',
    blue: 'text-[color:var(--nn-cyan)]',
    yellow: 'text-[color:var(--nn-amber)]',
    green: 'text-[color:var(--nn-green)]',
    purple: 'text-[color:var(--nn-violet)]',
    orange: 'text-[color:var(--nn-amber)]',
  };

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none p-4 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-[color:var(--nn-text-secondary)] font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses] || 'text-[color:var(--nn-text-primary)]'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

interface SortButtonProps {
  label: string;
  field: string;
  active: boolean;
  onClick: () => void;
}

function SortButton({ label, active, onClick }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-none font-semibold transition-all ${
        active
          ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] shadow-lg'
          : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
      }`}
    >
      {label}
    </button>
  );
}

interface LeaderboardRowProps {
  player: LeaderboardPlayer;
  rank: number;
  sortBy: string;
}

function LeaderboardRow({ player, rank, sortBy }: LeaderboardRowProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getHighlightedValue = () => {
    if (sortBy === 'combatPower') return player.combatPower?.toLocaleString() ?? '0';
    if (sortBy === 'level') return player.level?.toLocaleString() ?? '0';
    if (sortBy === 'resources.metal') return player.resources?.metal?.toLocaleString() ?? '0';
    if (sortBy === 'resources.energy') return player.resources?.energy?.toLocaleString() ?? '0';
    return player.combatPower?.toLocaleString() ?? '0';
  };

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold w-12 text-center">
            {getRankIcon(rank)}
          </span>
          <div>
            <div className="font-bold text-lg text-[color:var(--nn-cyan)]">{player.username}</div>
            <div className="text-sm text-[color:var(--nn-text-secondary)]">
              Level {player.level ?? 0} • Power: {player.combatPower?.toLocaleString() ?? '0'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[color:var(--nn-amber)]">{getHighlightedValue()}</div>
          <div className="text-sm text-[color:var(--nn-text-secondary)]">
            {sortBy === 'combatPower' && 'Power'}
            {sortBy === 'level' && 'Level'}
            {sortBy === 'resources.metal' && 'Metal'}
            {sortBy === 'resources.energy' && 'Energy'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Three-tab interface: Personal Stats, Game Stats, Economy
// - Personal tab fetches from /api/player/stats
// - Game tab fetches from /api/stats with sort parameter
// - Uses only metal and energy resources (ECHO compliant)
// - Optional chaining (?.) for all data access
// - Responsive grid layouts for stats display
// - Auto-closes when player moves (handled by GameLayout)
// ============================================================
// END OF FILE
// ============================================================
