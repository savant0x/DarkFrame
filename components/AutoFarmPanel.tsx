/**
 * AutoFarmPanel.tsx
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Sidebar control panel for auto-farm system. Provides Start/Pause/Stop controls,
 * real-time status indicator, current position display, and link to settings page.
 * Positioned near MovementControls for convenient access.
 * 
 * Features:
 * - Start/Pause/Stop buttons with state management
 * - Status indicator (Active/Paused/Stopped) with color coding
 * - Current tile position display (X, Y)
 * - Progress indicator (tiles completed)
 * - Settings page link
 * - Visual feedback for premium feature
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AutoFarmStatus } from '@/types/autoFarm.types';

interface AutoFarmPanelProps {
  status: AutoFarmStatus;
  currentPosition: { x: number; y: number };
  tilesCompleted: number;
  lastAction?: string; // Optional: last action performed (move, harvest, combat)
  isVIP?: boolean; // VIP status for speed tier display
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/**
 * Auto-Farm control panel component
 */
export default function AutoFarmPanel({
  status,
  currentPosition,
  tilesCompleted,
  lastAction = 'Ready',
  isVIP = false,
  onStart,
  onPause,
  onResume,
  onStop
}: AutoFarmPanelProps) {
  const router = useRouter();

  const isActive = status === AutoFarmStatus.ACTIVE;
  const isPaused = status === AutoFarmStatus.PAUSED;
  const isStopped = status === AutoFarmStatus.STOPPED;

  const handleSettingsClick = () => {
    router.push('/game/auto-farm-settings');
  };

  // Status colors and labels
  const statusConfig = {
    [AutoFarmStatus.STOPPED]: { color: 'gray', label: 'Stopped', icon: '⏸️' },
    [AutoFarmStatus.ACTIVE]: { color: 'green', label: 'Active', icon: '⚡' },
    [AutoFarmStatus.PAUSED]: { color: 'yellow', label: 'Paused', icon: '⏸️' }
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 rounded-lg p-4 border-2 border-purple-500 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h3 className="text-lg font-bold text-white">Auto-Farm</h3>
          {isVIP ? (
            <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-2 py-0.5 rounded-full font-bold shadow-lg">
              ⚡ VIP
            </span>
          ) : (
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">
              BASIC
            </span>
          )}
        </div>
        
        {/* Settings Button */}
        <button
          onClick={handleSettingsClick}
          className="text-gray-400 hover:text-white transition-colors"
          title="Auto-Farm Settings"
        >
          <span className="text-xl">⚙️</span>
        </button>
      </div>

      {/* Status Indicator */}
      <div className="mb-3 bg-gray-900/50 rounded-lg p-2 border border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Status:</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isActive ? 'bg-green-500 animate-pulse' :
              isPaused ? 'bg-yellow-500' :
              'bg-gray-500'
            }`} />
            <span className={`text-sm font-bold ${
              isActive ? 'text-green-400' :
              isPaused ? 'text-yellow-400' :
              'text-gray-400'
            }`}>
              {currentStatus.icon} {currentStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {!isStopped && (
        <div className="mb-3 space-y-2">
          {/* Current Position */}
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Position:</span>
              <span className="text-white font-mono font-bold">
                ({currentPosition.x}, {currentPosition.y})
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-400">Tiles:</span>
              <span className="text-purple-400 font-bold">
                {tilesCompleted.toLocaleString()} / 22,500
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span className="text-purple-400 font-bold">
                {((tilesCompleted / 22500) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.min((tilesCompleted / 22500) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Last Action Indicator */}
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Last Action:</span>
              <span className={`font-bold ${isActive ? 'animate-pulse text-green-400' : 'text-yellow-400'}`}>
                {isActive ? lastAction : '⏸ Paused'}
              </span>
            </div>
          </div>

          {/* Speed Tier Info */}
          <div className={`rounded-lg p-2 border ${isVIP ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-600/50' : 'bg-purple-900/30 border-purple-600/50'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Speed Tier:</span>
              <span className={`font-bold ${isVIP ? 'text-yellow-400' : 'text-purple-400'}`}>
                {isVIP ? '⚡ VIP (5.6 hrs)' : '🐢 Basic (11.6 hrs)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-2">
        {isStopped && (
          <button
            onClick={onStart}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>▶️</span>
            <span>Start Auto-Farm</span>
          </button>
        )}

        {isActive && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onPause}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition-colors"
            >
              ⏸️ Pause
            </button>
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
            >
              ⏹️ Stop
            </button>
          </div>
        )}

        {isPaused && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onResume}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
            >
              ▶️ Resume
            </button>
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
            >
              ⏹️ Stop
            </button>
          </div>
        )}
      </div>

      {/* Info Message */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        {isStopped && 'Configure settings and start farming!'}
        {isActive && 'Auto-farming in progress...'}
        {isPaused && 'Paused - resume anytime'}
      </div>

      {/* VIP Upgrade CTA (only show for non-VIP users) */}
      {!isVIP && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <button
            onClick={() => router.push('/game/vip-upgrade')}
            className="w-full px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            <span>Get VIP - 2x Speed!</span>
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Complete map in 5.6 hours instead of 11.6 hours
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. CONTROL STATES:
 *    - Stopped: Show Start button only
 *    - Active: Show Pause + Stop buttons
 *    - Paused: Show Resume + Stop buttons
 * 
 * 2. VISUAL FEEDBACK:
 *    - Green pulsing dot for active state
 *    - Yellow dot for paused state
 *    - Gray dot for stopped state
 *    - Status label with emoji icon
 * 
 * 3. POSITION DISPLAY:
 *    - Shows current (X, Y) coordinates
 *    - Displays tiles completed counter
 *    - Hidden when stopped
 * 
 * 4. PREMIUM STYLING:
 *    - Purple gradient background
 *    - Premium badge
 *    - Robot emoji for auto-play feel
 *    - Matches DarkFrame dark theme
 * 
 * 5. USER ACTIONS:
 *    - Quick access to settings via gear icon
 *    - Clear button states with color coding
 *    - Helpful status messages
 * 
 * 6. INTEGRATION:
 *    - Callbacks for all control actions
 *    - Receives state from parent component
 *    - No direct API calls (managed by engine)
 */
