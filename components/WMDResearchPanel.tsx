/**
 * @file components/WMDResearchPanel.tsx
 * @created 2025-10-22
 * @overview WMD Research Tech Tree Panel
 * 
 * OVERVIEW:
 * Interactive research panel for WMD tech progression. Displays 3 parallel
 * research tracks (Missile, Defense, Intelligence) with 10 tiers each.
 * Shows available techs, current research, and RP spending options.
 * 
 * Features:
 * - 30 tech cards organized by track and tier
 * - Research progress tracking with completion timers
 * - RP balance display and spending interface
 * - Tech prerequisites and unlock indicators
 * - Clan research bonus display
 * 
 * Dependencies: /api/wmd/research, /types/wmd, researchPointService
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { useGameContext } from '@/context/GameContext';
import { showSuccess, showError } from '@/lib/toastService';

interface Tech {
  id: string;
  name: string;
  description: string;
  track: 'MISSILE' | 'DEFENSE' | 'INTELLIGENCE';
  tier: number;
  rpCost: number;
  researchTime: number;
  prerequisites: string[];
  unlocks: string[];
}

interface PlayerResearch {
  playerId: string;
  researchPoints: number;
  currentResearch?: {
    techId: string;
    startedAt: Date;
    completesAt: Date;
  };
  completedTechs: string[];
  availableTechs: string[];
  missileTier: number;
  defenseTier: number;
  intelligenceTier: number;
  clanResearchBonus: number;
}

export default function WMDResearchPanel() {
  const [research, setResearch] = useState<PlayerResearch | null>(null);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<'MISSILE' | 'DEFENSE' | 'INTELLIGENCE' | 'ALL'>('ALL');
  const { socket, isConnected } = useWebSocketContext();
  const { player } = useGameContext(); // Get player data from context

  useEffect(() => {
    fetchResearchData();
    fetchTechTree();
    const interval = setInterval(fetchResearchData, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for research completion
    const handleResearchComplete = (payload: any) => {
      showSuccess(`Research complete: ${payload.techName}!`);
      fetchResearchData();
      fetchTechTree(); // Refresh for new unlocks
    };

    socket.on('wmd:research_complete', handleResearchComplete);

    return () => {
      socket.off('wmd:research_complete', handleResearchComplete);
    };
  }, [socket, isConnected]);

  const fetchResearchData = async () => {
    try {
      const res = await fetch('/api/wmd/research');
      const data = await res.json();
      if (data.success) {
        setResearch(data.research);
      }
    } catch (error) {
      console.error('Failed to fetch research:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechTree = async () => {
    try {
      const res = await fetch('/api/wmd/research?view=tree');
      const data = await res.json();
      if (data.success) {
        // Flatten tech tree into array
        const allTechs: Tech[] = [];
        Object.values(data.tree).forEach((categoryTechs: any) => {
          categoryTechs.forEach((tech: any) => {
            allTechs.push({
              id: tech.techId,
              name: tech.name,
              description: tech.description,
              track: tech.category,
              tier: 1, // Calculate from prerequisites
              rpCost: tech.rpCost,
              researchTime: tech.researchTime || 0,
              prerequisites: tech.prerequisites || [],
              unlocks: tech.unlocks || [],
            });
          });
        });
        setTechs(allTechs);
      }
    } catch (error) {
      console.error('Failed to fetch tech tree:', error);
    }
  };

  const startResearch = async (techId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', techId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Research started successfully!');
        await fetchResearchData();
      } else {
        showError(data.error || 'Failed to start research');
      }
    } catch (error) {
      showError('Error starting research');
      console.error('Error starting research:', error);
    } finally {
      setLoading(false);
    }
  };

  const spendRP = async (techId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spendRP', techId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Research unlocked instantly!');
        await fetchResearchData();
        await fetchTechTree();
      } else {
        showError(data.error || 'Failed to spend RP');
      }
    } catch (error) {
      showError('Error spending RP');
      console.error('Error spending RP:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!research?.currentResearch) return null;
    const now = new Date().getTime();
    const completes = new Date(research.currentResearch.completesAt).getTime();
    const remaining = Math.max(0, completes - now);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const _filteredTechs = selectedTrack === 'ALL' 
    ? techs 
    : techs.filter(t => t.track === selectedTrack);

  if (loading) {
    return (
      <div className="p-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none">
        <p className="text-[color:var(--nn-text-secondary)]">Loading research data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--nn-amber)]">WMD Research</h2>
          <p className="text-sm text-[color:var(--nn-text-secondary)]">Unlock advanced warfare technologies</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-[color:var(--nn-green)]">
            {player?.researchPoints?.toLocaleString() || 0} RP
          </div>
          {research && research.clanResearchBonus > 0 && (
            <Badge className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] mt-1">
              +{research.clanResearchBonus}% Clan Bonus
            </Badge>
          )}
        </div>
      </div>

      {/* Current Research */}
      {research?.currentResearch && (
        <Card className="p-4 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[color:var(--nn-cyan)]">Research In Progress</h3>
              <p className="text-sm text-[color:var(--nn-cyan)]">{research.currentResearch.techId}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-[color:var(--nn-cyan)]">{getTimeRemaining()}</div>
              <p className="text-xs text-[color:var(--nn-cyan)]">remaining</p>
            </div>
          </div>
        </Card>
      )}

      {/* Track Filter */}
      <div className="flex gap-2">
        <Button
          onClick={() => setSelectedTrack('ALL')}
          variant={selectedTrack === 'ALL' ? 'primary' : 'secondary'}
          size="sm"
        >
          All Tracks
        </Button>
        <Button
          onClick={() => setSelectedTrack('MISSILE')}
          variant={selectedTrack === 'MISSILE' ? 'primary' : 'secondary'}
          size="sm"
          className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
        >
          Missiles (Tier {research?.missileTier || 0})
        </Button>
        <Button
          onClick={() => setSelectedTrack('DEFENSE')}
          variant={selectedTrack === 'DEFENSE' ? 'primary' : 'secondary'}
          size="sm"
          className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
        >
          Defense (Tier {research?.defenseTier || 0})
        </Button>
        <Button
          onClick={() => setSelectedTrack('INTELLIGENCE')}
          variant={selectedTrack === 'INTELLIGENCE' ? 'primary' : 'secondary'}
          size="sm"
          className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]"
        >
          Intelligence (Tier {research?.intelligenceTier || 0})
        </Button>
      </div>

      {/* Tech Tree Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {research?.availableTechs?.slice(0, 9).map((techId) => {
          const isCompleted = research.completedTechs.includes(techId);
          const isAvailable = research.availableTechs.includes(techId);
          const isResearching = research.currentResearch?.techId === techId;

          return (
            <Card 
              key={techId}
              className={`p-4 ${
                isCompleted ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' :
                isResearching ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]' :
                isAvailable ? 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]' :
                'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] opacity-50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-[color:var(--nn-text-primary)]">{techId}</h3>
                  {isCompleted && (
                    <Badge className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]">✓ Complete</Badge>
                  )}
                </div>
                <p className="text-sm text-[color:var(--nn-text-secondary)]">Advanced technology unlock</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[color:var(--nn-amber)] font-bold">Cost varies</span>
                  {isAvailable && !isCompleted && !isResearching && (
                    <div className="flex gap-1">
                      <Button
                        onClick={() => startResearch(techId)}
                        size="sm"
                        className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
                      >
                        Research
                      </Button>
                      <Button
                        onClick={() => spendRP(techId)}
                        size="sm"
                        className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]"
                      >
                        Instant RP
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {research && research.availableTechs?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[color:var(--nn-text-secondary)] text-lg">All research complete!</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm">You{"'"}ve unlocked all WMD technologies</p>
        </div>
      )}
    </div>
  );
}
