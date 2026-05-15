/**
 * @file components/UnitBuildPanelEnhanced.tsx
 * @overview Modern unit building interface — archetype-based with 20 units (4×5)
 * 
 * DESIGN:
 * - Full-screen overlay with backdrop blur
 * - Left: Archetype navigation (Striker/Bulwark/Artillery/Support)
 * - Center: Unit cards grid (5 tiers per archetype)
 * - Right (mobile bottom): Build queue with totals
 * - Dark glass-morphism with neon accents per archetype
 * 
 * UX FLOW:
 * 1. Player opens panel → sees their archetypes
 * 2. Click archetype → see 5 tier cards
 * 3. Use +/- on any card → add to build queue
 * 4. Cart shows running total of metal/energy/slots
 * 5. Click BUILD → submit to server
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { Resources, UnitType, UnitTier, UNIT_CONFIGS } from '@/types/game.types';

// ─── Types ─────────────────────────────────────────────────────────────────
interface UnitBuildPanelProps {
  isOpen: boolean;
  onClose: () => void;
  factoryX: number;
  factoryY: number;
  playerResources: Resources;
  availableSlots: number;
  maxSlots: number;
  usedSlots: number;
  onBuildComplete: () => void;
}

interface BuildEntry {
  unitType: string;
  config: typeof UNIT_CONFIGS[string];
  quantity: number;
}

// ─── Archetype config ──────────────────────────────────────────────────────
const ARCHETYPES = [
  { key: 'STRIKER', label: 'Striker', icon: '⚔️', color: 'from-red-600/80 to-red-800/40', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-red-500/20', desc: 'Offense — 130% damage to Bulwarks' },
  { key: 'BULWARK', label: 'Bulwark', icon: '🛡️', color: 'from-blue-600/80 to-blue-800/40', border: 'border-blue-500/40', text: 'text-blue-400', glow: 'shadow-blue-500/20', desc: 'Defense — absorbs frontline damage' },
  { key: 'ARTILLERY', label: 'Artillery', icon: '💥', color: 'from-orange-600/80 to-orange-800/40', border: 'border-orange-500/40', text: 'text-orange-400', glow: 'shadow-orange-500/20', desc: 'Anti-Support — strikes Support first' },
  { key: 'SUPPORT', label: 'Support', icon: '📡', color: 'from-green-600/80 to-green-800/40', border: 'border-green-500/40', text: 'text-green-400', glow: 'shadow-green-500/20', desc: 'Buff — amplifies STR/DEF up to +60%' },
] as const;

const TIER_LABELS = ['', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

// ─── Component ─────────────────────────────────────────────────────────────
export default function UnitBuildPanelEnhanced({
  isOpen, onClose, factoryX, factoryY,
  playerResources, availableSlots, maxSlots, usedSlots, onBuildComplete,
}: UnitBuildPanelProps) {
  const { player } = useGameContext();
  const [activeArchetype, setActiveArchetype] = useState('STRIKER');
  const [buildQueue, setBuildQueue] = useState<BuildEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // Filter units by active archetype and player level
  const availableUnits = useMemo(() => {
    return Object.values(UNIT_CONFIGS)
      .filter(c => c.archetype === activeArchetype)
      .sort((a, b) => a.tier - b.tier);
  }, [activeArchetype]);

  // Calculate total costs from build queue
  const totals = useMemo(() => {
    let metal = 0, energy = 0, slots = 0;
    for (const entry of buildQueue) {
      metal += entry.config.metalCost * entry.quantity;
      energy += entry.config.energyCost * entry.quantity;
      slots += entry.config.slotCost * entry.quantity;
    }
    return { metal, energy, slots };
  }, [buildQueue]);

  // Check if player can afford the build
  const canAfford = useMemo(() => {
    if (!playerResources) return false;
    return totals.metal <= playerResources.metal &&
           totals.energy <= playerResources.energy &&
           totals.slots <= availableSlots;
  }, [totals, playerResources, availableSlots]);

  // Add to build queue
  const addToQueue = useCallback((config: typeof UNIT_CONFIGS[string]) => {
    setBuildQueue(prev => {
      const existing = prev.find(e => e.unitType === config.type);
      if (existing) {
        return prev.map(e => e.unitType === config.type ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { unitType: config.type, config, quantity: 1 }];
    });
  }, []);

  // Remove from queue or decrease quantity
  const removeFromQueue = useCallback((unitType: string) => {
    setBuildQueue(prev => {
      const existing = prev.find(e => e.unitType === unitType);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(e => e.unitType !== unitType);
      }
      return prev.map(e => e.unitType === unitType ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setBuildQueue([]);
  }, []);

  // Submit build — one request per unit type
  const handleBuild = useCallback(async () => {
    if (!canAfford || buildQueue.length === 0 || loading) return;
    setLoading(true);
    setMessage('');

    try {
      for (const entry of buildQueue) {
        const res = await fetch('/api/factory/build-unit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: player?.username,
            factoryX, factoryY,
            unitType: entry.unitType,
            quantity: entry.quantity,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          setMessageType('error');
          setMessage(data.message || `Failed to build ${entry.config.name}`);
          setLoading(false);
          return;
        }
      }

      setMessageType('success');
      setMessage(`Built ${buildQueue.reduce((s, e) => s + e.quantity, 0)} units!`);
      setBuildQueue([]);
      onBuildComplete();
    } catch {
      setMessageType('error');
      setMessage('Network error');
    } finally {
      setLoading(false);
      setTimeout(() => { setMessage(''); setMessageType(''); }, 3000);
    }
  }, [buildQueue, canAfford, loading, player?.username, factoryX, factoryY, onBuildComplete]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && canAfford && buildQueue.length > 0) handleBuild();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, canAfford, buildQueue, handleBuild]);

  if (!isOpen || !playerResources) return null;

  const queueTotal = buildQueue.reduce((s, e) => s + e.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[95vw] max-w-6xl h-[85vh] bg-gray-950/90 border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden">

        {/* ─── LEFT SIDEBAR: Archetype Nav ─── */}
        <div className="w-48 shrink-0 bg-black/40 border-r border-white/5 p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1 px-2">Archetypes</div>
          {ARCHETYPES.map(a => (
            <button
              key={a.key}
              onClick={() => { setActiveArchetype(a.key); setMessage(''); }}
              className={`relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeArchetype === a.key
                  ? `bg-gradient-to-r ${a.color} ${a.border} ${a.text} shadow-lg ${a.glow} scale-[1.02]`
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-lg">{a.icon}</span>
              <span>{a.label}</span>
              {activeArchetype === a.key && (
                <div className={`absolute right-2 w-1.5 h-1.5 rounded-full ${a.text.replace('text-', 'bg-')}`} />
              )}
            </button>
          ))}
        </div>

        {/* ─── MAIN CONTENT: Unit Cards ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {ARCHETYPES.find(a => a.key === activeArchetype)?.icon} Build Units
              </h2>
              <p className="text-xs text-white/40 mt-0.5">{ARCHETYPES.find(a => a.key === activeArchetype)?.desc}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">⏎ Enter to build</span>
              <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl leading-none">&times;</button>
            </div>
          </div>

          {/* Resource Bar */}
          <div className="flex items-center gap-4 px-6 py-2.5 bg-white/[0.02] border-b border-white/5 text-xs">
            <span className="text-white/40">Resources:</span>
            <span className="text-amber-400">⚙️ {playerResources.metal.toLocaleString()}</span>
            <span className="text-cyan-400">⚡ {playerResources.energy.toLocaleString()}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/40">Slots:</span>
            <span className="text-white/70">{availableSlots.toLocaleString()} / {maxSlots.toLocaleString()}</span>
          </div>

          {/* Unit Grid — scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {availableUnits.map(unit => {
                const inQueue = buildQueue.find(e => e.unitType === unit.type);
                const queueQty = inQueue?.quantity || 0;
                const canAffordUnit = playerResources.metal >= unit.metalCost && playerResources.energy >= unit.energyCost;
                const isLocked = !!(player && unit.levelRequired > player.level);

                return (
                  <div
                    key={unit.type}
                    className={`relative group rounded-xl border transition-all duration-200 ${
                      isLocked
                        ? 'border-white/5 bg-white/[0.02] opacity-40'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] hover:shadow-lg'
                    }`}
                  >
                    {/* Tier Badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/50">
                      T{unit.tier}
                    </div>

                    {/* Locked Overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg mb-1">🔒</div>
                          <div className="text-[10px] text-white/40">Level {unit.levelRequired} req.</div>
                        </div>
                      </div>
                    )}

                    <div className="p-3 pt-7">
                      {/* Name */}
                      <div className="text-sm font-bold text-white mb-1.5 truncate">{unit.name}</div>

                      {/* Stats Bars */}
                      <div className="space-y-1 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-red-400/70 w-6">STR</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (unit.strength / 300) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-white/40 w-8 text-right">{unit.strength}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-blue-400/70 w-6">DEF</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (unit.defense / 300) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-white/40 w-8 text-right">{unit.defense}</span>
                        </div>
                      </div>

                      {/* Costs */}
                      <div className="flex items-center gap-2.5 text-[10px] text-white/50 mb-3">
                        <span className="text-amber-400/70">⚙️{unit.metalCost.toLocaleString()}</span>
                        <span className="text-cyan-400/70">⚡{unit.energyCost.toLocaleString()}</span>
                        <span className="text-white/30">📦{unit.slotCost}</span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeFromQueue(unit.type)}
                          disabled={!inQueue || isLocked}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-20"
                        >
                          &minus;
                        </button>
                        <div className="flex-1 text-center text-sm font-bold text-white tabular-nums">
                          {queueQty || 0}
                        </div>
                        <button
                          onClick={() => addToQueue(unit)}
                          disabled={!canAffordUnit || isLocked}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-20"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`px-6 py-2 text-sm font-semibold text-center ${
              messageType === 'success' ? 'text-green-400 bg-green-500/10' :
              messageType === 'error' ? 'text-red-400 bg-red-500/10' : ''
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Build Queue / Cart ─── */}
        <div className="w-72 shrink-0 bg-black/40 border-l border-white/5 flex flex-col">
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Build Queue</div>
            <div className="text-2xl font-bold text-white mt-1">{queueTotal}</div>
            <div className="text-[10px] text-white/30">units to build</div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {buildQueue.length === 0 && (
              <div className="text-center text-white/20 text-xs py-8">
                Click + on units to add them here
              </div>
            )}
            {buildQueue.map(entry => (
              <div key={entry.unitType} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{entry.config.name}</div>
                  <div className="text-[10px] text-white/40">
                    ⚙️{(entry.config.metalCost * entry.quantity).toLocaleString()} ⚡{(entry.config.energyCost * entry.quantity).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => removeFromQueue(entry.unitType)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/40 text-xs">&minus;</button>
                  <span className="w-6 text-center text-sm font-bold text-white">{entry.quantity}</span>
                  <button onClick={() => addToQueue(entry.config)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/40 text-xs">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-4 py-3 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Total Metal</span>
              <span className={`font-bold ${totals.metal <= playerResources.metal ? 'text-amber-400' : 'text-red-400'}`}>
                ⚙️ {totals.metal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Total Energy</span>
              <span className={`font-bold ${totals.energy <= playerResources.energy ? 'text-cyan-400' : 'text-red-400'}`}>
                ⚡ {totals.energy.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Total Slots</span>
              <span className={`font-bold ${totals.slots <= availableSlots ? 'text-white/70' : 'text-red-400'}`}>
                📦 {totals.slots.toLocaleString()}
              </span>
            </div>

            <button
              onClick={handleBuild}
              disabled={!canAfford || queueTotal === 0 || loading}
              className={`w-full mt-2 py-3 rounded-xl font-bold text-sm transition-all ${
                loading ? 'bg-gray-700 text-gray-400 cursor-wait' :
                canAfford && queueTotal > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {loading ? 'BUILDING...' : `BUILD ${queueTotal} UNITS`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
