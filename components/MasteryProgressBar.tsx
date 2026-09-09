/**
 * @file components/MasteryProgressBar.tsx
 * @created 2025-01-17
 * @last-modified 2026-09-08 (FID-20260908-011 neon-noir structural pass)
 * @overview Visual mastery progress bar with milestone indicators
 *
 * OVERVIEW:
 * Displays mastery progression from 0-100% with milestone markers at 25%, 50%, 75%, and 100%.
 * Shows bonus percentages at each milestone and highlights current progress with accent-coded bar.
 *
 * MILESTONES:
 * - 25%: +5% bonus stats to specialized units
 * - 50%: +10% bonus stats
 * - 75%: +15% bonus stats, 4th specialized unit unlocked
 * - 100%: +20% bonus stats, 5th specialized unit unlocked
 *
 * VISUAL DESIGN:
 * - Square HUD meter fills left-to-right with flat accent fill (FID-011:
 *   same-color gradient fills → flat token fills; decorative shimmer removed)
 * - Milestone markers are square token checkpoints
 * - Current level displayed prominently in nn-num
 * - XP progress shows numeric details
 */

'use client';

import React from 'react';

interface MasteryProgressBarProps {
  masteryLevel: number; // 0-100
  masteryXP: number; // Total XP earned
  maxLevel: number; // Always 100
  showDetails?: boolean; // Show detailed XP info
}

const MILESTONES = [
  { level: 25, bonus: 5, description: '+5% bonus stats' },
  { level: 50, bonus: 10, description: '+10% bonus stats' },
  { level: 75, bonus: 15, description: '+15% bonus, 4th unit' },
  { level: 100, bonus: 20, description: '+20% bonus, 5th unit' }
];

const MasteryProgressBar: React.FC<MasteryProgressBarProps> = ({
  masteryLevel,
  masteryXP,
  maxLevel,
  showDetails = true
}) => {
  const progressPercent = (masteryLevel / maxLevel) * 100;

  // Flat accent fill by level band (FID-011: gradient no-ops → flat fills)
  const getProgressColor = (): string => {
    if (masteryLevel >= 100) return 'bg-[color:var(--nn-amber)]';
    if (masteryLevel >= 75) return 'bg-[color:var(--nn-violet)]';
    if (masteryLevel >= 50) return 'bg-[color:var(--nn-cyan)]';
    if (masteryLevel >= 25) return 'bg-[color:var(--nn-green)]';
    return 'bg-[color:var(--nn-text-secondary)]';
  };

  // Determine level text color
  const getLevelTextColor = () => {
    if (masteryLevel >= 100) return 'nn-text-amber';
    if (masteryLevel >= 75) return 'nn-text-violet';
    if (masteryLevel >= 50) return 'nn-text-cyan';
    if (masteryLevel >= 25) return 'nn-text-green';
    return 'nn-text-secondary';
  };

  const xpPerLevel = Math.max(1, Math.ceil(masteryXP / Math.max(1, masteryLevel)) || 100);
  const xpProgress = masteryXP % xpPerLevel;
  const xpNeeded = xpPerLevel - xpProgress;

  return (
    <div className="space-y-3">
      {/* Level Display */}
      <div className="flex justify-between items-center">
        <div>
          <span className="nn-lab">Mastery Level</span>
          <span className={`ml-2 text-2xl font-bold nn-num ${getLevelTextColor()}`}>
            {masteryLevel}%
          </span>
        </div>
        {showDetails && masteryLevel < maxLevel && (
          <div className="text-right nn-lab">
            <p><span className="nn-num">{xpProgress}</span> / <span className="nn-num">{xpPerLevel}</span> XP</p>
            <p className="nn-text-dim"><span className="nn-num">{xpNeeded}</span> needed</p>
          </div>
        )}
        {masteryLevel >= maxLevel && (
          <span className="nn-chip nn-chip--amber">
            Mastered
          </span>
        )}
      </div>

      {/* Progress Meter — square HUD track with milestone checkpoints */}
      <div className="relative h-8 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] overflow-hidden border-2 border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]">
        {/* Progress Fill */}
        <div
          className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Milestone Markers */}
        {MILESTONES.map((milestone) => {
          const isReached = masteryLevel >= milestone.level;
          const position = (milestone.level / maxLevel) * 100;

          return (
            <div
              key={milestone.level}
              className="absolute top-0 bottom-0 flex items-center"
              style={{ left: `${position}%` }}
            >
              {/* Milestone Line */}
              <div
                className={`w-0.5 h-full ${
                  isReached ? 'bg-[color-mix(in_oklab,var(--nn-text-primary)_50%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                }`}
              />

              {/* Milestone Marker — square token checkpoint */}
              <div
                className={`absolute -top-8 -translate-x-1/2 flex flex-col items-center transition-transform ${
                  isReached ? 'scale-110' : 'scale-100'
                }`}
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold border-2 nn-num ${
                    isReached
                      ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] text-[color:var(--nn-text-secondary)]'
                  }`}
                >
                  {isReached ? '✓' : milestone.level}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Milestone Details — ledger blocks */}
      {showDetails && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {MILESTONES.map((milestone) => {
            const isReached = masteryLevel >= milestone.level;
            const isCurrent = masteryLevel < milestone.level && masteryLevel >= (MILESTONES.find(m => m.level < milestone.level)?.level || 0);

            return (
              <div
                key={milestone.level}
                className={`p-2 border-2 text-center transition-colors ${
                  isReached
                    ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]'
                    : isCurrent
                    ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]'
                    : 'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  {isReached && <span className="nn-text-green text-xs">✓</span>}
                  <p className={`font-bold text-sm nn-num ${isReached ? 'nn-text-green' : 'nn-text-dim'}`}>
                    {milestone.level}%
                  </p>
                </div>
                <p className={`text-xs mt-1 ${isReached ? 'text-[color:var(--nn-text-primary)]' : 'nn-text-dim'}`}>
                  +{milestone.bonus}% bonus
                </p>
                {milestone.level >= 75 && (
                  <p className="nn-lab mt-0.5">
                    {milestone.level === 75 ? '4th unit' : '5th unit'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* XP Details (collapsed view) */}
      {!showDetails && masteryLevel < maxLevel && (
        <div className="text-center nn-lab">
          <span className="nn-num">{masteryXP.toLocaleString()}</span> / <span className="nn-num">{(maxLevel * xpPerLevel).toLocaleString()}</span> Total XP
        </div>
      )}
    </div>
  );
};

export default MasteryProgressBar;
