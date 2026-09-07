/**
 * Inventory Page
 * Full-page inventory management system
 * 
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Full-page replacement for InventoryPanel modal. Displays all player items with:
 * - Filtering (All, Diggers, Tradeable)
 * - Sorting (Name, Rarity, Quantity)
 * - Capacity tracking
 * - Digger counts and gathering bonuses
 * - Active boosts with countdown timers
 * - Large grid layout (5-6 columns)
 * - Back button navigation to /game
 * 
 * Features:
 * - Item grid with rarity-based coloring
 * - Real-time boost timers
 * - Comprehensive stats display
 * - Responsive design for all screens
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { BackButton } from '@/components';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  rarity: string;
  category: string;
  description?: string;
  gatheringBonus?: number;
}

interface PlayerInventory {
  items: InventoryItem[];
  capacity: number;
  usedSlots: number;
  diggers: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  activeBoosts: Array<{
    type: string;
    multiplier: number;
    expiresAt: string;
  }>;
}

type FilterType = 'all' | 'diggers' | 'tradeable';
type SortType = 'name' | 'rarity' | 'quantity';

const RARITY_COLORS = {
  Common: 'border-[color-mix(in_oklab,var(--nn-cyan)_30%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]',
  Uncommon: 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]',
  Rare: 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]',
  Epic: 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]',
  Legendary: 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]',
};

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export default function InventoryPage() {
  const router = useRouter();
  const { player } = useGameContext();
  const [inventory, setInventory] = useState<PlayerInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('rarity');
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!player) {
      router.push('/login');
      return;
    }

    const username = player.username;

    const fetchInventory = async () => {
      try {
        const response = await fetch(`/api/inventory?username=${username}`);
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
  }, [player, router]);

  // Update boost timers every second
  useEffect(() => {
    if (!inventory?.activeBoosts) return;

    const updateTimers = () => {
      const newTimeRemaining: Record<string, string> = {};
      
      inventory.activeBoosts.forEach((boost) => {
        const now = Date.now();
        const expiresAt = new Date(boost.expiresAt).getTime();
        const diffMs = expiresAt - now;

        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          newTimeRemaining[boost.type] = `${hours}h ${minutes}m ${seconds}s`;
        } else {
          newTimeRemaining[boost.type] = 'Expired';
        }
      });

      setTimeRemaining(newTimeRemaining);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [inventory?.activeBoosts]);

  const getFilteredItems = () => {
    if (!inventory) return [];

    let filtered = [...inventory.items];

    // Apply filter
    if (filter === 'diggers') {
      filtered = filtered.filter(item => item.category === 'digger');
    } else if (filter === 'tradeable') {
      filtered = filtered.filter(item => item.category === 'tradeable' || item.category === 'resource');
    }

    // Apply sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'rarity') {
      filtered.sort((a, b) => {
        const rarityA = RARITY_ORDER.indexOf(a.rarity);
        const rarityB = RARITY_ORDER.indexOf(b.rarity);
        return rarityB - rarityA; // Descending (Legendary first)
      });
    } else if (sortBy === 'quantity') {
      filtered.sort((a, b) => b.quantity - a.quantity);
    }

    return filtered;
  };

  const calculateTotalGatheringBonus = () => {
    if (!inventory) return 0;

    let totalBonus = 0;

    // Add digger bonuses
    totalBonus += inventory.diggers.common * 5;
    totalBonus += inventory.diggers.uncommon * 15;
    totalBonus += inventory.diggers.rare * 30;
    totalBonus += inventory.diggers.epic * 60;
    totalBonus += inventory.diggers.legendary * 120;

    // Add active boost multipliers
    inventory.activeBoosts.forEach(boost => {
      totalBonus += (boost.multiplier - 1) * 100; // Convert multiplier to percentage
    });

    return totalBonus;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <p className="text-xl">Loading inventory...</p>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <p className="text-xl">Failed to load inventory</p>
      </div>
    );
  }

  const filteredItems = getFilteredItems();
  const totalGatheringBonus = calculateTotalGatheringBonus();

  return (
    <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <h1 className="text-4xl font-bold mt-4">Inventory</h1>
        </div>

        {/* Stats Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Capacity */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <h3 className="text-lg font-semibold mb-2">Capacity</h3>
            <p className="text-2xl">
              {inventory.usedSlots.toLocaleString()} / {inventory.capacity.toLocaleString()}
            </p>
            <div className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-full h-2 mt-2">
              <div
                className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] h-2 rounded-full transition-all"
                style={{ width: `${(inventory.usedSlots / inventory.capacity) * 100}%` }}
              />
            </div>
          </div>

          {/* Diggers */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <h3 className="text-lg font-semibold mb-2">Diggers</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-[color:var(--nn-text-secondary)]">Common:</span> {inventory.diggers.common}</p>
              <p><span className="text-[color:var(--nn-green)]">Uncommon:</span> {inventory.diggers.uncommon}</p>
              <p><span className="text-[color:var(--nn-cyan)]">Rare:</span> {inventory.diggers.rare}</p>
              <p><span className="text-[color:var(--nn-violet)]">Epic:</span> {inventory.diggers.epic}</p>
              <p><span className="text-[color:var(--nn-amber)]">Legendary:</span> {inventory.diggers.legendary}</p>
            </div>
          </div>

          {/* Gathering Bonus */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <h3 className="text-lg font-semibold mb-2">Gathering Bonus</h3>
            <p className="text-3xl text-[color:var(--nn-green)]">+{totalGatheringBonus}%</p>
            <p className="text-sm text-[color:var(--nn-text-secondary)] mt-1">
              From diggers and active boosts
            </p>
          </div>
        </div>

        {/* Active Boosts */}
        {inventory.activeBoosts.length > 0 && (
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] mb-6">
            <h3 className="text-lg font-semibold mb-3">Active Boosts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {inventory.activeBoosts.map((boost) => (
                <div
                  key={boost.type}
                  className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-3 rounded-none border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]"
                >
                  <p className="font-semibold">{boost.type}</p>
                  <p className="text-[color:var(--nn-green)]">×{boost.multiplier.toFixed(2)}</p>
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">
                    {timeRemaining[boost.type] || 'Calculating...'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Filter */}
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Filter:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-none ${
                    filter === 'all'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('diggers')}
                  className={`px-4 py-2 rounded-none ${
                    filter === 'diggers'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  Diggers
                </button>
                <button
                  onClick={() => setFilter('tradeable')}
                  className={`px-4 py-2 rounded-none ${
                    filter === 'tradeable'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  Tradeable
                </button>
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Sort by:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('rarity')}
                  className={`px-4 py-2 rounded-none ${
                    sortBy === 'rarity'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  Rarity
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-4 py-2 rounded-none ${
                    sortBy === 'name'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  Name
                </button>
                <button
                  onClick={() => setSortBy('quantity')}
                  className={`px-4 py-2 rounded-none ${
                    sortBy === 'quantity'
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  Quantity
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-none border-2 ${
                RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ||
                'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]'
              }`}
            >
              <h4 className="font-semibold text-sm mb-1 truncate">{item.name}</h4>
              <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">{item.rarity}</p>
              <p className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
                {item.quantity.toLocaleString()}
              </p>
              {item.gatheringBonus && (
                <p className="text-xs text-[color:var(--nn-green)] mt-1">
                  +{item.gatheringBonus}% gathering
                </p>
              )}
              {item.description && (
                <p className="text-xs text-[color:var(--nn-text-secondary)] mt-2 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-[color:var(--nn-text-secondary)]">No items found</p>
            <p className="text-sm text-[color:var(--nn-text-secondary)] mt-2">
              Try adjusting your filters or collect more items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
