/**
 * InventoryPanel Component
 *
 * Created: 2025-10-18
 * Refactored: 2025-10-18 (FID-20251018-044 Phase 4)
 * Neon-noir structural pass: 2026-09-08 (FID-20260908-011)
 *
 * OVERVIEW:
 * Main inventory interface displaying player items with:
 * - Item grid (nn-fade entries)
 * - Filter/sort controls (nn-tabchip + nn-input)
 * - Capacity and bonus statistics (nn-stat instruments)
 * - Active boost display with countdown timer
 * - Rarity-based color coding and borders
 * - Responsive grid layout (1/2/3 columns)
 * - Keyboard shortcuts (I to open, ESC to close)
 *
 * Styling: token primitives only (nn-panel / nn-stat / nn-chip / nn-tabchip /
 * nn-input); legacy bg-bg, border-border, text-text, and bg-accent utility
 * families, kit imports (Panel/StatCard/Button/Badge/Card), and transitions
 * imports removed. Rarity raw-hex glows replaced with accent-tinted token
 * shadows. Logic (fetch, filters, countdown, count-up) byte-preserved.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';
import {
  Package,
  Box,
  Wrench,
  Zap,
  Sparkles,
  Clock,
  ShoppingBag,
  Filter,
  ArrowUpDown,
  Loader2,
  X
} from 'lucide-react';

// ============================================================
// TYPES & ENUMS
// ============================================================

enum ItemRarity {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  Epic = 'Epic',
  Legendary = 'Legendary'
}

interface InventoryItem {
  id: number;
  name: string;
  rarity: ItemRarity;
  type: string;
  description?: string;
  bonusValue?: number;
  quantity?: number;
}

interface GatheringBonus {
  metalBonus: number;
  energyBonus: number;
}

interface ActiveBoosts {
  gatheringBoost: number | null;
  expiresAt: string | null;
}

interface InventoryData {
  capacity: number;
  items: InventoryItem[];
  gatheringBonus: GatheringBonus;
  metalDiggerCount: number;
  energyDiggerCount: number;
  activeBoosts: ActiveBoosts;
}

type FilterType = 'all' | 'diggers' | 'tradeable';
type SortType = 'name' | 'rarity' | 'quantity';

// ============================================================
// RARITY UTILITIES (FID-011: token-only mappings)
// ============================================================

/**
 * Get text class for item rarity
 */
const getRarityColor = (rarity: ItemRarity): string => {
  const colors: Record<ItemRarity, string> = {
    [ItemRarity.Common]: 'nn-text-secondary',
    [ItemRarity.Uncommon]: 'nn-text-green',
    [ItemRarity.Rare]: 'nn-text-cyan',
    [ItemRarity.Epic]: 'nn-text-violet',
    [ItemRarity.Legendary]: 'nn-text-amber'
  };
  return colors[rarity] || 'nn-text-secondary';
};

/**
 * Get border class for item rarity
 */
const getRarityBorder = (rarity: ItemRarity): string => {
  const borders: Record<ItemRarity, string> = {
    [ItemRarity.Common]: 'border-[color-mix(in_oklab,var(--nn-glass-border))]',
    [ItemRarity.Uncommon]: 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]',
    [ItemRarity.Rare]: 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]',
    [ItemRarity.Epic]: 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]',
    [ItemRarity.Legendary]: 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]'
  };
  return borders[rarity] || 'border-[color-mix(in_oklab,var(--nn-glass-border))]';
};

/**
 * Get chip class for item rarity
 */
const getRarityChip = (rarity: ItemRarity): string => {
  const chips: Record<ItemRarity, string> = {
    [ItemRarity.Common]: 'nn-chip',
    [ItemRarity.Uncommon]: 'nn-chip--green',
    [ItemRarity.Rare]: 'nn-chip--cyan',
    [ItemRarity.Epic]: 'nn-chip--violet',
    [ItemRarity.Legendary]: 'nn-chip--amber'
  };
  return chips[rarity] || 'nn-chip';
};

/**
 * Get rarity glow shadow (FID-011: raw Tailwind-palette hexes → token
 * color-mix accents; semantic function — rarity salience — preserved)
 */
