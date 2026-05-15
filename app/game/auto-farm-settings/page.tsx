'use client';

import React, { useState, useEffect } from 'react';
import {
  AutoFarmConfig,
  RankFilter,
  ResourceTarget,
  DEFAULT_AUTO_FARM_CONFIG
} from '@/types/autoFarm.types';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

const STORAGE_KEY = 'darkframe_autofarm_config';

function loadConfig(): AutoFarmConfig {
  if (typeof window === 'undefined') return DEFAULT_AUTO_FARM_CONFIG;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to load auto-farm config:', error);
  }
  return DEFAULT_AUTO_FARM_CONFIG;
}

function saveConfig(config: AutoFarmConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save auto-farm config:', error);
  }
}

export default function AutoFarmSettingsPage() {
  const [config, setConfig] = useState<AutoFarmConfig>(DEFAULT_AUTO_FARM_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_AUTO_FARM_CONFIG);
    saveConfig(DEFAULT_AUTO_FARM_CONFIG);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🤖</span>
                <div>
                  <h1 className="text-3xl font-bold text-white">Auto-Farm Settings</h1>
                  <p className="text-white/50">Configure your automated farming preferences</p>
                </div>
              </div>

              {saved && (
                <div className="mb-4 bg-[--synth]/10 border border-[--synth]/30 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-[--synth] text-xl">✓</span>
                  <span className="text-[--synth] font-bold">Settings saved successfully!</span>
                </div>
              )}

              <div className="bg-[--card] rounded-lg border-2 border-[--neon-pink]/30 shadow-xl p-6 space-y-6">
                <div className="bg-[--neon-pink]/10 border border-[--neon-pink]/20 rounded-lg p-4">
                  <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>🌾</span><span>Harvest Settings</span>
                  </h2>
                  <p className="text-white/70 mb-2">
                    Auto-farm automatically collects <strong className="text-white">ALL resources</strong> from every tile:
                  </p>
                  <ul className="text-sm text-white/50 space-y-1 ml-4">
                    <li>• 🔩 <strong className="text-white/70">Metal</strong> - from metal resource tiles</li>
                    <li>• ⚡ <strong className="text-white/70">Energy</strong> - from energy resource tiles</li>
                    <li>• 🗿 <strong className="text-white/70">Cave Items</strong> - from cave explorations</li>
                    <li>• 🌲 <strong className="text-white/70">Forest Items</strong> - from forest tiles</li>
                  </ul>
                  <p className="text-sm text-[--neon-pink] mt-3 italic">
                    No configuration needed - auto-farm collects everything by default!
                  </p>
                </div>

                <div className="bg-white/[0.03] rounded-lg p-4 border border-[--border]">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>⚔️</span><span>Combat Settings</span>
                  </h2>

                  <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.attackPlayers}
                        onChange={(e) => setConfig({ ...config, attackPlayers: e.target.checked })}
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-[--neon-pink] focus:ring-[--neon-pink]"
                      />
                      <div>
                        <span className="text-white font-bold">Attack Player Bases</span>
                        <p className="text-sm text-white/50">Automatically attack player bases encountered during farming</p>
                      </div>
                    </label>
                  </div>

                  {config.attackPlayers && (
                    <div className="space-y-4 ml-8 pl-4 border-l-2 border-[--neon-pink]/30">
                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Target Rank Filter</label>
                        <select
                          value={config.rankFilter}
                          onChange={(e) => setConfig({ ...config, rankFilter: e.target.value as RankFilter })}
                          className="w-full bg-white/5 border border-[--border] rounded-lg px-4 py-2 text-white focus:border-[--neon-pink] focus:outline-none"
                        >
                          <option value={RankFilter.ALL}>All Ranks - Attack any player</option>
                          <option value={RankFilter.LOWER}>Lower Ranks Only - Easier targets</option>
                          <option value={RankFilter.HIGHER}>Higher Ranks Only - Challenge mode</option>
                        </select>
                        <p className="text-xs text-white/40 mt-1">Choose which player ranks to target based on their level compared to yours</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Resource Priority (What YOU Need)</label>
                        <select
                          value={config.resourceTarget}
                          onChange={(e) => setConfig({ ...config, resourceTarget: e.target.value as ResourceTarget })}
                          className="w-full bg-white/5 border border-[--border] rounded-lg px-4 py-2 text-white focus:border-[--neon-pink] focus:outline-none"
                        >
                          <option value={ResourceTarget.METAL}>🔩 Metal - Attack when I need metal</option>
                          <option value={ResourceTarget.ENERGY}>⚡ Energy - Attack when I need energy</option>
                          <option value={ResourceTarget.LOWEST}>🎯 Lowest - Attack when MY lowest resource is low</option>
                        </select>
                        <p className="text-xs text-white/40 mt-1">Choose resource priority based on what <strong className="text-white/60">YOU</strong> need most</p>
                      </div>

                      <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-3 mt-4">
                        <p className="text-sm text-[--neon-red]">
                          <strong>⚠️ Warning:</strong> Attacking players may result in retaliation. Your army will be consumed in battles, win or lose.
                        </p>
                      </div>
                    </div>
                  )}

                  {!config.attackPlayers && (
                    <div className="bg-white/[0.03] border border-[--border] rounded-lg p-3">
                      <p className="text-sm text-white/50">ℹ️ Combat is disabled. Auto-farm will skip player bases and only collect resources.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex-1 px-6 py-3 bg-[--neon-pink]/15 border border-[--neon-pink]/25 text-[--neon-pink] rounded-lg font-bold hover:bg-[--neon-pink]/25 transition-colors"
                  >
                    💾 Save Settings
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-white/5 border border-[--border] text-white/60 rounded-lg font-bold hover:bg-white/10 transition-colors"
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-[--card] rounded-lg border border-[--border] p-4">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>❓</span><span>How Auto-Farm Works</span>
                </h3>
                <div className="space-y-3 text-sm text-white/50">
                  <p><strong className="text-white/70">Snake Pattern Traversal:</strong> Auto-farm systematically covers the entire 150x150 map by moving row-by-row, alternating direction.</p>
                  <p><strong className="text-white/70">Resource Collection:</strong> Every tile is automatically harvested for resources. Metal, energy, caves, and forests are all collected.</p>
                  <p><strong className="text-white/70">Combat (Optional):</strong> When enabled, auto-farm will attack player bases based on your rank filter and steal the selected resource type.</p>
                  <p><strong className="text-white/70">Control:</strong> You can pause, resume, or stop auto-farm anytime from the game page.</p>
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
