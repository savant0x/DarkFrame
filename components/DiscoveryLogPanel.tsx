// ============================================================
// FILE: DiscoveryLogPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2025-01-17
// ============================================================
// OVERVIEW:
// Discovery Log Panel component showing Ancient Technologies tracking system.
// Displays 15 total technologies across 3 categories (Industrial, Combat, Strategic).
// Features category filtering, progress tracking, and visual distinction between
// discovered and locked technologies. Uses keyboard shortcut (D key) for toggle.
// Integrates design system components (Panel, ProgressBar, StaggerChildren, Badge, Card, Button).
// ============================================================

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { Panel } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { StaggerChildren, StaggerItem } from '@/components/transitions/StaggerChildren';
import { LoadingSpinner } from '@/components/transitions/LoadingSpinner';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface DiscoveryLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Discovery {
  id: string;
  name: string;
  description: string;
  bonus: string;
  category: 'INDUSTRIAL' | 'COMBAT' | 'STRATEGIC';
  discoveredAt: number;
}

interface DiscoveryProgress {
  totalDiscovered: number;
  totalPossible: number;
  percentComplete: number;
  byCategory: {
    [key: string]: { discovered: number; total: number };
  };
  completionStatus: 'INCOMPLETE' | 'COMPLETE';
}

interface UndiscoveredTech {
  id: string;
  category: 'INDUSTRIAL' | 'COMBAT' | 'STRATEGIC';
}

type CategoryFilter = 'ALL' | 'INDUSTRIAL' | 'COMBAT' | 'STRATEGIC';

