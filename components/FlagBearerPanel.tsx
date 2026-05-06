/**
 * @file components/FlagBearerPanel.tsx
 * @created 2026-05-06
 * @overview Compact flag bearer status widget for the sidebar.
 * Shows when the player currently holds the flag.
 * Displays hold timer, earnings, and flag controls.
 * DB-driven: reads from flagBearer prop (sourced from /api/flag).
 *
 * Features:
 * - Hold duration timer with expiry warning
 * - Session earnings display
 * - HP bar (if applicable)
 * - Collapsible (full + compact modes)
 * - Flag release button
 */

'use client';

import { useState } from 'react';
import type { FlagBearer } from '@/types/flag.types';
import { formatHoldDuration, getTimeRemaining, isFlagExpiringSoon } from '@/lib/flagService';

interface FlagBearerPanelProps {
  flagBearer: FlagBearer;
  onRelease?: () => void;
  compact?: boolean;
}

export default function FlagBearerPanel({
  flagBearer,
  onRelease,
  compact = false,
}: FlagBearerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const timeRemaining = getTimeRemaining(flagBearer.holdDuration);
  const isExpiring = isFlagExpiringSoon(flagBearer.holdDuration);
  const holdText = formatHoldDuration(flagBearer.holdDuration);

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-yellow-600/50">
      {/* Header — clickable to collapse/expand */}
      <div
        className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🚩</span>
          <h3 className="text-sm font-bold text-yellow-400">Flag Bearer</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isExpiring ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
            {holdText}
          </span>
          <span className="text-gray-400 text-xs">{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {/* Compact mode: just timer */}
      {collapsed && (
        <div className="mt-2 text-xs text-gray-300">
          <span className={isExpiring ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
            {timeRemaining}
          </span>
          <span className="text-gray-500 ml-1">remaining</span>
        </div>
      )}

      {/* Full mode: bearer details */}
      {!collapsed && (
        <div className="mt-2 space-y-2">
          {/* Bearer Info */}
          <div className="bg-gray-900 rounded p-2 border border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="text-gray-400">Bearer</p>
                <p className="text-white font-bold">{flagBearer.username}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400">Level</p>
                <p className="text-cyan-400 font-bold">{flagBearer.level}</p>
              </div>
            </div>
          </div>

          {/* Hold Timer */}
          <div className={`rounded p-2 border ${isExpiring ? 'bg-red-900/30 border-red-600/50' : 'bg-gray-900 border-gray-700'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Hold Time</span>
              <span className={`font-bold ${isExpiring ? 'text-red-400' : 'text-green-400'}`}>
                {holdText}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Remaining</span>
              <span className={`font-bold ${isExpiring ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                {timeRemaining}
              </span>
            </div>
          </div>

          {/* HP Bar */}
          {flagBearer.currentHP !== undefined && flagBearer.maxHP !== undefined && (
            <div className="text-xs">
              <div className="flex justify-between text-gray-400 mb-1">
                <span>HP</span>
                <span>{flagBearer.currentHP.toLocaleString()} / {flagBearer.maxHP.toLocaleString()}</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-500 h-full transition-all duration-300"
                  style={{ width: `${(flagBearer.currentHP / flagBearer.maxHP) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Session Earnings */}
          {flagBearer.sessionEarnings && (
            <div className="bg-gray-900 rounded p-2 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Session Earnings</p>
              <div className="flex gap-3 text-xs">
                <span className="text-yellow-400 font-bold">⚙️ {flagBearer.sessionEarnings.metal?.toLocaleString() || 0}</span>
                <span className="text-blue-400 font-bold">⚡ {flagBearer.sessionEarnings.energy?.toLocaleString() || 0}</span>
              </div>
            </div>
          )}

          {/* Release Button */}
          {onRelease && (
            <button
              onClick={(e) => { e.stopPropagation(); onRelease(); }}
              className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors"
            >
              🏳️ Release Flag
            </button>
          )}
        </div>
      )}
    </div>
  );
}
