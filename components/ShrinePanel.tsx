// ============================================================
// FILE: components/ShrinePanel.tsx
// CREATED: 2025-10-17
// UPDATED: 2026-09-09 (FID-20260909-028 §2.6: full neon noir structural pass —
//   gradient BOOST-ALL hero → nn-panel with amber sec tick; emoji headers and
//   suit glyphs → lucide icons + text glyph marks; raw focus:border-yellow-400
//   input → nn-input; ad-hoc buttons → nn-btn family; doubled background
//   classes removed. All transaction/timer logic byte-preserved.)
// ============================================================
// OVERVIEW:
// Inline panel that displays in center view when player visits Shrine tile
// (1,1). Allows:
// 1. Sacrifice tradeable items to purchase gathering boost duration
// 2. Item rarity determines time value (Common=15min, Legendary=2hr)
// 3. "Boost All 4 Suits" for convenient activation
// 4. View active boost timers and total yield bonus
//
// Four boost tiers (all provide +25% yield):
// - Spade ♠ | Heart ♥ | Diamond ♦ | Club ♣
//
// Time Values per Item:
// - Common: 15 minutes · Uncommon: 30 · Rare: 60 · Epic: 90 · Legendary: 120
// - Max duration: 8 hours per buff
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { Landmark, Sparkles, Timer, Info } from 'lucide-react';
import { ShrineBoost, ShrineBoostTier, InventoryItem } from '@/types';
import { estimateDuration, formatDuration, MAX_BUFF_DURATION_HOURS } from '@/utils/shrineHelpers';
import { extractApiError } from '@/lib/apiClient';

interface ShrinePanelProps {
  tradeableItems: InventoryItem[];
  activeBoosts: ShrineBoost[];
  onTransaction: () => void;
  onBack: () => void;
}

interface BoostConfig {
  tier: ShrineBoostTier;
  name: string;
  glyph: string;
  yieldBonus: number;
}

const BOOST_CONFIGS: BoostConfig[] = [
  { tier: 'spade', name: 'Spade', glyph: '♠', yieldBonus: 0.25 },
  { tier: 'heart', name: 'Heart', glyph: '♥', yieldBonus: 0.25 },
  { tier: 'diamond', name: 'Diamond', glyph: '♦', yieldBonus: 0.25 },
  { tier: 'club', name: 'Club', glyph: '♣', yieldBonus: 0.25 }
];

/** Preset durations shared by boost-all and the per-suit rows. */
const PRESETS: { label: string; hours: number; max?: boolean }[] = [
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: '6h', hours: 6 },
  { label: '8h MAX', hours: 8, max: true }
];

