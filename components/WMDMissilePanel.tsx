/**
 * @file components/WMDMissilePanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-ptab/
 * nn-chip/nn-abtn token structure; launch flow logic byte-preserved)
 * @overview WMD Missile Arsenal Management Panel
 *
 * OVERVIEW:
 * Missile creation, assembly, and launch interface. Shows player's missile
 * inventory with assembly progress, allows component installation, and
 * provides targeting interface for launches.
 *
 * Dependencies: /api/wmd/missiles, /types/wmd/missile.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';
import type { WMDMissileLaunchedPayload, WMDMissileInterceptedPayload } from '@/types/websocket';

interface Missile {
  missileId: string;
  ownerId: string;
  warheadType: string;
  status: string;
  components: {
    warhead: boolean;
    propulsion: boolean;
    guidance: boolean;
    payload: boolean;
    stealth: boolean;
  };
  createdAt: Date;
}

export default function WMDMissilePanel() {
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMissile, setSelectedMissile] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [creatingMissile, setCreatingMissile] = useState(false);
  const [selectedWarhead, setSelectedWarhead] = useState('TACTICAL');
  const { socket, isConnected } = useWebSocketContext();

  useEffect(() => {
    fetchMissiles();
  }, []);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Typed server payloads (types/websocket.ts): launch carries targetName;
    // the server distinguishes launcher vs target rooms at emit time and sends
    // a pre-composed message — the interceptor's own success event arrives via
    // wmd:interception_success, so here we relay the server's message verbatim.
    const handleMissileLaunched = (payload: WMDMissileLaunchedPayload) => {
      showInfo(`Missile launched targeting ${payload.targetName}`);
      fetchMissiles();
    };

    const handleMissileIntercepted = (payload: WMDMissileInterceptedPayload) => {
      if (payload.message) {
        showInfo(payload.message);
      } else {
        showSuccess('Missile interception event');
      }
      fetchMissiles();
    };

    socket.on('wmd:missile_launched', handleMissileLaunched);
    socket.on('wmd:missile_intercepted', handleMissileIntercepted);

    return () => {
      socket.off('wmd:missile_launched', handleMissileLaunched);
      socket.off('wmd:missile_intercepted', handleMissileIntercepted);
    };
  }, [socket, isConnected]);

  const fetchMissiles = async () => {
    try {
      const res = await fetch('/api/wmd/missiles');
      const data = await res.json();
      if (data.success) {
        setMissiles(data.missiles);
      }
    } catch (error) {
      console.error('Failed to fetch missiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMissile = async () => {
    setCreatingMissile(true);
    try {
      const res = await fetch('/api/wmd/missiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', warheadType: selectedWarhead }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Created ${selectedWarhead} missile!`);
        await fetchMissiles();
      } else {
        showError(data.error || 'Failed to create missile');
      }
    } catch (error) {
      showError('Error creating missile');
      console.error('Error creating missile:', error);
    } finally {
      setCreatingMissile(false);
    }
  };

  const assembleComponent = async (missileId: string, component: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/missiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assemble', missileId, component }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Assembled ${component} component!`);
        await fetchMissiles();
      } else {
        showError(data.error || 'Failed to assemble component');
      }
    } catch (error) {
      showError('Error assembling component');
      console.error('Error assembling component:', error);
    } finally {
      setLoading(false);
    }
  };

  const launchMissile = async (missileId: string) => {
    if (!targetId.trim()) {
      showError('Please enter a target player username');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wmd/missiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch', missileId, targetId: targetId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Missile launched at ${targetId}!`);
        setSelectedMissile(null);
        setTargetId('');
        await fetchMissiles();
      } else {
        showError(data.error || 'Failed to launch missile');
      }
    } catch (error) {
      showError('Error launching missile');
      console.error('Error launching missile:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismantleMissile = async (missileId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wmd/missiles?missileId=${missileId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Missile dismantled');
        await fetchMissiles();
      } else {
        showError(data.error || 'Failed to dismantle missile');
      }
    } catch (error) {
      showError('Error dismantling missile');
      console.error('Error dismantling missile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComponentProgress = (missile: Missile) => {
    const completed = Object.values(missile.components).filter(Boolean).length;
    return `${completed}/5`;
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'ASSEMBLING': return 'nn-chip nn-chip--amber';
      case 'READY': return 'nn-chip nn-chip--green';
      case 'LAUNCHED': return 'nn-chip nn-chip--cyan';
      default: return 'nn-chip';
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading missiles…</p>
      </div>
    );
  }

  const selectedMissileData = missiles.find(m => m.missileId === selectedMissile);

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument */}
      <div className="nn-sec nn-sec--magenta">
        <span className="nn-panel__icon"><Rocket className="h-4 w-4" /></span>
        <span className="nn-sec__title">Missile Arsenal</span>
        <span className="nn-sec__note">{missiles.length} missile{missiles.length !== 1 ? 's' : ''} in inventory</span>
        <button
          onClick={createMissile}
          disabled={creatingMissile}
          className="nn-abtn nn-abtn--magenta ml-auto"
        >
          {creatingMissile ? 'Creating…' : '+ New Missile'}
        </button>
      </div>

      {/* Warhead Selection — text-rule tabs */}
      <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
        <div className="nn-panel__header">
          <span className="nn-panel__title">Warhead Type</span>
          <span className="nn-panel__meta">{selectedWarhead.replace('_', ' ')}</span>
        </div>
        <div className="nn-panel__body grid grid-cols-5 gap-0">
          {['TACTICAL', 'STRATEGIC', 'BUNKER_BUSTER', 'EMP', 'CLAN_BUSTER'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedWarhead(type)}
              data-selected={selectedWarhead === type}
              className={`nn-ptab ${selectedWarhead === type ? 'on' : ''}`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Missile Inventory — HUD unit cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {missiles.map((missile) => (
          <div
            key={missile.missileId}
            className="nn-panel"
            style={{ '--nn-accent': missile.status === 'READY' ? 'var(--nn-green)' : missile.status === 'LAUNCHED' ? 'var(--nn-cyan)' : 'var(--nn-amber)' } as React.CSSProperties}
          >
            <div className="nn-panel__header">
              <span className="nn-panel__title">{missile.warheadType.replace('_', ' ')}</span>
              <span className="nn-panel__meta nn-num">ID ▸ {missile.missileId.slice(-8)}</span>
              <span className={`nn-chip ${getStatusChip(missile.status)} nn-panel__meta`}>{missile.status}</span>
            </div>

            <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Component Progress — meter + install buttons */}
              {missile.status === 'ASSEMBLING' && (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span className="nn-lab">Assembly Progress</span>
                    <span className="nn-num nn-text-amber" style={{ fontSize: 12 }}>{getComponentProgress(missile)}</span>
                  </div>
                  <div className="nn-meter" style={{ marginBottom: 8, '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
                    <div style={{ width: `${(Object.values(missile.components).filter(Boolean).length / 5) * 100}%`, height: '100%', background: 'var(--nn-amber)' }} />
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.entries(missile.components).map(([comp, installed]) => (
                      <button
                        key={comp}
                        onClick={() => assembleComponent(missile.missileId, comp)}
                        disabled={installed}
                        className={installed ? 'nn-chip nn-chip--green' : 'nn-chip'}
                        style={{ cursor: installed ? 'default' : 'pointer', textAlign: 'center' }}
                      >
                        {comp.slice(0, 3).toUpperCase()}{installed ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions — destructive path magenta only */}
              <div className="flex gap-2">
                {missile.status === 'READY' && (
                  <button
                    onClick={() => setSelectedMissile(missile.missileId)}
                    className="nn-abtn nn-abtn--cyan flex-1"
                  >
                    Launch
                  </button>
                )}
                <button
                  onClick={() => dismantleMissile(missile.missileId)}
                  className="nn-abtn nn-abtn--magenta"
                >
                  Dismantle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Launch Interface — panel, void-glass wells, magenta destructive action */}
      {selectedMissileData && (
        <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
          <div className="nn-panel__header nn-panel__header--magenta">
            <span className="nn-panel__title">Launch Missile</span>
            <span className="nn-panel__meta">{selectedMissileData.warheadType.replace('_', ' ')}</span>
          </div>
          <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="nn-lab" style={{ display: 'block', marginBottom: 6 }}>Target Player Username</label>
              <input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Enter target username…"
                className="nn-input w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => launchMissile(selectedMissileData.missileId)}
                className="nn-abtn nn-abtn--magenta flex-1"
              >
                Launch Missile
              </button>
              <button
                onClick={() => setSelectedMissile(null)}
                className="nn-abtn nn-abtn--ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {missiles.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No missiles in arsenal</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>Create your first missile to begin</p>
        </div>
      )}
    </div>
  );
}
