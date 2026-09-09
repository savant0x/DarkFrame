/**
 * @fileoverview Bounty Board Panel - Daily bot defeat challenges UI
 * @module components/BountyBoardPanel
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * Displays daily bounties with progressive difficulty (easy, medium, hard).
 * Shows progress, rewards, and handles reward claiming. Auto-refreshes at midnight.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { showInfo } from '@/lib/toastService';
import { Trophy, Target, Clock, Gift, CheckCircle, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Bounty {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  specialization: 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';
  tier: number;
  defeatsRequired: number;
  currentDefeats: number;
  metalReward: number;
  energyReward: number;
  completed: boolean;
  claimed: boolean;
}

interface BountyStats {
  totalCompleted: number;
  totalClaimed: number;
  unclaimedRewards: number;
  nextRefresh: string; // ISO date string
}

interface BountyData {
  bounties: Bounty[];
  lastRefresh: string;
  unclaimedRewards: number;
  stats: BountyStats;
}

// ============================================================================
// SPECIALIZATION INFO
// ============================================================================

const SPECIALIZATION_INFO: Record<string, { icon: string; color: string }> = {
  Hoarder: { icon: '💰', color: 'text-[color:var(--nn-amber)]' },
  Fortress: { icon: '🛡️', color: 'text-[color:var(--nn-cyan)]' },
  Raider: { icon: '⚔️', color: 'text-[color:var(--nn-magenta)]' },
  Balanced: { icon: '⚖️', color: 'text-[color:var(--nn-green)]' },
  Ghost: { icon: '👻', color: 'text-[color:var(--nn-violet)]' },
};

const DIFFICULTY_INFO: Record<string, { color: string; bgColor: string; label: string }> = {
  easy: { color: 'text-[color:var(--nn-green)]', bgColor: 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]', label: 'Easy' },
  medium: { color: 'text-[color:var(--nn-amber)]', bgColor: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]', label: 'Medium' },
  hard: { color: 'text-[color:var(--nn-magenta)]', bgColor: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]', label: 'Hard' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function BountyBoardPanel() {
  const [bountyData, setBountyData] = useState<BountyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>('');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchBounties = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/bounty-board');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load bounties');
      }

      setBountyData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bounties');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBounties();
  }, []);

  // Refresh countdown timer
  useEffect(() => {
    if (!bountyData?.stats.nextRefresh) return;

    const updateTimer = () => {
      const now = new Date();
      const next = new Date(bountyData.stats.nextRefresh);
      const diff = next.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilRefresh('Refreshing...');
        fetchBounties(); // Auto-refresh
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilRefresh(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [bountyData?.stats.nextRefresh]);

  // ============================================================================
  // REWARD CLAIMING
  // ============================================================================

  const handleClaimReward = async (bountyId: string) => {
    try {
      setClaiming(bountyId);
      setError(null);

      const response = await fetch('/api/bounty-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bountyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to claim reward');
      }

      // Refresh bounty data
      await fetchBounties();

      // Show success message
      showInfo(`Reward claimed! +${result.metalGained.toLocaleString()} Metal, +${result.energyGained.toLocaleString()} Energy`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderBounty = (bounty: Bounty) => {
    const difficultyInfo = DIFFICULTY_INFO[bounty.difficulty];
    const specInfo = SPECIALIZATION_INFO[bounty.specialization];
    const progress = (bounty.currentDefeats / bounty.defeatsRequired) * 100;

    return (
      <div
        key={bounty.id}
        className={`rounded-none border-2 p-4 transition-all ${
          bounty.completed
            ? 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]'
            : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-none text-sm font-bold ${difficultyInfo.bgColor} ${difficultyInfo.color}`}>
              {difficultyInfo.label}
            </span>
            <span className="text-[color:var(--nn-text-secondary)]">Tier {bounty.tier}</span>
          </div>
          {bounty.completed && (
            bounty.claimed ? (
              <CheckCircle className="text-[color:var(--nn-green)]" size={24} />
            ) : (
              <Gift className="text-[color:var(--nn-amber)] nn-pulse" size={24} />
            )
          )}
        </div>

        {/* Objective */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-3xl ${specInfo.color}`}>{specInfo.icon}</span>
          <div>
            <div className="text-[color:var(--nn-text-primary)] font-bold">
              Defeat {bounty.defeatsRequired}× {bounty.specialization} Bots
            </div>
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Tier {bounty.tier}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[color:var(--nn-text-secondary)]">Progress</span>
            <span className={bounty.completed ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-text-primary)]'}>
              {bounty.currentDefeats} / {bounty.defeatsRequired}
            </span>
          </div>
          <div className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                bounty.completed ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Rewards */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[color:var(--nn-text-secondary)]">Rewards:</div>
          <div className="flex gap-3 text-sm">
            <span className="text-[color:var(--nn-text-secondary)]">
              💰 {bounty.metalReward.toLocaleString()}
            </span>
            <span className="text-[color:var(--nn-cyan)]">
              ⚡ {bounty.energyReward.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Claim Button */}
        {bounty.completed && !bounty.claimed && (
          <button
            onClick={() => handleClaimReward(bounty.id)}
            disabled={claiming === bounty.id}
            className="w-full bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] font-bold py-2 px-4 rounded-none transition-colors"
          >
            {claiming === bounty.id ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {bounty.claimed && (
          <div className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] text-center font-bold py-2 px-4 rounded-none">
            Reward Claimed
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading && !bountyData) {
    return (
      <div className="bg-[color:var(--nn-void)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" aria-label="Loading bounties" />
          <span className="text-[color:var(--nn-text-secondary)]">Loading bounty board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--nn-void)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-[color:var(--nn-amber)]" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Bounty Board</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm">Daily bot hunting challenges</p>
          </div>
        </div>

        {/* Next Refresh Timer */}
        <div className="flex items-center gap-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] px-4 py-2 rounded-none">
          <Clock className="text-[color:var(--nn-cyan)]" size={20} />
          <div className="text-sm">
            <div className="text-[color:var(--nn-text-secondary)]">Next refresh</div>
            <div className="text-[color:var(--nn-text-primary)] font-bold">{timeUntilRefresh}</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)] px-4 py-3 rounded-none mb-4">
          {error}
        </div>
      )}

      {/* Statistics */}
      {bountyData && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Completed</div>
            <div className="text-[color:var(--nn-text-primary)] text-2xl font-bold">
              {bountyData.stats.totalCompleted}
            </div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Claimed</div>
            <div className="text-[color:var(--nn-text-primary)] text-2xl font-bold">
              {bountyData.stats.totalClaimed}
            </div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 text-center">
            <div className="text-[color:var(--nn-text-secondary)] text-sm">Unclaimed</div>
            <div className="text-[color:var(--nn-amber)] text-2xl font-bold">
              {bountyData.stats.unclaimedRewards}
            </div>
          </div>
        </div>
      )}

      {/* Bounty List */}
      {bountyData && (
        <div className="space-y-4">
          {bountyData.bounties.map(renderBounty)}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <div className="flex items-start gap-2">
          <Target className="text-[color:var(--nn-cyan)] mt-1" size={20} />
          <div className="text-sm text-[color:var(--nn-text-secondary)]">
            <p className="font-bold mb-1">How Bounties Work:</p>
            <ul className="list-disc list-inside space-y-1 text-[color:var(--nn-text-secondary)]">
              <li>Defeat the specified bot type and tier to progress</li>
              <li>Complete all required defeats to unlock rewards</li>
              <li>Claim rewards before midnight or they expire</li>
              <li>Bounties refresh daily at midnight UTC</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
