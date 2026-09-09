/**
 * @file components/WMDResearchPanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-ptab/
 * nn-chip/nn-num token structure; research flow logic byte-preserved)
 * @overview WMD Research Tech Tree Panel
 *
 * OVERVIEW:
 * Interactive research panel for WMD tech progression. Displays 3 parallel
 * research tracks (Missile, Defense, Intelligence). Shows available techs,
 * current research, and RP spending options.
 *
 * Dependencies: /api/wmd/research, /types/wmd, researchPointService
 */

'use client';

import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { useGameContext } from '@/context/GameContext';
import { showSuccess, showError } from '@/lib/toastService';
import type { WMDResearchCompletePayload } from '@/types/websocket';
import type { ResearchTech } from '@/types/wmd';

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
    const handleResearchComplete = (payload: WMDResearchCompletePayload) => {
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
        // Flatten tech tree into array — ResearchTech is the declared tree-node
        // shape (types/wmd/research.types.ts); category maps onto the panel's
        // track union and `unlocks` is carried as-is.
        const allTechs: Tech[] = [];
        Object.values(data.tree as Record<string, ResearchTech[]>).forEach((categoryTechs) => {
          categoryTechs.forEach((tech) => {
            allTechs.push({
              id: tech.techId,
              name: tech.name,
              description: tech.description,
              track: tech.category as Tech['track'],
              tier: tech.tier || 1,
              rpCost: tech.rpCost,
              researchTime: 0,
              prerequisites: tech.prerequisites || [],
              unlocks: [],
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

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading research data…</p>
      </div>
    );
  }

  const trackAccent = (track: 'MISSILE' | 'DEFENSE' | 'INTELLIGENCE') =>
    track === 'MISSILE' ? 'var(--nn-amber)' : track === 'DEFENSE' ? 'var(--nn-cyan)' : 'var(--nn-violet)';

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument with RP readout */}
      <div className="nn-sec">
        <span className="nn-panel__icon"><FlaskConical className="h-4 w-4" /></span>
        <span className="nn-sec__title">WMD Research</span>
        <span className="nn-sec__note">Unlock advanced warfare technologies</span>
        <div className="ml-auto text-right">
          <div className="nn-num nn-text-green text-xl font-bold">{player?.researchPoints?.toLocaleString() || 0} RP</div>
          {research && research.clanResearchBonus > 0 && (
            <span className="nn-chip nn-chip--cyan" style={{ marginTop: 2 }}>+{research.clanResearchBonus}% Clan Bonus</span>
          )}
        </div>
      </div>

      {/* Current Research — panel with countdown */}
      {research?.currentResearch && (
        <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
          <div className="nn-panel__header">
            <span className="nn-panel__title">Research In Progress</span>
            <span className="nn-panel__meta nn-num">{research.currentResearch.techId}</span>
            <span className="nn-panel__meta nn-num nn-text-cyan" style={{ marginLeft: 'auto' }}>{getTimeRemaining()}</span>
          </div>
        </div>
      )}

      {/* Track Filter — text-rule tabs (never filled slabs) */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'color-mix(in oklab, var(--nn-cyan) 12%, transparent)' }}>
        {([
          ['ALL', 'All Tracks'],
          ['MISSILE', `Missiles (${research?.missileTier || 0})`],
          ['DEFENSE', `Defense (${research?.defenseTier || 0})`],
          ['INTELLIGENCE', `Intel (${research?.intelligenceTier || 0})`],
        ] as const).map(([track, label]) => (
          <button
            key={track}
            onClick={() => setSelectedTrack(track)}
            data-selected={selectedTrack === track}
            className={`nn-tab px-5 ${selectedTrack === track ? 'nn-tab--on' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tech Grid — HUD panels, status via accent signal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {research?.availableTechs?.slice(0, 9).map((techId) => {
          const isCompleted = research.completedTechs.includes(techId);
          const isAvailable = research.availableTechs.includes(techId);
          const isResearching = research.currentResearch?.techId === techId;
          const tech = techs.find(t => t.id === techId);
          const accent = isCompleted
            ? 'var(--nn-green)'
            : isResearching
            ? 'var(--nn-cyan)'
            : tech
            ? trackAccent(tech.track)
            : 'var(--nn-cyan)';

          return (
            <div
              key={techId}
              className={`nn-panel ${!isCompleted && !isResearching && !isAvailable ? 'opacity-50' : ''}`}
              style={{ '--nn-accent': accent } as React.CSSProperties}
            >
              <div className="nn-panel__header">
                <span className="nn-panel__title nn-num" style={{ fontSize: 10 }}>{techId}</span>
                {isCompleted && (
                  <span className="nn-chip nn-chip--green nn-panel__meta">✓ Complete</span>
                )}
              </div>
              <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)', margin: 0 }}>
                  {tech?.description || 'Advanced technology unlock'}
                </p>
                <div className="flex justify-between items-center">
                  <span className="nn-lab">Cost ▸ {tech ? `${tech.rpCost.toLocaleString()} RP` : 'varies'}</span>
                  {isAvailable && !isCompleted && !isResearching && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startResearch(techId)}
                        className="nn-abtn nn-abtn--cyan"
                      >
                        Research
                      </button>
                      <button
                        onClick={() => spendRP(techId)}
                        className="nn-abtn nn-abtn--amber"
                      >
                        Instant RP
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {research && research.availableTechs?.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">All research complete!</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>You&apos;ve unlocked all WMD technologies</p>
        </div>
      )}
    </div>
  );
}
