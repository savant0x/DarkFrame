/**
 * Clan Level Display Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Comprehensive clan level progression display with XP bar, current level,
 * next milestone preview, features unlocked list, and time-to-level estimate.
 * Shows milestone history and provides visual feedback for level progression.
 * 
 * Features:
 * - Animated XP progress bar with percentage
 * - Current level badge with tier color coding
 * - Next milestone countdown with rewards preview
 * - Features unlocked checklist
 * - Milestones completed history
 * - Time estimate to next level
 * - Responsive layout for different screen sizes
 * 
 * Integration:
 * - Fetches from GET /api/clan/level
 * - Real-time updates via polling or WebSocket
 * - Links to perk panel when features unlock
 */

'use client';

import { useState, useEffect } from 'react';
import { formatNumberAbbreviated } from '@/utils/formatting';

interface LevelInfo {
  currentLevel: number;
  totalXP: number;
  currentLevelXP: number;
  xpToNextLevel: number;
  progressPercentage: number;
  nextMilestone: {
    level: number;
    rewards: {
      metal: number;
      energy: number;
      researchPoints: number;
    };
    unlocksFeature?: string;
    description: string;
  } | null;
  milestonesCompleted: number;
  featuresUnlocked: string[];
  maxLevel: boolean;
}

interface Milestone {
  level: number;
  completedAt: string;
  rewards: {
    metal: number;
    energy: number;
    researchPoints: number;
  };
}

interface ClanLevelDisplayProps {
  clanId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

export default function ClanLevelDisplay({
  clanId,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: ClanLevelDisplayProps) {
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [milestones, setMilestones] = useState<{
    completed: Milestone[];
    upcoming: any[];
    currentLevel: number;
  } | null>(null);
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch level info
  const fetchLevelInfo = async () => {
    try {
      const response = await fetch('/api/clan/level?detailed=true&estimate=true');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch level info');
      }

      const data = await response.json();
      setLevelInfo(data.level);
      setMilestones(data.milestones);
      setEstimatedHours(data.estimatedHoursToNextLevel);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevelInfo();

    if (autoRefresh) {
      const interval = setInterval(fetchLevelInfo, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Get level tier color
  const getLevelTierColor = (level: number): string => {
    if (level >= 40) return 'text-purple-400'; // Legendary
    if (level >= 25) return 'text-yellow-400'; // Gold
    if (level >= 15) return 'text-blue-400';   // Silver
    if (level >= 5) return 'text-orange-400';  // Bronze
    return 'text-gray-400'; // Starting
  };

  // Get level tier name
  const getLevelTier = (level: number): string => {
    if (level >= 40) return 'Legendary';
    if (level >= 25) return 'Gold';
    if (level >= 15) return 'Silver';
    if (level >= 5) return 'Bronze';
    return 'Novice';
  };

  // Format feature name
  const formatFeatureName = (feature: string): string => {
    return feature
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-20 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
        <p className="text-red-400">Error loading level info: {error}</p>
        <button
          onClick={fetchLevelInfo}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!levelInfo) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
      {/* Header with Level Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`text-6xl font-bold ${getLevelTierColor(levelInfo.currentLevel)}`}>
            {levelInfo.currentLevel}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Clan Level</h2>
            <p className={`text-sm ${getLevelTierColor(levelInfo.currentLevel)}`}>
              {getLevelTier(levelInfo.currentLevel)} Tier
            </p>
          </div>
        </div>

        {levelInfo.maxLevel ? (
          <div className="px-4 py-2 bg-purple-900/50 border border-purple-500 rounded">
            <span className="text-purple-400 font-bold">MAX LEVEL</span>
          </div>
        ) : null}
      </div>

      {/* XP Progress Bar */}
      {!levelInfo.maxLevel && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              XP: {formatNumberAbbreviated(levelInfo.currentLevelXP)} / {formatNumberAbbreviated(levelInfo.currentLevelXP + levelInfo.xpToNextLevel)}
            </span>
            <span className="text-cyan-400 font-bold">
              {levelInfo.progressPercentage}%
            </span>
          </div>

          <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${levelInfo.progressPercentage}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatNumberAbbreviated(levelInfo.xpToNextLevel)} XP to next level</span>
            {estimatedHours !== null && estimatedHours > 0 && (
              <span>
                Est. {estimatedHours < 24 ? `${estimatedHours}h` : `${Math.ceil(estimatedHours / 24)}d`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Next Milestone */}
      {levelInfo.nextMilestone && (
        <div className="bg-gray-900/50 border border-yellow-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-lg">🏆</span>
            <h3 className="text-yellow-400 font-bold">
              Next Milestone: Level {levelInfo.nextMilestone.level}
            </h3>
          </div>
          <p className="text-gray-300 text-sm mb-3">
            {levelInfo.nextMilestone.description}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-400">Metal</div>
              <div className="text-orange-400 font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.metal)}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-400">Energy</div>
              <div className="text-blue-400 font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.energy)}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-gray-400">RP</div>
              <div className="text-purple-400 font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.researchPoints)}
              </div>
            </div>
          </div>
          {levelInfo.nextMilestone.unlocksFeature && (
            <div className="mt-3 px-3 py-2 bg-green-900/30 border border-green-700 rounded text-center">
              <span className="text-green-400 text-sm font-semibold">
                🔓 Unlocks: {formatFeatureName(levelInfo.nextMilestone.unlocksFeature)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Features Unlocked */}
      {levelInfo.featuresUnlocked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>✅</span>
            Features Unlocked ({levelInfo.featuresUnlocked.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {levelInfo.featuresUnlocked.map((feature) => (
              <div
                key={feature}
                className="bg-green-900/20 border border-green-700/50 rounded px-3 py-2 text-sm text-green-400"
              >
                {formatFeatureName(feature)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones Completed */}
      {milestones && milestones.completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>🏆</span>
            Milestones Completed ({milestones.completed.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {milestones.completed
              .sort((a, b) => b.level - a.level)
              .map((milestone) => (
                <div
                  key={milestone.level}
                  className="bg-gray-900/50 border border-gray-700 rounded p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-white font-semibold">Level {milestone.level}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(milestone.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-orange-400">
                      {formatNumberAbbreviated(milestone.rewards.metal)} M
                    </span>
                    <span className="text-blue-400">
                      {formatNumberAbbreviated(milestone.rewards.energy)} E
                    </span>
                    <span className="text-purple-400">
                      {formatNumberAbbreviated(milestone.rewards.researchPoints)} RP
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
        <div className="text-center">
          <div className="text-gray-400 text-sm">Total XP</div>
          <div className="text-white font-bold text-lg">
            {formatNumberAbbreviated(levelInfo.totalXP)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-sm">Milestones</div>
          <div className="text-yellow-400 font-bold text-lg">
            {levelInfo.milestonesCompleted} / 8
          </div>
        </div>
      </div>
    </div>
  );
}

