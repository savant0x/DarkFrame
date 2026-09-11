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
import { extractApiError } from '@/lib/apiClient';

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
      if (!response.ok) {
        // FID-20260911-041: structured rejections ({ error: { message } }) previously
        // rendered as an empty modal — surface the server's actual reason.
        data.success = false;
        data.victory = false;
        data.message = extractApiError(data, response.status);
      }
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
    if (distance <= 10) return 'text-[color:var(--nn-green)]';
    if (distance <= 25) return 'text-[color:var(--nn-amber)]';
    if (distance <= 50) return 'text-[color:var(--nn-amber)]';
    return 'text-[color:var(--nn-magenta)]';
  };

  // Get power tier color
  const getPowerTierColor = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'WEAK': return 'text-[color:var(--nn-text-secondary)]';
      case 'MID': return 'text-[color:var(--nn-green)]';
      case 'STRONG': return 'text-[color:var(--nn-cyan)]';
      case 'ELITE': return 'text-[color:var(--nn-violet)]';
      case 'ULTRA': return 'text-[color:var(--nn-amber)]';
      case 'LEGENDARY': return 'text-[color:var(--nn-magenta)]';
      default: return 'text-[color:var(--nn-text-primary)]';
    }
  };

  // Sort Beer Bases. Distance only — power/loot sorting would require the
  // hidden intel; the server already orders by distance as well.
  const getSortedBeerBases = (): BeerBase[] => {
    return [...beerBases].sort((a, b) => a.distance - b.distance);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] backdrop-blur-sm">
      <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none w-[90%] max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] p-4 border-b border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍺</span>
              <div>
                <h2 className="text-xl font-bold text-[color:var(--nn-text-primary)]">Beer Bases</h2>
                <p className="text-sm text-[color:var(--nn-amber)]">
                  Special high-reward targets • {totalCount} active bases
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[color:var(--nn-text-primary)] text-[color:var(--nn-amber)] text-2xl font-bold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Controls — distance sort only: power/loot would leak hidden intel */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] flex items-center justify-between">
          <span className="text-sm text-[color:var(--nn-text-secondary)]">Sorted by distance — walk to a base to scan its stats</span>
          <button
            onClick={fetchBeerBases}
            disabled={loading}
            className="px-3 py-1 text-xs bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Beer Base List */}
        <div className="p-4 max-h-[calc(80vh-200px)] overflow-y-auto">
          {loading && beerBases.length === 0 ? (
            <div className="text-center text-[color:var(--nn-text-secondary)] py-8">Loading Beer Bases...</div>
          ) : beerBases.length === 0 ? (
            <div className="text-center text-[color:var(--nn-text-secondary)] py-8">
              <p className="text-lg mb-2">No Beer Bases found</p>
              <p className="text-sm">Beer Bases respawn weekly on Sundays at 4 AM</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getSortedBeerBases().map((base, index) => (
                <div
                  key={index}
                  className={`bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border-2 transition-all ${
                    base.scanned
                      ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]'
                      : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-lg text-[color:var(--nn-amber)] flex items-center gap-2">
                        🍺 {base.username}
                      </span>
                      <div className="text-sm text-[color:var(--nn-text-secondary)]">
                        {base.scanned ? (
                          <span className="capitalize">{base.specialization} - Tier {base.tier}</span>
                        ) : (
                          <span className="italic text-[color:var(--nn-text-secondary)]">Unscouted — walk here to scan</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getPowerTierColor(base.powerTier)}`}>
                        {base.powerTier.toUpperCase()}
                      </div>
                      <div className="text-xs text-[color:var(--nn-text-secondary)]">
                        {base.scanned
                          ? `Position: (${base.position.x}, ${base.position.y})`
                          : 'Position: ???'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
                    <div>
                      <div className="text-[color:var(--nn-text-secondary)] text-xs">Distance</div>
                      <div className={`font-bold ${getDistanceColor(base.distance)}`}>
                        {base.distance} tiles
                      </div>
                    </div>
                    <div>
                      <div className="text-[color:var(--nn-text-secondary)] text-xs">Army Size</div>
                      {base.scanned ? (
                        <div className="font-bold text-[color:var(--nn-text-primary)]">{formatNumberAbbreviated(base.armySize)} units</div>
                      ) : (
                        <div className="font-bold text-[color:var(--nn-text-secondary)]">???</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[color:var(--nn-text-secondary)] text-xs">Strength</div>
                      {base.scanned ? (
                        <div className="font-bold text-[color:var(--nn-magenta)]">{formatNumberAbbreviated(base.totalStrength)}</div>
                      ) : (
                        <div className="font-bold text-[color:var(--nn-text-secondary)]">???</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[color:var(--nn-text-secondary)] text-xs">Defense</div>
                      {base.scanned ? (
                        <div className="font-bold text-[color:var(--nn-cyan)]">{formatNumberAbbreviated(base.totalDefense)}</div>
                      ) : (
                        <div className="font-bold text-[color:var(--nn-text-secondary)]">???</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-[color:var(--nn-text-secondary)]">Loot: </span>
                      {base.scanned ? (
                        <>
                          <span className="text-[color:var(--nn-cyan)] font-bold">
                            {formatNumberAbbreviated(base.resources.metal)} 🔩
                          </span>
                          <span className="text-[color:var(--nn-text-secondary)]"> + </span>
                          <span className="text-[color:var(--nn-amber)] font-bold">
                            {formatNumberAbbreviated(base.resources.energy)} ⚡
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-[color:var(--nn-text-secondary)]">??? — stand on the base to scan it</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAttack(base.username)}
                      disabled={attacking === base.username}
                      className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] z-10">
            <div className={`bg-[color:var(--nn-void)] border-4 rounded-none p-6 max-w-md ${
              attackResult.victory ? 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' : 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
            }`}>
              <h3 className={`text-2xl font-bold mb-4 ${
                attackResult.victory ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'
              }`}>
                {attackResult.victory ? '🎉 VICTORY!' : '💀 DEFEAT!'}
              </h3>
              <p className="text-[color:var(--nn-text-primary)] mb-4">{attackResult.message}</p>
              {attackResult.rewards && (
                <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                  <p className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Rewards:</p>
                  <div className="space-y-1">
                    <p className="text-[color:var(--nn-cyan)]">Metal: +{formatNumberAbbreviated(attackResult.rewards.metal)} 🔩</p>
                    <p className="text-[color:var(--nn-amber)]">Energy: +{formatNumberAbbreviated(attackResult.rewards.energy)} ⚡</p>
                    <p className="text-[color:var(--nn-violet)]">XP: +{formatNumberAbbreviated(attackResult.rewards.experience)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] text-center">
          <p className="text-xs text-[color:var(--nn-text-secondary)]">
            Press <kbd className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] text-[color:var(--nn-amber)]">{hotkeyShift ? 'Shift+' : ''}{hotkeyConfig}</kbd> to toggle • ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}

