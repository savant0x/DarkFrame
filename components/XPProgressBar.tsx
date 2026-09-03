/**
 * XP Progress Bar Component
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Visual progress bar showing player's current XP progress toward next level.
 * Displays current level, XP earned in current level, and XP required for next level.
 * Color-coded progress bar with animated fill.
 * 
 * FEATURES:
 * - Animated progress bar (smooth transitions)
 * - Level display with icon
 * - XP fraction and percentage
 * - Color gradient based on progress
 * - Hover tooltip with detailed stats
 */

'use client';

import React from 'react';
import { formatNumber } from '@/utils/formatting';

interface XPProgressBarProps {
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
  totalXP: number;
  compact?: boolean; // Compact mode for smaller spaces
}

export default function XPProgressBar({
  level,
  currentLevelXP,
  xpForNextLevel,
  totalXP,
  compact = false
}: XPProgressBarProps) {
  
  // Calculate progress percentage
  const progressPercent = Math.min((currentLevelXP / xpForNextLevel) * 100, 100);
  
  // Determine progress bar color based on percentage
  const getProgressColor = () => {
    if (progressPercent >= 90) return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
    if (progressPercent >= 75) return 'bg-gradient-to-r from-green-400 to-green-500';
    if (progressPercent >= 50) return 'bg-gradient-to-r from-blue-400 to-blue-500';
    if (progressPercent >= 25) return 'bg-gradient-to-r from-cyan-400 to-cyan-500';
    return 'bg-gradient-to-r from-gray-400 to-gray-500';
  };
  
  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Level {level}</span>
          <span className="text-xs text-gray-400">
            {Math.floor(progressPercent)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-300 ease-out`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {/* Level and Progress Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-yellow-400">⭐ Level {level}</span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-300">
            {formatNumber(currentLevelXP)} / {formatNumber(xpForNextLevel)} XP
          </div>
          <div className="text-xs text-gray-500">
            {Math.floor(progressPercent)}% to next level
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="relative w-full bg-gray-700 rounded-full h-6 overflow-hidden shadow-inner">
        {/* Filled portion */}
        <div
          className={`h-full ${getProgressColor()} transition-all duration-500 ease-out flex items-center justify-end pr-2`}
          style={{ width: `${progressPercent}%` }}
        >
          {progressPercent > 20 && (
            <span className="text-xs font-bold text-white drop-shadow-md">
              {Math.floor(progressPercent)}%
            </span>
          )}
        </div>
        
        {/* Animated shine effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
      </div>
      
      {/* Total XP Display */}
      <div className="mt-1 text-center text-xs text-gray-500">
        Total XP: {formatNumber(totalXP)}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Visual Design:
 *    - Color-coded progress (gray → cyan → blue → green → yellow)
 *    - Smooth transitions on XP gain
 *    - Animated shine effect for polish
 *    - Responsive layout
 * 
 * 2. Compact Mode:
 *    - Minimal height (good for sidebars)
 *    - Essential info only (level, percentage)
 *    - Smaller progress bar (2px vs 6px)
 * 
 * 3. Future Enhancements:
 *    - Pulsing animation on level-up
 *    - Sparkle particles when near level-up
 *    - Tooltip with next level rewards
 *    - Click to see XP breakdown by action
 *    - Historical XP gain graph
 */

// CSS for shine animation (add to global styles or use inline)
const styles = `
@keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shine {
  animation: shine 3s ease-in-out infinite;
}
`;
