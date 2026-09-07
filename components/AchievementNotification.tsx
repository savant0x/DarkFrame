/**
 * @file components/AchievementNotification.tsx
 * @overview Achievement unlock popup — NEON NOIR §5.1: quiet glass, category
 * signal rail, rarity token chip, Orbitron header. Auto-dismisses after 10s.
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Achievement, AchievementCategory, AchievementRarity } from '@/types/game.types';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

/** Category → signal-rail token */
const CATEGORY_ACCENT: Record<AchievementCategory, string> = {
  [AchievementCategory.Combat]: 'var(--nn-magenta)',
  [AchievementCategory.Economic]: 'var(--nn-amber)',
  [AchievementCategory.Exploration]: 'var(--nn-green)',
  [AchievementCategory.Progression]: 'var(--nn-violet)',
};

/** Rarity → token chip (border + tint + label color) */
const RARITY_CHIP: Record<AchievementRarity, { border: string; tint: number; color: string }> = {
  [AchievementRarity.Common]: { border: 'var(--nn-text-secondary)', tint: 14, color: 'var(--nn-text-secondary)' },
  [AchievementRarity.Rare]: { border: 'var(--nn-cyan)', tint: 16, color: 'var(--nn-cyan)' },
  [AchievementRarity.Epic]: { border: 'var(--nn-violet)', tint: 18, color: 'var(--nn-violet)' },
  [AchievementRarity.Legendary]: { border: 'var(--nn-amber)', tint: 20, color: 'var(--nn-amber)' },
};

/**
 * Celebratory notification when player unlocks achievement.
 * Square quiet-glass panel; the left signal rail carries the category accent.
 */
export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for fade-out animation
  }, [onDismiss]);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);

      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [achievement, handleDismiss]);

  if (!achievement || !isVisible) {
    return null;
  }

  const accent = CATEGORY_ACCENT[achievement.category];
  const rarity = RARITY_CHIP[achievement.rarity];
  const isEpicPlus =
    achievement.rarity === AchievementRarity.Epic ||
    achievement.rarity === AchievementRarity.Legendary;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
      {/* Ember confetti for Epic/Legendary — CSS animations, no CSP violations */}
      {isEpicPlus && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => {
            // Deterministic pseudo-random values from the index
            const leftPercent = (i * 37) % 100;
            const delayMs = (i * 73) % 500;
            const durationMs = 1000 + ((i * 111) % 1000);

            return (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full animate-confetti"
                style={{
                  left: `${leftPercent}%`,
                  animationDelay: `${delayMs}ms`,
                  animationDuration: `${durationMs}ms`,
                  backgroundColor: i % 3 === 0 ? 'var(--nn-amber)' : i % 3 === 1 ? 'var(--nn-magenta)' : 'var(--nn-cyan)',
                  boxShadow: '0 0 6px color-mix(in oklab, var(--nn-amber) 60%, transparent)',
                }}
              />
            );
          })}
        </div>
      )}

      <div
        className="rounded-none p-5 min-w-[400px] max-w-[500px]"
        style={{
          background: 'color-mix(in oklab, var(--nn-void) 90%, transparent)',
          border: '1px solid color-mix(in oklab, var(--nn-cyan) 16%, transparent)',
          borderLeft: `3px solid ${accent}`,
          boxShadow: `0 0 40px color-mix(in oklab, ${accent} 25%, transparent), 0 8px 32px rgba(0,0,0,0.6)`,
          backdropFilter: 'blur(8px)',
        }}
        onClick={handleDismiss}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div
                className="text-lg font-bold text-[color:var(--nn-text-primary)]"
                style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.04em' }}
              >
                ACHIEVEMENT UNLOCKED
              </div>
              <div
                className="mt-1 inline-block px-2 py-0.5 text-xs font-bold uppercase"
                style={{
                  letterSpacing: '0.14em',
                  color: rarity.color,
                  border: `1px solid color-mix(in oklab, ${rarity.border} ${rarity.tint * 3}%, transparent)`,
                  background: `color-mix(in oklab, ${rarity.border} ${rarity.tint}%, transparent)`,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {achievement.rarity}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-magenta)] transition-colors text-xl font-bold leading-none"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>

        {/* Achievement Details — neutral well */}
        <div
          className="rounded-none p-4 mb-3"
          style={{
            border: '1px solid color-mix(in oklab, var(--nn-cyan) 12%, transparent)',
            background: 'color-mix(in oklab, var(--nn-void) 45%, transparent)',
          }}
        >
          <div
            className="mb-1 text-base font-bold text-[color:var(--nn-text-primary)]"
            style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.03em' }}
          >
            {achievement.name}
          </div>
          <div className="mb-2 text-sm text-[color:var(--nn-text-secondary)]">
            {achievement.description}
          </div>
          <div
            className="text-xs uppercase text-[color:var(--nn-text-secondary)]"
            style={{ letterSpacing: '0.14em' }}
          >
            {achievement.category}
          </div>
        </div>

        {/* Rewards — well with rail */}
        <div
          className="rounded-none p-4"
          style={{
            border: '1px solid color-mix(in oklab, var(--nn-cyan) 12%, transparent)',
            borderLeft: `2px solid ${accent}`,
            background: 'color-mix(in oklab, var(--nn-void) 45%, transparent)',
          }}
        >
          <div
            className="mb-2 text-xs font-bold uppercase text-[color:var(--nn-text-secondary)]"
            style={{ letterSpacing: '0.16em' }}
          >
            Rewards
          </div>
          <div className="space-y-2">
            {/* Prestige Unit Unlock */}
            <div className="flex items-center gap-2 text-sm text-[color:var(--nn-amber)]">
              <span>⚔️</span>
              <span className="nn-num font-semibold">
                Unlocked: {achievement.reward.unitUnlock}
              </span>
            </div>

            {/* RP Bonus */}
            {achievement.reward.rpBonus && (
              <div className="flex items-center gap-2 text-sm text-[color:var(--nn-violet)]">
                <span>💎</span>
                <span className="nn-num font-semibold">
                  +{achievement.reward.rpBonus} Research Points
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss hint */}
        <div
          className="mt-3 text-center text-xs text-[color:var(--nn-text-secondary)]"
          style={{ letterSpacing: '0.12em' }}
        >
          CLICK ANYWHERE TO DISMISS
        </div>
      </div>
    </div>
  );
};
