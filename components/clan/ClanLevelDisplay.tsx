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
import { getErrorMessage } from '@/lib/errorMessage';
import { formatNumberAbbreviated } from '@/utils/formatting';
import type { ClanMilestone } from '@/types/clan.types';


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
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: ClanLevelDisplayProps) {
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [milestones, setMilestones] = useState<{
    completed: Milestone[];
    upcoming: ClanMilestone[];
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
    } catch (err) {
      setError(getErrorMessage(err));
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
    if (level >= 40) return 'text-[color:var(--nn-violet)]'; // Legendary
    if (level >= 25) return 'text-[color:var(--nn-amber)]'; // Gold
    if (level >= 15) return 'text-[color:var(--nn-cyan)]';   // Silver
    if (level >= 5) return 'text-[color:var(--nn-amber)]';  // Bronze
    return 'nn-text-secondary'; // Starting
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
      <div className="nn-surface rounded-none p-6 border border-[color:var(--nn-glass-border)]">
        <div className="nn-pulse">
          <div className="h-8 nn-surface rounded-none w-1/3 mb-4"></div>
          <div className="h-4 nn-surface rounded-none w-full mb-2"></div>
          <div className="h-20 nn-surface rounded-none w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-6">
        <p className="text-[color:var(--nn-magenta)]">Error loading level info: {error}</p>
        <button
          onClick={fetchLevelInfo}
          className="mt-4 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] rounded-none transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!levelInfo) return null;

  return (
    <div className="nn-surface rounded-none p-6 border border-[color:var(--nn-glass-border)] space-y-6">
      {/* Header with Level Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`text-6xl font-bold ${getLevelTierColor(levelInfo.currentLevel)}`}>
            {levelInfo.currentLevel}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Clan Level</h2>
            <p className={`text-sm ${getLevelTierColor(levelInfo.currentLevel)}`}>
              {getLevelTier(levelInfo.currentLevel)} Tier
            </p>
          </div>
        </div>

        {levelInfo.maxLevel ? (
          <div className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none">
            <span className="text-[color:var(--nn-violet)] font-bold">MAX LEVEL</span>
          </div>
        ) : null}
      </div>

      {/* XP Progress Bar */}
      {!levelInfo.maxLevel && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="nn-text-secondary">
              XP: {formatNumberAbbreviated(levelInfo.currentLevelXP)} / {formatNumberAbbreviated(levelInfo.currentLevelXP + levelInfo.xpToNextLevel)}
            </span>
            <span className="text-[color:var(--nn-cyan)] font-bold">
              {levelInfo.progressPercentage}%
            </span>
          </div>

          <div className="h-6 nn-surface rounded-none overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-cyan)] transition-all duration-1000 ease-out"
              style={{ width: `${levelInfo.progressPercentage}%` }}
            />
          </div>

          <div className="flex justify-between text-xs nn-text-secondary">
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
        <div className="nn-surface nn-surface--dark border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[color:var(--nn-amber)] text-lg">🏆</span>
            <h3 className="text-[color:var(--nn-amber)] font-bold">
              Next Milestone: Level {levelInfo.nextMilestone.level}
            </h3>
          </div>
          <p className="nn-text-primary text-sm mb-3">
            {levelInfo.nextMilestone.description}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="nn-surface rounded-none p-2 text-center">
              <div className="nn-text-secondary">Metal</div>
              <div className="text-[color:var(--nn-amber)] font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.metal)}
              </div>
            </div>
            <div className="nn-surface rounded-none p-2 text-center">
              <div className="nn-text-secondary">Energy</div>
              <div className="text-[color:var(--nn-cyan)] font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.energy)}
              </div>
            </div>
            <div className="nn-surface rounded-none p-2 text-center">
              <div className="nn-text-secondary">RP</div>
              <div className="text-[color:var(--nn-violet)] font-bold">
                {formatNumberAbbreviated(levelInfo.nextMilestone.rewards.researchPoints)}
              </div>
            </div>
          </div>
          {levelInfo.nextMilestone.unlocksFeature && (
            <div className="mt-3 px-3 py-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none text-center">
              <span className="text-[color:var(--nn-green)] text-sm font-semibold">
                🔓 Unlocks: {formatFeatureName(levelInfo.nextMilestone.unlocksFeature)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Features Unlocked */}
      {levelInfo.featuresUnlocked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[color:var(--nn-text-primary)] font-bold flex items-center gap-2">
            <span>✅</span>
            Features Unlocked ({levelInfo.featuresUnlocked.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {levelInfo.featuresUnlocked.map((feature) => (
              <div
                key={feature}
                className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none px-3 py-2 text-sm text-[color:var(--nn-green)]"
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
          <h3 className="text-[color:var(--nn-text-primary)] font-bold flex items-center gap-2">
            <span>🏆</span>
            Milestones Completed ({milestones.completed.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {milestones.completed
              .sort((a, b) => b.level - a.level)
              .map((milestone) => (
                <div
                  key={milestone.level}
                  className="nn-surface nn-surface--dark border border-[color:var(--nn-glass-border)] rounded-none p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[color:var(--nn-text-primary)] font-semibold">Level {milestone.level}</div>
                    <div className="text-xs nn-text-secondary">
                      {new Date(milestone.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-[color:var(--nn-amber)]">
                      {formatNumberAbbreviated(milestone.rewards.metal)} M
                    </span>
                    <span className="text-[color:var(--nn-cyan)]">
                      {formatNumberAbbreviated(milestone.rewards.energy)} E
                    </span>
                    <span className="text-[color:var(--nn-violet)]">
                      {formatNumberAbbreviated(milestone.rewards.researchPoints)} RP
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[color:var(--nn-glass-border)]">
        <div className="text-center">
          <div className="nn-text-secondary text-sm">Total XP</div>
          <div className="text-[color:var(--nn-text-primary)] font-bold text-lg">
            {formatNumberAbbreviated(levelInfo.totalXP)}
          </div>
        </div>
        <div className="text-center">
          <div className="nn-text-secondary text-sm">Milestones</div>
          <div className="text-[color:var(--nn-amber)] font-bold text-lg">
            {levelInfo.milestonesCompleted} / 8
          </div>
        </div>
      </div>
    </div>
  );
}

