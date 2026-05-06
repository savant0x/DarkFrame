/**
 * @file components/BotMagnetPanel.tsx
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * UI panel for deploying and managing Bot Magnet beacons.
 * 
 * FEATURES:
 * - Tech requirement display (bot-magnet)
 * - Beacon deployment with coordinate selector
 * - Active beacon status and stats
 * - Cooldown timer display
 * - Beacon deactivation option
 * 
 * INTEGRATION:
 * - Checks player.unlockedTechs for 'bot-magnet'
 * - Calls /api/bot-magnet endpoints
 * - Displays current player position as default
 * - Real-time countdown for cooldown and expiration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';

interface BeaconStatus {
  hasActiveBeacon: boolean;
  beacon?: {
    x: number;
    y: number;
    deployedAt: string;
    expiresAt: string;
    attractionRadius: number;
    attractionChance: number;
    botsAttracted: number;
  };
  cooldownRemaining?: number;
  canDeploy: boolean;
}

export default function BotMagnetPanel() {
  const { player } = useGameContext();
  const [beaconStatus, setBeaconStatus] = useState<BeaconStatus | null>(null);
  const [deployX, setDeployX] = useState<string>('');
  const [deployY, setDeployY] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if player has bot-magnet tech
  const hasTech = player?.unlockedTechs?.includes('bot-magnet') || false;

  // Fetch beacon status on mount and when hasTech changes
  useEffect(() => {
    if (hasTech) {
      fetchBeaconStatus();
    }
  }, [hasTech]);

  // Set default coordinates to player position
  useEffect(() => {
    if (player?.currentPosition && !deployX && !deployY) {
      setDeployX(player.currentPosition.x.toString());
      setDeployY(player.currentPosition.y.toString());
    }
  }, [player?.currentPosition]);

  const fetchBeaconStatus = async () => {
    try {
      const response = await fetch('/api/bot-magnet');
      const data = await response.json();
      
      if (data.success) {
        setBeaconStatus(data);
      }
    } catch (error) {
      console.error('Error fetching beacon status:', error);
    }
  };

  const handleDeploy = async () => {
    const x = parseInt(deployX);
    const y = parseInt(deployY);

    if (isNaN(x) || isNaN(y)) {
      setMessage({ type: 'error', text: 'Invalid coordinates' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bot-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchBeaconStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to deploy beacon' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate beacon? Cooldown will persist.')) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bot-magnet', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchBeaconStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to deactivate beacon' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (hours: number): string => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const calculateTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hours = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return formatTimeRemaining(Math.max(0, hours));
  };

  if (!hasTech) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-400 mb-4">🧲 Bot Magnet</h2>
        <p className="text-gray-400">
          Research <span className="text-purple-400 font-semibold">Bot Magnet</span> technology to unlock beacon deployment.
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p>• Deploy beacons to attract bots to strategic locations</p>
          <p>• 30% of nearby bots redirected to beacon area</p>
          <p>• 100-tile attraction radius</p>
          <p>• 7-day active duration, 14-day cooldown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-purple-400 mb-4">🧲 Bot Magnet</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
              : 'bg-red-500/20 border border-red-500/50 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Active Beacon Display */}
      {beaconStatus?.hasActiveBeacon && beaconStatus.beacon && (
        <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">Active Beacon</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Location:</span>
              <span className="text-white ml-2">
                ({beaconStatus.beacon.x}, {beaconStatus.beacon.y})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Bots Attracted:</span>
              <span className="text-green-400 ml-2 font-semibold">
                {beaconStatus.beacon.botsAttracted}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Radius:</span>
              <span className="text-white ml-2">{beaconStatus.beacon.attractionRadius} tiles</span>
            </div>
            <div>
              <span className="text-gray-400">Attraction Rate:</span>
              <span className="text-white ml-2">
                {(beaconStatus.beacon.attractionChance * 100).toFixed(0)}%
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Time Remaining:</span>
              <span className="text-cyan-400 ml-2 font-semibold">
                {calculateTimeRemaining(beaconStatus.beacon.expiresAt)}
              </span>
            </div>
          </div>
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50 transition"
          >
            Deactivate Beacon
          </button>
        </div>
      )}

      {/* Cooldown Display */}
      {beaconStatus && !beaconStatus.canDeploy && !beaconStatus.hasActiveBeacon && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded">
          <h3 className="text-lg font-semibold text-orange-300 mb-2">Cooldown Active</h3>
          <p className="text-gray-400">
            Next deployment available in:{' '}
            <span className="text-orange-400 font-semibold">
              {formatTimeRemaining(beaconStatus.cooldownRemaining || 0)}
            </span>
          </p>
        </div>
      )}

      {/* Deployment Form */}
      {beaconStatus?.canDeploy && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">Deploy New Beacon</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">X Coordinate</label>
              <input
                type="number"
                value={deployX}
                onChange={(e) => setDeployX(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-purple-500/30 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="X"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Y Coordinate</label>
              <input
                type="number"
                value={deployY}
                onChange={(e) => setDeployY(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-purple-500/30 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Y"
              />
            </div>
          </div>
          <button
            onClick={handleDeploy}
            disabled={loading || !deployX || !deployY}
            className="w-full px-4 py-3 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded hover:bg-purple-500/30 disabled:opacity-50 transition font-semibold"
          >
            {loading ? 'Deploying...' : '🧲 Deploy Beacon'}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-slate-700/30 rounded border border-slate-600/30">
        <h4 className="text-sm font-semibold text-purple-300 mb-2">Beacon Mechanics</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Attracts 30% of bots spawning within 100-tile radius</li>
          <li>• Bots spawn within 20 tiles of beacon center</li>
          <li>• Active for 7 days (168 hours)</li>
          <li>• 14-day cooldown between deployments</li>
          <li>• Only 1 beacon active per player</li>
          <li>• Deactivating early does not reduce cooldown</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * - Requires 'bot-magnet' technology unlocked
 * - Default coordinates set to player's current position
 * - Real-time countdown for beacon expiration
 * - Cooldown persists even after early deactivation
 * - Displays attraction statistics (bots redirected)
 * - Glassmorphism design matching game aesthetic
 * - Error handling with user-friendly messages
 * - Confirmation dialog for beacon deactivation
 */
