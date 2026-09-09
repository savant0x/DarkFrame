/**
 * @file components/WMDDefensePanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-ptab/
 * nn-chip/nn-meter token structure; defense flow logic byte-preserved)
 * @overview WMD Defense Battery Management Panel
 *
 * OVERVIEW:
 * Defense system management for missile interception. Deploy batteries,
 * monitor health, repair damaged units, and track interception success rates.
 *
 * Dependencies: /api/wmd/defense, /types/wmd/defense.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import type { InterceptionSuccessBroadcast } from '@/types/wmd';

interface DefenseBattery {
  batteryId: string;
  ownerId: string;
  batteryType: string;
  tier: number;
  status: string;
  interceptChance: number;
  successfulIntercepts: number;
  failedIntercepts: number;
  totalAttempts: number;
  health: number;
  repairing: boolean;
  createdAt: Date;
}

export default function WMDDefensePanel() {
  const [batteries, setBatteries] = useState<DefenseBattery[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [selectedType, setSelectedType] = useState('BASIC');
  const { socket, isConnected } = useWebSocketContext();

  useEffect(() => {
    fetchBatteries();
    const interval = setInterval(fetchBatteries, 15000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleInterceptionSuccess = (payload: InterceptionSuccessBroadcast) => {
      // The server payload identifies the launcher, not the battery — say so,
      // instead of rendering "Battery undefined intercepted …".
      showSuccess(`Intercepted incoming missile from ${payload.launcherName}!`);
      fetchBatteries();
    };

    socket.on('wmd:interception_success', handleInterceptionSuccess);

    return () => {
      socket.off('wmd:interception_success', handleInterceptionSuccess);
    };
  }, [socket, isConnected]);

  const fetchBatteries = async () => {
    try {
      const res = await fetch('/api/wmd/defense');
      const data = await res.json();
      if (data.success) {
        setBatteries(data.batteries);
      }
    } catch (error) {
      console.error('Failed to fetch batteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const deployBattery = async () => {
    setDeploying(true);
    try {
      const res = await fetch('/api/wmd/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy', batteryType: selectedType }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Deployed ${selectedType} defense battery!`);
        await fetchBatteries();
      } else {
        showError(data.error || 'Failed to deploy battery');
      }
    } catch (error) {
      showError('Error deploying battery');
      console.error('Error deploying battery:', error);
    } finally {
      setDeploying(false);
    }
  };

  const repairBattery = async (batteryId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair', batteryId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Battery repair started!');
        await fetchBatteries();
      } else {
        showError(data.error || 'Failed to repair battery');
      }
    } catch (error) {
      showError('Error repairing battery');
      console.error('Error repairing battery:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismantleBattery = async (batteryId: string) => {
    if (!(await confirmDialog('Dismantle this battery? This cannot be undone.'))) return;

    const res = await fetch(`/api/wmd/defense?batteryId=${batteryId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      await fetchBatteries();
    } else {
      showError(data.error || 'Failed to dismantle battery');
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'IDLE': return 'nn-chip nn-chip--green';
      case 'ACTIVE': return 'nn-chip nn-chip--cyan';
      case 'COOLDOWN': return 'nn-chip nn-chip--amber';
      case 'DAMAGED': return 'nn-chip nn-chip--magenta';
      case 'UPGRADING': return 'nn-chip nn-chip--violet';
      default: return 'nn-chip';
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'var(--nn-green)';
    if (health >= 50) return 'var(--nn-amber)';
    if (health >= 25) return 'var(--nn-amber)';
    return 'var(--nn-magenta)';
  };

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading defense systems…</p>
      </div>
    );
  }

  const activeBatteries = batteries.filter(b => b.status === 'IDLE' || b.status === 'ACTIVE').length;
  const totalIntercepts = batteries.reduce((sum, b) => sum + b.successfulIntercepts, 0);

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument */}
      <div className="nn-sec">
        <span className="nn-panel__icon"><Shield className="h-4 w-4" /></span>
        <span className="nn-sec__title">Defense Systems</span>
        <span className="nn-sec__note nn-num">{activeBatteries}/{batteries.length} active · {totalIntercepts} intercepts</span>
        <button
          onClick={deployBattery}
          disabled={deploying}
          className="nn-abtn nn-abtn--cyan ml-auto"
        >
          {deploying ? 'Deploying…' : '+ Deploy Battery'}
        </button>
      </div>

      {/* Battery Type Selection — text-rule tabs */}
      <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
        <div className="nn-panel__header">
          <span className="nn-panel__title">Battery Type</span>
          <span className="nn-panel__meta">{selectedType}</span>
        </div>
        <div className="nn-panel__body grid grid-cols-5 gap-0">
          {['BASIC', 'ADVANCED', 'ELITE', 'FORTRESS', 'AEGIS'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              data-selected={selectedType === type}
              className={`nn-ptab ${selectedType === type ? 'on' : ''}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Battery Grid — HUD panels with health meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batteries.map((battery) => (
          <div
            key={battery.batteryId}
            className="nn-panel"
            style={{ '--nn-accent': battery.status === 'DAMAGED' ? 'var(--nn-magenta)' : 'var(--nn-cyan)' } as React.CSSProperties}
          >
            <div className="nn-panel__header">
              <span className="nn-panel__title">{battery.batteryType}</span>
              <span className="nn-panel__meta nn-num">TIER {battery.tier}</span>
              <span className={`nn-chip ${getStatusChip(battery.status)} nn-panel__meta`}>{battery.status}</span>
            </div>

            <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Health — meter with semantic fill */}
              <div className="nn-meter" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
                <div style={{ width: `${battery.health}%`, height: '100%', background: getHealthColor(battery.health) }} />
              </div>

              {/* Stats — ledger rows with HUD numerals */}
              <div className="flex justify-between">
                <span className="nn-lab">Intercept Chance</span>
                <span className="nn-num nn-text-green" style={{ fontSize: 12 }}>{(battery.interceptChance * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="nn-lab">Health</span>
                <span className="nn-num" style={{ fontSize: 12, color: getHealthColor(battery.health) }}>{battery.health}%</span>
              </div>
              <div className="flex justify-between">
                <span className="nn-lab">Success Rate</span>
                <span className="nn-num nn-text-cyan" style={{ fontSize: 12 }}>
                  {battery.totalAttempts > 0
                    ? `${Math.round((battery.successfulIntercepts / battery.totalAttempts) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="nn-lab" style={{ fontSize: 9.5 }}>Record</span>
                <span className="nn-num nn-text-dim" style={{ fontSize: 10 }}>
                  ✓ {battery.successfulIntercepts} / ✗ {battery.failedIntercepts}
                </span>
              </div>

              {/* Actions — destructive path magenta only */}
              <div className="flex gap-2" style={{ marginTop: 4 }}>
                {battery.health < 100 && !battery.repairing && (
                  <button
                    onClick={() => repairBattery(battery.batteryId)}
                    className="nn-abtn nn-abtn--green flex-1"
                  >
                    Repair
                  </button>
                )}
                {battery.repairing && (
                  <div className="flex-1 text-center">
                    <span className="nn-lab nn-text-amber">Repairing…</span>
                  </div>
                )}
                <button
                  onClick={() => dismantleBattery(battery.batteryId)}
                  className="nn-abtn nn-abtn--magenta"
                >
                  Dismantle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {batteries.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No defense batteries deployed</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>Deploy your first battery for protection</p>
        </div>
      )}
    </div>
  );
}
