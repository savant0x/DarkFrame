/**
 * @file components/DiscoveryLogPanel.tsx
 * @created 2025-01-17
 * @overview Discovery log UI for tracking ancient technology progress
 * 
 * OVERVIEW:
 * Displays player's discovery progress (X/15) with categorized view.
 * Shows discovered technologies with bonuses and undiscovered technologies as locked.
 * Accessible via keyboard shortcut (D key).
 * Categories: Industrial (5), Combat (5), Strategic (5).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { Discovery, DiscoveryCategory } from '@/types';

interface DiscoveryProgress {
  totalDiscovered: number;
  totalAvailable: number;
  progressPercent: number;
  byCategory: {
    industrial: number;
    combat: number;
    strategic: number;
  };
  discoveries: Array<Discovery & { config?: any }>;
  undiscovered: Array<{
    id: string;
    name: string;
    category: DiscoveryCategory;
    icon: string;
    description: string;
  }>;
  completionStatus: 'COMPLETE' | 'IN_PROGRESS';
}

/**
 * Get category display info
 */
function getCategoryInfo(category: DiscoveryCategory) {
  switch (category) {
    case DiscoveryCategory.Industrial:
      return {
        color: 'text-blue-400 border-blue-500',
        bgColor: 'bg-blue-500/10',
        icon: '🏭',
        name: 'Industrial'
      };
    case DiscoveryCategory.Combat:
      return {
        color: 'text-red-400 border-red-500',
        bgColor: 'bg-red-500/10',
        icon: '⚔️',
        name: 'Combat'
      };
    case DiscoveryCategory.Strategic:
      return {
        color: 'text-purple-400 border-purple-500',
        bgColor: 'bg-purple-500/10',
        icon: '🎯',
        name: 'Strategic'
      };
    default:
      return {
        color: 'text-gray-400 border-gray-500',
        bgColor: 'bg-gray-500/10',
        icon: '📜',
        name: 'Unknown'
      };
  }
}

export default function DiscoveryLogPanel() {
  const { player } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DiscoveryCategory | 'all'>('all');

  /**
   * Fetch discovery progress
   */
  const fetchProgress = useCallback(async () => {
    if (!player?.username || !isOpen) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/discovery/status?username=${player.username}`);
      const data = await response.json();

      if (data.success) {
        setProgress(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch discovery progress:', error);
    } finally {
      setLoading(false);
    }
  }, [player?.username, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchProgress();
    }
  }, [isOpen, fetchProgress]);

  /**
   * Keyboard shortcut (D key)
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        // Don't trigger if typing in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isOpen) return null;

  // Filter discoveries by selected category
  const filteredDiscoveries = progress?.discoveries.filter(d =>
    selectedCategory === 'all' || d.category === selectedCategory
  ) || [];

  const filteredUndiscovered = progress?.undiscovered.filter(d =>
    selectedCategory === 'all' || d.category === selectedCategory
  ) || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-4 border-b border-cyan-500 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              📜 Ancient Technologies
              <span className="text-base font-normal text-cyan-300">
                ({progress?.totalDiscovered || 0} / 15)
              </span>
            </h2>
            <p className="text-sm text-cyan-300 mt-1">
              Discover ancient technologies in caves and forests • Press <kbd className="px-2 py-1 bg-cyan-700 rounded text-xs">D</kbd> to toggle
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-cyan-300 transition-colors text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-cyan-400 text-lg">Loading discoveries...</div>
          </div>
        ) : !progress ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400">Failed to load discovery progress</div>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="p-4 bg-gray-800/50 border-b border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-cyan-300 font-semibold">Overall Progress</span>
                <span className="text-lg font-bold text-white">{progress.progressPercent}%</span>
              </div>
              <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${progress.progressPercent}%` }}
                ></div>
              </div>

              {/* Category Stats */}
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-400">🏭 Industrial:</span>
                  <span className="font-bold text-white">{progress.byCategory.industrial}/5</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">⚔️ Combat:</span>
                  <span className="font-bold text-white">{progress.byCategory.combat}/5</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-400">🎯 Strategic:</span>
                  <span className="font-bold text-white">{progress.byCategory.strategic}/5</span>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="p-4 bg-gray-800/30 border-b border-cyan-500/30 flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All ({progress.totalDiscovered})
              </button>
              {[DiscoveryCategory.Industrial, DiscoveryCategory.Combat, DiscoveryCategory.Strategic].map(cat => {
                const info = getCategoryInfo(cat);
                const count = progress.discoveries.filter(d => d.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      selectedCategory === cat
                        ? `${info.bgColor} ${info.color} border-2 ${info.color.replace('text-', 'border-')}`
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {info.icon} {info.name} ({count}/5)
                  </button>
                );
              })}
            </div>

            {/* Discoveries List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Discovered Technologies */}
                {filteredDiscoveries.map(discovery => {
                  const info = getCategoryInfo(discovery.category);
                  return (
                    <div
                      key={discovery.id}
                      className={`border-2 ${info.color.replace('text-', 'border-')} ${info.bgColor} rounded-lg p-4`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-3xl">{discovery.config?.icon || '📜'}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${info.bgColor} ${info.color}`}>
                          {info.name.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{discovery.name}</h3>
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{discovery.description}</p>
                      <div className="bg-gray-800/50 rounded p-2 border border-gray-600">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bonus</div>
                        <div className="text-sm font-bold text-green-400">{discovery.bonus}</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}

                {/* Undiscovered Technologies (Locked) */}
                {filteredUndiscovered.map(tech => {
                  const info = getCategoryInfo(tech.category);
                  return (
                    <div
                      key={tech.id}
                      className="border-2 border-gray-700 bg-gray-800/30 rounded-lg p-4 opacity-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-3xl grayscale">🔒</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded bg-gray-700 text-gray-400`}>
                          {info.name.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-500 mb-1">???</h3>
                      <p className="text-sm text-gray-600 mb-3">Undiscovered technology</p>
                      <div className="bg-gray-800/50 rounded p-2 border border-gray-700">
                        <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Bonus</div>
                        <div className="text-sm font-bold text-gray-600">???</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Find in caves and forests (5% chance)
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Completion Message */}
              {progress.completionStatus === 'COMPLETE' && (
                <div className="mt-6 p-6 bg-gradient-to-r from-yellow-900 to-orange-900 border-2 border-yellow-500 rounded-lg text-center">
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="text-2xl font-bold text-white mb-2">All Technologies Discovered!</h3>
                  <p className="text-yellow-300">
                    You have uncovered all 15 ancient technologies and gained their permanent bonuses!
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: D key to open/close
// - Shows progress toward 15/15 discoveries
// - Category filtering (All, Industrial, Combat, Strategic)
// - Discovered technologies show full details
// - Undiscovered technologies appear locked
// - Visual progress bar with category breakdown
// - Completion celebration when all 15 found
// ============================================================
// END OF FILE
// ============================================================
