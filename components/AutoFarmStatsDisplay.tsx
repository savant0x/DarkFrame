/**
 * AutoFarmStatsDisplay.tsx
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Real-time statistics display for auto-farm sessions. Shows both per-session
 * stats (reset on stop) and all-time cumulative stats. Collapsible panel
 * positioned in bottom section of game view.
 * 
 * Features:
 * - Time elapsed (HH:MM:SS format)
 * - Metal & Energy collected
 * - Tiles visited counter
 * - Cave & Forest items found
 * - Combat statistics (Attacks Won/Lost)
 * - Collapsible/expandable panel
 * - Real-time updates (every second)
 * - All-time totals display
 */

'use client';

import React, { useState } from 'react';
import { AutoFarmSessionStats, AutoFarmAllTimeStats } from '@/types/autoFarm.types';

interface AutoFarmStatsDisplayProps {
  sessionStats: AutoFarmSessionStats;
  allTimeStats: AutoFarmAllTimeStats;
  isActive: boolean;
}

/**
 * Format milliseconds to HH:MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Auto-Farm statistics display component
 */
export default function AutoFarmStatsDisplay({
  sessionStats,
  allTimeStats,
  isActive
}: AutoFarmStatsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllTime, setShowAllTime] = useState(false);

  const stats = showAllTime ? {
    timeElapsed: allTimeStats.totalTimeElapsed,
    metalCollected: allTimeStats.totalMetalCollected,
    energyCollected: allTimeStats.totalEnergyCollected,
    tilesVisited: allTimeStats.totalTilesVisited,
    caveItemsFound: allTimeStats.totalCaveItemsFound,
    forestItemsFound: allTimeStats.totalForestItemsFound,
    attacksLaunched: allTimeStats.totalAttacksLaunched,
    attacksWon: allTimeStats.totalAttacksWon,
    attacksLost: allTimeStats.totalAttacksLost
  } : sessionStats;

  const winRate = stats.attacksLaunched > 0 
    ? ((stats.attacksWon / stats.attacksLaunched) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-[color:var(--nn-void)] rounded-none border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] shadow-lg">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-violet)] p-3 flex items-center justify-between cursor-pointer hover:from-[color:var(--nn-violet)] hover:to-[color:var(--nn-violet)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isActive ? '⚡' : '📊'}</span>
          <div>
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)]">Auto-Farm Statistics</h3>
            <p className="text-xs text-[color:var(--nn-violet)]">
              {showAllTime ? 'All-Time Totals' : 'Current Session'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAllTime(!showAllTime);
            }}
            className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none font-bold transition-colors"
          >
            {showAllTime ? 'Session' : 'All-Time'}
          </button>
          
          {/* Collapse Arrow */}
          <span className="text-[color:var(--nn-text-primary)] text-xl">
            {isExpanded ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {/* Stats Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Time Elapsed - Large Display */}
          <div className="bg-gradient-to-br from-[color:var(--nn-violet)] to-[color:var(--nn-violet)] rounded-none p-4 mb-4 border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
            <div className="text-center">
              <p className="text-sm text-[color:var(--nn-text-secondary)] mb-1">
                {showAllTime ? 'Total Time' : 'Time Elapsed'}
              </p>
              <p className="text-4xl font-mono font-bold text-[color:var(--nn-violet)]">
                {formatTime(stats.timeElapsed)}
              </p>
            </div>
          </div>

          {/* Resources Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Metal Collected */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🔩</span>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">Metal</p>
              </div>
              <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">
                {stats.metalCollected.toLocaleString()}
              </p>
            </div>

            {/* Energy Collected */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">⚡</span>
                <p className="text-xs text-[color:var(--nn-text-secondary)]">Energy</p>
              </div>
              <p className="text-2xl font-bold text-[color:var(--nn-amber)]">
                {stats.energyCollected.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Exploration Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Tiles Visited */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Tiles</p>
              <p className="text-lg font-bold text-[color:var(--nn-violet)]">
                {stats.tilesVisited.toLocaleString()}
              </p>
            </div>

            {/* Cave Items */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Caves</p>
              <p className="text-lg font-bold text-[color:var(--nn-amber)]">
                {stats.caveItemsFound.toLocaleString()}
              </p>
            </div>

            {/* Forest Items */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Forests</p>
              <p className="text-lg font-bold text-[color:var(--nn-green)]">
                {stats.forestItemsFound.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3 border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <h4 className="text-sm font-bold text-[color:var(--nn-text-primary)] mb-2 flex items-center gap-2">
              <span>⚔️</span>
              <span>Combat Statistics</span>
            </h4>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Attacks Launched */}
              <div className="text-center">
                <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Attacks</p>
                <p className="text-xl font-bold text-[color:var(--nn-cyan)]">
                  {stats.attacksLaunched}
                </p>
              </div>

              {/* Victories */}
              <div className="text-center">
                <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Won</p>
                <p className="text-xl font-bold text-[color:var(--nn-green)]">
                  {stats.attacksWon}
                </p>
              </div>

              {/* Defeats */}
              <div className="text-center">
                <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">Lost</p>
                <p className="text-xl font-bold text-[color:var(--nn-magenta)]">
                  {stats.attacksLost}
                </p>
              </div>
            </div>

            {/* Win Rate */}
            {stats.attacksLaunched > 0 && (
              <div className="mt-2 pt-2 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[color:var(--nn-text-secondary)]">Win Rate:</span>
                  <span className="text-sm font-bold text-[color:var(--nn-violet)]">
                    {winRate}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* All-Time Sessions Count */}
          {showAllTime && (
            <div className="mt-3 text-center text-xs text-[color:var(--nn-text-secondary)]">
              Total Sessions: {allTimeStats.totalSessionsCompleted}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. DUAL DISPLAY MODES:
 *    - Session Stats: Current farming session (reset on stop)
 *    - All-Time Stats: Cumulative totals across all sessions
 *    - Toggle button to switch between views
 * 
 * 2. TIME FORMATTING:
 *    - Displays as HH:MM:SS for easy reading
 *    - Large prominent display for quick reference
 *    - Updates every second when active
 * 
 * 3. RESOURCE TRACKING:
 *    - Metal and Energy in large tiles
 *    - Tiles, Caves, Forests in compact grid
 *    - Color-coded for quick identification
 * 
 * 4. COMBAT ANALYTICS:
 *    - Attacks launched, won, lost
 *    - Calculated win rate percentage
 *    - Only shows if attacks have occurred
 * 
 * 5. COLLAPSIBLE PANEL:
 *    - Click header to expand/collapse
 *    - Saves screen space when not needed
 *    - Smooth transitions
 * 
 * 6. VISUAL DESIGN:
 *    - Purple premium theme
 *    - Dark mode compatible
 *    - Icon-enhanced stat labels
 *    - Responsive grid layout
 * 
 * FUTURE ENHANCEMENTS:
 * - Graphs/charts for trends over time
 * - Export stats to CSV
 * - Compare sessions (best/worst)
 * - Efficiency metrics (resources per hour)
 */
