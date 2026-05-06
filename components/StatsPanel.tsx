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
  User, MapPin, Factory, Swords, Shield as ShieldIcon, 
  Users, Trophy, LogOut, Zap, Wrench,
  Clock, TrendingUp, Star, Sparkles, Package, Mountain
} from 'lucide-react';

interface StatsPanelProps {
  onClanClick?: () => void;
  onReferralsClick?: () => void;
  onFactoryManagementClick?: () => void;
  flagBearer?: {
    playerId: string;
    username: string;
    level: number;
    position: { x: number; y: number };
    currentHP?: number;
    maxHP?: number;
  } | null;
}

export default function StatsPanel({ onClanClick, onReferralsClick, onFactoryManagementClick, flagBearer }: StatsPanelProps = {}) {
  const { player, logout, refreshPlayer } = useGameContext();
  const router = useRouter();
  const [boostTimers, setBoostTimers] = useState<Record<string, string>>({});
  const [clanTag, setClanTag] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  // Check if current player is flag bearer
  const isPlayerFlagBearer = flagBearer && player && flagBearer.username === player.username;

  // Animated counts for key stats
  const metalCount = useCountUp(player?.resources.metal || 0, { duration: 1000 });
  const energyCount = useCountUp(player?.resources.energy || 0, { duration: 1000 });
  const strengthCount = useCountUp(player?.totalStrength || 0, { duration: 1200 });
  const defenseCount = useCountUp(player?.totalDefense || 0, { duration: 1200 });
  const effectivePower = useCountUp(player?.balanceEffects?.effectivePower ?? ((player?.totalStrength || 0) + (player?.totalDefense || 0)), { duration: 1500 });

  // Fetch clan tag when player has a clan
  useEffect(() => {
    const fetchClanTag = async () => {
      if (!player?.clanId) {
        setClanTag(null);
        return;
      }

      try {
        const response = await fetch(`/api/clan?clanId=${player.clanId}`);
        if (response.ok) {
          const data = await response.json();
          setClanTag(data.tag || null);
        }
      } catch (error) {
        console.error('Failed to fetch clan tag:', error);
      }
    };

    fetchClanTag();
  }, [player?.clanId]);

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
    <div className="space-y-3 p-3">
      {/* Player Info */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
        {/* Banner Title */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <User className="w-4 h-4" />
            PLAYER INFO
          </h3>
        </div>
        {/* Content - Alphabetical Order */}
        <div className="p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/70">Commander</span>
            <span className="font-semibold text-white font-display">{player.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Base Coords</span>
            <span className="text-cyan-400 font-bold font-mono text-sm">
              ({player.base.x}, {player.base.y})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Factories</span>
            <button
              onClick={onFactoryManagementClick}
              className="text-white font-bold font-display hover:text-accent-primary transition-colors cursor-pointer"
              title="Click to manage factories"
            >
              {player.factoryCount || 0}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Level</span>
            <span className="text-white font-bold font-display">{player.level || 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Rank</span>
            <span className="text-white font-bold font-display">{player.rank || 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">RP</span>
            <span className="text-white font-semibold font-display text-sm">
              {(player.researchPoints || 0).toLocaleString()}
            </span>
          </div>
          
          {/* VIP Status */}
          {player.vip && player.vipExpiration ? (
            <div className="flex items-center justify-between group">
              <span className="text-white/70">VIP Status</span>
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 font-semibold transition-colors text-xs group-hover:underline"
                title="Manage your VIP subscription"
              >
                <span className="inline-block bg-yellow-500/20 border border-yellow-500/50 px-2 py-0.5 rounded">
                  👑 ACTIVE
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-white/70">VIP Status</span>
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors text-xs"
                title="Upgrade to VIP for 2x speed and exclusive benefits"
              >
                Get VIP
              </button>
            </div>
          )}
          
          {/* Clan Row - Always show */}
          {player.clanId ? (
            <div className="flex items-center justify-between group">
              <span className="text-white/70">Clan</span>
              <button
                onClick={onClanClick || (() => router.push('/clan'))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                title="Click to view Clan page"
              >
                {clanTag && (
                  <span className="text-purple-500 font-bold">
                    [{clanTag}]
                  </span>
                )}
                <span className="group-hover:underline">
                  {player.clanName ? (
                    player.clanName.length > 15 ? player.clanName.substring(0, 15) + '...' : player.clanName
                  ) : (
                    'View Clan'
                  )}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-white/70">Clan</span>
              <button
                onClick={onClanClick || (() => router.push('/clan'))}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors text-xs"
                title="Create or join a clan"
              >
                Join/Create
              </button>
            </div>
          )}

          {/* Referrals Row */}
          <div className="flex items-center justify-between">
            <span className="text-white/70 flex items-center gap-1.5">
              🎁 Referrals
            </span>
            <button
              onClick={onReferralsClick || (() => router.push('/referrals'))}
              className="text-pink-400 hover:text-pink-300 font-semibold transition-colors text-xs"
              title="Invite friends and earn rewards"
            >
              Invite Friends
            </button>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      {(player as any).xpProgress && (
        <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          {/* Banner Title */}
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <Star className="w-4 h-4" />
              EXPERIENCE
            </h3>
          </div>
          {/* Content */}
          <div className="p-3">
            <XPProgressBar
              level={player.level || 1}
              currentLevelXP={(player as any).xpProgress.currentLevelXP}
              xpForNextLevel={(player as any).xpProgress.xpForNextLevel}
              totalXP={player.xp || 0}
            />
          </div>
        </div>
      )}

      {/* Resources */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
        {/* Banner Title */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            RESOURCES
          </h3>
        </div>
        {/* Content */}
        <div className="p-3 space-y-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/70 flex items-center gap-1.5">
                <span className="text-base">⚙️</span>
                Metal
              </span>
              <span className="font-bold text-white font-mono text-sm">
                {Math.round(metalCount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/50">Banked</span>
              <span className="text-white/70 font-mono">
                {(player.bank?.metal || 0).toLocaleString()}
              </span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/70 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Energy
              </span>
              <span className="font-bold text-white font-mono text-sm">
                {Math.round(energyCount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/50">Banked</span>
              <span className="text-white/70 font-mono">
                {(player.bank?.energy || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Military Power */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
        {/* Banner Title */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <Swords className="w-4 h-4" />
            MILITARY POWER
          </h3>
        </div>
        {/* Content */}
        <div className="p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/70 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              Strength
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white font-mono text-sm">
                {Math.round(strengthCount).toLocaleString()}
              </span>
              {player.balanceEffects && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.balanceEffects.status === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : player.balanceEffects.status === 'IMBALANCED' ? 'bg-yellow-500/20 text-yellow-300' : player.balanceEffects.status === 'OPTIMAL' ? 'bg-green-500/20 text-green-300' : 'bg-green-500/20 text-green-300'}`}>
                  {player.totalStrength + player.totalDefense > 0
                    ? ((player.totalStrength / (player.totalStrength + player.totalDefense)) * 100).toFixed(0)
                    : '0'}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70 flex items-center gap-1.5">
              <ShieldIcon className="w-3.5 h-3.5" />
              Defense
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white font-mono text-sm">
                {Math.round(defenseCount).toLocaleString()}
              </span>
              {player.balanceEffects && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.balanceEffects.status === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : player.balanceEffects.status === 'IMBALANCED' ? 'bg-yellow-500/20 text-yellow-300' : player.balanceEffects.status === 'OPTIMAL' ? 'bg-green-500/20 text-green-300' : 'bg-green-500/20 text-green-300'}`}>
                  {player.totalStrength + player.totalDefense > 0
                    ? ((player.totalDefense / (player.totalStrength + player.totalDefense)) * 100).toFixed(0)
                    : '0'}%
                </span>
              )}
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent my-2" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/70 font-semibold">Total Power</span>
            <span className="font-bold text-white font-display text-sm">
              {Math.round(effectivePower).toLocaleString()}
            </span>
          </div>
          {player.balanceEffects && ((player.totalStrength || 0) + (player.totalDefense || 0) > 0) && (
            <>
              <div className="border-t border-gray-600 pt-3 mb-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Power:</span>
                    <span className="font-bold text-gray-300">
                      {((player.totalStrength || 0) + (player.totalDefense || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Effective Power:</span>
                    <span className={`font-bold text-xl ${!player.balanceEffects ? '' : player.balanceEffects.status === 'OPTIMAL' ? 'text-yellow-400' : player.balanceEffects.status === 'BALANCED' ? 'text-green-400' : player.balanceEffects.status === 'IMBALANCED' ? 'text-yellow-600' : 'text-red-500'}`}>
                      {player.balanceEffects.effectivePower.toLocaleString()}
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
              <BalanceIndicator balanceEffects={player.balanceEffects} str={player.totalStrength || 0} def={player.totalDefense || 0} />
              {player.balanceEffects.warnings.length > 0 && (
                <div className="mt-3 bg-red-900/30 border border-red-700 rounded p-3">
                  <p className="text-red-400 font-bold text-sm mb-2">ACTIVE PENALTIES:</p>
                  <ul className="space-y-1">
                    {player.balanceEffects.warnings.map((warning: string, index: number) => (
                      <li key={index} className="text-red-300 text-xs">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {player.balanceEffects.bonuses.length > 0 && player.balanceEffects.status !== 'BALANCED' && (
                <div className="mt-3 bg-yellow-900/30 border border-yellow-700 rounded p-3">
                  <p className="text-yellow-400 font-bold text-sm mb-2">
                    {player.balanceEffects.status === 'OPTIMAL' ? 'OPTIMAL BONUSES:' : 'Status:'}
                  </p>
                  <ul className="space-y-1">
                    {player.balanceEffects.bonuses.map((bonus: string, index: number) => (
                      <li key={index} className="text-yellow-200 text-xs">{bonus}</li>
                    ))}
                  </ul>
                </div>
              )}
              {player.balanceEffects.recommendation && (
                <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded p-3">
                  <p className="text-blue-200 text-xs">{player.balanceEffects.recommendation}</p>
                </div>
              )}
            </>
          )}
          <Button 
            onClick={() => router.push('/game/unit-factory')} 
            variant="primary"
            size="sm"
            fullWidth
            className="text-xs py-2"
          >
            <Users className="w-3.5 h-3.5" />
            Build Units
          </Button>
        </div>
      </div>

      {/* Harvest Calculator - NEW */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-green-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.2)]">
        {/* Banner Title */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-b border-green-500/30 px-3 py-2">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            HARVEST CALCULATOR
          </h3>
        </div>
        {/* Content */}
        <div className="p-3 space-y-3 text-xs">
          {/* VIP Status Indicator */}
          {player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date() ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <div>
                  <p className="text-yellow-300 font-bold text-[11px]">⚡ VIP ACTIVE - 2x Multiplier</p>
                  <p className="text-yellow-200/70 text-[10px]">All harvests receive double rewards</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-[11px]">VIP Not Active</p>
                <button
                  onClick={() => router.push('/game/vip-upgrade')}
                  className="text-purple-400 hover:text-purple-300 text-[10px] font-semibold transition-colors"
                >
                  Get VIP
                </button>
              </div>
            </div>
          )}
          
          {/* Metal Breakdown */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-white/70 font-semibold text-[11px]">METAL NODE</span>
            </div>
            <div className="space-y-1.5 ml-5">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Base Amount</span>
                <span className="text-white font-mono">1,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Gathering Bonus</span>
                <span className="text-green-400 font-mono">
                  +{(player.gatheringBonus?.metalBonus || 0)}%
                </span>
              </div>
              {activeBoosts.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Shrine Buffs
                  </span>
                  <span className="text-cyan-400 font-mono">
                    +{(totalShrineBonus * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date() && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    VIP Multiplier
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    ×2
                  </span>
                </div>
              )}
              {isPlayerFlagBearer && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    🚩 Flag Bearer
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    +100%
                  </span>
                </div>
              )}
              <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent my-1" />
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">Expected Amount</span>
                <span className="text-green-400 font-bold font-mono">
                  {(() => {
                    const hasVIP = player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date();
                    let amount = 1000 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                    if (hasVIP) amount *= 2;
                    if (isPlayerFlagBearer) amount *= 2; // Flag bearer +100% = 2x multiplier
                    return Math.round(amount).toLocaleString();
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />

          {/* Energy Breakdown */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-white/70 font-semibold text-[11px]">ENERGY NODE</span>
            </div>
            <div className="space-y-1.5 ml-5">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Base Amount</span>
                <span className="text-white font-mono">1,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Gathering Bonus</span>
                <span className="text-green-400 font-mono">
                  +{(player.gatheringBonus?.energyBonus || 0)}%
                </span>
              </div>
              {activeBoosts.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Shrine Buffs
                  </span>
                  <span className="text-cyan-400 font-mono">
                    +{(totalShrineBonus * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date() && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    VIP Multiplier
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    ×2
                  </span>
                </div>
              )}
              {isPlayerFlagBearer && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    🚩 Flag Bearer
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    +100%
                  </span>
                </div>
              )}
              <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent my-1" />
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">Expected Amount</span>
                <span className="text-green-400 font-bold font-mono">
                  {(() => {
                    const hasVIP = player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date();
                    let amount = 1000 * (1 + ((player.gatheringBonus?.energyBonus || 0) / 100)) * (1 + totalShrineBonus);
                    if (hasVIP) amount *= 2;
                    if (isPlayerFlagBearer) amount *= 2; // Flag bearer +100% = 2x multiplier
                    return Math.round(amount).toLocaleString();
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />

          {/* Cave/Forest Breakdown */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Mountain className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-white/70 font-semibold text-[11px]">CAVE/FOREST</span>
            </div>
            <div className="space-y-1.5 ml-5">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Base Amount</span>
                <span className="text-white font-mono">500-1,500</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Gathering Bonus</span>
                <span className="text-green-400 font-mono">
                  +{(player.gatheringBonus?.metalBonus || 0)}% / +{(player.gatheringBonus?.energyBonus || 0)}%
                </span>
              </div>
              {activeBoosts.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Shrine Buffs
                  </span>
                  <span className="text-cyan-400 font-mono">
                    +{(totalShrineBonus * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date() && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    VIP Multiplier
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    ×2
                  </span>
                </div>
              )}
              {isPlayerFlagBearer && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-1">
                    🚩 Flag Bearer
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">
                    +100%
                  </span>
                </div>
              )}
              <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent my-1" />
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">Expected Range</span>
                <span className="text-green-400 font-bold font-mono text-[10px]">
                  {(() => {
                    const hasVIP = player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date();
                    let minAmount = 500 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                    let maxAmount = 1500 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                    if (hasVIP) {
                      minAmount *= 2;
                      maxAmount *= 2;
                    }
                    if (isPlayerFlagBearer) {
                      minAmount *= 2; // Flag bearer +100% = 2x multiplier
                      maxAmount *= 2;
                    }
                    return `${Math.round(minAmount).toLocaleString()}-${Math.round(maxAmount).toLocaleString()}`;
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Harvest Cooldown Info */}
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
            <div className="flex items-center gap-2 text-[10px] text-amber-300">
              <Clock className="w-3 h-3" />
              <span>5-minute cooldown per tile after harvesting</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clan Info - NEW */}
      {player.clanId && (
        <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-purple-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(147,51,234,0.2)]">
          {/* Banner Title */}
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-b border-purple-500/30 px-3 py-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <Users className="w-4 h-4" />
              CLAN
            </h3>
          </div>
          {/* Content */}
          <div className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Name</span>
              <span className="font-semibold text-purple-400 font-display truncate max-w-[150px]">
                {player.clanName || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Level</span>
              <span className="text-white font-bold">{player.clanLevel || 1}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Role</span>
              <span className="text-cyan-400 text-[10px] font-semibold uppercase">
                {player.clanRole || 'MEMBER'}
              </span>
            </div>
            <Button 
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
              }} 
              variant="secondary"
              size="sm"
              fullWidth
              className="text-xs py-2 mt-2"
            >
              <Users className="w-3.5 h-3.5" />
              View Clan (C)
            </Button>
          </div>
        </div>
      )}

      {/* Shrine Boosts */}
      {player.shrineBoosts && player.shrineBoosts.length > 0 && (
        <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          {/* Banner Title */}
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              SHRINE BUFFS
            </h3>
          </div>
          {/* Content */}
          <div className="p-3">
            {activeBoosts.length > 0 ? (
              <div className="space-y-2 text-xs">
                {activeBoosts.map(boost => (
                  <div key={boost.tier} className="flex justify-between items-center p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-white text-xs font-medium">
                      {getBoostIcon(boost.tier)} {boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1)}
                    </span>
                    <span className="text-white/70 text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {boostTimers[boost.tier] || '...'}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent my-1" />
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/70">Total Bonus</span>
                  <span className="text-white font-bold">+{(totalShrineBonus * 100).toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <p className="text-white/70 text-xs">No active buffs</p>
            )}
          </div>
        </div>
      )}

      {/* Action Menu */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
        {/* Banner Title */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            ACTIONS
          </h3>
        </div>
        {/* Content */}
        <div className="p-3 space-y-2">
          <Button 
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
            }} 
            variant="secondary"
            size="sm"
            fullWidth
            className="text-xs py-2"
          >
            <Package className="w-3.5 h-3.5" />
            Inventory
          </Button>
          {player.level >= 15 && (
            <Button 
              onClick={() => router.push('/game/specialization')} 
              variant="secondary"
              size="sm"
              fullWidth
              className="text-xs py-2"
            >
              <Star className="w-3.5 h-3.5" />
              Specialization
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================

