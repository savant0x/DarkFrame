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

import React, { useState, useEffect } from 'react';
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
  const fetchPersonalStats = async () => {
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
  };

  /**
   * Fetches game leaderboard statistics from API
   */
  const fetchLeaderboardStats = async (newSortBy?: string) => {
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
  };

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'personal') {
      fetchPersonalStats();
    } else if (activeTab === 'game') {
      fetchLeaderboardStats();
    } else {
      setLoading(false);
    }
  }, [activeTab]);

  /**
   * Handles sort button click for leaderboards
   */
  const handleSort = (field: string) => {
    if (activeTab === 'game') {
      fetchLeaderboardStats(field);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-blue-300">📊 Statistics</h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-700 flex gap-2">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'personal'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📈 Personal Stats
        </button>
        <button
          onClick={() => setActiveTab('game')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'game'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🏆 Game Stats
        </button>
        <button
          onClick={() => setActiveTab('harvest')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'harvest'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ⛏️ Harvest Calculator
        </button>
        <button
          onClick={() => setActiveTab('economy')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'economy'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          💰 Economy
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-xl text-blue-400">Loading statistics...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
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
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-500/30">
        <h2 className="text-2xl font-bold text-blue-300 mb-4">⚔️ {username}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Level</div>
            <div className="text-2xl font-bold text-yellow-400">{level}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Combat Power</div>
            <div className="text-2xl font-bold text-red-400">{combatPower.toLocaleString()}</div>
            {powerBreakdown && (
              <div className="text-xs text-gray-500 mt-1">{powerBreakdown.balanceStatus}</div>
            )}
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Metal</div>
            <div className="text-2xl font-bold text-gray-300">{resources.metal.toLocaleString()}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Energy</div>
            <div className="text-2xl font-bold text-blue-400">{resources.energy.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Achievement Stats */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-blue-300 mb-4">🏆 Achievements</h3>
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
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-6 border border-purple-500/30">
        <h2 className="text-2xl font-bold text-purple-300 mb-4">🌍 Global Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Players</div>
            <div className="text-2xl font-bold text-blue-400">{gameStats.totalPlayers.toLocaleString()}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Metal</div>
            <div className="text-2xl font-bold text-gray-300">{gameStats.totalMetal.toLocaleString()}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Energy</div>
            <div className="text-2xl font-bold text-blue-400">{gameStats.totalEnergy.toLocaleString()}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Average Level</div>
            <div className="text-2xl font-bold text-yellow-400">{gameStats.averageLevel.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Sort By:</h3>
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
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-blue-300 mb-4">🏆 Top 10 Players</h3>
        <div className="space-y-2">
          {topPlayers.map((player, index) => (
            <LeaderboardRow
              key={player.username}
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
  const [balanceMultiplier, setBalanceMultiplier] = useState<number>(1.0);
  const [balanceStatus, setBalanceStatus] = useState<string>('BALANCED');
  const [isVIP, setIsVIP] = useState<boolean>(false);
  const [isFlagBearer, setIsFlagBearer] = useState<boolean>(false);

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
          const invItems = data.inventory?.items || data.inventory || [];
          if (Array.isArray(invItems)) {
            invItems.forEach((item: any) => {
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

          // Calculate balance effect (matches balanceService.ts formula: min/max ratio)
          const str = data.totalStrength || 0;
          const def = data.totalDefense || 0;
          
          if (str > 0 || def > 0) {
            const ratio = Math.min(str, def) / Math.max(str, def) || 0;
            if (ratio < 0.7) {
              setBalanceMultiplier(0.75); // CRITICAL: -25% gathering
              setBalanceStatus('CRITICAL');
            } else if (ratio < 0.85) {
              setBalanceMultiplier(0.9);  // IMBALANCED: -10% gathering
              setBalanceStatus('IMBALANCED');
            } else {
              setBalanceMultiplier(1.0);  // BALANCED: no penalty
              setBalanceStatus('BALANCED');
            }
          }

          // Check Flag Bearer status
          try {
            const flagRes = await fetch('/api/flag');
            const flagData = await flagRes.json();
            if (flagData.success && flagData.bearerUsername === data.username) {
              setIsFlagBearer(true);
            }
          } catch {}

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

  // Calculate final harvest amount (matches harvestService.ts formula)
  const calculateHarvest = () => {
    // Step 1: Apply additive percentage bonuses (digger + shrine)
    const multiplier = 1 + (diggerBonus / 100) + (shrineBonus / 100);
    let finalAmount = Math.floor(baseAmount * multiplier);

    // Step 2: Apply VIP 2x multiplier
    if (isVIP) {
      finalAmount = Math.floor(finalAmount * 2);
    }

    // Step 3: Apply Flag Bearer 2x multiplier (if active)
    if (isFlagBearer) {
      finalAmount = Math.floor(finalAmount * 2);
    }

    // Step 4: Apply balance gathering multiplier (0.75 CRITICAL / 0.9 IMBALANCED / 1.0 BALANCED)
    finalAmount = Math.floor(finalAmount * balanceMultiplier);

    return finalAmount;
  };

  const finalAmount = calculateHarvest();
  const totalBonus = finalAmount - baseAmount;
  const bonusPercentage = baseAmount > 0 ? ((finalAmount / baseAmount - 1) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-blue-400">Loading player stats...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg p-6 border border-green-500/30">
        <h2 className="text-2xl font-bold text-green-300 mb-4">⛏️ Harvest Calculator</h2>
        <p className="text-gray-400 mb-6">Your current harvest bonuses (auto-populated from your stats)</p>

        {/* VIP Status Alert */}
        {isVIP ? (
          <div className="bg-yellow-900/50 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <p className="text-yellow-300 font-bold text-lg">VIP Status Active</p>
                <p className="text-yellow-200/80 text-sm">All harvests receive 2x multiplier (doubles your final amount)</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💎</span>
              <div>
                <p className="text-gray-300 font-bold text-lg">VIP Not Active</p>
                <p className="text-gray-400 text-sm">Purchase VIP to receive 2x harvest multiplier on all resources</p>
              </div>
            </div>
          </div>
        )}

        {/* Player Stats Summary */}
        {playerData && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-blue-500/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">Total Strength</p>
                <p className="text-lg font-bold text-red-400">{playerData.totalStrength || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Defense</p>
                <p className="text-lg font-bold text-blue-400">{playerData.totalDefense || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Power</p>
                <p className="text-lg font-bold text-purple-400">{(playerData.totalStrength || 0) + (playerData.totalDefense || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">VIP Status</p>
                <p className="text-lg font-bold text-yellow-400">{isVIP ? '⚡ ACTIVE' : '❌ Inactive'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Base Amount */}
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-sm text-gray-400 mb-2 block">Base Harvest Amount</label>
            <input
              type="number"
              min="800"
              max="1500"
              value={baseAmount}
              onChange={(e) => setBaseAmount(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Normal range: 800-1500</p>
          </div>

          {/* Digger Bonus */}
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-sm text-gray-400 mb-2 block">
              Digger Bonus (%) 
              <span className="text-green-400 ml-2">✓ Auto-detected</span>
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={diggerBonus}
              onChange={(e) => setDiggerBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-green-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">From equipped diggers (0-30%)</p>
          </div>

          {/* Shrine Bonus */}
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-sm text-gray-400 mb-2 block">
              Shrine Boost (%)
              <span className="text-green-400 ml-2">✓ Auto-detected</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={shrineBonus}
              onChange={(e) => setShrineBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-green-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Active shrine boosts</p>
          </div>

          {/* Balance Effect */}
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-sm text-gray-400 mb-2 block">
              Balance Status
              <span className="text-green-400 ml-2">✓ Auto-calculated</span>
            </label>
            <div className={`text-lg font-bold ${
              balanceStatus === 'CRITICAL' ? 'text-red-400' :
              balanceStatus === 'IMBALANCED' ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {balanceStatus}
              <span className="text-xs text-gray-500 ml-2">
                (×{balanceMultiplier.toFixed(2)} gathering multiplier)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Based on STR/DEF ratio (min÷max). CRITICAL: -25%, IMBALANCED: -10%</p>
          </div>

          {/* Flag Bearer Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-sm text-gray-400 mb-2 block">
              Flag Bearer
              <span className="text-green-400 ml-2">✓ Auto-detected</span>
            </label>
            <div className={`text-lg font-bold ${isFlagBearer ? 'text-yellow-400' : 'text-gray-500'}`}>
              {isFlagBearer ? '🚩 ACTIVE (2x)' : 'Inactive'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Flag Bearer doubles all harvests</p>
          </div>

          {/* VIP Toggle */}
          <div className="bg-gray-800 rounded-lg p-4 md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isVIP}
                onChange={(e) => setIsVIP(e.target.checked)}
                className="w-5 h-5 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-400">
                ⚡ VIP Status (2x Multiplier)
                <span className="text-green-400 ml-2">✓ Auto-detected</span>
              </span>
            </label>
          </div>
        </div>

        {/* Results Display */}
        <div className="bg-gray-900 rounded-lg p-6 border border-blue-500/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">Base Amount</p>
              <p className="text-2xl font-bold text-blue-400">{baseAmount.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">Total Bonus</p>
              <p className="text-2xl font-bold text-green-400">+{totalBonus.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">Final Harvest</p>
              <p className="text-3xl font-bold text-yellow-400">{finalAmount.toLocaleString()}</p>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-gray-700">
            <p className="text-lg text-gray-300">
              Total Increase: <span className="text-green-400 font-bold">{bonusPercentage}%</span>
            </p>
          </div>

          {/* Breakdown */}
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-gray-300">Calculation Breakdown:</p>
            <div className="text-sm text-gray-400 space-y-1 bg-gray-800 p-3 rounded">
              <p>1. Base Amount: {baseAmount.toLocaleString()}</p>
              {diggerBonus > 0 && <p>2. + Digger Bonus ({diggerBonus}%): +{Math.floor(baseAmount * (diggerBonus / 100)).toLocaleString()}</p>}
              {shrineBonus > 0 && <p>3. + Shrine Boost ({shrineBonus}%): +{Math.floor(baseAmount * (shrineBonus / 100)).toLocaleString()}</p>}
              {isVIP && <p className="text-yellow-400 font-bold">4. ⚡ VIP 2x Multiplier: ×2</p>}
              {isFlagBearer && <p className="text-yellow-400 font-bold">5. 🚩 Flag Bearer 2x: ×2</p>}
              {balanceMultiplier !== 1.0 && (
                <p>6. Balance Effect ({balanceStatus}): ×{balanceMultiplier.toFixed(2)}</p>
              )}
              <p className="pt-2 border-t border-gray-700 font-bold text-green-400">= {finalAmount.toLocaleString()}</p>
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
      <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg p-6 border border-green-500/30">
        <h2 className="text-2xl font-bold text-green-300 mb-4">💰 Economy Statistics</h2>
        <div className="text-gray-400 text-center py-12">
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
    red: 'text-red-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-300 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses] || 'text-white'}`}>
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

function SortButton({ label, field, active, onClick }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
    <div className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold w-12 text-center">
            {getRankIcon(rank)}
          </span>
          <div>
            <div className="font-bold text-lg text-blue-300">{player.username}</div>
            <div className="text-sm text-gray-400">
              Level {player.level ?? 0} • Power: {player.combatPower?.toLocaleString() ?? '0'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-yellow-400">{getHighlightedValue()}</div>
          <div className="text-sm text-gray-400">
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
