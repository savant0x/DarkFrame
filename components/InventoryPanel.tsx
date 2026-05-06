/**
 * InventoryPanel Component (Refactored)
 * 
 * Modern inventory display with animated grid
 * 
 * Created: 2025-10-18
 * Updated: 2026-05-04 — Root-fix item names/effects, fix tab switching
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Panel } from './ui/Panel';
import { StatCard } from './ui/StatCard';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { StaggerChildren, StaggerItem } from './transitions/StaggerChildren';
import { useCountUp } from '@/hooks/useCountUp';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';
import type { InventoryItemPayload } from '@/types/api-responses';
import { normalizeItemRow } from '@/lib/itemUtils';
import { 
  Package, 
  Box, 
  Wrench, 
  Zap, 
  Sparkles, 
  Clock, 
  ShoppingBag,
  Filter,
  ArrowUpDown
} from 'lucide-react';

// ============================================================
// ITEM NAME & EFFECT NORMALIZATION
// ============================================================

function normalizeItem(item: Record<string, unknown>): InventoryItemPayload {
  const rawRarity = String(item.rarity || 'Common');
  const normalized = normalizeItemRow({
    name: String(item.name || ''),
    item_type: String(item.item_type || item.type || ''),
    description: String(item.description || ''),
    rarity: rawRarity,
  });
  return {
    id: String(item.id || item.item_id || ''),
    name: normalized.name,
    rarity: rawRarity.toUpperCase() || 'COMMON',
    type: normalized.type,
    description: normalized.description,
    quantity: Number(item.quantity) || 1,
  };
}

// ============================================================
// TYPES
// ============================================================

type FilterType = 'all' | 'diggers' | 'tradeable';
type SortType = 'name' | 'rarity' | 'quantity';

// ============================================================
// RARITY UTILITIES
// ============================================================
// RARITY UTILITIES
// ============================================================

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'text-gray-400',
  UNCOMMON: 'text-green-400',
  RARE: 'text-blue-400',
  EPIC: 'text-purple-400',
  LEGENDARY: 'text-yellow-400',
};

const RARITY_BORDERS: Record<string, string> = {
  COMMON: 'border-gray-600',
  UNCOMMON: 'border-green-500',
  RARE: 'border-blue-500',
  EPIC: 'border-purple-500',
  LEGENDARY: 'border-yellow-500',
};

const RARITY_BADGE: Record<string, string> = {
  COMMON: 'default',
  UNCOMMON: 'success',
  RARE: 'info',
  EPIC: 'primary',
  LEGENDARY: 'warning',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function InventoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<InventoryItemPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('rarity');
  const [boostTimeRemaining, setBoostTimeRemaining] = useState<string>('');

  const isMobile = useIsMobile();
  const capacityCount = useCountUp(items.length, { duration: 1000 });

  // Fetch inventory data
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/player/inventory');
        if (response.ok) {
          const data = await response.json();
          const normalizedItems = (data.items || []).map(normalizeItem);
          setItems(normalizedItems);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTypingInInput()) return;
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

  // Boost timer
  useEffect(() => {
    // Boost timer logic unchanged — activeBoost data from API
    const updateTimer = () => {
      const expiresAt = localStorage.getItem('darkframe_boost_expires');
      if (!expiresAt) { setBoostTimeRemaining(''); return; }
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setBoostTimeRemaining('Expired'); return; }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setBoostTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtered & sorted items (pure computation, no mutation)
  const filteredItems = React.useMemo(() => {
    if (!items.length) return items;

    let result = [...items];

    if (filter === 'diggers') {
      result = result.filter(item => (item.type || '').toUpperCase().includes('DIGGER'));
    } else if (filter === 'tradeable') {
      result = result.filter(item => (item.type || '').toUpperCase() === 'TRADEABLE_ITEM');
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'rarity') {
        const order = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];
        return order.indexOf(a.rarity) - order.indexOf(b.rarity);
      }
      return (b.quantity || 0) - (a.quantity || 0);
    });

    return result;
  }, [items, filter, sortBy]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gray-800 border-b border-cyan-500/30 px-4 py-3 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Package className="w-6 h-6" />
                INVENTORY
              </h2>
              <Button onClick={() => setIsOpen(false)} variant="secondary" size="sm">✕</Button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 max-h-[calc(90vh-140px)]">
              {loading ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
                  Loading inventory...
                </div>
              ) : (
                <>
                  {/* Filters & Sort */}
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="flex gap-2">
                      <Button onClick={() => setFilter('all')} variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" className="text-xs">
                        <Box className="w-4 h-4 mr-1" />
                        All
                      </Button>
                      <Button onClick={() => setFilter('diggers')} variant={filter === 'diggers' ? 'primary' : 'secondary'} size="sm" className="text-xs">
                        <Wrench className="w-4 h-4 mr-1" />
                        Diggers
                      </Button>
                      <Button onClick={() => setFilter('tradeable')} variant={filter === 'tradeable' ? 'primary' : 'secondary'} size="sm" className="text-xs">
                        <ShoppingBag className="w-4 h-4 mr-1" />
                        Tradeable
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 md:ml-auto">
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortType)}
                        className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="rarity">Sort by Rarity</option>
                        <option value="name">Sort by Name</option>
                        <option value="quantity">Sort by Quantity</option>
                      </select>
                    </div>
                  </div>

                  {/* Items Grid */}
                  {filteredItems.length > 0 ? (
                    <StaggerChildren staggerDelay={0.05} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredItems.map((item) => (
                        <StaggerItem key={item.id || item.name}>
                          <Card className={`border-2 ${RARITY_BORDERS[item.rarity] || 'border-gray-600'} hover:scale-105 transition-transform duration-200`}>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className={`font-bold text-lg truncate ${RARITY_COLORS[item.rarity] || 'text-gray-400'}`}>
                                {item.name}
                              </h3>
                              {item.quantity > 1 && (
                                <Badge variant="default">×{item.quantity}</Badge>
                              )}
                            </div>
                            <Badge variant={RARITY_BADGE[item.rarity] as any || 'default'} className="mb-3">
                              {item.rarity}
                            </Badge>
                            {item.description && (
                              <p className="text-sm text-gray-400 mb-3">{item.description}</p>
                            )}
                            <div className="text-xs text-gray-500">
                              {(item.type || '').replace(/_/g, ' ')}
                            </div>
                          </Card>
                        </StaggerItem>
                      ))}
                    </StaggerChildren>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-500 opacity-50" />
                      <p className="text-gray-400 text-lg mb-2">No items found</p>
                      <p className="text-gray-500 text-sm">Explore caves (F key) to find items and diggers</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}