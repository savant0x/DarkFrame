/**
 * @file components/MasteryProgressBar.tsx
 * @created 2025-01-17
 * @overview Visual mastery progress bar with milestone indicators
 * 
 * OVERVIEW:
 * Displays mastery progression from 0-100% with milestone markers at 25%, 50%, 75%, and 100%.
 * Shows bonus percentages at each milestone and highlights current progress with color-coded bar.
 * 
 * MILESTONES:
 * - 25%: +5% bonus stats to specialized units
 * - 50%: +10% bonus stats
 * - 75%: +15% bonus stats, 4th specialized unit unlocked
 * - 100%: +20% bonus stats, 5th specialized unit unlocked
 * 
 * VISUAL DESIGN:
 * - Progress bar fills from left to right with gradient
 * - Milestone markers show as checkpoints
 * - Current level displayed prominently
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

  // Determine progress bar color based on level
  const getProgressColor = () => {
    if (masteryLevel >= 100) return 'bg-gradient-to-r from-yellow-500 to-yellow-300';
    if (masteryLevel >= 75) return 'bg-gradient-to-r from-purple-500 to-purple-300';
    if (masteryLevel >= 50) return 'bg-gradient-to-r from-blue-500 to-blue-300';
    if (masteryLevel >= 25) return 'bg-gradient-to-r from-green-500 to-green-300';
    return 'bg-gradient-to-r from-gray-500 to-gray-400';
  };

  // Determine level text color
  const getLevelTextColor = () => {
    if (masteryLevel >= 100) return 'text-yellow-400';
    if (masteryLevel >= 75) return 'text-purple-400';
    if (masteryLevel >= 50) return 'text-blue-400';
    if (masteryLevel >= 25) return 'text-green-400';
    return 'text-gray-400';
  };

  // Calculate XP for next level (100 XP per level)
  const xpPerLevel = 100;
  const currentLevelXP = masteryLevel * xpPerLevel;
  const nextLevelXP = (masteryLevel + 1) * xpPerLevel;
  const xpProgress = masteryXP - currentLevelXP;
  const xpNeeded = masteryLevel < maxLevel ? nextLevelXP - masteryXP : 0;

  return (
    <div className="space-y-3">
      {/* Level Display */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-gray-400 text-sm">Mastery Level</span>
          <span className={`ml-2 text-2xl font-bold ${getLevelTextColor()}`}>
            {masteryLevel}%
          </span>
        </div>
        {showDetails && masteryLevel < maxLevel && (
          <div className="text-right text-xs text-gray-400">
            <p>{xpProgress} / {xpPerLevel} XP</p>
            <p className="text-gray-500">{xpNeeded} needed</p>
          </div>
        )}
        {masteryLevel >= maxLevel && (
          <span className="text-yellow-400 font-bold text-sm">
            ★ MASTERED ★
          </span>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden border-2 border-gray-600">
        {/* Progress Fill */}
        <div
          className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>

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
                  isReached ? 'bg-white/50' : 'bg-gray-500'
                }`}
              />
              
              {/* Milestone Marker */}
              <div
                className={`absolute -top-8 -translate-x-1/2 flex flex-col items-center transition-all ${
                  isReached ? 'scale-110' : 'scale-100'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isReached
                      ? 'bg-green-500 border-green-300 text-white'
                      : 'bg-gray-700 border-gray-500 text-gray-400'
                  }`}
                >
                  {isReached ? '✓' : milestone.level}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Milestone Details */}
      {showDetails && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {MILESTONES.map((milestone) => {
            const isReached = masteryLevel >= milestone.level;
            const isCurrent = masteryLevel < milestone.level && masteryLevel >= (MILESTONES.find(m => m.level < milestone.level)?.level || 0);

            return (
              <div
                key={milestone.level}
                className={`p-2 rounded border-2 text-center transition-all ${
                  isReached
                    ? 'bg-green-900/30 border-green-500'
                    : isCurrent
                    ? 'bg-yellow-900/30 border-yellow-500'
                    : 'bg-gray-800 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  {isReached && <span className="text-green-400 text-xs">✓</span>}
                  <p className={`font-bold text-sm ${isReached ? 'text-green-400' : 'text-gray-400'}`}>
                    {milestone.level}%
                  </p>
                </div>
                <p className={`text-xs mt-1 ${isReached ? 'text-white' : 'text-gray-500'}`}>
                  +{milestone.bonus}% bonus
                </p>
                {milestone.level >= 75 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
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
        <div className="text-center text-xs text-gray-400">
          {masteryXP.toLocaleString()} / {(maxLevel * xpPerLevel).toLocaleString()} Total XP
        </div>
      )}
    </div>
  );
};

export default MasteryProgressBar;
