/**
 * Beer Base Panel Component
 * Created: 2025-01-23
 * 
 * OVERVIEW:
 * UI component for the Beer Base feature. Displays Beer Base locations with power tiers,
 * allows players to attack Beer Bases for loot. Activated by hotkey (configurable in admin panel).
 * 
 * FEATURES:
 * - Lists all Beer Bases with power tier and location
 * - Shows distance from player
 * - Displays loot potential and army composition
 * - Attack functionality with battle results
 * - Keyboard hotkey support (configurable)
 * - Beer Base highlighting with 🍺 icon
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { formatNumberAbbreviated } from '@/utils/formatting';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

interface BeerBase {
  username: string;
  position: { x: number; y: number };
  distance: number;
  totalStrength: number;
  totalDefense: number;
  resources: { metal: number; energy: number };
  armySize: number;
  powerTier: string;
  specialization: string;
  tier: number;
}

interface BeerBaseListResponse {
  success: boolean;
  beerBases: BeerBase[];
  totalCount: number;
}

interface AttackResult {
  success: boolean;
  victory: boolean;
  message: string;
  rewards?: {
    metal: number;
    energy: number;
    experience: number;
  };
}

export default function BeerBasePanel() {
  const { player } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [beerBases, setBeerBases] = useState<BeerBase[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'power' | 'loot'>('distance');
  const [hotkeyConfig, setHotkeyConfig] = useState<string>('B');

  // Load Beer Base list
  const fetchBeerBases = async () => {
    if (!player?.username) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/beer-bases/list?username=${encodeURIComponent(player.username)}`);
      const data: BeerBaseListResponse = await response.json();

      if (data.success) {
        setBeerBases(data.beerBases);
        setTotalCount(data.totalCount);
      }
    } catch (error) {
      console.error('Failed to load Beer Bases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load hotkey configuration
  useEffect(() => {
    const loadHotkey = async () => {
      try {
        const response = await fetch('/api/admin/hotkeys');
        if (response.ok) {
          const data = await response.json();
          const beerBaseHotkey = data.hotkeys.find((h: any) => h.action === 'BEER_BASE_PANEL');
          if (beerBaseHotkey) {
            setHotkeyConfig(beerBaseHotkey.key.toUpperCase());
          }
        }
      } catch (error) {
        // Use default 'B' if hotkey fetch fails
      }
    };

    loadHotkey();
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (isTypingInInput()) {
        return;
      }

      if (e.key.toUpperCase() === hotkeyConfig && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
        if (!isOpen) {
          fetchBeerBases();
        }
      }

      // ESC to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setAttackResult(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, hotkeyConfig]);

  // Load Beer Bases when panel opens
  useEffect(() => {
    if (isOpen && player?.username) {
      fetchBeerBases();
    }
  }, [isOpen, player]);

  // Attack Beer Base
  const handleAttack = async (targetUsername: string) => {
    if (!player?.username || attacking) return;

    setAttacking(targetUsername);
    setAttackResult(null);

    try {
      const response = await fetch('/api/combat/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attacker: player.username,
          defender: targetUsername,
        }),
      });

      const data: AttackResult = await response.json();
      setAttackResult(data);

      // Refresh list after attack
      setTimeout(() => {
        fetchBeerBases();
        setAttackResult(null);
      }, 3000);
    } catch (error) {
      console.error('Attack failed:', error);
      setAttackResult({
        success: false,
        victory: false,
        message: 'Attack request failed. Please try again.',
      });
    } finally {
      setAttacking(null);
    }
  };

  // Calculate distance color
  const getDistanceColor = (distance: number): string => {
    if (distance <= 10) return 'text-green-400';
    if (distance <= 25) return 'text-yellow-400';
    if (distance <= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get power tier color
  const getPowerTierColor = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'WEAK': return 'text-gray-400';
      case 'MID': return 'text-green-400';
      case 'STRONG': return 'text-blue-400';
      case 'ELITE': return 'text-purple-400';
      case 'ULTRA': return 'text-orange-400';
      case 'LEGENDARY': return 'text-red-500';
      default: return 'text-white';
    }
  };

  // Sort Beer Bases
  const getSortedBeerBases = (): BeerBase[] => {
    const sorted = [...beerBases];
    
    switch (sortBy) {
      case 'distance':
        return sorted.sort((a, b) => a.distance - b.distance);
      case 'power':
        return sorted.sort((a, b) => (b.totalStrength + b.totalDefense) - (a.totalStrength + a.totalDefense));
      case 'loot':
        return sorted.sort((a, b) => (b.resources.metal + b.resources.energy) - (a.resources.metal + a.resources.energy));
      default:
        return sorted;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-900 to-orange-900 p-4 border-b border-yellow-500">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍺</span>
              <div>
                <h2 className="text-xl font-bold text-white">Beer Bases</h2>
                <p className="text-sm text-yellow-200">
                  Special high-reward targets • {totalCount} active bases
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-yellow-300 text-2xl font-bold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sort by:</span>
            <button
              onClick={() => setSortBy('distance')}
              className={`px-3 py-1 text-xs rounded ${
                sortBy === 'distance'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Distance
            </button>
            <button
              onClick={() => setSortBy('power')}
              className={`px-3 py-1 text-xs rounded ${
                sortBy === 'power'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Power
            </button>
            <button
              onClick={() => setSortBy('loot')}
              className={`px-3 py-1 text-xs rounded ${
                sortBy === 'loot'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Loot
            </button>
          </div>
          <button
            onClick={fetchBeerBases}
            disabled={loading}
            className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Beer Base List */}
        <div className="p-4 max-h-[calc(80vh-200px)] overflow-y-auto">
          {loading && beerBases.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Loading Beer Bases...</div>
          ) : beerBases.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg mb-2">No Beer Bases found</p>
              <p className="text-sm">Beer Bases respawn weekly on Sundays at 4 AM</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getSortedBeerBases().map((base, index) => (
                <div
                  key={index}
                  className="bg-gray-800 p-4 rounded border-2 border-yellow-500/50 hover:border-yellow-500 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-lg text-yellow-300 flex items-center gap-2">
                        🍺 {base.username}
                      </span>
                      <div className="text-sm text-gray-400">
                        <span className="capitalize">{base.specialization}</span> - Tier {base.tier}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getPowerTierColor(base.powerTier)}`}>
                        {base.powerTier.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Position: ({base.position.x}, {base.position.y})
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">Distance</div>
                      <div className={`font-bold ${getDistanceColor(base.distance)}`}>
                        {base.distance} tiles
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Army Size</div>
                      <div className="font-bold text-white">{formatNumberAbbreviated(base.armySize)} units</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Strength</div>
                      <div className="font-bold text-red-400">{formatNumberAbbreviated(base.totalStrength)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Defense</div>
                      <div className="font-bold text-blue-400">{formatNumberAbbreviated(base.totalDefense)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-400">Loot: </span>
                      <span className="text-cyan-400 font-bold">
                        {formatNumberAbbreviated(base.resources.metal)} 🔩
                      </span>
                      <span className="text-gray-400"> + </span>
                      <span className="text-yellow-400 font-bold">
                        {formatNumberAbbreviated(base.resources.energy)} ⚡
                      </span>
                    </div>
                    <button
                      onClick={() => handleAttack(base.username)}
                      disabled={attacking === base.username}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {attacking === base.username ? 'Attacking...' : 'ATTACK'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attack Result Modal */}
        {attackResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <div className={`bg-gray-900 border-4 rounded-lg p-6 max-w-md ${
              attackResult.victory ? 'border-green-500' : 'border-red-500'
            }`}>
              <h3 className={`text-2xl font-bold mb-4 ${
                attackResult.victory ? 'text-green-400' : 'text-red-400'
              }`}>
                {attackResult.victory ? '🎉 VICTORY!' : '💀 DEFEAT!'}
              </h3>
              <p className="text-white mb-4">{attackResult.message}</p>
              {attackResult.rewards && (
                <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">Rewards:</p>
                  <div className="space-y-1">
                    <p className="text-cyan-400">Metal: +{formatNumberAbbreviated(attackResult.rewards.metal)} 🔩</p>
                    <p className="text-yellow-400">Energy: +{formatNumberAbbreviated(attackResult.rewards.energy)} ⚡</p>
                    <p className="text-purple-400">XP: +{formatNumberAbbreviated(attackResult.rewards.experience)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-800 p-3 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-yellow-300">{hotkeyConfig}</kbd> to toggle • ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}

