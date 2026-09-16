/**
 * @file components/WMDIntelligencePanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-tabchip/
 * nn-chip/nn-row token structure; spy/mission flow logic byte-preserved)
 * @updated 2026-09-16 (FID-20260916-011: sabotage view — target → victim preview →
 * fire flow over the pinned FID-20260916-007 seam; success/detection math imported
 * from the shared sabotageMath module, server refusals surfaced verbatim, no
 * client-side refusal pre-filtering)
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
import { Eye, Crosshair } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';
import { extractApiError } from '@/lib/apiClient';
import type { WMDSpyMissionCompletePayload } from '@/types/websocket';
import {
  sabotageSuccessChance,
  sabotageDetectionRisk,
  SABOTAGE_SKILL_FLOOR,
  type SabotageTargetType,
} from '@/lib/wmd/sabotageMath';

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

/** Sabotage-capable spy as the selector consumes it (subset of the spies GET payload). */
interface SabotageSpy {
  spyId: string;
  codename: string;
  status: string;
  skills: {
    stealth: number;
    hacking: number;
    sabotage: number;
    intelligence: number;
  };
}

/** Mirrors SabotageTargetOption from lib/wmd/sabotageTargets (route payload shape). */
interface SabotageTarget {
  targetType: SabotageTargetType;
  targetId: string;
  label: string;
  victimKind: 'PLAYER' | 'CLAN';
  victimId: string;
  victimUsername: string | null;
  protected: boolean;
  difficulty: number;
  detectionRisk: number;
}

interface SabotageTargetsPayload {
  success: boolean;
  missiles?: SabotageTarget[];
  batteries?: SabotageTarget[];
  research?: SabotageTarget[];
}

const SABOTAGE_TYPES: SabotageTargetType[] = ['MISSILE', 'DEFENSE_BATTERY', 'RESEARCH'];

