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
    color: 'text-[color:var(--nn-text-secondary)]',
    bgColor: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]',
    icon: Eye,
    lootBonus: 1.0,
    description: 'A new adversary',
  },
  notorious: {
    min: 6,
    max: 15,
    label: 'Notorious',
    color: 'text-[color:var(--nn-amber)]',
    bgColor: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]',
    icon: Star,
    lootBonus: 1.1,
    description: '+10% loot from this bot',
  },
  infamous: {
    min: 16,
    max: 30,
    label: 'Infamous',
    color: 'text-[color:var(--nn-amber)]',
    bgColor: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]',
    icon: Skull,
    lootBonus: 1.25,
    description: '+25% loot from this bot',
  },
  legendary: {
    min: 31,
    max: Infinity,
    label: 'Legendary',
    color: 'text-[color:var(--nn-violet)]',
    bgColor: 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]',
    icon: Crown,
    lootBonus: 1.5,
    description: '+50% loot from this bot',
  },
} as const;

/**
 * Calculate reputation tier from defeat count
 */
function _getReputationTier(defeats: number): BotReputation {
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
  // DATA FETCHING (live bot reputation from /api/bot-scanner/tracked)
  // ============================================================================

  useEffect(() => {
    const fetchTrackedBots = async () => {
      try {
        setLoading(true);
        setError(null);

        // Real data: botConfig defeat counters maintained by botCombatService
        const response = await fetch('/api/bot-scanner/tracked');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to load tracked bots');
        }

        const bots: TrackedBot[] = (data.bots || []).map((b: Record<string, unknown>) => ({
          botId: String(b.botId),
          botName: String(b.botName),
          specialization: String(b.specialization),
          tier: Number(b.tier),
          defeats: Number(b.defeats),
          reputation: String(b.reputation) as BotReputation,
          lastDefeatAt: b.lastDefeatAt ? new Date(String(b.lastDefeatAt)) : new Date(0),
          totalLoot: {
            metal: Number((b.totalLoot as { metal?: number } | undefined)?.metal ?? 0),
            energy: Number((b.totalLoot as { energy?: number } | undefined)?.energy ?? 0),
          },
        }));

        setTrackedBots(bots);
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
        className={`rounded-none border-2 p-4 transition-all ${repInfo.bgColor} border-opacity-50`}
        style={{ borderColor: repInfo.color.replace('text-', '') }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Icon className={repInfo.color} size={28} />
            <div>
              <div className="text-[color:var(--nn-text-primary)] font-bold">{bot.botName}</div>
              <div className="text-[color:var(--nn-text-secondary)] text-sm">
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
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-xs">Defeats</div>
            <div className="text-[color:var(--nn-text-primary)] font-bold text-lg">{bot.defeats}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-xs">Loot Bonus</div>
            <div className={`font-bold text-lg ${repInfo.color}`}>
              +{Math.round((repInfo.lootBonus - 1) * 100)}%
            </div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-xs">Last Defeat</div>
            <div className="text-[color:var(--nn-text-primary)] font-bold text-xs">
              {formatTimeAgo(bot.lastDefeatAt)}
            </div>
          </div>
        </div>

        {/* Total Loot */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-[color:var(--nn-text-secondary)]">Total Loot:</span>
          <div className="flex gap-3">
            <span className="text-[color:var(--nn-text-secondary)]">
              💰 {bot.totalLoot.metal.toLocaleString()}
            </span>
            <span className="text-[color:var(--nn-cyan)]">
              ⚡ {bot.totalLoot.energy.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {bot.reputation !== 'legendary' && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[color:var(--nn-text-secondary)]">Progress to Next Tier</span>
              <span className="text-[color:var(--nn-text-primary)]">
                {bot.defeats} / {repInfo.max + 1}
              </span>
            </div>
            <div className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-full h-2">
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
      <div className="bg-[color:var(--nn-void)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]" />
          <span className="text-[color:var(--nn-text-secondary)]">Loading reputation data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--nn-void)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-[color:var(--nn-violet)]" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Bot Reputation</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm">Track your nemeses and earn bonuses</p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('defeats')}
            className={`px-3 py-1 rounded-none text-sm transition-colors ${
              sortBy === 'defeats'
                ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
            }`}
          >
            By Defeats
          </button>
          <button
            onClick={() => setSortBy('reputation')}
            className={`px-3 py-1 rounded-none text-sm transition-colors ${
              sortBy === 'reputation'
                ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
            }`}
          >
            By Tier
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1 rounded-none text-sm transition-colors ${
              sortBy === 'recent'
                ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)] px-4 py-3 rounded-none mb-4">
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
              className={`rounded-none p-3 text-center ${tier.bgColor} border border-opacity-30`}
              style={{ borderColor: tier.color.replace('text-', '') }}
            >
              <Icon className={`${tier.color} mx-auto mb-2`} size={24} />
              <div className={`font-bold ${tier.color}`}>{tier.label}</div>
              <div className="text-[color:var(--nn-text-secondary)] text-xs">
                {tier.min}-{tier.max === Infinity ? '∞' : tier.max} defeats
              </div>
              <div className="text-[color:var(--nn-text-secondary)] text-xs mt-1">
                {tier.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracked Bots List */}
      {sortedBots.length === 0 ? (
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-8 text-center border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
          <Eye className="text-[color:var(--nn-text-secondary)] mx-auto mb-3" size={48} />
          <p className="text-[color:var(--nn-text-secondary)]">No bots tracked yet</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm mt-2">
            Defeat bots to start building your reputation
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBots.map(renderBot)}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <div className="flex items-start gap-2">
          <Star className="text-[color:var(--nn-amber)] mt-1" size={20} />
          <div className="text-sm text-[color:var(--nn-text-secondary)]">
            <p className="font-bold mb-1">How Reputation Works:</p>
            <ul className="list-disc list-inside space-y-1 text-[color:var(--nn-text-secondary)]">
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