export default function ShrinePanel({
  tradeableItems,
  activeBoosts,
  onTransaction,
  onBack
}: ShrinePanelProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Individual buff item amounts
  const [itemAmounts, setItemAmounts] = useState<Record<ShrineBoostTier, string>>({
    spade: '',
    heart: '',
    diamond: '',
    club: ''
  });

  // Boost All input
  const [boostAllAmount, setBoostAllAmount] = useState('');

  // Timers for active boosts
  const [timers, setTimers] = useState<Record<ShrineBoostTier, string>>({
    spade: '',
    heart: '',
    diamond: '',
    club: ''
  });

  // Update timers every second
  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();
      const newTimers: Record<ShrineBoostTier, string> = {
        spade: '',
        heart: '',
        diamond: '',
        club: ''
      };

      activeBoosts.forEach(boost => {
        const expiresAt = new Date(boost.expiresAt);
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          newTimers[boost.tier] = `${hours}h ${minutes}m`;
        }
      });

      setTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [activeBoosts]);

  const getActiveBoost = (tier: ShrineBoostTier): ShrineBoost | undefined => {
    return activeBoosts.find(b => b.tier === tier);
  };

  const isBoostActive = (tier: ShrineBoostTier): boolean => {
    const boost = getActiveBoost(tier);
    if (!boost) return false;
    return new Date(boost.expiresAt) > new Date();
  };

  const getTotalYieldBonus = (): number => {
    const now = new Date();
    return activeBoosts
      .filter(boost => new Date(boost.expiresAt) > now)
      .reduce((sum, boost) => sum + boost.yieldBonus, 0);
  };

  const getEstimatedDuration = (itemCount: number): string => {
    if (!itemCount || itemCount <= 0) return '0m';
    const minutes = estimateDuration(itemCount);
    return formatDuration(minutes);
  };

  /**
   * Calculate maximum items needed to reach 8-hour cap based on average rarity distribution
   * Uses the same estimation logic as duration preview
   */
  const getMaxItemsForCap = (): number => {
    const maxMinutes = MAX_BUFF_DURATION_HOURS * 60; // 480 minutes

    // Average minutes per item based on expected distribution (60/25/10/4/1)
    // Common: 15min * 0.60 = 9
    // Uncommon: 30min * 0.25 = 7.5
    // Rare: 60min * 0.10 = 6
    // Epic: 90min * 0.04 = 3.6
    // Legendary: 120min * 0.01 = 1.2
    // Total: 27.3 minutes average per item
    const avgMinutesPerItem = 27.3;

    // Max items needed: 480 / 27.3 ≈ 18 items (rounded up for safety)
    return Math.ceil(maxMinutes / avgMinutesPerItem);
  };

  /**
   * Handle input change with validation - cap at max needed for 8 hours
   */
  const handleItemAmountChange = (tier: ShrineBoostTier, value: string) => {
    const numValue = parseInt(value);
    const maxNeeded = getMaxItemsForCap();

    // Allow empty string for clearing
    if (value === '') {
      setItemAmounts({ ...itemAmounts, [tier]: '' });
      return;
    }

    // Cap at max needed for 8 hours
    if (numValue > maxNeeded) {
      setItemAmounts({ ...itemAmounts, [tier]: maxNeeded.toString() });
      setMessage(`Capped at ${maxNeeded} items (8-hour maximum)`);
      setTimeout(() => setMessage(''), 3000);
    } else if (numValue >= 0) {
      setItemAmounts({ ...itemAmounts, [tier]: value });
    }
  };

  /**
   * Handle Boost All input with validation
   */
  const handleBoostAllChange = (value: string) => {
    const numValue = parseInt(value);
    const maxNeeded = getMaxItemsForCap();

    // Allow empty string for clearing
    if (value === '') {
      setBoostAllAmount('');
      return;
    }

    // Cap at max needed for 8 hours per suit
    if (numValue > maxNeeded) {
      setBoostAllAmount(maxNeeded.toString());
      setMessage(`Capped at ${maxNeeded} items per suit (8-hour maximum)`);
      setTimeout(() => setMessage(''), 3000);
    } else if (numValue >= 0) {
      setBoostAllAmount(value);
    }
  };

  /**
   * Calculate items needed for a specific duration in hours
   */
  const getItemsForDuration = (hours: number): number => {
    const targetMinutes = hours * 60;
    const avgMinutesPerItem = 27.3; // Based on rarity distribution
    return Math.ceil(targetMinutes / avgMinutesPerItem);
  };

  /**
   * Set preset duration for individual boost
   */
  const setPresetDuration = (tier: ShrineBoostTier, hours: number) => {
    const items = getItemsForDuration(hours);
    setItemAmounts({ ...itemAmounts, [tier]: items.toString() });
  };

  /**
   * Set preset duration for Boost All
   */
  const setPresetDurationAll = (hours: number) => {
    const items = getItemsForDuration(hours);
    setBoostAllAmount(items.toString());
  };

  const handleActivateBoost = async (tier: ShrineBoostTier) => {
    const itemCount = parseInt(itemAmounts[tier]);
    if (!itemCount || itemCount <= 0) {
      setMessage('Enter a valid number of items');
      return;
    }

    if (itemCount > tradeableItems.length) {
      setMessage(`You only have ${tradeableItems.length} tradeable items`);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/shrine/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, itemCount })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setItemAmounts({ ...itemAmounts, [tier]: '' });
        onTransaction();
      } else {
        // FID-20260911-041: read the server's actual rejection reason —
        // error bodies nest it under error.message; data.message is absent
        // on structured failures (was always 'Activation failed').
        setMessage(extractApiError(data, response.status));
      }
    } catch {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleBoostAll = async () => {
    const itemCount = parseInt(boostAllAmount);
    if (!itemCount || itemCount <= 0) {
      setMessage('Enter a valid number of items per suit');
      return;
    }

    const totalNeeded = itemCount * 4;
    if (totalNeeded > tradeableItems.length) {
      setMessage(`Need ${totalNeeded} items total (you have ${tradeableItems.length})`);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/shrine/boost-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCount })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setBoostAllAmount('');
        onTransaction();
      } else {
        // FID-20260911-041: same fix — surface the server's reason verbatim.
        setMessage(extractApiError(data, response.status));
      }
    } catch {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = tradeableItems.length;
  const boostAllTotal = parseInt(boostAllAmount) * 4 || 0;
  const canBoostAll = boostAllTotal > 0 && boostAllTotal <= totalItems;
  const activeCount = activeBoosts.filter(b => new Date(b.expiresAt) > new Date()).length;
  const isOkMessage = message.startsWith('Boosted') || message.startsWith('Capped');
  const isError = !isOkMessage && message.length > 0 && (message.startsWith('Enter') || message.startsWith('You only') || message.startsWith('Need') || message === 'Network error' || message.includes('failed'));

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto nn-surface">
      {/* Section strip — flat neon noir header (gradient hero removed) */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0">
        <div className="nn-sec nn-sec--violet">
          <Landmark className="w-4 h-4" style={{ color: 'var(--nn-violet)', display: 'inline-flex' }} />
          <span className="nn-sec__title">Ancient Shrine of Power</span>
          <span className="nn-sec__note">Sacrifice ▸ Duration</span>
          <span className="nn-sec__end flex items-center gap-2">
            <span className="nn-chip nn-chip--cyan">{totalItems} tradeable</span>
            <span className="nn-chip nn-chip--green">{activeCount}/4 active</span>
            <span className="nn-chip nn-chip--amber">x{(1 + getTotalYieldBonus()).toFixed(2)} yield</span>
          </span>
        </div>
      </div>

      {/* Back to game — nn-btn ghost */}
      <div className="px-6 pb-4 flex-shrink-0">
        <button onClick={onBack} className="nn-btn nn-btn--ghost">
          <span aria-hidden>←</span> Back to Game
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 space-y-4">
        {/* Boost All 4 Suits */}
        <div className="nn-panel">
          <div className="nn-panel__header">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--nn-amber)', display: 'inline-flex' }} />
            <span className="nn-panel__title">Boost All 4 Suits</span>
            <span className="nn-panel__meta">UNIFORM DURATION ▸ +25% EACH</span>
            <span className="nn-chip nn-chip--amber ml-auto">x2.0 AT FULL SPREAD</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            {/* Quick presets */}
            <div className="flex items-center gap-2 mb-3">
              <span className="nn-row__label">Quick</span>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPresetDurationAll(p.hours)}
                  className="nn-chip nn-chip--violet px-2.5 py-1 text-xs font-semibold"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="nn-row__label mb-1 block">Items per suit</label>
                <input
                  type="number"
                  value={boostAllAmount}
                  onChange={(e) => handleBoostAllChange(e.target.value)}
                  className="nn-input w-full"
                  placeholder="e.g. 10"
                  min="1"
                />
              </div>
              <button
                onClick={handleBoostAll}
                disabled={loading || !canBoostAll}
                className="nn-btn nn-btn--amber whitespace-nowrap"
              >
                Activate All
              </button>
            </div>

            {boostAllAmount && (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <span className="nn-chip nn-chip--cyan">{boostAllTotal} items total</span>
                <span className="nn-chip nn-chip--amber">~{getEstimatedDuration(parseInt(boostAllAmount))} each</span>
                {boostAllTotal > totalItems && (
                  <span className="nn-chip nn-chip--magenta">Shortfall {boostAllTotal - totalItems}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Individual Boost Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {BOOST_CONFIGS.map(config => {
            const isActive = isBoostActive(config.tier);
            const itemCount = parseInt(itemAmounts[config.tier]) || 0;
            const canAfford = itemCount > 0 && itemCount <= totalItems;

            return (
              <div key={config.tier} className="nn-panel">
                <div className="nn-panel__header">
                  <span
                    className="nn-num inline-flex items-center justify-center"
                    style={{
                      color: isActive ? 'var(--nn-green)' : 'var(--nn-violet)',
                      width: 28,
                      height: 28,
                      border: `1px solid color-mix(in oklab, ${isActive ? 'var(--nn-green)' : 'var(--nn-violet)'} 45%, transparent)`,
                      fontSize: 15,
                      fontWeight: 700
                    }}
                    aria-hidden
                  >
                    {config.glyph}
                  </span>
                  <span className="nn-panel__title">{config.name}</span>
                  <span className="nn-panel__meta">+{config.yieldBonus * 100}% YIELD</span>
                  {isActive ? (
                    <span className="nn-chip nn-chip--green ml-auto">
                      <Timer className="w-3 h-3 mr-1 inline" />{timers[config.tier]}
                    </span>
                  ) : (
                    <span className="nn-chip ml-auto">IDLE</span>
                  )}
                </div>
                <div className="nn-panel__body nn-panel__body--padded space-y-3">
                  {/* Purchase input */}
                  <div>
                    <label className="nn-row__label mb-1 block">Items to sacrifice</label>

                    {/* Quick preset chips */}
                    <div className="flex items-center gap-2 mb-2">
                      {PRESETS.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setPresetDuration(config.tier, p.hours)}
                          className="nn-chip nn-chip--violet px-2 py-0.5 text-xs font-semibold"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      value={itemAmounts[config.tier]}
                      onChange={(e) => handleItemAmountChange(config.tier, e.target.value)}
                      className="nn-input w-full"
                      placeholder="0"
                      min="1"
                    />
                  </div>

                  {/* Duration preview */}
                  {itemCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="nn-chip nn-chip--amber">~{getEstimatedDuration(itemCount)}</span>
                      {itemCount > totalItems && (
                        <span className="nn-chip nn-chip--magenta">Not enough items</span>
                      )}
                    </div>
                  )}

                  {/* Activate */}
                  <button
                    onClick={() => handleActivateBoost(config.tier)}
                    disabled={loading || !canAfford}
                    className={`w-full ${isActive ? 'nn-btn nn-btn--primary' : 'nn-btn nn-btn--ghost'}`}
                  >
                    {isActive ? 'Replace / Extend' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status message — flat chips, no emoji sentinels */}
        {message && (
          <div className="flex">
            <span className={`nn-chip ${isError ? 'nn-chip--magenta' : 'nn-chip--green'}`}>
              {message}
            </span>
          </div>
        )}

        {/* Mechanics — nn-panel with nn-row ledger */}
        <div className="nn-panel">
          <div className="nn-panel__header">
            <Info className="w-3.5 h-3.5" style={{ color: 'var(--nn-cyan)', display: 'inline-flex' }} />
            <span className="nn-panel__title">Mechanics</span>
            <span className="nn-panel__meta">RARITY ▸ TIME VALUE</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded space-y-2">
            <div className="nn-row">
              <span className="nn-row__label">Sacrifice</span>
              <span className="nn-row__value nn-text-secondary">Tradeable items purchase buff duration</span>
            </div>
            <div className="nn-row">
              <span className="nn-row__label">Rarity value</span>
              <span className="nn-row__value nn-text-secondary">Common 15m · Uncommon 30m · Rare 1h · Epic 1.5h · Legendary 2h</span>
            </div>
            <div className="nn-row">
              <span className="nn-row__label">Full spread</span>
              <span className="nn-row__value nn-text-amber">All 4 active = +100% gathering = x2.0</span>
            </div>
            <div className="nn-row">
              <span className="nn-row__label">Cap</span>
              <span className="nn-row__value nn-text-secondary">8 hours per buff</span>
            </div>
            <div className="nn-row">
              <span className="nn-row__label">Boost all</span>
              <span className="nn-row__value nn-text-secondary">Activates every suit at the same duration</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