export default function WMDIntelligencePanel() {
  const [spies, setSpies] = useState<Spy[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'spies' | 'missions' | 'sabotage'>('spies');
  const [selectedSpec, setSelectedSpec] = useState('SURVEILLANCE');
  const [targetId, setTargetId] = useState('');
  const { socket, isConnected } = useWebSocketContext();

  // FID-20260916-011: sabotage flow state
  const [sabSpies, setSabSpies] = useState<SabotageSpy[]>([]);
  const [sabSpyId, setSabSpyId] = useState('');
  const [sabType, setSabType] = useState<SabotageTargetType>('MISSILE');
  const [sabTargets, setSabTargets] = useState<Record<SabotageTargetType, SabotageTarget[]>>({
    MISSILE: [],
    DEFENSE_BATTERY: [],
    RESEARCH: [],
  });
  const [sabTargetId, setSabTargetId] = useState('');
  const [sabResult, setSabResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [firing, setFiring] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/wmd/intelligence?type=${view}`);
      const data = await res.json();
      if (data.success) {
        if (view === 'spies') setSpies(data.spies);
        else if (view === 'missions') setMissions(data.missions);
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

  // FID-20260916-011: the sabotage view polls no list — spies are fetched on
  // entry, targets on spy selection and after each fire.
  const fetchSabSpies = useCallback(async () => {
    try {
      const res = await fetch('/api/wmd/intelligence?type=spies');
      const data = await res.json();
      if (data.success) setSabSpies(data.spies);
    } catch (error) {
      console.error('Failed to fetch spies for sabotage:', error);
    }
  }, []);

  const fetchSabTargets = useCallback(async (spyId: string) => {
    try {
      const res = await fetch(`/api/wmd/intelligence?type=sabotage-targets&spyId=${encodeURIComponent(spyId)}`);
      const data: SabotageTargetsPayload = await res.json();
      if (data.success) {
        setSabTargets({
          MISSILE: data.missiles ?? [],
          DEFENSE_BATTERY: data.batteries ?? [],
          RESEARCH: data.research ?? [],
        });
      } else {
        showError(typeof data === 'object' ? 'Failed to enumerate sabotage targets' : 'Failed');
      }
    } catch (error) {
      console.error('Failed to fetch sabotage targets:', error);
    }
  }, []);

  useEffect(() => {
    if (view === 'sabotage') {
      fetchSabSpies();
    }
  }, [view, fetchSabSpies]);

  const selectSabSpy = (spyId: string) => {
    setSabSpyId(spyId);
    setSabTargetId('');
    setSabResult(null);
    fetchSabTargets(spyId);
  };

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

  // FID-20260916-011: fire the pinned seam. The server's message — success or
  // refusal — is surfaced verbatim; this UI never pre-filters refusals.
  const fireSabotage = async () => {
    if (!sabSpyId || !sabTargetId) {
      showError('Select a spy and a target first');
      return;
    }
    setFiring(true);
    setSabResult(null);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sabotage',
          spyId: sabSpyId,
          targetType: sabType,
          targetId: sabTargetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Sabotage operation executed');
        setSabResult({ ok: true, message: data.message });
      } else {
        const message = typeof data.error === 'string' ? data.error : extractApiError(data, res.status);
        showError(message);
        setSabResult({ ok: false, message });
      }
      // The spy may now be COMPROMISED and the target lists stale — refresh both.
      fetchSabSpies();
      fetchSabTargets(sabSpyId);
    } catch (error) {
      showError('Error executing sabotage');
      console.error('Error executing sabotage:', error);
    } finally {
      setFiring(false);
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

  // FID-20260916-011: presentational gate only — the server enforces the same
  // floor (and everything else) at fire time.
  const capableSabSpies = sabSpies.filter(
    s => s.status === 'AVAILABLE' && (s.skills?.sabotage ?? 0) >= SABOTAGE_SKILL_FLOOR
  );
  const selectedSabSpy = capableSabSpies.find(s => s.spyId === sabSpyId);
  const sabOptions = sabTargets[sabType];
  const selectedTarget = sabOptions.find(t => t.targetId === sabTargetId);

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
          <button
            onClick={() => setView('sabotage')}
            data-selected={view === 'sabotage'}
            className={`nn-ptab ${view === 'sabotage' ? 'on' : ''}`}
          >
            Sabotage
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

      {/* Sabotage View — FID-20260916-011: target → victim preview → fire */}
      {view === 'sabotage' && (
        <div className="space-y-4">
          {/* Step 1 — operator */}
          <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
            <div className="nn-panel__header">
              <span className="nn-panel__title">1 · Operator</span>
              <span className="nn-panel__meta">sabotage ≥ {SABOTAGE_SKILL_FLOOR}</span>
            </div>
            <div className="nn-panel__body flex flex-wrap gap-2">
              {capableSabSpies.map((spy) => (
                <button
                  key={spy.spyId}
                  onClick={() => selectSabSpy(spy.spyId)}
                  data-selected={sabSpyId === spy.spyId}
                  className={`nn-tabchip ${sabSpyId === spy.spyId ? 'nn-tabchip--on' : ''}`}
                >
                  {spy.codename} · sab {spy.skills.sabotage} / stl {spy.skills.stealth}
                </button>
              ))}
              {capableSabSpies.length === 0 && (
                <p className="nn-lab">No sabotage-capable spies available (skill ≥ {SABOTAGE_SKILL_FLOOR})</p>
              )}
            </div>
          </div>

          {/* Step 2 — target */}
          {sabSpyId && (
            <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
              <div className="nn-panel__header">
                <span className="nn-panel__title">2 · Target</span>
                <span className="nn-panel__meta">{sabType.toLowerCase()}</span>
              </div>
              <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex flex-wrap gap-2">
                  {SABOTAGE_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setSabType(t); setSabTargetId(''); }}
                      data-selected={sabType === t}
                      className={`nn-tabchip ${sabType === t ? 'nn-tabchip--on' : ''}`}
                    >
                      {t.toLowerCase().replace('_', ' ')} ({sabTargets[t].length})
                    </button>
                  ))}
                </div>
                <select
                  value={sabTargetId}
                  onChange={(e) => setSabTargetId(e.target.value)}
                  className="nn-input w-full"
                >
                  <option value="">Select target…</option>
                  {sabOptions.map((t) => (
                    <option key={t.targetId} value={t.targetId}>
                      {t.label} — victim: {t.victimUsername ?? t.victimId}{t.protected ? ' [PROTECTED]' : ''}
                    </option>
                  ))}
                </select>
                {sabOptions.length === 0 && (
                  <p className="nn-lab">No {sabType.toLowerCase().replace('_', ' ')} targets listed</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — preview + fire */}
          {selectedTarget && selectedSabSpy && (
            <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
              <div className="nn-panel__header">
                <span className="nn-panel__title">3 · Preview &amp; Fire</span>
                <span className="nn-panel__meta">{selectedTarget.targetType.toLowerCase()}</span>
              </div>
              <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="flex justify-between">
                  <span className="nn-lab">Victim ({selectedTarget.victimKind.toLowerCase()})</span>
                  <span style={{ fontSize: 12 }}>{selectedTarget.victimUsername ?? selectedTarget.victimId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="nn-lab">Protection</span>
                  {selectedTarget.protected ? (
                    <span className="nn-chip nn-chip--magenta" style={{ fontSize: 12 }}>SHIELDED — fire will be refused</span>
                  ) : (
                    <span className="nn-chip nn-chip--green" style={{ fontSize: 12 }}>none</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="nn-lab">Success chance</span>
                  <span className="nn-num nn-text-green" style={{ fontSize: 12 }}>
                    {Math.round(sabotageSuccessChance(selectedSabSpy.skills.sabotage, selectedTarget.targetType) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="nn-lab">Detection risk</span>
                  <span className="nn-num nn-text-magenta" style={{ fontSize: 12 }}>
                    {Math.round(sabotageDetectionRisk(selectedSabSpy.skills.stealth, selectedTarget.targetType) * 100)}%
                  </span>
                </div>
                <p className="nn-footnote" style={{ marginTop: 6 }}>
                  Firing commits the operation and voids your remaining new-player protection window — regardless of the outcome.
                </p>
                <button
                  onClick={fireSabotage}
                  disabled={firing}
                  className="nn-abtn nn-abtn--magenta w-full"
                  style={{ marginTop: 6 }}
                >
                  <Crosshair className="h-4 w-4 mr-1" />
                  {firing ? 'Executing…' : 'Execute Sabotage'}
                </button>
              </div>
            </div>
          )}

          {/* Result — server message surfaced verbatim (success or refusal) */}
          {sabResult && (
            <div className="nn-panel" style={{ '--nn-accent': sabResult.ok ? 'var(--nn-green)' : 'var(--nn-magenta)' } as React.CSSProperties}>
              <div className="nn-panel__header">
                <span className="nn-panel__title">{sabResult.ok ? 'Operation result' : 'Refused'}</span>
              </div>
              <div className="nn-panel__body">
                <p className={sabResult.ok ? 'nn-text-green' : 'nn-text-magenta'} style={{ fontSize: 12 }}>
                  {sabResult.message}
                </p>
              </div>
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