const getRarityGlow = (rarity: ItemRarity): string => {
  const glows: Record<ItemRarity, string> = {
    [ItemRarity.Common]: '',
    [ItemRarity.Uncommon]: 'shadow-[0_0_10px_color-mix(in_oklab,var(--nn-green)_30%,transparent)]',
    [ItemRarity.Rare]: 'shadow-[0_0_10px_color-mix(in_oklab,var(--nn-cyan)_30%,transparent)]',
    [ItemRarity.Epic]: 'shadow-[0_0_10px_color-mix(in_oklab,var(--nn-violet)_30%,transparent)]',
    [ItemRarity.Legendary]: 'shadow-[0_0_15px_color-mix(in_oklab,var(--nn-amber)_40%,transparent)]'
  };
  return glows[rarity] || '';
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function InventoryPanel() {
  // ============================================================
  // STATE
  // ============================================================
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('rarity');
  const [boostTimeRemaining, setBoostTimeRemaining] = useState<string>('');

  // Animated counts for statistics
  const capacityCount = useCountUp(inventory?.items.length || 0, { duration: 1000 });
  const metalBonusCount = useCountUp(inventory?.gatheringBonus.metalBonus || 0, { duration: 1200 });
  const energyBonusCount = useCountUp(inventory?.gatheringBonus.energyBonus || 0, { duration: 1200 });

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Fetch inventory data on mount
   */
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/player/inventory');
        if (response.ok) {
          const data = await response.json();
          setInventory(data);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  /**
   * Keyboard shortcuts (I to open, ESC to close)
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (isTypingInInput()) {
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  /**
   * Update boost timer every second
   */
  useEffect(() => {
    if (!inventory?.activeBoosts?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(inventory.activeBoosts.expiresAt!);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setBoostTimeRemaining('EXPIRED');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setBoostTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [inventory?.activeBoosts?.expiresAt]);

  // ============================================================
  // FILTER & SORT LOGIC
  // ============================================================

  /**
   * Get filtered and sorted items
   */
  const getFilteredItems = (): InventoryItem[] => {
    if (!inventory) return [];

    let filtered = inventory.items;

    // Apply filter
    if (filter === 'diggers') {
      filtered = filtered.filter(item => item.type.includes('DIGGER'));
    } else if (filter === 'tradeable') {
      filtered = filtered.filter(item => item.type === 'TRADEABLE_ITEM');
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'rarity') {
        const rarityOrder = [
          ItemRarity.Legendary,
          ItemRarity.Epic,
          ItemRarity.Rare,
          ItemRarity.Uncommon,
          ItemRarity.Common
        ];
        return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
      }
      return (b.quantity || 0) - (a.quantity || 0);
    });

    return filtered;
  };

  const filteredItems = getFilteredItems();

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* Inventory Modal — toggled by keyboard (I / ESC) */}
      {isOpen && (
        <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_75%,transparent)] flex items-center justify-center z-50 p-4">
          <div
            className="nn-panel max-w-4xl w-full max-h-[90vh] overflow-hidden"
            style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}
            role="dialog"
            aria-label="Inventory"
          >
            {/* Header — scanline instrument strip */}
            <div className="nn-panel__header">
              <span className="nn-panel__icon"><Package className="w-4 h-4" /></span>
              <span className="nn-panel__title">Inventory</span>
              <span className="nn-panel__meta">Press I to toggle · ESC to close</span>
              <button
                onClick={() => setIsOpen(false)}
                className="ml-auto nn-abtn nn-abtn--ghost px-3"
                aria-label="Close inventory"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="nn-panel__body text-center py-12">
                <Loader2 className="nn-spin-icon w-7 h-7 mx-auto block mb-4 text-[color:var(--nn-cyan)]" aria-label="Loading inventory" />
                <p className="nn-lab">Loading inventory…</p>
              </div>
            ) : inventory ? (
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-56px)] space-y-6">
                {/* Statistics Grid — nn-stat instruments */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="nn-stat">
                    <div className="nn-stat__lab"><Box className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" /> Capacity</div>
                    <div className="nn-stat__num">
                      {Math.round(capacityCount)} <span className="nn-stat__sub">/ {inventory.capacity}</span>
                    </div>
                  </div>
                  <div className="nn-stat">
                    <div className="nn-stat__lab"><Wrench className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" /> Metal Bonus</div>
                    <div className="nn-stat__num nn-stat__num--glow-amber">+{metalBonusCount.toFixed(1)}%</div>
                  </div>
                  <div className="nn-stat">
                    <div className="nn-stat__lab"><Zap className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" /> Energy Bonus</div>
                    <div className="nn-stat__num nn-stat__num--glow-cyan">+{energyBonusCount.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Active Boost */}
                {inventory?.activeBoosts?.gatheringBoost && (
                  <div className="border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] p-4">
                    <h3 className="nn-lab mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 nn-text-green" />
                      Active Boost
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold nn-num nn-text-green">
                          +{inventory.activeBoosts.gatheringBoost}% gathering bonus
                        </p>
                        <p className="nn-lab flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          Expires in: <span className="nn-num">{boostTimeRemaining}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters and Sort Controls */}
                <div className="nn-surface--dark border border-[color-mix(in_oklab,var(--nn-glass-border))] p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Filter Chips */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="nn-panel__icon"><Filter className="w-4 h-4" /></span>
                      <span className="nn-lab uppercase mr-1">Filter</span>
                      <button
                        onClick={() => setFilter('all')}
                        className={`nn-tabchip px-3 ${filter === 'all' ? 'nn-tabchip--on' : ''}`}
                      >
                        All Items
                      </button>
                      <button
                        onClick={() => setFilter('diggers')}
                        className={`nn-tabchip px-3 ${filter === 'diggers' ? 'nn-tabchip--on' : ''}`}
                      >
                        <Wrench className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                        Diggers
                      </button>
                      <button
                        onClick={() => setFilter('tradeable')}
                        className={`nn-tabchip px-3 ${filter === 'tradeable' ? 'nn-tabchip--on' : ''}`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                        Tradeable
                      </button>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2 md:ml-auto">
                      <ArrowUpDown className="w-3.5 h-3.5 nn-text-dim" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortType)}
                        className="nn-input py-1.5 text-sm"
                        aria-label="Sort items"
                      >
                        <option value="rarity">Sort by Rarity</option>
                        <option value="name">Sort by Name</option>
                        <option value="quantity">Sort by Quantity</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Items Grid */}
                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="nn-fade">
                        <div
                          className={`nn-panel border-2 ${getRarityBorder(item.rarity)} ${getRarityGlow(item.rarity)}`}
                        >
                          <div className="p-4">
                            {/* Item Header */}
                            <div className="flex justify-between items-start mb-2">
                              <h3 className={`font-bold text-base ${getRarityColor(item.rarity)}`}>
                                {item.name}
                              </h3>
                              {item.quantity && item.quantity > 1 && (
                                <span className="nn-chip nn-num">×{item.quantity}</span>
                              )}
                            </div>

                            {/* Rarity Chip */}
                            <span className={`nn-chip ${getRarityChip(item.rarity)}`}>
                              {item.rarity}
                            </span>

                            {/* Description */}
                            {item.description && (
                              <p className="nn-text-dim text-sm mt-2">
                                {item.description}
                              </p>
                            )}

                            {/* Bonus Value */}
                            {item.bonusValue && (
                              <div className="mt-2 border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2">
                                <p className="text-sm font-bold nn-num nn-text-green">
                                  Bonus: +{item.bonusValue}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nn-panel text-center py-12">
                    <div className="nn-panel__body">
                      <Package className="w-14 h-14 mx-auto mb-4 nn-text-dim opacity-50" />
                      <p className="text-lg nn-text-primary mb-2">No items found</p>
                      <p className="nn-lab">Explore caves to discover items!</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="nn-panel m-6 text-center py-12">
                <div className="nn-panel__body">
                  <p className="nn-text-magenta text-lg">Failed to load inventory</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// STYLING (FID-20260908-011):
// - Token primitives only: nn-panel / nn-stat / nn-chip / nn-tabchip /
//   nn-input / nn-surface / nn-lab / nn-num
// - Kit imports (Panel/StatCard/Button/Badge/Card) removed
// - Legacy bg-bg-*/border-border-*/text-text-*/bg-accent-* removed
// - Rarity glows: raw Tailwind-palette hexes → token color-mix accents
//
// FEATURES:
// - Real-time boost countdown timer
// - Filter by type (all/diggers/tradeable)
// - Sort by name, rarity, or quantity
// - Rarity-based borders and chips (5 tiers)
// - Keyboard shortcuts (I to toggle, ESC to close)
// - Responsive grid (1/2/3 columns)
// - Empty state with helpful message
// - Loading state with gated spinner
// - Error state with styled message
// - Count-up statistics retained (useCountUp)
// ============================================================
// END OF FILE
// ============================================================