interface CategoryInfo {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get styling information for a discovery category
 * @param category - Category identifier (INDUSTRIAL, COMBAT, STRATEGIC)
 * @returns Category styling configuration
 */
function getCategoryInfo(category: 'INDUSTRIAL' | 'COMBAT' | 'STRATEGIC'): CategoryInfo {
  const map: Record<string, CategoryInfo> = {
    INDUSTRIAL: {
      name: 'Industrial',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-500',
      icon: '⚙️',
    },
    COMBAT: {
      name: 'Combat',
      color: 'text-red-400',
      bgColor: 'bg-red-900/30',
      borderColor: 'border-red-500',
      icon: '⚔️',
    },
    STRATEGIC: {
      name: 'Strategic',
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/30',
      borderColor: 'border-purple-500',
      icon: '🧠',
    },
  };
  return map[category] || map.INDUSTRIAL;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DiscoveryLogPanel({ isOpen, onClose }: DiscoveryLogPanelProps) {
  const { player } = useGameContext();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [progress, setProgress] = useState<DiscoveryProgress>({
    totalDiscovered: 0,
    totalPossible: 15,
    percentComplete: 0,
    byCategory: {
      INDUSTRIAL: { discovered: 0, total: 5 },
      COMBAT: { discovered: 0, total: 5 },
      STRATEGIC: { discovered: 0, total: 5 },
    },
    completionStatus: 'INCOMPLETE',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('ALL');

  // ============================================================
  // DATA FETCHING
  // ============================================================

  /**
   * Fetch discovery data from server
   * Loads player's discovered technologies and calculates progress
   */
  useEffect(() => {
    if (!isOpen || !player?.username) return;

    const fetchDiscoveries = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/discoveries?username=${player.username}`);
        if (!response.ok) throw new Error('Failed to load discoveries');

        const data = await response.json();
        setDiscoveries(data.discoveries || []);
        setProgress(data.progress || progress);
      } catch (err) {
        console.error('Discovery fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveries();
  }, [isOpen, player?.username]);

  // ============================================================
  // KEYBOARD SHORTCUT
  // ============================================================

  /**
   * Handle keyboard shortcut (D key) to toggle panel
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        // Ignore if typing in input field
        if (isTypingInInput()) {
          return;
        }
        
        if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ============================================================
  // FILTERING & SORTING
  // ============================================================

  /**
   * Generate list of undiscovered technologies based on discovered IDs
   * Used to show locked technology cards
   */
  const undiscoveredTechs = useMemo(() => {
    const allTechIds: UndiscoveredTech[] = [
      // Industrial (5)
      { id: 'TECH_INDUSTRIAL_01', category: 'INDUSTRIAL' },
      { id: 'TECH_INDUSTRIAL_02', category: 'INDUSTRIAL' },
      { id: 'TECH_INDUSTRIAL_03', category: 'INDUSTRIAL' },
      { id: 'TECH_INDUSTRIAL_04', category: 'INDUSTRIAL' },
      { id: 'TECH_INDUSTRIAL_05', category: 'INDUSTRIAL' },
      // Combat (5)
      { id: 'TECH_COMBAT_01', category: 'COMBAT' },
      { id: 'TECH_COMBAT_02', category: 'COMBAT' },
      { id: 'TECH_COMBAT_03', category: 'COMBAT' },
      { id: 'TECH_COMBAT_04', category: 'COMBAT' },
      { id: 'TECH_COMBAT_05', category: 'COMBAT' },
      // Strategic (5)
      { id: 'TECH_STRATEGIC_01', category: 'STRATEGIC' },
      { id: 'TECH_STRATEGIC_02', category: 'STRATEGIC' },
      { id: 'TECH_STRATEGIC_03', category: 'STRATEGIC' },
      { id: 'TECH_STRATEGIC_04', category: 'STRATEGIC' },
      { id: 'TECH_STRATEGIC_05', category: 'STRATEGIC' },
    ];

    const discoveredIds = new Set(discoveries.map(d => d.id));
    return allTechIds.filter(tech => !discoveredIds.has(tech.id));
  }, [discoveries]);

  /**
   * Filter discoveries and undiscovered techs by selected category
   */
  const filteredDiscoveries = useMemo(() => {
    if (filter === 'ALL') return discoveries;
    return discoveries.filter(d => d.category === filter);
  }, [discoveries, filter]);

  const filteredUndiscovered = useMemo(() => {
    if (filter === 'ALL') return undiscoveredTechs;
    return undiscoveredTechs.filter(t => t.category === filter);
  }, [undiscoveredTechs, filter]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  if (!isOpen) return null;

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Discovery Log</h2>
              <p className="text-sm text-gray-400">Ancient Technologies Tracker</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-red-400 mb-2 font-semibold">Failed to load discoveries</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : (
            <>
              {/* Overall Progress Section */}
              <Panel className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Overall Progress</h3>
                    <p className="text-sm text-gray-400">
                      {progress.totalDiscovered} / {progress.totalPossible} Technologies Discovered
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-yellow-400">
                      {Math.round(progress.percentComplete)}%
                    </div>
                    <div className="text-xs text-gray-400">Complete</div>
                  </div>
                </div>

                <ProgressBar
                  value={progress.percentComplete}
                  max={100}
                  size="lg"
                  className="mb-4"
                />

                {/* Category Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  {(['INDUSTRIAL', 'COMBAT', 'STRATEGIC'] as const).map(category => {
                    const info = getCategoryInfo(category);
                    const catProgress = progress.byCategory[category] || { discovered: 0, total: 5 };
                    const percentage = (catProgress.discovered / catProgress.total) * 100;

                    return (
                      <div key={category} className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-xl">{info.icon}</span>
                          <span className={`text-sm font-bold ${info.color}`}>{info.name}</span>
                        </div>
                        <div className="text-lg font-bold text-white mb-1">
                          {catProgress.discovered} / {catProgress.total}
                        </div>
                        <ProgressBar
                          value={percentage}
                          max={100}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Divider className="my-6" />

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-sm text-gray-400 font-semibold mr-2">Filter:</span>
                <Button
                  variant={filter === 'ALL' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('ALL')}
                >
                  All Technologies
                </Button>
                <Button
                  variant={filter === 'INDUSTRIAL' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('INDUSTRIAL')}
                  className="flex items-center gap-1"
                >
                  <span>⚙️</span>
                  <span>Industrial</span>
                </Button>
                <Button
                  variant={filter === 'COMBAT' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('COMBAT')}
                  className="flex items-center gap-1"
                >
                  <span>⚔️</span>
                  <span>Combat</span>
                </Button>
                <Button
                  variant={filter === 'STRATEGIC' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('STRATEGIC')}
                  className="flex items-center gap-1"
                >
                  <span>🧠</span>
                  <span>Strategic</span>
                </Button>
              </div>

              {/* Technologies Grid */}
              <StaggerChildren staggerDelay={0.05}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Discovered Technologies */}
                  {filteredDiscoveries.map(discovery => {
                    const info = getCategoryInfo(discovery.category);
                    return (
                      <StaggerItem key={discovery.id}>
                        <Card
                          className={`border-2 ${info.borderColor} ${info.bgColor} hover:shadow-lg hover:scale-[1.02] transition-all duration-200`}
                        >
                          <div className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-3xl">{info.icon}</span>
                              <Badge variant="default" className={`${info.color} bg-transparent`}>
                                {info.name.toUpperCase()}
                              </Badge>
                            </div>

                            {/* Content */}
                            <h3 className="text-lg font-bold text-white mb-1">{discovery.name}</h3>
                            <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                              {discovery.description}
                            </p>

                            {/* Bonus Display */}
                            <div className="bg-gray-800/50 rounded p-2 border border-gray-600 mb-2">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                                Bonus
                              </div>
                              <div className="text-sm font-bold text-green-400">{discovery.bonus}</div>
                            </div>

                            {/* Discovery Date */}
                            <div className="text-xs text-gray-500">
                              Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                            </div>
                          </div>
                        </Card>
                      </StaggerItem>
                    );
                  })}

                  {/* Undiscovered Technologies (Locked) */}
                  {filteredUndiscovered.map(tech => {
                    const info = getCategoryInfo(tech.category);
                    return (
                      <StaggerItem key={tech.id}>
                        <Card className="border-2 border-gray-700 bg-gray-800/30 opacity-50">
                          <div className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-3xl grayscale">🔒</span>
                              <Badge variant="default" className="bg-gray-700 text-gray-400">
                                {info.name.toUpperCase()}
                              </Badge>
                            </div>

                            {/* Content */}
                            <h3 className="text-lg font-bold text-gray-500 mb-1">???</h3>
                            <p className="text-sm text-gray-600 mb-3">Undiscovered technology</p>

                            {/* Bonus Display */}
                            <div className="bg-gray-800/50 rounded p-2 border border-gray-700 mb-2">
                              <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                                Bonus
                              </div>
                              <div className="text-sm font-bold text-gray-600">???</div>
                            </div>

                            {/* Discovery Hint */}
                            <div className="text-xs text-gray-600">
                              Find in caves and forests (5% chance)
                            </div>
                          </div>
                        </Card>
                      </StaggerItem>
                    );
                  })}
                </div>
              </StaggerChildren>

              {/* Completion Message */}
              {progress.completionStatus === 'COMPLETE' && (
                <div className="mt-6 p-6 bg-gradient-to-r from-yellow-900 to-orange-900 border-2 border-yellow-500 rounded-lg text-center">
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    All Technologies Discovered!
                  </h3>
                  <p className="text-yellow-300">
                    You have uncovered all 15 ancient technologies and gained their permanent bonuses!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: D key to open/close panel
// - Shows progress toward 15/15 discoveries across 3 categories
// - Category filtering (All, Industrial, Combat, Strategic)
// - Discovered technologies show full details with bonuses
// - Undiscovered technologies appear locked with hints
// - Visual progress bars for overall and category-specific completion
// - Completion celebration when all 15 technologies found
// - Design system integration: Panel, ProgressBar, StaggerChildren, Badge, Card, Button, Divider
// - Responsive grid layout (1/2/3 columns)
// - Smooth animations with stagger effects (0.05s delay)
// - Hover effects on technology cards (scale + shadow)
// ============================================================
// END OF FILE
// ============================================================
