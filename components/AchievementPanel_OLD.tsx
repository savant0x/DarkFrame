/**
 * @file components/AchievementPanel.tsx
 * @created 2025-01-17
 * @overview Full achievement progress UI with category filtering (A key shortcut)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Achievement, AchievementCategory, AchievementRarity } from '@/types/game.types';

interface AchievementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

interface AchievementProgressData {
  totalUnlocked: number;
  totalAvailable: number;
  progressPercent: number;
  byCategory: Record<string, { unlocked: number; total: number }>;
  achievements: Achievement[];
  unlockedPrestigeUnits: string[];
  completionStatus: 'COMPLETE' | 'IN_PROGRESS';
}

/**
 * Comprehensive achievement progress panel (A key shortcut)
 * 
 * Features:
 * - Grid layout with 10 achievement cards
 * - Category filtering (All, Combat, Economic, Exploration, Progression)
 * - Progress bars showing current/required values
 * - Locked vs unlocked styling
 * - Prestige unit preview for each achievement
 * - Completion celebration when 10/10 reached
 * - Real-time progress updates
 */
export const AchievementPanel: React.FC<AchievementPanelProps> = ({
  isOpen,
  onClose,
  username
}) => {
  const [progressData, setProgressData] = useState<AchievementProgressData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && username) {
      fetchProgress();
    }
  }, [isOpen, username]);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/achievements/progress?username=${username}`);
      const result = await response.json();
      
      if (result.success) {
        setProgressData(result.data);
      } else {
        setError(result.error || 'Failed to load achievements');
      }
    } catch (err) {
      setError('Network error loading achievements');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Rarity colors
  const rarityColors: Record<AchievementRarity, string> = {
    [AchievementRarity.Common]: 'border-gray-400 bg-gray-900/80',
    [AchievementRarity.Rare]: 'border-blue-400 bg-blue-900/80',
    [AchievementRarity.Epic]: 'border-purple-500 bg-purple-900/80',
    [AchievementRarity.Legendary]: 'border-orange-500 bg-gradient-to-br from-orange-900/80 to-red-900/80'
  };

  // Category colors
  const categoryColors: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: 'text-red-400',
    [AchievementCategory.Economic]: 'text-yellow-400',
    [AchievementCategory.Exploration]: 'text-green-400',
    [AchievementCategory.Progression]: 'text-purple-400'
  };

  // Category icons
  const categoryIcons: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: '⚔️',
    [AchievementCategory.Economic]: '💰',
    [AchievementCategory.Exploration]: '🗺️',
    [AchievementCategory.Progression]: '📈'
  };

  // Filter achievements by category
  const filteredAchievements = progressData?.achievements.filter(
    a => selectedCategory === 'all' || a.category === selectedCategory
  ) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-800 rounded-lg border-2 border-yellow-500 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Achievements</h2>
              {progressData && (
                <div className="text-sm text-gray-200">
                  {progressData.totalUnlocked} / {progressData.totalAvailable} Unlocked ({progressData.progressPercent}%)
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Category Filter */}
        <div className="bg-gray-700 p-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded font-semibold ${
              selectedCategory === 'all'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            All ({progressData?.totalAvailable || 0})
          </button>
          {Object.values(AchievementCategory).map(category => {
            const count = progressData?.byCategory[category] || { unlocked: 0, total: 0 };
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded font-semibold flex items-center gap-2 ${
                  selectedCategory === category
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                <span>{categoryIcons[category]}</span>
                <span className="capitalize">{category}</span>
                <span className="text-xs">({count.unlocked}/{count.total})</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">
              Loading achievements...
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 py-8">
              {error}
            </div>
          )}

          {progressData && !loading && (
            <>
              {/* Completion Celebration */}
              {progressData.completionStatus === 'COMPLETE' && (
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg p-6 mb-6 text-center">
                  <div className="text-5xl mb-2">🎉</div>
                  <div className="text-2xl font-bold text-white mb-2">
                    All Achievements Unlocked!
                  </div>
                  <div className="text-white">
                    You've earned all {progressData.totalAvailable} achievements and unlocked every prestige unit!
                  </div>
                </div>
              )}

              {/* Achievement Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAchievements.map(achievement => {
                  const isUnlocked = !!achievement.unlockedAt;
                  const progressPercent = achievement.progress || 0;
                  const rarityClass = rarityColors[achievement.rarity];
                  const categoryColor = categoryColors[achievement.category];
                  const categoryIcon = categoryIcons[achievement.category];

                  return (
                    <div
                      key={achievement.id}
                      className={`
                        border-2 rounded-lg p-4
                        ${rarityClass}
                        ${isUnlocked ? '' : 'opacity-60'}
                        transition-all hover:scale-105
                      `}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{categoryIcon}</span>
                          <div>
                            <div className="font-bold text-white text-lg">
                              {achievement.name}
                            </div>
                            <div className={`text-xs uppercase font-semibold ${categoryColor}`}>
                              {achievement.rarity}
                            </div>
                          </div>
                        </div>
                        {isUnlocked && (
                          <span className="text-2xl">✅</span>
                        )}
                      </div>

                      {/* Description */}
                      <div className="text-gray-300 text-sm mb-3">
                        {achievement.description}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isUnlocked ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(progressPercent, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Requirement */}
                      <div className="bg-black/30 rounded p-2 mb-3 text-sm">
                        <div className="text-gray-400 mb-1">Requirement:</div>
                        <div className="text-white font-semibold">
                          {achievement.requirement.type}: {achievement.requirement.value.toLocaleString()}
                        </div>
                      </div>

                      {/* Rewards */}
                      <div className="bg-black/30 rounded p-2">
                        <div className="text-gray-400 mb-1 text-sm">Rewards:</div>
                        <div className="space-y-1">
                          <div className="text-yellow-300 text-sm flex items-center gap-1">
                            <span>⚔️</span>
                            <span className="font-semibold">{achievement.reward.unitUnlock}</span>
                          </div>
                          {achievement.reward.rpBonus && (
                            <div className="text-purple-300 text-sm flex items-center gap-1">
                              <span>💎</span>
                              <span>+{achievement.reward.rpBonus} RP</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unlocked Date */}
                      {isUnlocked && achievement.unlockedAt && (
                        <div className="mt-2 text-xs text-gray-400 text-center">
                          Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unlocked Prestige Units Summary */}
              {progressData.unlockedPrestigeUnits.length > 0 && (
                <div className="mt-6 bg-gray-700 rounded-lg p-4">
                  <div className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <span>⚔️</span>
                    Unlocked Prestige Units ({progressData.unlockedPrestigeUnits.length})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {progressData.unlockedPrestigeUnits.map(unit => (
                      <div
                        key={unit}
                        className="bg-gray-800 border border-yellow-500 rounded px-3 py-2 text-yellow-300 text-sm font-semibold text-center"
                      >
                        {unit}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-3 text-center text-gray-400 text-sm">
          Press <kbd className="px-2 py-1 bg-gray-600 rounded">A</kbd> to toggle this panel
        </div>
      </div>
    </div>
  );
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: A key (handled in parent component)
// - Category filtering: All, Combat, Economic, Exploration, Progression
// - Progress bars show completion percentage
// - Locked achievements shown with reduced opacity
// - Unlocked achievements show checkmark and unlock date
// - Rarity-based border colors (gray/blue/purple/orange)
// - Category-specific text colors and icons
// - Completion celebration when all achievements unlocked
// - Grid layout responsive (1/2/3 columns based on screen size)
// - Scrollable content area
// - Real-time progress fetching from API
// ============================================================
// USAGE EXAMPLE:
// ============================================================
// const [achievementPanelOpen, setAchievementPanelOpen] = useState(false);
// 
// // Keyboard shortcut handler:
// useEffect(() => {
//   const handleKeyPress = (e: KeyboardEvent) => {
//     if (e.key === 'a' || e.key === 'A') {
//       setAchievementPanelOpen(prev => !prev);
//     }
//   };
//   window.addEventListener('keydown', handleKeyPress);
//   return () => window.removeEventListener('keydown', handleKeyPress);
// }, []);
// 
// <AchievementPanel
//   isOpen={achievementPanelOpen}
//   onClose={() => setAchievementPanelOpen(false)}
//   username={username}
// />
// ============================================================
// END OF FILE
// ============================================================
