/**
 * @file components/WMDMissilePanel.tsx
 * @created 2025-10-22
 * @overview WMD Missile Arsenal Management Panel
 * 
 * OVERVIEW:
 * Missile creation, assembly, and launch interface. Shows player's missile
 * inventory with assembly progress, allows component installation, and
 * provides targeting interface for launches.
 * 
 * Features:
 * - Missile inventory display with status indicators
 * - Component assembly interface (5 components per missile)
 * - Launch targeting with player/clan selection
 * - Warhead type selection (Tactical → Clan Buster)
 * - Flight time and impact estimation
 * 
 * Dependencies: /api/wmd/missiles, /types/wmd/missile.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';

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

    const handleMissileLaunched = (payload: any) => {
      showInfo(`Missile launched by ${payload.launcherUsername} targeting ${payload.targetUsername}`);
      fetchMissiles();
    };

    const handleMissileIntercepted = (payload: any) => {
      if (payload.isYourMissile) {
        showError(`Your missile was intercepted by ${payload.defenderUsername}!`);
      } else {
        showSuccess(`Successfully intercepted incoming missile!`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSEMBLING': return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]';
      case 'READY': return 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]';
      case 'LAUNCHED': return 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]';
      default: return 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none">
        <p className="text-[color:var(--nn-text-secondary)]">Loading missiles...</p>
      </div>
    );
  }

  const selectedMissileData = missiles.find(m => m.missileId === selectedMissile);

  return (
    <div className="p-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--nn-magenta)]">Missile Arsenal</h2>
          <p className="text-sm text-[color:var(--nn-text-secondary)]">
            {missiles.length} missile{missiles.length !== 1 ? 's' : ''} in inventory
          </p>
        </div>
        <Button
          onClick={createMissile}
          disabled={creatingMissile}
          className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
        >
          {creatingMissile ? 'Creating...' : '+ New Missile'}
        </Button>
      </div>

      {/* Warhead Selection for New Missiles */}
      <Card className="p-4 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]">
        <h3 className="font-bold text-[color:var(--nn-text-primary)] mb-2">Warhead Type</h3>
        <div className="grid grid-cols-5 gap-2">
          {['TACTICAL', 'STRATEGIC', 'BUNKER_BUSTER', 'EMP', 'CLAN_BUSTER'].map(type => (
            <Button
              key={type}
              onClick={() => setSelectedWarhead(type)}
              variant={selectedWarhead === type ? 'primary' : 'secondary'}
              size="sm"
              className={selectedWarhead === type ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]' : ''}
            >
              {type.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </Card>

      {/* Missile Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {missiles.map((missile) => (
          <Card key={missile.missileId} className="p-4 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[color:var(--nn-text-primary)]">{missile.warheadType}</h3>
                  <p className="text-xs text-[color:var(--nn-text-secondary)]">
                    ID: {missile.missileId.slice(-8)}
                  </p>
                </div>
                <Badge className={getStatusColor(missile.status)}>
                  {missile.status}
                </Badge>
              </div>

              {/* Component Progress */}
              {missile.status === 'ASSEMBLING' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[color:var(--nn-text-secondary)]">Assembly Progress</span>
                    <span className="text-[color:var(--nn-amber)] font-bold">
                      {getComponentProgress(missile)}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.entries(missile.components).map(([comp, installed]) => (
                      <Button
                        key={comp}
                        onClick={() => assembleComponent(missile.missileId, comp)}
                        disabled={installed}
                        size="sm"
                        className={`text-xs ${installed ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'}`}
                      >
                        {comp.slice(0, 3).toUpperCase()}
                        {installed && ' ✓'}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {missile.status === 'READY' && (
                  <Button
                    onClick={() => setSelectedMissile(missile.missileId)}
                    className="flex-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
                    size="sm"
                  >
                    Launch
                  </Button>
                )}
                <Button
                  onClick={() => dismantleMissile(missile.missileId)}
                  variant="danger"
                  size="sm"
                  className="text-[color:var(--nn-magenta)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
                >
                  Dismantle
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Launch Interface */}
      {selectedMissileData && (
        <Card className="p-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] space-y-4">
          <h3 className="text-xl font-bold text-[color:var(--nn-cyan)]">Launch Missile</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[color:var(--nn-cyan)] block mb-1">Target Player Username</label>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Enter target username..."
                className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-text-primary)]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => launchMissile(selectedMissileData.missileId)}
                className="flex-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
              >
                🚀 LAUNCH MISSILE
              </Button>
              <Button
                onClick={() => setSelectedMissile(null)}
                variant="secondary"
                className="border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {missiles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[color:var(--nn-text-secondary)] text-lg">No missiles in arsenal</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm">Create your first missile to begin</p>
        </div>
      )}
    </div>
  );
}
