/**
 * @file components/ShrinePanel.tsx
 * @created 2025-10-17
 * @updated 2025-10-25
 * @overview Shrine interface for direct-purchase gathering boosts
 * 
 * OVERVIEW:
 * Inline panel that displays in center view when player visits Shrine tile (1,1). Allows:
 * 1. Sacrifice tradeable items to purchase gathering boost duration
 * 2. Item rarity determines time value (Common=15min, Legendary=2hr)
 * 3. "Boost All 4 Suits" button for convenient activation
 * 4. View active boost timers and total yield bonus
 * 
 * Four boost tiers (all provide +25% yield):
 * - Spade ♠️ | Heart ♥️ | Diamond ♦️ | Club ♣️
 * 
 * Time Values per Item:
 * - Common: 15 minutes
 * - Uncommon: 30 minutes
 * - Rare: 1 hour
 * - Epic: 1.5 hours
 * - Legendary: 2 hours
 * - Max duration: 8 hours per buff
 */

'use client';

import { useState, useEffect } from 'react';
import { ShrineBoost, ShrineBoostTier, InventoryItem } from '@/types';
import { estimateDuration, formatDuration, MAX_BUFF_DURATION_HOURS } from '@/utils/shrineHelpers';

interface ShrinePanelProps {
  tradeableItems: InventoryItem[];
  activeBoosts: ShrineBoost[];
  onTransaction: () => void;
  onBack: () => void;
}

interface BoostConfig {
  tier: ShrineBoostTier;
  name: string;
  icon: string;
  yieldBonus: number;
}

