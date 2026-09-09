// ============================================================
// FILE: AchievementPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2026-09-08 (FID-20260908-011 neon-noir structural pass)
// ============================================================
// OVERVIEW:
// Achievement progress UI component displaying 10 achievements across 4 categories.
// Features category filtering (Combat, Economic, Exploration, Progression),
// progress bars, rarity-based styling, and prestige unit unlocks.
// Uses keyboard shortcut (A key) for toggle.
// Styling: token primitives only (nn-panel / nn-chip / nn-meter / nn-tab /
// nn-num); no legacy UI-kit or transitions imports. Logic byte-preserved.
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X, Trophy } from 'lucide-react';
import { Achievement, AchievementCategory, AchievementRarity } from '@/types/game.types';

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
 * Get border/background classes for achievement rarity (FID-011: legendary
 * two-stop gradient → flat amber accent; decorative gradient removed)
 * @param rarity - Achievement rarity level
 * @returns Token classes for styling
 */
function getRarityClasses(rarity: AchievementRarity): string {
  const map: Record<AchievementRarity, string> = {
    [AchievementRarity.Common]: 'border-[color-mix(in_oklab,var(--nn-cyan)_30%,transparent)] bg-[color:var(--nn-void)]',
    [AchievementRarity.Rare]: 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]',
    [AchievementRarity.Epic]: 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]',
    [AchievementRarity.Legendary]: 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]'
  };
  return map[rarity] || map[AchievementRarity.Common];
}

/**
 * Get rarity chip class (FID-011: rarity renders as a semantic chip)
 */
function getRarityChip(rarity: AchievementRarity): string {
  const map: Record<AchievementRarity, string> = {
    [AchievementRarity.Common]: 'nn-chip--cyan',
    [AchievementRarity.Rare]: 'nn-chip--cyan',
    [AchievementRarity.Epic]: 'nn-chip--violet',
    [AchievementRarity.Legendary]: 'nn-chip--amber'
  };
  return map[rarity] || 'nn-chip--cyan';
}

/**
 * Get text color class for achievement category
 * @param category - Achievement category
 * @returns Token text color class
 */
function getCategoryColor(category: AchievementCategory): string {
  const map: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: 'nn-text-magenta',
    [AchievementCategory.Economic]: 'nn-text-amber',
    [AchievementCategory.Exploration]: 'nn-text-green',
    [AchievementCategory.Progression]: 'nn-text-violet'
  };
  return map[category] || 'nn-text-secondary';
}

/**
 * Get icon glyph for achievement category
 * @param category - Achievement category
 * @returns Token label for the category
 */
