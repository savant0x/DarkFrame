// ============================================================
// FILE: AchievementPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2025-01-17
// ============================================================
// OVERVIEW:
// Achievement progress UI component displaying 10 achievements across 4 categories.
// Features category filtering (Combat, Economic, Exploration, Progression),
// progress bars, rarity-based styling, and prestige unit unlocks.
// Uses keyboard shortcut (A key) for toggle. Integrates design system components
// (Card, Badge, ProgressBar, Button, StaggerChildren, LoadingSpinner).
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Achievement, AchievementCategory, AchievementRarity } from '@/types/game.types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Divider } from '@/components/ui/Divider';
import { StaggerChildren, StaggerItem } from '@/components/transitions/StaggerChildren';
import { LoadingSpinner } from '@/components/transitions/LoadingSpinner';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get border and background classes for achievement rarity
 * @param rarity - Achievement rarity level
 * @returns Tailwind classes for styling
 */
function getRarityClasses(rarity: AchievementRarity): string {
  const map: Record<AchievementRarity, string> = {
    [AchievementRarity.Common]: 'border-gray-400 bg-gray-900/80',
    [AchievementRarity.Rare]: 'border-blue-400 bg-blue-900/80',
    [AchievementRarity.Epic]: 'border-purple-500 bg-purple-900/80',
    [AchievementRarity.Legendary]: 'border-orange-500 bg-gradient-to-br from-orange-900/80 to-red-900/80'
  };
  return map[rarity] || map[AchievementRarity.Common];
}

/**
 * Get text color class for achievement category
 * @param category - Achievement category
 * @returns Tailwind text color class
 */
function getCategoryColor(category: AchievementCategory): string {
  const map: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: 'text-red-400',
    [AchievementCategory.Economic]: 'text-yellow-400',
    [AchievementCategory.Exploration]: 'text-green-400',
    [AchievementCategory.Progression]: 'text-purple-400'
  };
  return map[category] || 'text-gray-400';
}

/**
 * Get icon emoji for achievement category
 * @param category - Achievement category
 * @returns Icon emoji string
 */
function getCategoryIcon(category: AchievementCategory): string {
  const map: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: '⚔️',
    [AchievementCategory.Economic]: '💰',
    [AchievementCategory.Exploration]: '🗺️',
    [AchievementCategory.Progression]: '📈'
  };
  return map[category] || '❓';
}

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Comprehensive achievement progress panel (A key shortcut)
 * 
 * Features:
 * - Grid layout with 10 achievement cards
 * - Category filtering (All, Combat, Economic, Exploration, Progression)
 * - Progress bars showing current/required values
 * - Locked vs unlocked styling with checkmarks
 * - Prestige unit preview for each achievement
 * - Completion celebration when 10/10 reached
 * - Real-time progress updates from API
 * - Design system integration with animations
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

  // ============================================================
  // DATA FETCHING
  // ============================================================

  /**
   * Fetch achievement progress data from server
   * Loads all achievements with progress, unlock status, and category breakdown
   */
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
      console.error('Achievement fetch error:', err);
      setError('Network error loading achievements');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FILTERING
  // ============================================================

  /**
   * Filter achievements by selected category
   * Returns all achievements if 'all' is selected, otherwise filters by category
   */
  const filteredAchievements = progressData?.achievements.filter(
    a => selectedCategory === 'all' || a.category === selectedCategory
  ) || [];

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  if (!isOpen) return null;

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 flex items-center justify-between rounded-t-lg">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Category Filter */}
        <div className="bg-gray-700 p-3 flex gap-2 overflow-x-auto">
          <Button
            variant={selectedCategory === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All ({progressData?.totalAvailable || 0})
          </Button>
          {Object.values(AchievementCategory).map(category => {
            const count = progressData?.byCategory[category] || { unlocked: 0, total: 0 };
            const icon = getCategoryIcon(category);
            
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-2"
              >
                <span>{icon}</span>
                <span className="capitalize">{category}</span>
                <span className="text-xs">({count.unlocked}/{count.total})</span>
              </Button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-red-400 font-semibold mb-2">Failed to load achievements</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : progressData ? (
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
              <StaggerChildren staggerDelay={0.06}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {filteredAchievements.map(achievement => {
                    const isUnlocked = !!achievement.unlockedAt;
                    const progressPercent = achievement.progress || 0;
                    const rarityClass = getRarityClasses(achievement.rarity);
                    const categoryColor = getCategoryColor(achievement.category);
                    const categoryIcon = getCategoryIcon(achievement.category);

                    return (
                      <StaggerItem key={achievement.id}>
                        <Card
                          className={`
                            border-2 ${rarityClass}
                            ${isUnlocked ? '' : 'opacity-60'}
                            transition-all hover:scale-[1.02] hover:shadow-lg
                          `}
                        >
                          <div className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{categoryIcon}</span>
                                <div>
                                  <div className="font-bold text-white text-lg">
                                    {achievement.name}
                                  </div>
                                  <Badge variant="default" className={`${categoryColor} bg-transparent`}>
                                    {achievement.rarity}
                                  </Badge>
                                </div>
                              </div>
                              {isUnlocked && (
                                <span className="text-2xl">✅</span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                              {achievement.description}
                            </p>

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{progressPercent}%</span>
                              </div>
                              <ProgressBar
                                value={Math.min(progressPercent, 100)}
                                max={100}
                                size="base"
                                className={isUnlocked ? 'bg-green-500' : ''}
                              />
                            </div>

                            {/* Requirement */}
                            <div className="bg-black/30 rounded p-2 mb-3">
                              <div className="text-gray-400 mb-1 text-xs">Requirement:</div>
                              <div className="text-white font-semibold text-sm">
                                {achievement.requirement.type}: {achievement.requirement.value.toLocaleString()}
                              </div>
                            </div>

                            {/* Rewards */}
                            <div className="bg-black/30 rounded p-2">
                              <div className="text-gray-400 mb-1 text-xs">Rewards:</div>
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
                        </Card>
                      </StaggerItem>
                    );
                  })}
                </div>
              </StaggerChildren>

              {/* Unlocked Prestige Units Summary */}
              {progressData.unlockedPrestigeUnits.length > 0 && (
                <Card className="bg-gray-700">
                  <div className="p-4">
                    <div className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <span>⚔️</span>
                      Unlocked Prestige Units ({progressData.unlockedPrestigeUnits.length})
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {progressData.unlockedPrestigeUnits.map(unit => (
                        <Badge
                          key={unit}
                          variant="default"
                          className="bg-gray-800 border border-yellow-500 text-yellow-300 text-center py-2"
                        >
                          {unit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-3 text-center text-gray-400 text-sm border-t border-gray-600">
          Press <kbd className="px-2 py-1 bg-gray-600 rounded font-mono">A</kbd> to toggle this panel
        </div>
      </Card>
    </div>
  );
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: A key (handled in parent component)
// - Category filtering: All, Combat, Economic, Exploration, Progression
// - Progress bars show completion percentage with color coding
// - Locked achievements shown with reduced opacity (60%)
// - Unlocked achievements show checkmark and unlock date
// - Rarity-based border colors (gray/blue/purple/orange gradient)
// - Category-specific text colors and icons
// - Completion celebration banner when all achievements unlocked
// - Grid layout responsive (1/2/3 columns based on screen size)
// - Scrollable content area with animations (0.06s stagger)
// - Real-time progress fetching from API
// - Design system integration: Card, Badge, Button, ProgressBar, StaggerChildren, LoadingSpinner
// - Hover effects on achievement cards (scale + shadow)
// ============================================================
// END OF FILE
// ============================================================
