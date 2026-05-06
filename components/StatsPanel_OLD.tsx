/**
 * @file components/StatsPanel.tsx
 * @created 2025-10-16
 * @updated 2025-10-18 - Refactored with new design system
 * @overview Left panel displaying player statistics with modern UI
 * 
 * OVERVIEW:
 * Player statistics dashboard with real-time shrine boost timers,
 * military power calculations, and resource tracking. Uses new design
 * system with StatCard components, animated progress bars, and
 * micro-interactions for enhanced UX.
 * 
 * UPDATES:
 * - 2025-10-17: Added shrine boost display with real-time timers
 * - 2025-10-17: Removed incorrect upgrade system, added "Build Units" button
 * - 2025-10-18: Refactored with StatCard grid, useCountUp animations, modern design system
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { StatCard, Panel, Button, Badge, Divider } from '@/components/ui';
import { StaggerChildren, StaggerItem } from '@/components/transitions';
import { useCountUp, useIsMobile } from '@/hooks';
import BalanceIndicator from './BalanceIndicator';
import XPProgressBar from './XPProgressBar';
import { 
  User, MapPin, Factory, Swords, Shield, 
  Users, Trophy, LogOut, Zap, Wrench,
  Clock, TrendingUp, Star
} from 'lucide-react';

export default function StatsPanel() {
  const { player, logout, refreshPlayer } = useGameContext();
  const router = useRouter();
  const [boostTimers, setBoostTimers] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  // Animated counts for key stats
  const metalCount = useCountUp(player?.resources.metal || 0, { duration: 1000 });
  const energyCount = useCountUp(player?.resources.energy || 0, { duration: 1000 });
  const strengthCount = useCountUp(player?.totalStrength || 0, { duration: 1200 });
  const defenseCount = useCountUp(player?.totalDefense || 0, { duration: 1200 });
  const effectivePower = useCountUp((player?.totalStrength || 0) + (player?.totalDefense || 0), { duration: 1500 });

  // Update shrine boost timers every second
  useEffect(() => {
    if (!player?.shrineBoosts) return;

    const updateTimers = () => {
      const now = new Date();
      const timers: Record<string, string> = {};

      player.shrineBoosts.forEach(boost => {
        const expiresAt = new Date(boost.expiresAt);
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          timers[boost.tier] = `${hours}h ${minutes}m`;
        }
      });

      setBoostTimers(timers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [player?.shrineBoosts]);

  if (!player) {
    return (
      <div className="p-6">
        <Panel title="Loading">
          <p className="text-text-secondary">Loading player data...</p>
        </Panel>
      </div>
    );
  }

  // Calculate total shrine boost
  const activeBoosts = player.shrineBoosts?.filter(boost => 
    new Date(boost.expiresAt) > new Date()
  ) || [];
  const totalShrineBonus = activeBoosts.reduce((sum, boost) => sum + boost.yieldBonus, 0);

  // Get boost icon
  const getBoostIcon = (tier: string): string => {
    switch (tier) {
      case 'speed': return '♠️';
      case 'heart': return '♥️';
      case 'diamond': return '♦️';
      case 'club': return '♣️';
      default: return '✨';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Player Info */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-3">Player Info</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Commander:</span>
            <span className="font-semibold">{player.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Level:</span>
            <span className="font-bold text-yellow-400">{player.level || 1}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">🏭 Factories Owned:</span>
            <span className="font-bold text-purple-400">{(player.factoryCount || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Base Location:</span>
            <span className="font-mono text-sm">
              ({player.base.x}, {player.base.y})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Current Position:</span>
            <span className="font-mono text-sm">
              ({player.currentPosition.x}, {player.currentPosition.y})
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      {(player as any).xpProgress && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-3">Experience</h2>
          <XPProgressBar
            level={player.level || 1}
            currentLevelXP={(player as any).xpProgress.currentLevelXP}
            xpForNextLevel={(player as any).xpProgress.xpForNextLevel}
            totalXP={player.xp || 0}
          />
          {player.researchPoints !== undefined && player.researchPoints > 0 && (
            <div className="mt-3 flex items-center justify-between bg-purple-900/50 border border-purple-700 rounded p-3">
              <span className="text-purple-200">Research Points:</span>
              <span className="text-2xl font-bold text-purple-300">{player.researchPoints} RP</span>
            </div>
          )}
        </div>
      )}

      {/* Resources */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-3">Resources</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400">⚙️ Metal:</span>
              <span className="font-bold text-yellow-400">{player.resources.metal.toLocaleString()}</span>
            </div>
            {player.bank && (
              <div className="text-xs text-gray-500 text-right">
                ({(player.bank.metal || 0).toLocaleString()} banked)
              </div>
            )}
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400">⚡ Energy:</span>
              <span className="font-bold text-cyan-400">{player.resources.energy.toLocaleString()}</span>
            </div>
            {player.bank && (
              <div className="text-xs text-gray-500 text-right">
                ({(player.bank.energy || 0).toLocaleString()} banked)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shrine Boosts */}
      {player.shrineBoosts && player.shrineBoosts.length > 0 && (
        <div className="bg-purple-900/50 border border-purple-500 rounded-lg p-4">
          <h2 className="text-xl font-bold text-purple-300 mb-3">⛩️ Shrine Buffs</h2>
          
          {activeBoosts.length > 0 ? (
            <>
              {/* Active Boosts List */}
              <div className="space-y-2 mb-3">
                {activeBoosts.map(boost => (
                  <div key={boost.tier} className="flex justify-between items-center bg-purple-800/50 p-2 rounded">
                    <span className="text-purple-200">
                      {getBoostIcon(boost.tier)} {boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1)}
                    </span>
                    <span className="text-green-400 font-bold text-sm">
                      {boostTimers[boost.tier] || 'Calculating...'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Bonus */}
              <div className="border-t border-purple-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Current Bonus:</span>
                  <span className="text-yellow-400 font-bold">+{(totalShrineBonus * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-purple-300">Resource Yield:</span>
                  <span className="text-green-400 font-bold">{(1 + totalShrineBonus).toFixed(2)}x</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-purple-300 text-sm">No active boosts. Visit the Shrine at (1, 1) to activate.</p>
          )}
        </div>
      )}

      {/* Military Power */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-3">⚔️ Military Power</h2>
        
        {/* Effective Power (Top Priority) */}
        <div className="mb-4 bg-purple-900/30 border border-purple-600 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-purple-200 font-semibold">⭐ Effective Power:</span>
            <span className="text-2xl font-bold text-purple-300">
              {((player.totalStrength || 0) + (player.totalDefense || 0)).toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* Stats Display */}
        <div className="space-y-2 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">🎯 Total Strength:</span>
            <span className="font-bold text-red-400">{(player.totalStrength || 0).toLocaleString()} STR</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">🛡️ Total Defense:</span>
            <span className="font-bold text-blue-400">{(player.totalDefense || 0).toLocaleString()} DEF</span>
          </div>
        </div>

        {/* Build Units Button */}
        <button
          onClick={() => router.push('/game/unit-factory')}
          className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded transition-colors mb-3"
        >
          🏭 Build Units
        </button>
        
        {/* Additional Stats */}
        <div className="pt-3 border-t border-gray-600 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">🪖 Army:</span>
            <span className="font-bold text-green-400">{(player.units?.length || 0).toLocaleString()} units</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">📦 Slots:</span>
            <span className="font-bold text-yellow-400">
              {(player.units?.length || 0).toLocaleString()} / {(100 + ((player.factoryCount || 0) * 50)).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">🏭 Factories Owned:</span>
            <span className="font-bold text-purple-400">{(player.factoryCount || 0).toLocaleString()}</span>
          </div>
        </div>
        
        {/* Balance Effects Section */}
        {((player.totalStrength || 0) + (player.totalDefense || 0) > 0) && player.balanceEffects && (
          <>
            <div className="border-t border-gray-600 pt-3 mb-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Power:</span>
                  <span className="font-bold text-gray-300">
                    {(player.totalStrength || 0) + (player.totalDefense || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">⚡ Effective Power:</span>
                  <span className={`font-bold text-xl ${
                    player.balanceEffects.status === 'OPTIMAL' ? 'text-yellow-400' :
                    player.balanceEffects.status === 'BALANCED' ? 'text-green-400' :
                    player.balanceEffects.status === 'IMBALANCED' ? 'text-yellow-600' :
                    'text-red-500'
                  }`}>
                    {player.balanceEffects.effectivePower}
                    {player.balanceEffects.powerMultiplier !== 1.0 && (
                      <span className="text-sm ml-1">
                        ({player.balanceEffects.powerMultiplier > 1 ? '+' : ''}
                        {((player.balanceEffects.powerMultiplier - 1) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Balance Indicator */}
            <BalanceIndicator 
              balanceEffects={player.balanceEffects}
              str={player.totalStrength || 0}
              def={player.totalDefense || 0}
            />
            
            {/* Warnings/Penalties */}
            {player.balanceEffects.warnings.length > 0 && (
              <div className="mt-3 bg-red-900/30 border border-red-700 rounded p-3">
                <p className="text-red-400 font-bold text-sm mb-2">⚠️ ACTIVE PENALTIES:</p>
                <ul className="space-y-1">
                  {player.balanceEffects.warnings.map((warning, index) => (
                    <li key={index} className="text-red-300 text-xs">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Bonuses */}
            {player.balanceEffects.bonuses.length > 0 && player.balanceEffects.status !== 'BALANCED' && (
              <div className="mt-3 bg-yellow-900/30 border border-yellow-700 rounded p-3">
                <p className="text-yellow-400 font-bold text-sm mb-2">
                  {player.balanceEffects.status === 'OPTIMAL' ? '⭐ OPTIMAL BONUSES:' : '✅ Status:'}
                </p>
                <ul className="space-y-1">
                  {player.balanceEffects.bonuses.map((bonus, index) => (
                    <li key={index} className="text-yellow-200 text-xs">{bonus}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Recommendation */}
            {player.balanceEffects.recommendation && (
              <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded p-3">
                <p className="text-blue-300 text-xs">
                  💡 {player.balanceEffects.recommendation}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <a
          href="/leaderboard"
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded transition-colors block text-center"
        >
          🏆 View Leaderboard
        </a>
        <button
          onClick={logout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
