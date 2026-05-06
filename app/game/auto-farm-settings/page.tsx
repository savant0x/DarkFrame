/**
 * Auto-Farm Settings Page
 * Full configuration interface for auto-farm system
 * 
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Comprehensive settings page for configuring auto-farm behavior.
 * Allows users to customize combat options including rank filters
 * and resource targeting preferences.
 * 
 * Settings:
 * - Combat Toggle: Enable/disable attacking player bases
 * - Rank Filter: All / Lower Rank / Higher Rank
 * - Resource Target: Metal / Energy / Lowest (auto-detect)
 * 
 * Note: Harvesting is always ALL resources (metal, energy, caves, forests)
 * - no configuration needed for harvest behavior.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AutoFarmConfig,
  RankFilter,
  ResourceTarget,
  DEFAULT_AUTO_FARM_CONFIG
} from '@/types/autoFarm.types';

const STORAGE_KEY = 'darkframe_autofarm_config';

/**
 * Load config from localStorage
 */
function loadConfig(): AutoFarmConfig {
  if (typeof window === 'undefined') return DEFAULT_AUTO_FARM_CONFIG;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load auto-farm config:', error);
  }
  
  return DEFAULT_AUTO_FARM_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfig(config: AutoFarmConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save auto-farm config:', error);
  }
}

