// ============================================================
// FILE: app/tech-tree/page.tsx
// CREATED: 2025-01-18
// LAST MODIFIED: 2025-01-18
// ============================================================
// OVERVIEW:
// Technology research tree page allowing players to unlock new
// capabilities and upgrades. Features include fast travel (Troop Transport),
// enhanced resource gathering, combat bonuses, and special abilities.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  Rocket,
  Pickaxe,
  Shield,
  Swords,
  Factory,
  Eye,
  Target,
  TrendingUp,
  Lock,
  Check,
  Clock
} from 'lucide-react';
import { useGameContext } from '@/context/GameContext';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface TechTreePageProps {
  embedded?: boolean; // When true, renders without TopNavBar and GameLayout
}

interface Technology {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  researchTime: number; // in seconds
  prerequisites: string[];
  unlocked: boolean;
  researching: boolean;
  researchProgress?: number;
  category: 'movement' | 'combat' | 'economy' | 'special';
  effects: string[];
}

// ============================================================
// CATEGORY ICONS
// (FID-20260912-058 T1: the in-file technology mock was deleted — it
// advertised six functional bot techs the /api/research route refused to
// sell, and six effectless techs the route happily sold. The tree now
// hydrates entirely from the route's shared catalog, so the UI can only
// show what the server actually sells at the server's prices.)
// ============================================================

