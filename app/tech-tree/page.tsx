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
  ArrowLeft,
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
import BackButton from '@/components/BackButton';

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
export default function TechTreePage({ embedded = false }: TechTreePageProps = {}) {
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
        setError(typeof data.error === 'string' ? data.error : (data.message || 'Failed to start research'));
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
   * Get category color
   */
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      movement: 'cyan',
      combat: 'red',
      economy: 'yellow',
      special: 'purple',
    };
    return colors[category] || 'gray';
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/70 mb-4">Loading player data...</p>
          {!embedded && (
            <button
              onClick={() => router.push('/game')}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded"
            >
              Return to Game
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderTechTreeContent = () => (
    <div className="bg-gray-800 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Technology Tree</h1>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-sm">Available Metal</p>
            <p className="text-2xl font-bold text-gray-400">⚙️ {player.resources.metal.toLocaleString()}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technologies.map(tech => {
            const color = getCategoryColor(tech.category);
            const canStartResearch = canResearch(tech);
            const isLocked = tech.prerequisites.some(
              prereqId => !technologies.find(t => t.id === prereqId)?.unlocked
            );

            return (
              <div
                key={tech.id}
                className={`bg-gray-900/60 backdrop-blur-sm border-2 rounded-lg overflow-hidden transition-all ${
                  tech.unlocked
                    ? 'border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    : tech.researching
                    ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : canStartResearch
                    ? `border-${color}-500/30 hover:border-${color}-500/50`
                    : 'border-gray-700/30'
                }`}
              >
                {/* Header */}
                <div className={`bg-gradient-to-r from-${color}-500/20 to-${color}-500/10 border-b border-${color}-500/30 p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-${color}-400`}>{getIcon(tech.icon)}</div>
                    {tech.unlocked ? (
                      <div className="bg-green-500/20 border border-green-500/50 rounded-full p-2">
                        <Check className="w-5 h-5 text-green-400" />
                      </div>
                    ) : tech.researching ? (
                      <div className="bg-blue-500/20 border border-blue-500/50 rounded-full p-2">
                        <Clock className="w-5 h-5 text-blue-400 animate-spin" />
                      </div>
                    ) : isLocked ? (
                      <div className="bg-gray-700/50 rounded-full p-2">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-bold text-white">{tech.name}</h3>
                  <p className="text-sm text-white/70 capitalize">{tech.category}</p>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-white/80 text-sm mb-4">{tech.description}</p>

                  {/* Effects */}
                  <div className="space-y-2 mb-4">
                    {tech.effects.map((effect, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white/70">{effect}</span>
                      </div>
                    ))}
                  </div>

                  {/* Prerequisites */}
                  {tech.prerequisites.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-white/50 mb-1">Requires:</p>
                      {tech.prerequisites.map(prereqId => {
                        const prereq = technologies.find(t => t.id === prereqId);
                        return (
                          <span
                            key={prereqId}
                            className={`inline-block text-xs px-2 py-1 rounded mr-2 mb-1 ${
                              prereq?.unlocked
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'bg-red-500/20 text-red-400 border border-red-500/50'
                            }`}
                          >
                            {prereq?.name || prereqId}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Cost and Action */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <p className="text-xs text-white/50">Cost</p>
                      <p className="text-lg font-bold text-yellow-400">{tech.cost.toLocaleString()}</p>
                    </div>
                    {tech.unlocked ? (
                      <span className="bg-green-500/20 text-green-400 font-bold px-4 py-2 rounded border border-green-500/50">
                        Unlocked
                      </span>
                    ) : tech.researching ? (
                      <span className="bg-blue-500/20 text-blue-400 font-bold px-4 py-2 rounded border border-blue-500/50">
                        Researching...
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResearch(tech.id)}
                        disabled={!canStartResearch || isLoading}
                        className={`font-bold px-4 py-2 rounded transition-all ${
                          canStartResearch
                            ? `bg-${color}-600 hover:bg-${color}-700 text-white border border-${color}-500/50`
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
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
