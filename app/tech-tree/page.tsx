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
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface TechTreePageProps {
  embedded?: boolean;
}

interface Technology {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  researchTime: number;
  prerequisites: string[];
  unlocked: boolean;
  researching: boolean;
  researchProgress?: number;
  category: 'movement' | 'combat' | 'economy' | 'special';
  effects: string[];
}

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

export default function TechTreePage({ embedded = false }: TechTreePageProps = {}) {
  const router = useRouter();
  const { player, refreshGameState } = useGameContext();
  const [technologies, setTechnologies] = useState<Technology[]>(TECHNOLOGIES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setTechnologies(prev =>
          prev.map(tech =>
            tech.id === techId ? { ...tech, researching: true } : tech
          )
        );
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

  const canResearch = (tech: Technology): boolean => {
    if (!player) return false;
    if (tech.unlocked || tech.researching) return false;
    if (player.resources.metal < tech.cost) return false;

    for (const prereqId of tech.prerequisites) {
      const prereq = technologies.find(t => t.id === prereqId);
      if (!prereq?.unlocked) return false;
    }

    return true;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      movement: 'cyan',
      combat: 'red',
      economy: 'yellow',
      special: 'purple',
    };
    return colors[category] || 'gray';
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-[--void] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/70 mb-4">Loading player data...</p>
          {!embedded && (
            <button
              onClick={() => router.push('/game')}
              className="bg-[--electric] hover:opacity-80 text-white font-bold py-2 px-4 rounded"
            >
              Return to Game
            </button>
          )}
        </div>
      </div>
    );
  }

  const categoryStyles: Record<string, { bg: string; border: string; text: string }> = {
    movement: { bg: 'bg-[--electric]/10', border: 'border-[--electric]/20', text: 'text-[--electric]' },
    combat: { bg: 'bg-[--neon-red]/10', border: 'border-[--neon-red]/20', text: 'text-[--neon-red]' },
    economy: { bg: 'bg-[--neon-yellow]/10', border: 'border-[--neon-yellow]/20', text: 'text-[--neon-yellow]' },
    special: { bg: 'bg-[--neon-pink]/10', border: 'border-[--neon-pink]/20', text: 'text-[--neon-pink]' },
  };

  const renderTechTreeContent = () => (
    <div className="bg-[--card] rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
      <div className="bg-[--void] border-b border-[--border] p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-[--electric]" />
            <h1 className="text-3xl font-bold text-white">Technology Tree</h1>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-sm">Available Metal</p>
            <p className="text-2xl font-bold text-white/60">⚙️ {player.resources.metal.toLocaleString()}</p>
          </div>
        </div>

        {error && (
          <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-3 text-[--neon-red]">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technologies.map(tech => {
            const color = getCategoryColor(tech.category);
            const canStartResearch = canResearch(tech);
            const isLocked = tech.prerequisites.some(
              prereqId => !technologies.find(t => t.id === prereqId)?.unlocked
            );
            const styles = categoryStyles[tech.category] || categoryStyles.movement;

            return (
              <div
                key={tech.id}
                className={`bg-[--card] border-2 rounded-lg overflow-hidden transition-all ${
                  tech.unlocked
                    ? 'border-[--synth]/20'
                    : tech.researching
                    ? 'border-[--electric]/20'
                    : canStartResearch
                    ? `${styles.border} hover:opacity-80`
                    : 'border-[--border]'
                }`}
              >
                <div className={`${styles.bg} border-b ${styles.border} p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={styles.text}>{getIcon(tech.icon)}</div>
                    {tech.unlocked ? (
                      <div className="bg-[--synth]/15 border border-[--synth]/25 rounded-full p-2">
                        <Check className="w-5 h-5 text-[--synth]" />
                      </div>
                    ) : tech.researching ? (
                      <div className="bg-[--electric]/15 border border-[--electric]/25 rounded-full p-2">
                        <Clock className="w-5 h-5 text-[--electric] animate-spin" />
                      </div>
                    ) : isLocked ? (
                      <div className="bg-[--card] rounded-full p-2">
                        <Lock className="w-5 h-5 text-white/40" />
                      </div>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-bold text-white">{tech.name}</h3>
                  <p className="text-sm text-white/70 capitalize">{tech.category}</p>
                </div>

                <div className="p-4">
                  <p className="text-white/80 text-sm mb-4">{tech.description}</p>

                  <div className="space-y-2 mb-4">
                    {tech.effects.map((effect, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-[--synth] flex-shrink-0 mt-0.5" />
                        <span className="text-white/70">{effect}</span>
                      </div>
                    ))}
                  </div>

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
                                ? 'bg-[--synth]/15 text-[--synth] border border-[--synth]/25'
                                : 'bg-[--neon-red]/15 text-[--neon-red] border border-[--neon-red]/25'
                            }`}
                          >
                            {prereq?.name || prereqId}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-[--border]">
                    <div>
                      <p className="text-xs text-white/50">Cost</p>
                      <p className="text-lg font-bold text-[--neon-yellow]">{tech.cost.toLocaleString()}</p>
                    </div>
                    {tech.unlocked ? (
                      <span className="bg-[--synth]/15 text-[--synth] font-bold px-4 py-2 rounded border border-[--synth]/25">
                        Unlocked
                      </span>
                    ) : tech.researching ? (
                      <span className="bg-[--electric]/15 text-[--electric] font-bold px-4 py-2 rounded border border-[--electric]/25">
                        Researching...
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResearch(tech.id)}
                        disabled={!canStartResearch || isLoading}
                        className={`font-bold px-4 py-2 rounded transition-all ${
                          canStartResearch
                            ? `${styles.text} bg-[--card] border ${styles.border} hover:opacity-80`
                            : 'bg-[--card] text-white/40 cursor-not-allowed'
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

  if (embedded) {
    return renderTechTreeContent();
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            {renderTechTreeContent()}
          </div>
        }
      />
    </>
  );
}
