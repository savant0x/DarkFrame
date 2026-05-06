/**
 * @fileoverview Reputation Panel - Bot defeat tracking and reputation tiers
 * @module components/ReputationPanel
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * Displays player's reputation levels for each bot encountered. Reputation
 * tiers unlock bonus rewards and are based on cumulative defeats per bot.
 * Integrated with existing bot tracking system.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Star, Skull, Eye, Crown } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bot reputation tier based on defeats
 */
export type BotReputation = 'unknown' | 'notorious' | 'infamous' | 'legendary';

/**
 * Bot tracking data with reputation
 */
interface TrackedBot {
  botId: string;
  botName: string;
  specialization: string;
  tier: number;
  defeats: number;
  reputation: BotReputation;
  lastDefeatAt: Date;
  totalLoot: {
    metal: number;
    energy: number;
  };
}

// ============================================================================
// REPUTATION CONFIGURATION
// ============================================================================

/**
 * Reputation tier thresholds and bonuses
 */
const REPUTATION_TIERS = {
  unknown: {
    min: 0,
    max: 5,
    label: 'Unknown',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    icon: Eye,
    lootBonus: 1.0,
    description: 'A new adversary',
  },
  notorious: {
    min: 6,
    max: 15,
    label: 'Notorious',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: Star,
    lootBonus: 1.1,
    description: '+10% loot from this bot',
  },
  infamous: {
    min: 16,
    max: 30,
    label: 'Infamous',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: Skull,
    lootBonus: 1.25,
    description: '+25% loot from this bot',
  },
  legendary: {
    min: 31,
    max: Infinity,
    label: 'Legendary',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: Crown,
    lootBonus: 1.5,
    description: '+50% loot from this bot',
  },
} as const;

/**
 * Calculate reputation tier from defeat count
 */
