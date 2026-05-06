/**
 * @file components/InventoryPanel.tsx
 * @created 2025-10-16
 * @overview Full inventory display panel with items, bonuses, and boosts
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { InventoryItem, ItemRarity } from '@/types';

interface InventoryData {
  items: InventoryItem[];
  capacity: number;
  metalDiggerCount: number;
  energyDiggerCount: number;
  gatheringBonus: {
    metalBonus: number;
    energyBonus: number;
  };
  activeBoosts: {
    gatheringBoost: number | null;
    expiresAt: Date | null;
  };
}

export default function InventoryPanel() {
  const { player } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'diggers' | 'tradeable'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'quantity'>('rarity');

  // Fetch inventory data
  useEffect(() => {
    if (!player || !isOpen) return;

    const username = player.username; // Capture for null-safety

    async function fetchInventory() {
      setLoading(true);
      try {
        const response = await fetch(`/api/inventory?username=${username}`);
        const data = await response.json();
        
        if (data.success) {
          // Transform API response to match component's expected structure
          const transformedData: InventoryData = {
            items: data.inventory.items || [],
            capacity: data.inventory.capacity || 100,
            metalDiggerCount: data.inventory.metalDiggerCount || 0,
            energyDiggerCount: data.inventory.energyDiggerCount || 0,
            gatheringBonus: data.gatheringBonus || { metalBonus: 0, energyBonus: 0 },
            activeBoosts: data.activeBoosts || { gatheringBoost: null, expiresAt: null }
          };
          setInventory(transformedData);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchInventory();
  }, [player, isOpen]);

  // Keyboard shortcut: I for inventory
  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      // ESC to close
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  // Early return AFTER all hooks
  if (!player) return null;

  // Get rarity color
  const getRarityColor = (rarity: ItemRarity): string => {
    switch (rarity) {
      case ItemRarity.Common: return 'text-gray-400';
      case ItemRarity.Uncommon: return 'text-green-400';
      case ItemRarity.Rare: return 'text-blue-400';
      case ItemRarity.Epic: return 'text-purple-400';
      case ItemRarity.Legendary: return 'text-yellow-400';
      default: return 'text-white';
    }
  };

  // Get rarity border
  const getRarityBorder = (rarity: ItemRarity): string => {
    switch (rarity) {
      case ItemRarity.Common: return 'border-gray-600';
      case ItemRarity.Uncommon: return 'border-green-600';
      case ItemRarity.Rare: return 'border-blue-600';
      case ItemRarity.Epic: return 'border-purple-600';
      case ItemRarity.Legendary: return 'border-yellow-600';
      default: return 'border-gray-600';
    }
  };

  // Filter and sort items
  const getFilteredItems = (): InventoryItem[] => {
    if (!inventory) return [];

    let filtered = inventory.items;

    // Apply filter
    if (filter === 'diggers') {
      filtered = filtered.filter(item => 
        item.type.includes('DIGGER')
      );
    } else if (filter === 'tradeable') {
      filtered = filtered.filter(item => 
        item.type === 'TRADEABLE_ITEM'
      );
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
      } else {
        return (b.quantity || 1) - (a.quantity || 1);
      }
    });

    return filtered;
  };

  // Calculate time remaining for boost
  const getBoostTimeRemaining = (): string => {
    if (!inventory?.activeBoosts.expiresAt) return '';
    
    const now = new Date();
    const expiresAt = new Date(inventory.activeBoosts.expiresAt);
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'EXPIRED';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <>
      {/* Inventory Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all z-30"
      >
        🎒 Inventory (I)
      </button>

      {/* Inventory Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border-4 border-gray-600 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">📦 INVENTORY</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-2xl hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400">
                <p>Loading inventory...</p>
              </div>
            ) : inventory ? (
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Capacity */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-1">Capacity</h3>
                    <p className="text-2xl font-bold text-white">
                      {inventory.items.length} / {inventory.capacity}
                    </p>
                  </div>

                  {/* Metal Bonus */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-1">⛏️ Metal Bonus</h3>
                    <p className="text-2xl font-bold text-yellow-400">
                      +{inventory.gatheringBonus.metalBonus.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {inventory.metalDiggerCount} diggers
                    </p>
                  </div>

                  {/* Energy Bonus */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-1">⚡ Energy Bonus</h3>
                    <p className="text-2xl font-bold text-blue-400">
                      +{inventory.gatheringBonus.energyBonus.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {inventory.energyDiggerCount} diggers
                    </p>
                  </div>
                </div>

                {/* Active Boosts */}
                {inventory.activeBoosts.gatheringBoost && (
                  <div className="bg-green-900 border border-green-600 rounded-lg p-4 mb-6">
                    <h3 className="text-white font-bold mb-2">🔥 ACTIVE BOOST</h3>
                    <p className="text-green-300">
                      +{inventory.activeBoosts.gatheringBoost}% gathering bonus
                    </p>
                    <p className="text-sm text-green-400 mt-1">
                      Expires in: {getBoostTimeRemaining()}
                    </p>
                  </div>
                )}

                {/* Filters and Sort */}
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilter('diggers')}
                      className={`px-4 py-2 rounded ${filter === 'diggers' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      Diggers
                    </button>
                    <button
                      onClick={() => setFilter('tradeable')}
                      className={`px-4 py-2 rounded ${filter === 'tradeable' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      Tradeable
                    </button>
                  </div>

                  <div className="flex gap-2 ml-auto">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'rarity' | 'quantity')}
                      className="bg-gray-700 text-white px-4 py-2 rounded"
                    >
                      <option value="rarity">Sort by Rarity</option>
                      <option value="name">Sort by Name</option>
                      <option value="quantity">Sort by Quantity</option>
                    </select>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getFilteredItems().map((item) => (
                    <div
                      key={item.id}
                      className={`bg-gray-700 border-2 ${getRarityBorder(item.rarity)} rounded-lg p-4 hover:shadow-lg transition-shadow`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${getRarityColor(item.rarity)}`}>
                          {item.name}
                        </h3>
                        {item.quantity && item.quantity > 1 && (
                          <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded">
                            ×{item.quantity}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-400 mb-2">{item.rarity}</p>
                      
                      {item.description && (
                        <p className="text-sm text-gray-300 mb-2">{item.description}</p>
                      )}
                      
                      {item.bonusValue && (
                        <p className="text-sm text-green-400 font-bold">
                          Bonus: +{item.bonusValue}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {getFilteredItems().length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No items found</p>
                    <p className="text-sm mt-2">Explore caves to discover items!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-red-400">
                Failed to load inventory
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
// - Press I to open/close inventory
// - Shows capacity, bonuses, and active boosts
// - Filterable by item type (all/diggers/tradeable)
// - Sortable by name, rarity, or quantity
// - Color-coded by rarity
// - Real-time boost countdown
// ============================================================
