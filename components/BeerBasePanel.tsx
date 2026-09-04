/**
 * Beer Base Panel Component
 * Created: 2025-01-23
 * Updated: 2026-09-04 — intel gating (organic discovery)
 * 
 * OVERVIEW:
 * UI component for the Beer Base feature. Lists Beer Bases for exploration:
 * only the name, power tier (visible on the map), and coarse distance are
 * shown from afar — army size, strength, defense, loot, specialization, tier,
 * and exact position are revealed ONLY when the player stands on the base's
 * tile (server-gated). Attack requires presence at the base.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { formatNumberAbbreviated } from '@/utils/formatting';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

/** Full intel — served only when the player is standing on the base tile. */
interface BeerBaseScanned {
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
  scanned: true;
}

/** Far-field view: name, tier, and the hot/cold distance compass only. */
interface BeerBaseUnscanned {
  username: string;
  powerTier: string;
  distance: number;
  scanned: false;
}

type BeerBase = BeerBaseScanned | BeerBaseUnscanned;

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
  const [hotkeyConfig, setHotkeyConfig] = useState<string>('E');

  // Load Beer Base list
  const fetchBeerBases = useCallback(async () => {
    if (!player?.username) return;

    setLoading(true);
    try {
      const response = await fetch('/api/beer-bases/list');
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
  }, [player?.username]);

  // Load hotkey configuration (Shift+E by default — bare E is movement).
  const [hotkeyShift, setHotkeyShift] = useState(true);
  useEffect(() => {
    const loadHotkey = async () => {
      try {
        const response = await fetch('/api/admin/hotkeys');
        if (response.ok) {
          const data = await response.json();
          const beerBaseHotkey = data.hotkeys.find((h: { action: string }) => h.action === 'BEER_BASE_PANEL');
          if (beerBaseHotkey) {
            setHotkeyConfig(beerBaseHotkey.key.toUpperCase());
            setHotkeyShift(beerBaseHotkey.requiresShift === true);
          }
        }
      } catch {
        // Keep default hotkey if fetch fails
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

      // Single-mapping invariant: this combo fires ONLY here. The Shift
      // requirement (default) keeps bare E exclusively movement's.
      const shiftOk = hotkeyShift ? e.shiftKey : true;
      if (e.key.toUpperCase() === hotkeyConfig && shiftOk && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
  }, [isOpen, hotkeyConfig, hotkeyShift, fetchBeerBases]);

  // Load Beer Bases when panel opens; re-fetch on the move so the distance
  // compass stays live and standing on a tile flips that base to scanned.
  useEffect(() => {
    if (isOpen && player?.username) {
      fetchBeerBases();
      const interval = setInterval(fetchBeerBases, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, player, fetchBeerBases]);

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

  // Sort Beer Bases. Distance only — power/loot sorting would require the
  // hidden intel; the server already orders by distance as well.
  const getSortedBeerBases = (): BeerBase[] => {
    return [...beerBases].sort((a, b) => a.distance - b.distance);
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

        {/* Controls — distance sort only: power/loot would leak hidden intel */}
        <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-400">Sorted by distance — walk to a base to scan its stats</span>
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
                  className={`bg-gray-800 p-4 rounded border-2 transition-all ${
                    base.scanned
                      ? 'border-yellow-500 hover:border-yellow-400'
                      : 'border-gray-600/60 hover:border-yellow-500/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-lg text-yellow-300 flex items-center gap-2">
                        🍺 {base.username}
                      </span>
                      <div className="text-sm text-gray-400">
                        {base.scanned ? (
                          <span className="capitalize">{base.specialization} - Tier {base.tier}</span>
                        ) : (
                          <span className="italic text-gray-500">Unscouted — walk here to scan</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getPowerTierColor(base.powerTier)}`}>
                        {base.powerTier.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {base.scanned
                          ? `Position: (${base.position.x}, ${base.position.y})`
                          : 'Position: ???'}
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
                      {base.scanned ? (
                        <div className="font-bold text-white">{formatNumberAbbreviated(base.armySize)} units</div>
                      ) : (
                        <div className="font-bold text-gray-600">???</div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Strength</div>
                      {base.scanned ? (
                        <div className="font-bold text-red-400">{formatNumberAbbreviated(base.totalStrength)}</div>
                      ) : (
                        <div className="font-bold text-gray-600">???</div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Defense</div>
                      {base.scanned ? (
                        <div className="font-bold text-blue-400">{formatNumberAbbreviated(base.totalDefense)}</div>
                      ) : (
                        <div className="font-bold text-gray-600">???</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-400">Loot: </span>
                      {base.scanned ? (
                        <>
                          <span className="text-cyan-400 font-bold">
                            {formatNumberAbbreviated(base.resources.metal)} 🔩
                          </span>
                          <span className="text-gray-400"> + </span>
                          <span className="text-yellow-400 font-bold">
                            {formatNumberAbbreviated(base.resources.energy)} ⚡
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-gray-600">??? — stand on the base to scan it</span>
                      )}
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
            Press <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-yellow-300">{hotkeyShift ? 'Shift+' : ''}{hotkeyConfig}</kbd> to toggle • ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}