function getReputationTier(defeats: number): BotReputation {
  if (defeats >= REPUTATION_TIERS.legendary.min) return 'legendary';
  if (defeats >= REPUTATION_TIERS.infamous.min) return 'infamous';
  if (defeats >= REPUTATION_TIERS.notorious.min) return 'notorious';
  return 'unknown';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ReputationPanel() {
  const [trackedBots, setTrackedBots] = useState<TrackedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'defeats' | 'reputation' | 'recent'>('defeats');

  // ============================================================================
  // DATA FETCHING (Mock for now - integrate with bot scanner service)
  // ============================================================================

  useEffect(() => {
    const fetchTrackedBots = async () => {
      try {
        setLoading(true);
        setError(null);

        // TODO: Replace with actual API call to bot scanner service
        // const response = await fetch('/api/bot-scanner/tracked');
        // const data = await response.json();

        // Mock data for demonstration
        const mockBots: TrackedBot[] = [
          {
            botId: 'bot-001',
            botName: 'IronVault_42',
            specialization: 'Fortress',
            tier: 5,
            defeats: 35,
            reputation: 'legendary',
            lastDefeatAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            totalLoot: { metal: 450000, energy: 280000 },
          },
          {
            botId: 'bot-002',
            botName: 'GhostRaider_13',
            specialization: 'Ghost',
            tier: 4,
            defeats: 18,
            reputation: 'infamous',
            lastDefeatAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
            totalLoot: { metal: 280000, energy: 190000 },
          },
          {
            botId: 'bot-003',
            botName: 'Hoarder_99',
            specialization: 'Hoarder',
            tier: 3,
            defeats: 8,
            reputation: 'notorious',
            lastDefeatAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            totalLoot: { metal: 120000, energy: 80000 },
          },
        ];

        setTrackedBots(mockBots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tracked bots');
      } finally {
        setLoading(false);
      }
    };

    fetchTrackedBots();
  }, []);

  // ============================================================================
  // SORTING
  // ============================================================================

  const sortedBots = [...trackedBots].sort((a, b) => {
    switch (sortBy) {
      case 'defeats':
        return b.defeats - a.defeats;
      case 'reputation': {
        const repOrder = { legendary: 4, infamous: 3, notorious: 2, unknown: 1 };
        return repOrder[b.reputation] - repOrder[a.reputation];
      }
      case 'recent':
        return new Date(b.lastDefeatAt).getTime() - new Date(a.lastDefeatAt).getTime();
      default:
        return 0;
    }
  });

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderBot = (bot: TrackedBot) => {
    const repInfo = REPUTATION_TIERS[bot.reputation];
    const Icon = repInfo.icon;
    const progressToNext = bot.reputation !== 'legendary'
      ? ((bot.defeats - repInfo.min) / (repInfo.max - repInfo.min)) * 100
      : 100;

    return (
      <div
        key={bot.botId}
        className={`rounded-lg border-2 p-4 transition-all ${repInfo.bgColor} border-opacity-50`}
        style={{ borderColor: repInfo.color.replace('text-', '') }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Icon className={repInfo.color} size={28} />
            <div>
              <div className="text-white font-bold">{bot.botName}</div>
              <div className="text-gray-400 text-sm">
                {bot.specialization} • Tier {bot.tier}
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full font-bold text-sm ${repInfo.bgColor} ${repInfo.color}`}>
            {repInfo.label}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="bg-gray-800/50 rounded p-2 text-center">
            <div className="text-gray-400 text-xs">Defeats</div>
            <div className="text-white font-bold text-lg">{bot.defeats}</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2 text-center">
            <div className="text-gray-400 text-xs">Loot Bonus</div>
            <div className={`font-bold text-lg ${repInfo.color}`}>
              +{Math.round((repInfo.lootBonus - 1) * 100)}%
            </div>
          </div>
          <div className="bg-gray-800/50 rounded p-2 text-center">
            <div className="text-gray-400 text-xs">Last Defeat</div>
            <div className="text-white font-bold text-xs">
              {formatTimeAgo(bot.lastDefeatAt)}
            </div>
          </div>
        </div>

        {/* Total Loot */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-gray-400">Total Loot:</span>
          <div className="flex gap-3">
            <span className="text-gray-300">
              💰 {bot.totalLoot.metal.toLocaleString()}
            </span>
            <span className="text-blue-300">
              ⚡ {bot.totalLoot.energy.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {bot.reputation !== 'legendary' && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Progress to Next Tier</span>
              <span className="text-white">
                {bot.defeats} / {repInfo.max + 1}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${repInfo.color.replace('text-', 'bg-')}`}
                style={{ width: `${progressToNext}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border-2 border-gray-700">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          <span className="text-gray-400">Loading reputation data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border-2 border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-purple-400" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-white">Bot Reputation</h2>
            <p className="text-gray-400 text-sm">Track your nemeses and earn bonuses</p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('defeats')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              sortBy === 'defeats'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            By Defeats
          </button>
          <button
            onClick={() => setSortBy('reputation')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              sortBy === 'reputation'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            By Tier
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              sortBy === 'recent'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Reputation Tiers Guide */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(REPUTATION_TIERS).map(([key, tier]) => {
          const Icon = tier.icon;
          return (
            <div
              key={key}
              className={`rounded-lg p-3 text-center ${tier.bgColor} border border-opacity-30`}
              style={{ borderColor: tier.color.replace('text-', '') }}
            >
              <Icon className={`${tier.color} mx-auto mb-2`} size={24} />
              <div className={`font-bold ${tier.color}`}>{tier.label}</div>
              <div className="text-gray-400 text-xs">
                {tier.min}-{tier.max === Infinity ? '∞' : tier.max} defeats
              </div>
              <div className="text-gray-300 text-xs mt-1">
                {tier.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracked Bots List */}
      {sortedBots.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
          <Eye className="text-gray-500 mx-auto mb-3" size={48} />
          <p className="text-gray-400">No bots tracked yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Defeat bots to start building your reputation
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBots.map(renderBot)}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-start gap-2">
          <Star className="text-yellow-400 mt-1" size={20} />
          <div className="text-sm text-gray-300">
            <p className="font-bold mb-1">How Reputation Works:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Defeating the same bot multiple times increases your reputation</li>
              <li>Higher reputation tiers grant increased loot bonuses</li>
              <li>Legendary reputation (31+ defeats) gives +50% loot</li>
              <li>Track your nemeses and optimize farming routes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
