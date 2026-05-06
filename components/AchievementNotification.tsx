/**
 * @file components/AchievementNotification.tsx
 * @created 2025-01-17
 * @overview Celebration popup when achievement is unlocked
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Achievement, AchievementCategory, AchievementRarity } from '@/types/game.types';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

/**
 * Celebratory notification when player unlocks achievement
 * 
 * Features:
 * - Category-specific colors (Combat=red, Economic=gold, Exploration=green, Progression=purple)
 * - Shows rarity badge (Common/Rare/Epic/Legendary)
 * - Displays prestige unit unlocked
 * - Shows RP bonus earned
 * - Auto-dismisses after 10 seconds
 * - Confetti animation for Epic/Legendary
 */
export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [achievement]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for fade-out animation
  };

  if (!achievement || !isVisible) {
    return null;
  }

  // Category-specific colors
  const categoryColors: Record<AchievementCategory, string> = {
    [AchievementCategory.Combat]: 'from-red-600 to-red-800 border-red-500',
    [AchievementCategory.Economic]: 'from-yellow-600 to-yellow-800 border-yellow-500',
    [AchievementCategory.Exploration]: 'from-green-600 to-green-800 border-green-500',
    [AchievementCategory.Progression]: 'from-purple-600 to-purple-800 border-purple-500'
  };

  // Rarity colors
  const rarityColors: Record<AchievementRarity, string> = {
    [AchievementRarity.Common]: 'bg-gray-500 text-white',
    [AchievementRarity.Rare]: 'bg-blue-500 text-white',
    [AchievementRarity.Epic]: 'bg-purple-600 text-white',
    [AchievementRarity.Legendary]: 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
  };

  const colorClass = categoryColors[achievement.category];
  const rarityClass = rarityColors[achievement.rarity];

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
      {/* Confetti for Epic/Legendary - Using CSS animations to avoid CSP violations */}
      {(achievement.rarity === AchievementRarity.Epic || achievement.rarity === AchievementRarity.Legendary) && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => {
            // Generate random positions and delays using array index for deterministic values
            const leftPercent = ((i * 37) % 100); // Pseudo-random 0-100
            const delayMs = ((i * 73) % 500); // Pseudo-random 0-500ms
            const durationMs = 1000 + ((i * 111) % 1000); // Pseudo-random 1000-2000ms
            
            return (
              <div
                key={i}
                className={`absolute w-2 h-2 bg-yellow-400 rounded-full animate-confetti`}
                style={{
                  left: `${leftPercent}%`,
                  animationDelay: `${delayMs}ms`,
                  animationDuration: `${durationMs}ms`
                }}
              />
            );
          })}
        </div>
      )}

      <div
        className={`
          bg-gradient-to-br ${colorClass}
          border-4 rounded-lg shadow-2xl
          p-6 min-w-[400px] max-w-[500px]
          transform transition-all duration-300
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🏆</div>
            <div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">
                Achievement Unlocked!
              </div>
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${rarityClass} mt-1`}>
                {achievement.rarity}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-gray-200 text-2xl font-bold"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>

        {/* Achievement Details */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <div className="text-xl font-bold text-white mb-2">
            {achievement.name}
          </div>
          <div className="text-gray-200 text-sm mb-3">
            {achievement.description}
          </div>
          <div className="text-gray-300 text-xs uppercase tracking-wide">
            Category: {achievement.category}
          </div>
        </div>

        {/* Rewards */}
        <div className="bg-black/30 rounded-lg p-4">
          <div className="text-white font-bold mb-2 flex items-center gap-2">
            <span className="text-lg">🎁</span>
            Rewards
          </div>
          <div className="space-y-2">
            {/* Prestige Unit Unlock */}
            <div className="flex items-center gap-2 text-yellow-300">
              <span className="text-lg">⚔️</span>
              <span className="font-semibold">
                Unlocked: {achievement.reward.unitUnlock}
              </span>
            </div>

            {/* RP Bonus */}
            {achievement.reward.rpBonus && (
              <div className="flex items-center gap-2 text-purple-300">
                <span className="text-lg">💎</span>
                <span className="font-semibold">
                  +{achievement.reward.rpBonus} Research Points
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 text-center text-white text-sm">
          Click anywhere to dismiss
        </div>
      </div>
    </div>
  );
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Auto-dismiss after 10 seconds
// - Manual dismiss via X button or click
// - Category-specific gradient backgrounds
// - Rarity badge with appropriate styling
// - Confetti animation for Epic/Legendary achievements
// - Shows prestige unit unlocked and RP bonus
// - Positioned at top-center of screen
// ============================================================
// USAGE EXAMPLE:
// ============================================================
// const [achievement, setAchievement] = useState<Achievement | null>(null);
// 
// // When achievement unlocked:
// setAchievement(unlockedAchievement);
// 
// <AchievementNotification
//   achievement={achievement}
//   onDismiss={() => setAchievement(null)}
// />
// ============================================================
// END OF FILE
// ============================================================
