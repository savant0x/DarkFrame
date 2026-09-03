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
import { Trophy, Target, Clock, Gift, CheckCircle, Circle } from 'lucide-react';

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
  Hoarder: { icon: '💰', color: 'text-yellow-400' },
  Fortress: { icon: '🛡️', color: 'text-blue-400' },
  Raider: { icon: '⚔️', color: 'text-red-400' },
  Balanced: { icon: '⚖️', color: 'text-green-400' },
  Ghost: { icon: '👻', color: 'text-purple-400' },
};

const DIFFICULTY_INFO: Record<string, { color: string; bgColor: string; label: string }> = {
  easy: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Easy' },
  medium: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Medium' },
  hard: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Hard' },
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
      alert(`Reward claimed! +${result.metalGained.toLocaleString()} Metal, +${result.energyGained.toLocaleString()} Energy`);
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
        className={`rounded-lg border-2 p-4 transition-all ${
          bounty.completed
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-gray-700 bg-gray-800/50'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-sm font-bold ${difficultyInfo.bgColor} ${difficultyInfo.color}`}>
              {difficultyInfo.label}
            </span>
            <span className="text-gray-400">Tier {bounty.tier}</span>
          </div>
          {bounty.completed && (
            bounty.claimed ? (
              <CheckCircle className="text-green-400" size={24} />
            ) : (
              <Gift className="text-yellow-400 animate-pulse" size={24} />
            )
          )}
        </div>

        {/* Objective */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-3xl ${specInfo.color}`}>{specInfo.icon}</span>
          <div>
            <div className="text-white font-bold">
              Defeat {bounty.defeatsRequired}× {bounty.specialization} Bots
            </div>
            <div className="text-gray-400 text-sm">Tier {bounty.tier}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Progress</span>
            <span className={bounty.completed ? 'text-green-400' : 'text-white'}>
              {bounty.currentDefeats} / {bounty.defeatsRequired}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                bounty.completed ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Rewards */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-400">Rewards:</div>
          <div className="flex gap-3 text-sm">
            <span className="text-gray-300">
              💰 {bounty.metalReward.toLocaleString()}
            </span>
            <span className="text-blue-300">
              ⚡ {bounty.energyReward.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Claim Button */}
        {bounty.completed && !bounty.claimed && (
          <button
            onClick={() => handleClaimReward(bounty.id)}
            disabled={claiming === bounty.id}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {claiming === bounty.id ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {bounty.claimed && (
          <div className="w-full bg-gray-700 text-gray-400 text-center font-bold py-2 px-4 rounded">
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
      <div className="bg-gray-900 rounded-lg p-6 border-2 border-gray-700">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="text-gray-400">Loading bounty board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border-2 border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-400" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-white">Bounty Board</h2>
            <p className="text-gray-400 text-sm">Daily bot hunting challenges</p>
          </div>
        </div>

        {/* Next Refresh Timer */}
        <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg">
          <Clock className="text-blue-400" size={20} />
          <div className="text-sm">
            <div className="text-gray-400">Next refresh</div>
            <div className="text-white font-bold">{timeUntilRefresh}</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Statistics */}
      {bountyData && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-sm">Completed</div>
            <div className="text-white text-2xl font-bold">
              {bountyData.stats.totalCompleted}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-sm">Claimed</div>
            <div className="text-white text-2xl font-bold">
              {bountyData.stats.totalClaimed}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-sm">Unclaimed</div>
            <div className="text-yellow-400 text-2xl font-bold">
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
      <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-start gap-2">
          <Target className="text-blue-400 mt-1" size={20} />
          <div className="text-sm text-gray-300">
            <p className="font-bold mb-1">How Bounties Work:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
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