export default function AutoFarmSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AutoFarmConfig>(DEFAULT_AUTO_FARM_CONFIG);
  const [saved, setSaved] = useState(false);

  // Load config on mount
  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    
    // Clear saved indicator after 2 seconds
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_AUTO_FARM_CONFIG);
    saveConfig(DEFAULT_AUTO_FARM_CONFIG);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBack = () => {
    router.push('/game');
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="text-purple-400 hover:text-purple-300 mb-4 flex items-center gap-2 transition-colors"
          >
            <span>←</span>
            <span>Back to Game</span>
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🤖</span>
            <div>
              <h1 className="text-3xl font-bold text-white">Auto-Farm Settings</h1>
              <p className="text-gray-400">Configure your automated farming preferences</p>
            </div>
          </div>
        </div>

        {/* Save Indicator */}
        {saved && (
          <div className="mb-4 bg-green-900/30 border border-green-500 rounded-lg p-3 flex items-center gap-2">
            <span className="text-green-400 text-xl">✓</span>
            <span className="text-green-400 font-bold">Settings saved successfully!</span>
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-gray-900 rounded-lg border-2 border-purple-500 shadow-xl p-6 space-y-6">
          
          {/* Harvest Settings Info */}
          <div className="bg-purple-900/20 border border-purple-500 rounded-lg p-4">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span>🌾</span>
              <span>Harvest Settings</span>
            </h2>
            <p className="text-gray-300 mb-2">
              Auto-farm automatically collects <strong>ALL resources</strong> from every tile:
            </p>
            <ul className="text-sm text-gray-400 space-y-1 ml-4">
              <li>• 🔩 <strong>Metal</strong> - from metal resource tiles</li>
              <li>• ⚡ <strong>Energy</strong> - from energy resource tiles</li>
              <li>• 🗿 <strong>Cave Items</strong> - from cave explorations</li>
              <li>• 🌲 <strong>Forest Items</strong> - from forest tiles</li>
            </ul>
            <p className="text-sm text-purple-400 mt-3 italic">
              No configuration needed - auto-farm collects everything by default!
            </p>
          </div>

          {/* Combat Settings */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>⚔️</span>
              <span>Combat Settings</span>
            </h2>

            {/* Attack Players Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.attackPlayers}
                  onChange={(e) => setConfig({ ...config, attackPlayers: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-white font-bold">Attack Player Bases</span>
                  <p className="text-sm text-gray-400">
                    Automatically attack player bases encountered during farming
                  </p>
                </div>
              </label>
            </div>

            {/* Combat Options - Only show if attacking is enabled */}
            {config.attackPlayers && (
              <div className="space-y-4 ml-8 pl-4 border-l-2 border-purple-500">
                {/* Rank Filter */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    Target Rank Filter
                  </label>
                  <select
                    value={config.rankFilter}
                    onChange={(e) => setConfig({ ...config, rankFilter: e.target.value as RankFilter })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value={RankFilter.ALL}>All Ranks - Attack any player</option>
                    <option value={RankFilter.LOWER}>Lower Ranks Only - Easier targets</option>
                    <option value={RankFilter.HIGHER}>Higher Ranks Only - Challenge mode</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose which player ranks to target based on their level compared to yours
                  </p>
                </div>

                {/* Resource Target */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    Resource Priority (What YOU Need)
                  </label>
                  <select
                    value={config.resourceTarget}
                    onChange={(e) => setConfig({ ...config, resourceTarget: e.target.value as ResourceTarget })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value={ResourceTarget.METAL}>🔩 Metal - Attack when I need metal</option>
                    <option value={ResourceTarget.ENERGY}>⚡ Energy - Attack when I need energy</option>
                    <option value={ResourceTarget.LOWEST}>🎯 Lowest - Attack when MY lowest resource is low</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose resource priority based on what <strong>YOU</strong> need most, not what enemies have
                  </p>
                </div>

                {/* Combat Warning */}
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 mt-4">
                  <p className="text-sm text-red-400">
                    <strong>⚠️ Warning:</strong> Attacking players may result in retaliation.
                    Your army will be consumed in battles, win or lose.
                  </p>
                </div>
              </div>
            )}

            {/* Combat Disabled Info */}
            {!config.attackPlayers && (
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                <p className="text-sm text-gray-400">
                  ℹ️ Combat is disabled. Auto-farm will skip player bases and only collect resources.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
            >
              💾 Save Settings
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
            >
              🔄 Reset to Default
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-gray-900 rounded-lg border border-gray-700 p-4">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <span>❓</span>
            <span>How Auto-Farm Works</span>
          </h3>
          
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              <strong className="text-white">Snake Pattern Traversal:</strong> Auto-farm systematically
              covers the entire 150x150 map by moving row-by-row, alternating direction
              (left-to-right, then right-to-left, and so on).
            </p>
            
            <p>
              <strong className="text-white">Resource Collection:</strong> Every tile is automatically
              harvested for resources. Metal, energy, caves, and forests are all collected with
              no manual input required.
            </p>
            
            <p>
              <strong className="text-white">Combat (Optional):</strong> When enabled, auto-farm will
              attack player bases based on your rank filter and steal the selected resource type.
              Combat results are tracked in real-time statistics.
            </p>
            
            <p>
              <strong className="text-white">Control:</strong> You can pause, resume, or stop auto-farm
              anytime from the game page. Statistics reset when you stop, but all-time totals
              are preserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. CONFIGURATION STORAGE:
 *    - Saved to localStorage for persistence
 *    - Loaded on page mount
 *    - Can be reset to defaults
 * 
 * 2. HARVEST SETTINGS:
 *    - Always collects ALL resources (no toggles needed)
 *    - Informational section explains this behavior
 *    - Metal, Energy, Caves, Forests all auto-collected
 * 
 * 3. COMBAT CONFIGURATION:
 *    - Toggle to enable/disable combat
 *    - Rank filter (All/Lower/Higher)
 *    - Resource target (Metal/Energy/Lowest)
 *    - Warning about retaliation
 * 
 * 4. USER EXPERIENCE:
 *    - Clear section organization
 *    - Helpful descriptions for each option
 *    - Visual feedback on save
 *    - Back button to game
 *    - Help section with detailed explanation
 * 
 * 5. VISUAL DESIGN:
 *    - Purple premium theme
 *    - Dark mode compatible
 *    - Icon-enhanced labels
 *    - Conditional display (combat options only when enabled)
 * 
 * 6. VALIDATION:
 *    - Uses TypeScript enums for type safety
 *    - localStorage error handling
 *    - Default values on load failure
 */
