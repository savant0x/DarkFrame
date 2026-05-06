/**
 * @file components/WMDDefensePanel.tsx
 * @created 2025-10-22
 * @overview WMD Defense Battery Management Panel
 * 
 * OVERVIEW:
 * Defense system management for missile interception. Deploy batteries,
 * monitor health, repair damaged units, and track interception success rates.
 * 
 * Features:
 * - Battery inventory with status display
 * - 5 battery tiers (Basic → AEGIS)
 * - Health and repair management
 * - Interception statistics
 * - Battery deployment interface
 * 
 * Dependencies: /api/wmd/defense, /types/wmd/defense.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';

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

    const handleInterceptionSuccess = (payload: any) => {
      showSuccess(`Battery ${payload.batteryId} intercepted incoming missile!`);
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
    if (!confirm('Dismantle this battery? This cannot be undone.')) return;

    const res = await fetch(`/api/wmd/defense?batteryId=${batteryId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      await fetchBatteries();
    } else {
      alert(data.error || 'Failed to dismantle battery');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IDLE': return 'bg-green-600';
      case 'ACTIVE': return 'bg-blue-600';
      case 'COOLDOWN': return 'bg-yellow-600';
      case 'DAMAGED': return 'bg-red-600';
      case 'UPGRADING': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-400';
    if (health >= 50) return 'text-yellow-400';
    if (health >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg">
        <p className="text-gray-300">Loading defense systems...</p>
      </div>
    );
  }

  const activeBatteries = batteries.filter(b => b.status === 'IDLE' || b.status === 'ACTIVE').length;
  const totalIntercepts = batteries.reduce((sum, b) => sum + b.successfulIntercepts, 0);

  return (
    <div className="p-6 bg-gray-800 rounded-lg space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-blue-400">Defense Systems</h2>
          <p className="text-sm text-gray-400">
            {activeBatteries}/{batteries.length} batteries active | {totalIntercepts} total intercepts
          </p>
        </div>
        <Button
          onClick={deployBattery}
          disabled={deploying}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {deploying ? 'Deploying...' : '+ Deploy Battery'}
        </Button>
      </div>

      {/* Battery Type Selection */}
      <Card className="p-4 bg-gray-700">
        <h3 className="font-bold text-white mb-2">Battery Type</h3>
        <div className="grid grid-cols-5 gap-2">
          {['BASIC', 'ADVANCED', 'ELITE', 'FORTRESS', 'AEGIS'].map(type => (
            <Button
              key={type}
              onClick={() => setSelectedType(type)}
              variant={selectedType === type ? 'primary' : 'secondary'}
              size="sm"
              className={selectedType === type ? 'bg-blue-600' : ''}
            >
              {type}
            </Button>
          ))}
        </div>
      </Card>

      {/* Battery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batteries.map((battery) => (
          <Card key={battery.batteryId} className="p-4 bg-gray-700 space-y-3">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-white">{battery.batteryType}</h3>
                <p className="text-xs text-gray-400">Tier {battery.tier}</p>
              </div>
              <Badge className={getStatusColor(battery.status)}>
                {battery.status}
              </Badge>
            </div>

            {/* Stats */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Intercept Chance:</span>
                <span className="text-green-400 font-bold">
                  {(battery.interceptChance * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Health:</span>
                <span className={`font-bold ${getHealthColor(battery.health)}`}>
                  {battery.health}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Success Rate:</span>
                <span className="text-blue-400">
                  {battery.totalAttempts > 0
                    ? `${Math.round((battery.successfulIntercepts / battery.totalAttempts) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">
                  ✓ {battery.successfulIntercepts} / ✗ {battery.failedIntercepts}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {battery.health < 100 && !battery.repairing && (
                <Button
                  onClick={() => repairBattery(battery.batteryId)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  Repair
                </Button>
              )}
              {battery.repairing && (
                <div className="flex-1 text-center text-sm text-yellow-400">
                  Repairing...
                </div>
              )}
              <Button
                onClick={() => dismantleBattery(battery.batteryId)}
                variant="danger"
                size="sm"
              >
                Dismantle
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {batteries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No defense batteries deployed</p>
          <p className="text-gray-500 text-sm">Deploy your first battery for protection</p>
        </div>
      )}
    </div>
  );
}