const BOOST_CONFIGS: BoostConfig[] = [
  { tier: 'spade', name: 'Spade', icon: '♠️', yieldBonus: 0.25 },
  { tier: 'heart', name: 'Heart', icon: '♥️', yieldBonus: 0.25 },
  { tier: 'diamond', name: 'Diamond', icon: '♦️', yieldBonus: 0.25 },
  { tier: 'club', name: 'Club', icon: '♣️', yieldBonus: 0.25 }
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
      setMessage(`ℹ️ Capped at ${maxNeeded} items (8-hour maximum)`);
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
      setMessage(`ℹ️ Capped at ${maxNeeded} items per suit (8-hour maximum)`);
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
      setMessage('❌ Enter a valid number of items');
      return;
    }

    if (itemCount > tradeableItems.length) {
      setMessage(`❌ You only have ${tradeableItems.length} tradeable items`);
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
        setMessage(`✅ ${data.message}`);
        setItemAmounts({ ...itemAmounts, [tier]: '' });
        onTransaction();
      } else {
        setMessage(`❌ ${data.message || 'Activation failed'}`);
      }
    } catch {
      setMessage('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleBoostAll = async () => {
    const itemCount = parseInt(boostAllAmount);
    if (!itemCount || itemCount <= 0) {
      setMessage('❌ Enter a valid number of items per suit');
      return;
    }

    const totalNeeded = itemCount * 4;
    if (totalNeeded > tradeableItems.length) {
      setMessage(`❌ Need ${totalNeeded} items total (you have ${tradeableItems.length})`);
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
        setMessage(`✅ ${data.message}`);
        setBoostAllAmount('');
        onTransaction();
      } else {
        setMessage(`❌ ${data.message || 'Activation failed'}`);
      }
    } catch {
      setMessage('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = tradeableItems.length;
  const boostAllTotal = parseInt(boostAllAmount) * 4 || 0;
  const canBoostAll = boostAllTotal > 0 && boostAllTotal <= totalItems;

  return (
    <div className="h-full w-full flex flex-col p-6 bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] overflow-y-auto">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-none transition-colors"
        >
          <span className="text-lg">←</span>
          <span>Back to Game</span>
        </button>
      </div>

      {/* Header */}
      <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-6 mb-4">
        <h2 className="text-3xl font-bold text-[color:var(--nn-violet)] mb-2">
          ⛩️ Ancient Shrine of Power
        </h2>
        
        {/* Status */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] p-4 rounded-none mt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[color:var(--nn-violet)]">Tradeable Items: <span className="text-[color:var(--nn-text-primary)] font-bold">{totalItems}</span></p>
              <p className="text-[color:var(--nn-violet)]">Active Boosts: <span className="text-[color:var(--nn-text-primary)] font-bold">{activeBoosts.filter(b => new Date(b.expiresAt) > new Date()).length} / 4</span></p>
            </div>
            <div className="text-right">
              <p className="text-[color:var(--nn-violet)]">Total Gathering Bonus:</p>
              <p className="text-[color:var(--nn-amber)] text-2xl font-bold">x{(1 + getTotalYieldBonus()).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Boost All 4 Suits Button */}
        <div className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4">
          <h3 className="text-xl font-bold text-[color:var(--nn-amber)] mb-3">⚡ BOOST ALL 4 SUITS</h3>
          
          {/* Quick Preset Buttons */}
          <div className="flex gap-2 mb-3">
            <span className="text-[color:var(--nn-violet)] text-sm self-center mr-2">Quick:</span>
            <button
              onClick={() => setPresetDurationAll(2)}
              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-sm font-semibold transition-colors"
            >
              2h
            </button>
            <button
              onClick={() => setPresetDurationAll(4)}
              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-sm font-semibold transition-colors"
            >
              4h
            </button>
            <button
              onClick={() => setPresetDurationAll(6)}
              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-sm font-semibold transition-colors"
            >
              6h
            </button>
            <button
              onClick={() => setPresetDurationAll(8)}
              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-sm font-bold transition-colors"
            >
              8h MAX
            </button>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[color:var(--nn-violet)] text-sm block mb-1">Items per suit:</label>
              <input
                type="number"
                value={boostAllAmount}
                onChange={(e) => handleBoostAllChange(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-3 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] focus:border-yellow-400 focus:outline-none"
                placeholder="e.g. 10"
                min="1"
              />
            </div>
            <button
              onClick={handleBoostAll}
              disabled={loading || !canBoostAll}
              className={`px-6 py-2 rounded-none font-bold whitespace-nowrap ${
                loading || !canBoostAll
                  ? 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)] cursor-not-allowed'
                  : 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)]'
              }`}
            >
              Activate All
            </button>
          </div>
          {boostAllAmount && (
            <div className="mt-2 text-sm">
              <p className="text-[color:var(--nn-violet)]">
                Total: <span className="text-[color:var(--nn-text-primary)] font-bold">{boostAllTotal} items</span>
                {' | '}
                Duration: <span className="text-[color:var(--nn-amber)] font-bold">~{getEstimatedDuration(parseInt(boostAllAmount))}</span> each
              </p>
              {boostAllTotal > totalItems && (
                <p className="text-[color:var(--nn-magenta)] mt-1">❌ Not enough items (need {boostAllTotal}, have {totalItems})</p>
              )}
            </div>
          )}
        </div>

        {/* Individual Boost Cards */}
        <div className="grid grid-cols-2 gap-4">
          {BOOST_CONFIGS.map(config => {
            const isActive = isBoostActive(config.tier);
            const activeBoost = getActiveBoost(config.tier);
            const itemCount = parseInt(itemAmounts[config.tier]) || 0;
            const canAfford = itemCount > 0 && itemCount <= totalItems;

            return (
              <div
                key={config.tier}
                className={`border-2 rounded-none p-4 ${
                  isActive
                    ? 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]'
                    : 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{config.icon}</span>
                    <div>
                      <h3 className="text-[color:var(--nn-text-primary)] font-bold">{config.name}</h3>
                      <p className="text-[color:var(--nn-violet)] text-sm">+{(config.yieldBonus * 100)}% Yield</p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] px-2 py-1 rounded-none text-xs font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Active Boost Timer */}
                {isActive && activeBoost && (
                  <div className="mb-3 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] p-2 rounded-none">
                    <div className="flex justify-between text-sm">
                      <span className="text-[color:var(--nn-green)]">Time Remaining:</span>
                      <span className="text-[color:var(--nn-green)] font-bold">{timers[config.tier]}</span>
                    </div>
                  </div>
                )}

                {/* Purchase Input */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[color:var(--nn-violet)] text-xs block mb-1">Items to sacrifice:</label>
                    
                    {/* Quick Preset Buttons */}
                    <div className="flex gap-2 mb-2">
                      <span className="text-[color:var(--nn-violet)] text-xs self-center mr-1">Quick:</span>
                      <button
                        onClick={() => setPresetDuration(config.tier, 2)}
                        className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                      >
                        2h
                      </button>
                      <button
                        onClick={() => setPresetDuration(config.tier, 4)}
                        className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                      >
                        4h
                      </button>
                      <button
                        onClick={() => setPresetDuration(config.tier, 6)}
                        className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                      >
                        6h
                      </button>
                      <button
                        onClick={() => setPresetDuration(config.tier, 8)}
                        className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-bold transition-colors"
                      >
                        8h MAX
                      </button>
                    </div>
                    
                    <input
                      type="number"
                      value={itemAmounts[config.tier]}
                      onChange={(e) => handleItemAmountChange(config.tier, e.target.value)}
                      className="nn-input w-full text-sm"
                      placeholder="0"
                      min="1"
                    />
                  </div>

                  {/* Duration Preview */}
                  {itemCount > 0 && (
                    <p className="text-[color:var(--nn-violet)] text-xs">
                      Duration: <span className="text-[color:var(--nn-amber)] font-bold">~{getEstimatedDuration(itemCount)}</span>
                      {itemCount > totalItems && <span className="text-[color:var(--nn-magenta)] ml-1">(not enough!)</span>}
                    </p>
                  )}

                  {/* Activate Button */}
                  <button
                    onClick={() => handleActivateBoost(config.tier)}
                    disabled={loading || !canAfford}
                    className={`w-full py-2 px-4 rounded-none font-bold text-sm ${
                      loading || !canAfford
                        ? 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)] cursor-not-allowed'
                        : isActive
                        ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                        : 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                    }`}
                  >
                    {isActive ? '🔄 Replace/Extend' : '⛩️ Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-none ${
            message.includes('✅')
              ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)]'
              : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)]'
          }`}>
            {message}
          </div>
        )}

        {/* Help Text */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] p-3 rounded-none text-[color:var(--nn-violet)] text-sm space-y-1">
          <p>💡 <strong>How It Works:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Sacrifice tradeable items to purchase buff duration</li>
            <li>Item rarity determines time value (Common=15min, Legendary=2hr)</li>
            <li>All 4 boosts active = +100% gathering = x2.0 multiplier</li>
            <li>Maximum 8 hours per buff</li>
            <li>Use &quot;Boost All 4&quot; for quick activation with same duration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
