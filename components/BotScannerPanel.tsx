/**
 * Bot Scanner Panel Component
 * Created: 2024-10-18
 * 
 * OVERVIEW:
 * UI component for the Bot Scanner feature. Displays scanned bots, nests, and scanner status.
 * Activated by pressing "B" key (when tech is unlocked). Shows cooldown timer and tech requirements.
 * 
 * FEATURES:
 * - Tech-gated display (shows unlock requirement if not available)
 * - Cooldown timer countdown
 * - Bot list with sorting (distance, resources, reputation)
 * - Nest location display
 * - Beer Base highlighting
 * - Distance calculation from player
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

interface ScannedBot {
  username: string;
  specialization: string;
  tier: number;
  position: { x: number; y: number };
  distance: number;
  resources: { metal: number; energy: number };
  reputation: string;
  lastDefeated: Date | null;
  isSpecialBase: boolean;
  totalStrength: number;
  totalDefense: number;
  armySize: number;
}

interface ScanResult {
  success: boolean;
  message: string;
  bots: ScannedBot[];
  nests: Array<{
    id: number;
    name: string;
    position: { x: number; y: number };
    distance: number;
  }>;
  radius: number;
  cooldownUntil: Date;
  botsFound: number;
}

interface ScannerStatus {
  unlocked: boolean;
  radius: number;
  cooldownMinutes: number;
  onCooldown: boolean;
  cooldownUntil: Date | null;
  hasAdvancedTracking: boolean;
}

export default function BotScannerPanel() {
  const { player } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [cooldownTime, setCooldownTime] = useState<string>('');
  const [sortBy, setSortBy] = useState<'distance' | 'resources' | 'reputation'>('distance');

  // Load scanner status
  useEffect(() => {
    if (player?.username) {
      fetchStatus();
    }
  }, [player]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (isTypingInInput()) {
        return;
      }
      
      if (e.key === 'b' || e.key === 'B') {
        if (status?.unlocked) {
          setIsOpen(prev => !prev);
        }
      }
      
      // ESC to close (allow even in inputs for convenience)
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [status]);

  // Cooldown timer
  useEffect(() => {
    if (!status?.cooldownUntil || !status.onCooldown) {
      setCooldownTime('');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(status.cooldownUntil!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setCooldownTime('');
        fetchStatus(); // Refresh status when cooldown expires
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCooldownTime(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.cooldownUntil, status?.onCooldown]);

  const fetchStatus = async () => {
    if (!player?.username) return;

    try {
      const response = await fetch(`/api/bot-scanner?action=status`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch scanner status:', error);
    }
  };

  const executeScan = async () => {
    if (!player?.username || scanning || status?.onCooldown) return;

    setScanning(true);
    try {
      const response = await fetch(`/api/bot-scanner`);
      const data = await response.json();
      
      if (data.success) {
        setScanResult(data);
        await fetchStatus(); // Update cooldown
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scanner malfunction');
    } finally {
      setScanning(false);
    }
  };

  const getSortedBots = () => {
    if (!scanResult?.bots) return [];

    const bots = [...scanResult.bots];

    switch (sortBy) {
      case 'distance':
        return bots.sort((a, b) => a.distance - b.distance);
      case 'resources':
        return bots.sort((a, b) => 
          (b.resources.metal + b.resources.energy) - (a.resources.metal + a.resources.energy)
        );
      case 'reputation':
        const repOrder = { legendary: 4, infamous: 3, notorious: 2, unknown: 1 };
        return bots.sort((a, b) => 
          (repOrder[b.reputation as keyof typeof repOrder] || 0) - 
          (repOrder[a.reputation as keyof typeof repOrder] || 0)
        );
      default:
        return bots;
    }
  };

  const getReputationColor = (reputation: string) => {
    switch (reputation) {
      case 'legendary': return 'text-purple-400';
      case 'infamous': return 'text-orange-400';
      case 'notorious': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getReputationIcon = (reputation: string) => {
    switch (reputation) {
      case 'legendary': return '👑';
      case 'infamous': return '💀';
      case 'notorious': return '⭐';
      default: return '👁️';
    }
  };

  const getReputationBonus = (reputation: string): string => {
    switch (reputation) {
      case 'legendary': return '+50% loot';
      case 'infamous': return '+25% loot';
      case 'notorious': return '+10% loot';
      default: return 'No bonus';
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-4 bg-gray-800/80 text-white px-3 py-2 rounded text-sm">
        {status?.unlocked ? (
          <span>Press <kbd className="bg-gray-700 px-2 py-1 rounded">B</kbd> for Bot Scanner</span>
        ) : (
          <span className="text-gray-500">Bot Scanner locked (unlock Bot Hunter tech)</span>
        )}
      </div>
    );
  }

  if (!status?.unlocked) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 text-white rounded-lg p-6 max-w-md">
          <h2 className="text-2xl font-bold mb-4">🔒 Bot Scanner Locked</h2>
          <p className="mb-4">
            Unlock the <strong>Bot Hunter</strong> tech to use the Bot Scanner feature.
          </p>
          <button
            onClick={() => setIsOpen(false)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">🔍 Bot Scanner</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="mt-2 flex gap-4 text-sm">
            <span>Radius: <strong>{status.radius} tiles</strong></span>
            <span>
              Cooldown: <strong>{status.cooldownMinutes}min</strong>
              {status.hasAdvancedTracking && ' ⚡'}
            </span>
            {cooldownTime && (
              <span className="text-yellow-400">Next scan: {cooldownTime}</span>
            )}
          </div>
        </div>

        {/* Scan Button */}
        <div className="p-4 bg-gray-800/50 border-b border-gray-700">
          <button
            onClick={executeScan}
            disabled={scanning || status.onCooldown}
            className={`w-full py-3 rounded font-bold ${
              scanning || status.onCooldown
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {scanning ? 'Scanning...' : status.onCooldown ? `On Cooldown (${cooldownTime})` : 'Execute Scan'}
          </button>
        </div>

        {/* Results */}
        {scanResult && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Sort Controls */}
            <div className="mb-4 flex gap-2">
              <span className="text-gray-400">Sort by:</span>
              <button
                onClick={() => setSortBy('distance')}
                className={`px-2 py-1 rounded text-sm ${sortBy === 'distance' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Distance
              </button>
              <button
                onClick={() => setSortBy('resources')}
                className={`px-2 py-1 rounded text-sm ${sortBy === 'resources' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Resources
              </button>
              <button
                onClick={() => setSortBy('reputation')}
                className={`px-2 py-1 rounded text-sm ${sortBy === 'reputation' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Reputation
              </button>
            </div>

            {/* Bots Found */}
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-3">
                Bots Detected: {scanResult.botsFound}
              </h3>
              
              {scanResult.botsFound === 0 ? (
                <p className="text-gray-400">No bots found within {scanResult.radius} tiles</p>
              ) : (
                <div className="space-y-2">
                  {getSortedBots().map((bot, index) => (
                    <div
                      key={index}
                      className={`bg-gray-800 p-3 rounded border ${
                        bot.isSpecialBase ? 'border-yellow-500' : 'border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-lg">
                            {bot.username}
                            {bot.isSpecialBase && ' 🍺'}
                          </span>
                          <div className="text-sm text-gray-400">
                            <span className="capitalize">{bot.specialization}</span> - Tier {bot.tier}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold flex items-center gap-1 justify-end ${getReputationColor(bot.reputation)}`}>
                            <span>{getReputationIcon(bot.reputation)}</span>
                            <span>{bot.reputation.toUpperCase()}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {getReputationBonus(bot.reputation)}
                          </div>
                          <div className="text-sm text-gray-400">
                            {bot.distance.toFixed(1)} tiles
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">Position:</span> ({bot.position.x}, {bot.position.y})
                        </div>
                        <div>
                          <span className="text-gray-400">Resources:</span> {bot.resources.metal}M / {bot.resources.energy}E
                        </div>
                        <div>
                          <span className="text-gray-400">Army:</span> {bot.armySize} units ({bot.totalStrength}STR / {bot.totalDefense}DEF)
                        </div>
                        {bot.lastDefeated && (
                          <div>
                            <span className="text-gray-400">Last Defeated:</span> {new Date(bot.lastDefeated).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nests Found */}
            {scanResult.nests.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-3">
                  Nests Detected: {scanResult.nests.length}
                </h3>
                <div className="space-y-2">
                  {scanResult.nests.map((nest) => (
                    <div key={nest.id} className="bg-gray-800 p-3 rounded border border-purple-500">
                      <div className="flex justify-between">
                        <span className="font-bold">📍 {nest.name}</span>
                        <span className="text-gray-400">{nest.distance.toFixed(1)} tiles</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Position: ({nest.position.x}, {nest.position.y})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