const CATEGORY_ICONS: Record<string, string> = {
  movement: 'rocket',
  economy: 'pickaxe',
  combat: 'shield',
  special: 'target',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Tech Tree Page Component
 * 
 * Displays available technologies and allows players to:
 * - View technology descriptions and costs
 * - Research new technologies
 * - Track research progress
 * - View unlocked technologies
 */
export default function TechTreePage({ embedded = false }: TechTreePageProps) {
  const router = useRouter();
  const { player, refreshGameState } = useGameContext();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // ICON MAPPING
  // ============================================================

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      rocket: <Rocket className="w-8 h-8" />,
      pickaxe: <Pickaxe className="w-8 h-8" />,
      shield: <Shield className="w-8 h-8" />,
      swords: <Swords className="w-8 h-8" />,
      factory: <Factory className="w-8 h-8" />,
      eye: <Eye className="w-8 h-8" />,
      target: <Target className="w-8 h-8" />,
    };
    return icons[iconName] || <Zap className="w-8 h-8" />;
  };

  // ============================================================
  // ACTION HANDLERS
  // ============================================================

  /**
   * Start researching a technology
   */
  // FID-20260912-058 T1: hydrate the ENTIRE tree from the server catalog —
  // the route is the single source of truth for what exists, what it costs,
  // and what is already unlocked (the old mock diverged in both directions).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/research');
        const data = await response.json();
        if (cancelled || !data.success || !Array.isArray(data.catalog)) return;
        const unlockedIds = new Set<string>(data.unlockedTechnologies as string[]);
        const hydrated: Technology[] = (data.catalog as Array<
          Pick<Technology, 'id' | 'name' | 'description' | 'cost' | 'researchTime' | 'prerequisites' | 'category' | 'effects'>
        >).map((entry) => ({
          ...entry,
          icon: CATEGORY_ICONS[entry.category] ?? 'zap',
          unlocked: unlockedIds.has(entry.id),
          researching: false,
        }));
        setTechnologies(hydrated);
      } catch {
        // Non-fatal: tree renders empty if the catalog is unavailable
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleResearch = async (techId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technologyId: techId }),
      });

      const data = await response.json();

      if (data.success) {
        // FID-20260909-029 §2.2: the API unlocks instantly on spend — reflect
        // that locally (the old flip to `researching` contradicted the        // server, which has no queue).
        setTechnologies(prev =>
          prev.map(tech =>
            tech.id === techId ? { ...tech, unlocked: true, researching: false } : tech
          )
        );
        
        // Refresh player data to update the RP balance
        await refreshGameState?.();
      } else {
        setError(data.error || 'Failed to start research');
      }
    } catch (err) {
      console.error('Research error:', err);
      setError('An error occurred while starting research');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if technology can be researched
   */
  const canResearch = (tech: Technology): boolean => {
    if (!player) return false;
    if (tech.unlocked || tech.researching) return false;
    // FID-20260909-029 §2.3: RP is the research currency (the API spends via
    // spendResearchPoints) — the old client gate compared against Metal, so
    // affordable techs were disabled and unaffordable ones looked purchasable.
    if ((player.researchPoints ?? 0) < tech.cost) return false;
    
    // Check prerequisites
    for (const prereqId of tech.prerequisites) {
      const prereq = technologies.find(t => t.id === prereqId);
      if (!prereq?.unlocked) return false;
    }
    
    return true;
  };

  /**
   * Get category accent token (NEON NOIR semantic signals)
   */
  const getCategoryAccent = (category: string): string => {
    const accents: Record<string, string> = {
      movement: 'var(--nn-cyan)',
      combat: 'var(--nn-magenta)',
      economy: 'var(--nn-amber)',
      special: 'var(--nn-violet)',
    };
    return accents[category] || 'var(--nn-cyan)';
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--nn-void)' }}>
        <div className="text-center">
          <p className="nn-lab mb-4">Loading player data...</p>
          {!embedded && (
            <button
              onClick={() => router.push('/game')}
              className="nn-btn nn-btn--primary mt-4"
            >
              Return to Game
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderTechTreeContent = () => (
    <div className="h-full overflow-auto" style={{ background: 'var(--nn-void)' }}>
      {/* Page header — sample .sec-label */}
      <div className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] px-6 py-5" style={{ background: 'color-mix(in oklab, var(--nn-void) 88%, transparent)' }}>
        <div className="nn-sec">
          <span className="nn-sec__title">Research &amp; Technology</span>
          <span className="nn-sec__note">Tree ▸ {technologies.length} Branches</span>
          <div className="nn-stat nn-sec__end !py-2 !px-4">
            <p className="nn-stat__lab">Research Points</p>
            <p className="nn-stat__num nn-stat__num--glow-violet !text-lg">{(player.researchPoints ?? 0).toLocaleString()}</p>
          </div>
        </div>
        {error && (
          <div className="nn-note mt-4">
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 p-6">
        {/* FID-20260912-058 T1: the tree hydrates from the server catalog —
            surface the sync state instead of a silent empty grid. */}
        {technologies.length === 0 && (
          <p className="nn-lab py-12 text-center">Syncing research catalog…</p>
        )}
        {/* Technology cards — status accents via --nn-accent per card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {technologies.map(tech => {
            const accent = tech.unlocked
              ? 'var(--nn-green)'
              : tech.researching
              ? 'var(--nn-cyan)'
              : getCategoryAccent(tech.category);
            const canStartResearch = canResearch(tech);
            const isLocked = tech.prerequisites.some(
              prereqId => !technologies.find(t => t.id === prereqId)?.unlocked
            );

            return (
              <div
                key={tech.id}
                className={`nn-panel ${isLocked && !tech.unlocked && !tech.researching ? 'opacity-70' : ''}`}
                style={{ '--nn-accent': accent } as React.CSSProperties}
              >
                {/* Card header — scanline strip with status chip */}
                <div className="nn-panel__header">
                  <span className="nn-panel__icon">{getIcon(tech.icon)}</span>
                  <span className="nn-panel__title">{tech.name}</span>
                  {tech.unlocked ? (
                    <span className="nn-chip nn-chip--green nn-panel__meta">
                      <Check className="h-3 w-3" /> Unlocked
                    </span>
                  ) : tech.researching ? (
                    <span className="nn-chip nn-chip--cyan nn-panel__meta">
                      <Clock className="h-3 w-3" /> Researching
                    </span>
                  ) : isLocked ? (
                    <span className="nn-chip nn-panel__meta">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  ) : (
                    <span className="nn-chip nn-chip--amber nn-panel__meta">Available</span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <p className="nn-lab mb-2">{tech.category}</p>
                  <p className="mb-4 text-[13px] leading-relaxed text-[color:var(--nn-text-secondary)]">{tech.description}</p>

                  {/* Effects — gain ledger rows */}
                  <div className="space-y-1.5 mb-4">
                    {tech.effects.map((effect, index) => (
                      <div key={index} className="flex items-start gap-2 text-[13px]">
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--nn-green)]" />
                        <span className="text-[color:var(--nn-text-secondary)]">{effect}</span>
                      </div>
                    ))}
                  </div>

                  {/* Prerequisites */}
                  {tech.prerequisites.length > 0 && (
                    <div className="mb-4">
                      <p className="nn-lab mb-1.5">Requires</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tech.prerequisites.map(prereqId => {
                          const prereq = technologies.find(t => t.id === prereqId);
                          return (
                            <span
                              key={prereqId}
                              className={`nn-chip ${prereq?.unlocked ? 'nn-chip--green' : 'nn-chip--magenta'}`}
                            >
                              {prereq?.name || prereqId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cost + action footer */}
                  <div className="flex items-center justify-between border-t border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] pt-4">
                    <div>
                      <p className="nn-lab">Cost (RP)</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-amber)]">{tech.cost.toLocaleString()}</p>
                    </div>
                    {tech.unlocked ? (
                      <span className="nn-chip nn-chip--green px-3 py-1.5 text-[10px]">Unlocked</span>
                    ) : tech.researching ? (
                      <span className="nn-chip nn-chip--cyan px-3 py-1.5 text-[10px]">Researching</span>
                    ) : (
                      <button
                        onClick={() => handleResearch(tech.id)}
                        disabled={!canStartResearch || isLoading}
                        className="nn-abtn nn-abtn--cyan px-5 py-2"
                      >
                        Research
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // If embedded, return just the content
  if (embedded) {
    return renderTechTreeContent();
  }

  // Otherwise, return standalone page (shouldn't be used per project rules)
  return renderTechTreeContent();
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Displays technology tree with categories (movement, combat, economy, special)
// - Troop Transport technology enables fast travel (5 spaces vs 1)
// - Bot Hunter tech branch (6 tiers):
//   * T1: Bot Hunter - Unlock scanner, +25% loot
//   * T2: Advanced Tracking - 2x radius, 50% faster cooldown, +75% loot
//   * T3: Bot Magnet - Attract bots to location
//   * T4: Bot Concentration Zones - Control spawn areas
//   * T5: Bot Summoning Circle - Spawn specific bot types
//   * T6: Fast Travel Network - Waypoint system
// - Shows prerequisites, costs, and effects for each technology
// - Research system with API integration (/api/research endpoint)
// - Visual feedback for unlocked, researching, and locked states
// - Color-coded by category for easy identification
// - Glassmorphism design matching game theme
// - Back button and metal display in header
// ============================================================
// END OF FILE
// ============================================================
