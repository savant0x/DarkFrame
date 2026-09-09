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

import React, { useState } from 'react';
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
// MOCK TECHNOLOGIES
// ============================================================

const TECHNOLOGIES: Technology[] = [
  {
    id: 'troop-transport',
    name: 'Troop Transport',
    description: 'Advanced logistics allowing your armies to move 5 spaces per turn instead of 1',
    icon: 'rocket',
    cost: 10000,
    researchTime: 300,
    prerequisites: [],
    unlocked: false,
    researching: false,
    category: 'movement',
    effects: ['Movement range increased from 1 to 5 spaces', 'Fast travel enabled']
  },
  {
    id: 'advanced-mining',
    name: 'Advanced Mining',
    description: 'Improved resource extraction techniques',
    icon: 'pickaxe',
    cost: 5000,
    researchTime: 180,
    prerequisites: [],
    unlocked: false,
    researching: false,
    category: 'economy',
    effects: ['+25% resource harvesting speed', '+10% resource yield']
  },
  {
    id: 'fortification',
    name: 'Fortification',
    description: 'Defensive structures and tactics',
    icon: 'shield',
    cost: 8000,
    researchTime: 240,
    prerequisites: [],
    unlocked: false,
    researching: false,
    category: 'combat',
    effects: ['+15% defensive power', 'Reduced damage from raids']
  },
  {
    id: 'tactical-warfare',
    name: 'Tactical Warfare',
    description: 'Advanced combat strategies and unit coordination',
    icon: 'swords',
    cost: 12000,
    researchTime: 360,
    prerequisites: ['fortification'],
    unlocked: false,
    researching: false,
    category: 'combat',
    effects: ['+20% attack power', 'Critical hit chance increased']
  },
  {
    id: 'factory-automation',
    name: 'Factory Automation',
    description: 'Automated production systems for faster unit creation',
    icon: 'factory',
    cost: 15000,
    researchTime: 420,
    prerequisites: ['advanced-mining'],
    unlocked: false,
    researching: false,
    category: 'economy',
    effects: ['-30% unit production time', '+2 factory queue slots']
  },
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    description: 'Scout enemy territories and reveal hidden information',
    icon: 'eye',
    cost: 6000,
    researchTime: 200,
    prerequisites: [],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: ['Reveal nearby enemy positions', 'View enemy unit counts']
  },
  
  // ============================================================
  // BOT HUNTER TECH BRANCH
  // ============================================================
  {
    id: 'bot-hunter',
    name: 'Bot Hunter',
    description: 'Unlock bot detection scanner and increase loot from bot defeats',
    icon: 'target',
    cost: 5000,
    researchTime: 180,
    prerequisites: [],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: [
      'Unlock Bot Scanner (B key)',
      'Scan radius: 50 tiles',
      'Cooldown: 1 hour',
      '+25% loot from defeated bots'
    ]
  },
  {
    id: 'advanced-tracking',
    name: 'Advanced Tracking',
    description: 'Enhanced bot scanner with larger radius and reduced cooldown',
    icon: 'eye',
    cost: 15000,
    researchTime: 300,
    prerequisites: ['bot-hunter'],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: [
      'Scan radius: 100 tiles (2x)',
      'Cooldown: 30 minutes (50% faster)',
      '+75% total loot from bots',
      'View bot movement history'
    ]
  },
  {
    id: 'bot-magnet',
    name: 'Bot Magnet',
    description: 'Deploy a beacon that attracts bots to your location',
    icon: 'target',
    cost: 30000,
    researchTime: 420,
    prerequisites: ['advanced-tracking'],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: [
      'Attract 30% of bots within 100-tile radius',
      'Duration: 7 days',
      'Cooldown: 14 days',
      'Increased bot engagement opportunities'
    ]
  },
  {
    id: 'bot-concentration-zones',
    name: 'Bot Concentration Zones',
    description: 'Define zones where new bots preferentially spawn',
    icon: 'target',
    cost: 35000,
    researchTime: 480,
    prerequisites: ['bot-magnet'],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: [
      'Define 3 zones (30×30 tiles each)',
      '70% of new spawns in your zones',
      'Zones persist until changed',
      'No cooldown - permanent choice'
    ]
  },
  {
    id: 'bot-summoning-circle',
    name: 'Bot Summoning Circle',
    description: 'Summon specific bot types to your location',
    icon: 'target',
    cost: 75000,
    researchTime: 600,
    prerequisites: ['bot-concentration-zones'],
    unlocked: false,
    researching: false,
    category: 'special',
    effects: [
      'Spawn 5 bots of chosen specialization',
      'Spawns within 20-tile radius',
      'Summoned bots have 1.5x resources',
      'Cooldown: 7 days'
    ]
  },
  {
    id: 'fast-travel-network',
    name: 'Fast Travel Network',
    description: 'Create waypoints for instant travel across the map',
    icon: 'rocket',
    cost: 50000,
    researchTime: 540,
    prerequisites: ['bot-summoning-circle'],
    unlocked: false,
    researching: false,
    category: 'movement',
    effects: [
      '5 waypoint slots',
      'Set waypoint at any location',
      'Instant travel to waypoints',
      'Cooldown: 12 hours per use'
    ]
  }
];

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
  const [technologies, setTechnologies] = useState<Technology[]>(TECHNOLOGIES);
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
        // Update local state
        setTechnologies(prev =>
          prev.map(tech =>
            tech.id === techId ? { ...tech, researching: true } : tech
          )
        );
        
        // Refresh player data to update resources
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
    if (player.resources.metal < tech.cost) return false;
    
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
            <p className="nn-stat__lab">Available Metal</p>
            <p className="nn-stat__num nn-stat__num--glow-amber !text-lg">{player.resources.metal.toLocaleString()}</p>
          </div>
        </div>
        {error && (
          <div className="nn-note mt-4">
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 p-6">
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
                      <p className="nn-lab">Cost</p>
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
