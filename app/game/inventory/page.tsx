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
  Common: 'border-gray-400 bg-gray-800',
  Uncommon: 'border-green-500 bg-green-900/20',
  Rare: 'border-blue-500 bg-blue-900/20',
  Epic: 'border-purple-500 bg-purple-900/20',
  Legendary: 'border-yellow-500 bg-yellow-900/20',
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-xl">Loading inventory...</p>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-xl">Failed to load inventory</p>
      </div>
    );
  }

  const filteredItems = getFilteredItems();
  const totalGatheringBonus = calculateTotalGatheringBonus();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <h1 className="text-4xl font-bold mt-4">Inventory</h1>
        </div>

        {/* Stats Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Capacity */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Capacity</h3>
            <p className="text-2xl">
              {inventory.usedSlots.toLocaleString()} / {inventory.capacity.toLocaleString()}
            </p>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(inventory.usedSlots / inventory.capacity) * 100}%` }}
              />
            </div>
          </div>

          {/* Diggers */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Diggers</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-400">Common:</span> {inventory.diggers.common}</p>
              <p><span className="text-green-400">Uncommon:</span> {inventory.diggers.uncommon}</p>
              <p><span className="text-blue-400">Rare:</span> {inventory.diggers.rare}</p>
              <p><span className="text-purple-400">Epic:</span> {inventory.diggers.epic}</p>
              <p><span className="text-yellow-400">Legendary:</span> {inventory.diggers.legendary}</p>
            </div>
          </div>

          {/* Gathering Bonus */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Gathering Bonus</h3>
            <p className="text-3xl text-green-400">+{totalGatheringBonus}%</p>
            <p className="text-sm text-gray-400 mt-1">
              From diggers and active boosts
            </p>
          </div>
        </div>

        {/* Active Boosts */}
        {inventory.activeBoosts.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3">Active Boosts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {inventory.activeBoosts.map((boost) => (
                <div
                  key={boost.type}
                  className="bg-gray-700 p-3 rounded border border-green-500"
                >
                  <p className="font-semibold">{boost.type}</p>
                  <p className="text-green-400">×{boost.multiplier.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">
                    {timeRemaining[boost.type] || 'Calculating...'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Filter */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Filter:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('diggers')}
                  className={`px-4 py-2 rounded ${
                    filter === 'diggers'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Diggers
                </button>
                <button
                  onClick={() => setFilter('tradeable')}
                  className={`px-4 py-2 rounded ${
                    filter === 'tradeable'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Tradeable
                </button>
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Sort by:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('rarity')}
                  className={`px-4 py-2 rounded ${
                    sortBy === 'rarity'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Rarity
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-4 py-2 rounded ${
                    sortBy === 'name'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Name
                </button>
                <button
                  onClick={() => setSortBy('quantity')}
                  className={`px-4 py-2 rounded ${
                    sortBy === 'quantity'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
              className={`p-3 rounded-lg border-2 ${
                RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ||
                'border-gray-600 bg-gray-800'
              }`}
            >
              <h4 className="font-semibold text-sm mb-1 truncate">{item.name}</h4>
              <p className="text-xs text-gray-400 mb-1">{item.rarity}</p>
              <p className="text-2xl font-bold text-white">
                {item.quantity.toLocaleString()}
              </p>
              {item.gatheringBonus && (
                <p className="text-xs text-green-400 mt-1">
                  +{item.gatheringBonus}% gathering
                </p>
              )}
              {item.description && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">No items found</p>
            <p className="text-sm text-gray-500 mt-2">
              Try adjusting your filters or collect more items
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