function getCategoryLabel(category: AchievementCategory): string {
  const map: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: 'Combat',
    [AchievementCategory.Economic]: 'Economic',
    [AchievementCategory.Exploration]: 'Exploration',
    [AchievementCategory.Progression]: 'Progression'
  };
  return map[category] || 'Unknown';
}

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Comprehensive achievement progress panel (A key shortcut)
 *
 * Features:
 * - Grid layout with achievement cards
 * - Category filtering (All, Combat, Economic, Exploration, Progression)
 * - Progress meters showing current/required values
 * - Locked vs unlocked styling with semantic chips
 * - Prestige unit preview for each achievement
 * - Completion celebration when all achievements reached
 * - Real-time progress updates from API
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

  const fetchProgress = useCallback(async () => {
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
  }, [username]);

  useEffect(() => {
    if (isOpen && username) {
      fetchProgress();
    }
  }, [isOpen, username, fetchProgress]);

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
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="nn-panel w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}
        role="dialog"
        aria-label="Achievements"
      >
        {/* Header — scanline instrument strip */}
        <div className="nn-panel__header nn-panel__header--bleed">
          <span className="nn-panel__icon"><Trophy className="h-4 w-4" /></span>
          <span className="nn-panel__title">Achievements</span>
          {progressData && (
            <span className="nn-panel__meta">
              <span className="nn-num nn-text-amber">{progressData.totalUnlocked}</span>
              {' '}/ {progressData.totalAvailable} unlocked · {progressData.progressPercent}%
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto nn-abtn nn-abtn--ghost px-3"
            aria-label="Close achievements"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category Filter — text-rule tabs */}
        <div className="flex border-b border-[color-mix(in_oklab,var(--nn-glass-border))] overflow-x-auto">
          <button
            className={`nn-tab px-5 ${selectedCategory === 'all' ? 'nn-tab--on' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All ({progressData?.totalAvailable || 0})
          </button>
          {Object.values(AchievementCategory).map(category => {
            const count = progressData?.byCategory[category] || { unlocked: 0, total: 0 };

            return (
              <button
                key={category}
                className={`nn-tab px-5 ${selectedCategory === category ? 'nn-tab--on' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {getCategoryLabel(category)} ({count.unlocked}/{count.total})
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="nn-spin-icon w-7 h-7 text-[color:var(--nn-cyan)]" aria-label="Loading achievements" />
            </div>
          ) : error ? (
            <div className="nn-note" role="alert">
              <p className="nn-text-magenta text-sm font-semibold">Failed to load achievements</p>
              <p className="nn-text-dim text-sm">{error}</p>
            </div>
          ) : progressData ? (
            <>
              {/* Completion Celebration */}
              {progressData.completionStatus === 'COMPLETE' && (
                <div className="nn-brief nn-brief--amber mb-6 text-center">
                  <div className="text-2xl font-bold nn-text-amber mb-1 nn-num">
                    ALL ACHIEVEMENTS UNLOCKED
                  </div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">
                    You{"'"}ve earned all {progressData.totalAvailable} achievements and unlocked every prestige unit!
                  </div>
                </div>
              )}

              {/* Achievement Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {filteredAchievements.map(achievement => {
                  const isUnlocked = !!achievement.unlockedAt;
                  const progressPercent = achievement.progress || 0;
                  const rarityClass = getRarityClasses(achievement.rarity);
                  const categoryColor = getCategoryColor(achievement.category);
                  const rarityChip = getRarityChip(achievement.rarity);

                  return (
                    <div key={achievement.id} className="nn-fade">
                      <div
                        className={`
                          nn-panel border ${rarityClass}
                          ${isUnlocked ? '' : 'opacity-60'}
                        `}
                      >
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold text-[color:var(--nn-text-primary)] text-base">
                                {achievement.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`nn-chip ${rarityChip}`}>{achievement.rarity}</span>
                                <span className={`nn-lab ${categoryColor}`}>{getCategoryLabel(achievement.category)}</span>
                              </div>
                            </div>
                            {isUnlocked && (
                              <span className="nn-chip nn-chip--green">Done</span>
                            )}
                          </div>

                          {/* Description */}
                          <p className="nn-text-dim text-sm mb-3 leading-relaxed">
                            {achievement.description}
                          </p>

                          {/* Progress Meter */}
                          <div className="mb-3">
                            <div className="flex justify-between nn-lab mb-1">
                              <span>Progress</span>
                              <span className="nn-num">{progressPercent}%</span>
                            </div>
                            <div className="nn-meter">
                              <div
                                className="nn-meter__seg"
                                style={{
                                  width: `${Math.min(progressPercent, 100)}%`,
                                  '--nn-accent': isUnlocked
                                    ? 'var(--nn-green)'
                                    : 'var(--nn-amber)',
                                } as React.CSSProperties}
                              />
                            </div>
                          </div>

                          {/* Requirement */}
                          <div className="nn-well mb-2 py-1.5">
                            <span className="nn-lab">Requirement</span>
                            <span className="nn-num text-sm text-[color:var(--nn-text-primary)]">
                              {achievement.requirement.type}: {achievement.requirement.value.toLocaleString()}
                            </span>
                          </div>

                          {/* Rewards */}
                          <div className="nn-well py-1.5">
                            <span className="nn-lab">Rewards</span>
                            <span className="nn-num text-sm nn-text-amber">
                              {achievement.reward.unitUnlock}
                              {achievement.reward.rpBonus ? ` · +${achievement.reward.rpBonus} RP` : ''}
                            </span>
                          </div>

                          {/* Unlocked Date */}
                          {isUnlocked && achievement.unlockedAt && (
                            <div className="mt-2 nn-lab text-center">
                              Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unlocked Prestige Units Summary */}
              {progressData.unlockedPrestigeUnits.length > 0 && (
                <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
                  <div className="nn-panel__header">
                    <span className="nn-panel__title">Unlocked Prestige Units ({progressData.unlockedPrestigeUnits.length})</span>
                  </div>
                  <div className="nn-panel__body">
                    <div className="flex flex-wrap gap-2">
                      {progressData.unlockedPrestigeUnits.map(unit => (
                        <span
                          key={unit}
                          className="nn-chip nn-chip--amber"
                        >
                          {unit}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 text-center nn-lab border-t border-[color-mix(in_oklab,var(--nn-glass-border))]">
          Press <kbd className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] font-mono">A</kbd> to toggle this panel
        </div>
      </div>
    </div>
  );
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: A key (handled in parent component)
// - Category filtering: All, Combat, Economic, Exploration, Progression (text-rule tabs)
// - Progress meters show completion percentage with accent coding
// - Locked achievements shown with reduced opacity (60%)
// - Unlocked achievements show semantic chip and unlock date
// - Rarity-based borders (cyan/violet/amber) with flat token fills
// - Completion celebration as amber brief block
// - Grid layout responsive (1/2/3 columns based on screen size)
// - Scrollable content area with nn-fade entry
// - Real-time progress fetching from API
// - Token primitives only: nn-panel / nn-tab / nn-chip / nn-meter / nn-well
// ============================================================
// END OF FILE
// ============================================================
