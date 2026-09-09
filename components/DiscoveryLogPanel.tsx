// ============================================================
// FILE: DiscoveryLogPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2026-09-08 (FID-20260908-011 neon-noir structural pass)
// ============================================================
// OVERVIEW:
// Discovery Log Panel component showing Ancient Technologies tracking system.
// Displays 15 total technologies across 3 categories (Industrial, Combat, Strategic).
// Features category filtering, progress tracking, and visual distinction between
// discovered and locked technologies. Uses keyboard shortcut (Shift+D) for toggle.
// Styling: token primitives only (nn-panel / nn-meter / nn-tabchip / nn-chip);
// no legacy UI-kit or transitions imports. Logic byte-preserved.
// ============================================================

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, ScrollText } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
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
      color: 'nn-text-cyan',
      bgColor: 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]',
      borderColor: 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]',
      icon: '⚙️',
    },
    COMBAT: {
      name: 'Combat',
      color: 'nn-text-magenta',
      bgColor: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]',
      borderColor: 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]',
      icon: '⚔️',
    },
    STRATEGIC: {
      name: 'Strategic',
      color: 'nn-text-violet',
      bgColor: 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]',
      borderColor: 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]',
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
        setProgress(data.progress || ((prev: DiscoveryProgress) => prev));
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
   * Handle keyboard shortcut (Shift+D) to toggle panel.
   * Bare D is movement East — single-mapping rule (see lib/hotkeyRegistry.ts).
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'd' || e.key === 'D') && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Ignore if typing in input field
        if (isTypingInInput()) {
          return;
        }

        if (isOpen) {
          e.preventDefault();
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
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="nn-panel w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}
        role="dialog"
        aria-label="Discovery log"
      >
        {/* Header — scanline instrument strip */}
        <div className="nn-panel__header">
          <span className="nn-panel__icon"><ScrollText className="h-4 w-4" /></span>
          <span className="nn-panel__title">Discovery Log</span>
          <span className="nn-panel__meta">Ancient Technologies Tracker</span>
          <button
            onClick={onClose}
            className="ml-auto nn-abtn nn-abtn--ghost px-3"
            aria-label="Close discovery log"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="nn-spin-icon h-7 w-7" aria-label="Loading discoveries" />
            </div>
          ) : error ? (
            <div className="nn-note" role="alert">
              <p className="nn-text-magenta font-semibold mb-2 text-sm">Failed to load discoveries</p>
              <p className="nn-text-dim text-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* Overall Progress Section */}
              <div className="nn-panel mb-6">
                <div className="nn-panel__body">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="nn-lab uppercase">Overall Progress</h3>
                      <p className="nn-lab mt-1">
                        <span className="nn-num">{progress.totalDiscovered}</span>
                        {' '}/ <span className="nn-num">{progress.totalPossible}</span> Technologies Discovered
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold nn-num nn-text-amber">
                        {Math.round(progress.percentComplete)}%
                      </div>
                      <div className="nn-lab">Complete</div>
                    </div>
                  </div>

                  <div className="nn-meter mb-4">
                    <div
                      className="nn-meter__seg"
                      style={{ width: `${progress.percentComplete}%`, '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}
                    />
                  </div>

                  {/* Category Breakdown */}
                  <div className="grid grid-cols-3 gap-4">
                    {(['INDUSTRIAL', 'COMBAT', 'STRATEGIC'] as const).map(category => {
                      const info = getCategoryInfo(category);
                      const catProgress = progress.byCategory[category] || { discovered: 0, total: 5 };
                      const percentage = (catProgress.discovered / catProgress.total) * 100;

                      return (
                        <div key={category} className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-lg">{info.icon}</span>
                            <span className={`nn-lab ${info.color}`}>{info.name}</span>
                          </div>
                          <div className="text-lg font-bold nn-num text-[color:var(--nn-text-primary)] mb-1">
                            {catProgress.discovered} / {catProgress.total}
                          </div>
                          <div className="nn-meter">
                            <div
                              className="nn-meter__seg"
                              style={{ width: `${percentage}%`, '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Category Filter Tabs — text-rule chips */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="nn-lab uppercase mr-2">Filter</span>
                <button
                  onClick={() => setFilter('ALL')}
                  className={`nn-tabchip px-3 ${filter === 'ALL' ? 'nn-tabchip--on' : ''}`}
                >
                  All Technologies
                </button>
                <button
                  onClick={() => setFilter('INDUSTRIAL')}
                  className={`nn-tabchip px-3 ${filter === 'INDUSTRIAL' ? 'nn-tabchip--on' : ''}`}
                >
                  <span className="mr-1">⚙️</span> Industrial
                </button>
                <button
                  onClick={() => setFilter('COMBAT')}
                  className={`nn-tabchip px-3 ${filter === 'COMBAT' ? 'nn-tabchip--on' : ''}`}
                >
                  <span className="mr-1">⚔️</span> Combat
                </button>
                <button
                  onClick={() => setFilter('STRATEGIC')}
                  className={`nn-tabchip px-3 ${filter === 'STRATEGIC' ? 'nn-tabchip--on' : ''}`}
                >
                  <span className="mr-1">🧠</span> Strategic
                </button>
              </div>

              {/* Technologies Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Discovered Technologies */}
                {filteredDiscoveries.map(discovery => {
                  const info = getCategoryInfo(discovery.category);
                  return (
                    <div key={discovery.id} className="nn-fade">
                      <div className={`nn-panel border-2 ${info.borderColor} ${info.bgColor}`}>
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl">{info.icon}</span>
                            <span className={`nn-chip ${info.color}`}>{info.name.toUpperCase()}</span>
                          </div>

                          {/* Content */}
                          <h3 className="text-base font-bold text-[color:var(--nn-text-primary)] mb-1">{discovery.name}</h3>
                          <p className="nn-text-dim text-sm mb-3 leading-relaxed">
                            {discovery.description}
                          </p>

                          {/* Bonus Display */}
                          <div className="nn-well py-1.5 mb-2">
                            <span className="nn-lab">Bonus</span>
                            <span className="nn-num text-sm nn-text-green">{discovery.bonus}</span>
                          </div>

                          {/* Discovery Date */}
                          <div className="nn-lab">
                            Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Undiscovered Technologies (Locked) */}
                {filteredUndiscovered.map(tech => {
                  const info = getCategoryInfo(tech.category);
                  return (
                    <div key={tech.id} className="nn-fade">
                      <div className="nn-panel border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] opacity-50">
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl grayscale">🔒</span>
                            <span className="nn-chip nn-text-dim">{info.name.toUpperCase()}</span>
                          </div>

                          {/* Content */}
                          <h3 className="text-base font-bold nn-text-dim mb-1">???</h3>
                          <p className="nn-text-dim text-sm mb-3">Undiscovered technology</p>

                          {/* Bonus Display */}
                          <div className="nn-well py-1.5 mb-2">
                            <span className="nn-lab">Bonus</span>
                            <span className="nn-num text-sm nn-text-dim">???</span>
                          </div>

                          {/* Discovery Hint */}
                          <div className="nn-lab">
                            Find in caves and forests (5% chance)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Completion Message */}
              {progress.completionStatus === 'COMPLETE' && (
                <div className="nn-brief nn-brief--amber mt-6 text-center">
                  <div className="text-2xl font-bold nn-num nn-text-amber mb-2">
                    ALL TECHNOLOGIES DISCOVERED
                  </div>
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">
                    You have uncovered all 15 ancient technologies and gained their permanent bonuses!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: Shift+D (bare D is movement East — single-mapping rule)
// - Shows progress toward 15/15 discoveries across 3 categories
// - Category filtering (All, Industrial, Combat, Strategic) — nn-tabchip row
// - Discovered technologies show full details with bonuses (nn-well ledger)
// - Undiscovered technologies appear locked with hints
// - Progress meters for overall and category-specific completion (nn-meter)
// - Completion celebration as amber brief block
// - Responsive grid layout (1/2/3 columns)
// - nn-fade entry on technology cards
// - Token primitives only: nn-panel / nn-meter / nn-tabchip / nn-chip / nn-well
// ============================================================
// END OF FILE
// ============================================================
