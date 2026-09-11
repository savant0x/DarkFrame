/**
 * @file components/WMDIntelligencePanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-tabchip/
 * nn-chip/nn-row token structure; spy/mission flow logic byte-preserved)
 * @overview WMD Spy Network & Intelligence Operations Panel
 *
 * OVERVIEW:
 * Manage spy network, launch intelligence missions, execute sabotage,
 * and track mission results. Includes spy recruitment, training, and
 * counter-intelligence operations.
 *
 * Dependencies: /api/wmd/intelligence, /types/wmd/intelligence.types
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';
import { extractApiError } from '@/lib/apiClient';
import type { WMDSpyMissionCompletePayload } from '@/types/websocket';

interface Spy {
  spyId: string;
  codename: string;
  rank: string;
  specialization: string;
  status: string;
  experience: number;
  missionHistory: string[];
}

interface Mission {
  missionId: string;
  spyId: string;
  missionType: string;
  targetId: string;
  status: string;
  startedAt: Date;
  completesAt?: Date;
}

export default function WMDIntelligencePanel() {
  const [spies, setSpies] = useState<Spy[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'spies' | 'missions'>('spies');
  const [selectedSpec, setSelectedSpec] = useState('SURVEILLANCE');
  const [targetId, setTargetId] = useState('');
  const { socket, isConnected } = useWebSocketContext();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/wmd/intelligence?type=${view}`);
      const data = await res.json();
      if (data.success) {
        if (view === 'spies') setSpies(data.spies);
        else setMissions(data.missions);
      }
    } catch (error) {
      console.error('Failed to fetch intelligence data:', error);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [view, fetchData]);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMissionComplete = (payload: WMDSpyMissionCompletePayload) => {
      showInfo(`Mission ${payload.success ? 'complete' : 'failed'}: ${payload.missionType}`);
      fetchData();
    };

    socket.on('wmd:spy_mission_complete', handleMissionComplete);

    return () => {
      socket.off('wmd:spy_mission_complete', handleMissionComplete);
    };
  }, [socket, isConnected, fetchData]);

  const recruitSpy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recruit', specialization: selectedSpec }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Recruited ${selectedSpec} spy!`);
        await fetchData();
      } else {
        showError(extractApiError(data, res.status));
      }
    } catch (error) {
      showError('Error recruiting spy');
      console.error('Error recruiting spy:', error);
    } finally {
      setLoading(false);
    }
  };

  const startMission = async (spyId: string, missionType: string) => {
    if (!targetId.trim()) {
      showError('Please enter a target player username');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mission',
          spyId,
          missionType,
          targetId: targetId.trim()
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Mission started: ${missionType}`);
        setTargetId('');
        await fetchData();
      } else {
        showError(extractApiError(data, res.status));
      }
    } catch (error) {
      showError('Error starting mission');
      console.error('Error starting mission:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCounterIntel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'counterIntel' }),
      });
      const data = await res.json();
      if (data.success) {
        showInfo(`Counter-Intel: ${data.threatsDetected} threats, ${data.spiesDetected.length} spies detected`);
      } else {
        showError(extractApiError(data, res.status));
      }
    } catch (error) {
      showError('Error running counter-intel');
      console.error('Error running counter-intel:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'nn-chip nn-chip--green';
      case 'ON_MISSION': return 'nn-chip nn-chip--cyan';
      case 'COMPROMISED': return 'nn-chip nn-chip--magenta';
      case 'RETIRED': return 'nn-chip';
      default: return 'nn-chip';
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading intelligence data…</p>
      </div>
    );
  }

  const availableSpies = spies.filter(s => s.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument */}
      <div className="nn-sec nn-sec--magenta">
        <span className="nn-panel__icon"><Eye className="h-4 w-4" /></span>
        <span className="nn-sec__title">Intelligence Network</span>
        <span className="nn-sec__note nn-num">{spies.length} spies · {availableSpies} available</span>
        <div className="ml-auto flex gap-0">
          <button
            onClick={() => setView('spies')}
            data-selected={view === 'spies'}
            className={`nn-ptab ${view === 'spies' ? 'on' : ''}`}
          >
            Spies
          </button>
          <button
            onClick={() => setView('missions')}
            data-selected={view === 'missions'}
            className={`nn-ptab ${view === 'missions' ? 'on' : ''}`}
          >
            Missions
          </button>
        </div>
        <button onClick={runCounterIntel} className="nn-abtn nn-abtn--amber">
          Counter-Intel
        </button>
      </div>

      {/* Spies View */}
      {view === 'spies' && (
        <>
          {/* Recruitment — panel with spec tabchips */}
          <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
            <div className="nn-panel__header">
              <span className="nn-panel__title">Recruit Spy</span>
              <span className="nn-panel__meta">{selectedSpec}</span>
              <button onClick={recruitSpy} className="nn-abtn nn-abtn--violet ml-auto">+ Recruit</button>
            </div>
            <div className="nn-panel__body flex flex-wrap gap-2">
              {['SURVEILLANCE', 'SABOTAGE', 'INFILTRATION', 'CYBER'].map(spec => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpec(spec)}
                  data-selected={selectedSpec === spec}
                  className={`nn-tabchip ${selectedSpec === spec ? 'nn-tabchip--on' : ''}`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>

          {/* Spy Roster — HUD panels with ledger rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spies.map((spy) => (
              <div
                key={spy.spyId}
                className="nn-panel"
                style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}
              >
                <div className="nn-panel__header">
                  <span className="nn-panel__title">{spy.codename}</span>
                  <span className="nn-panel__meta">{spy.rank}</span>
                  <span className={`nn-chip ${getStatusChip(spy.status)} nn-panel__meta`}>{spy.status}</span>
                </div>

                <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="flex justify-between">
                    <span className="nn-lab">Specialization</span>
                    <span className="nn-text-violet" style={{ fontSize: 12 }}>{spy.specialization}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="nn-lab">Experience</span>
                    <span className="nn-num nn-text-green" style={{ fontSize: 12 }}>{spy.experience} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="nn-lab">Missions</span>
                    <span className="nn-num nn-text-cyan" style={{ fontSize: 12 }}>{spy.missionHistory.length}</span>
                  </div>

                  {spy.status === 'AVAILABLE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                      <input
                        placeholder="Target username…"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="nn-input w-full"
                      />
                      <button
                        onClick={() => startMission(spy.spyId, 'RECONNAISSANCE')}
                        className="nn-abtn nn-abtn--violet w-full"
                      >
                        Start Mission
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Missions View — ledger panels */}
      {view === 'missions' && (
        <div className="space-y-4">
          {missions.map((mission) => (
            <div
              key={mission.missionId}
              className="nn-panel"
              style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}
            >
              <div className="nn-panel__header">
                <span className="nn-panel__title">{mission.missionType}</span>
                <span className="nn-panel__meta">Target ▸ {mission.targetId}</span>
                <span className={`nn-chip ${mission.status === 'ACTIVE' ? 'nn-chip--cyan' : ''} nn-panel__meta`}>
                  {mission.status}
                </span>
              </div>
            </div>
          ))}
          {missions.length === 0 && (
            <div className="text-center py-12">
              <p className="nn-lab">No active missions</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {view === 'spies' && spies.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No spies in network</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>Recruit your first spy to begin operations</p>
        </div>
      )}
    </div>
  );
}
