'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { StaggerChildren, StaggerItem } from './transitions/StaggerChildren';
import { useCountUp } from '@/hooks/useCountUp';
import type { InventoryItemPayload } from '@/types/api-responses';
import { normalizeItemRow } from '@/lib/itemUtils';
import { Package, Box, Wrench, ShoppingBag, ArrowUpDown } from 'lucide-react';

type FilterType = 'all' | 'diggers' | 'tradeable';
type SortType = 'name' | 'rarity' | 'quantity';

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'text-white/50',
  UNCOMMON: 'text-[--synth]',
  RARE: 'text-[--electric]',
  EPIC: 'text-[--neon-pink]',
  LEGENDARY: 'text-[--neon-yellow]',
};

const RARITY_BORDERS: Record<string, string> = {
  COMMON: 'border-white/10',
  UNCOMMON: 'border-[--synth]/30',
  RARE: 'border-[--electric]/30',
  EPIC: 'border-[--neon-pink]/30',
  LEGENDARY: 'border-[--neon-yellow]/30',
};

const RARITY_BADGE: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  COMMON: 'default',
  UNCOMMON: 'success',
  RARE: 'info',
  EPIC: 'primary',
  LEGENDARY: 'warning',
};

export function InventoryPanel() {
  const [items, setItems] = useState<InventoryItemPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('rarity');
  const [boostTimeRemaining, setBoostTimeRemaining] = useState<string>('');

  const capacityCount = useCountUp(items.length, { duration: 1000 });

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await fetch('/api/player/inventory');
        if (response.ok) {
          const data = await response.json();
          const normalizedItems = (data.items || []).map((item: Record<string, unknown>) => {
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
          });
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

  useEffect(() => {
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

  const filteredItems = React.useMemo(() => {
    if (!items.length) return items;
    let result = [...items];
    if (filter === 'diggers') {
      result = result.filter(item => (item.type || '').toUpperCase().includes('DIGGER'));
    } else if (filter === 'tradeable') {
      result = result.filter(item => (item.type || '').toUpperCase() === 'TRADEABLE_ITEM');
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'rarity') {
        const order = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];
        return order.indexOf(a.rarity) - order.indexOf(b.rarity);
      }
      return (b.quantity || 0) - (a.quantity || 0);
    });
    return result;
  }, [items, filter, sortBy]);

  return (
    <div className="h-full flex flex-col bg-[--void]">
      <div className="bg-[--card] border-b border-[--border] px-4 py-3 flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-[--neon-pink] flex items-center gap-2">
          <Package className="w-5 h-5" />
          INVENTORY
          <span className="text-sm text-white/40">({capacityCount} items)</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-white/50">
            <div className="animate-spin w-8 h-8 border-2 border-[--electric] border-t-transparent rounded-full mx-auto mb-4" />
            Loading inventory...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex gap-2">
                <Button onClick={() => setFilter('all')} variant={filter === 'all' ? 'primary' : 'ghost'} size="sm" className="text-xs">
                  <Box className="w-4 h-4 mr-1" />All
                </Button>
                <Button onClick={() => setFilter('diggers')} variant={filter === 'diggers' ? 'primary' : 'ghost'} size="sm" className="text-xs">
                  <Wrench className="w-4 h-4 mr-1" />Diggers
                </Button>
                <Button onClick={() => setFilter('tradeable')} variant={filter === 'tradeable' ? 'primary' : 'ghost'} size="sm" className="text-xs">
                  <ShoppingBag className="w-4 h-4 mr-1" />Tradeable
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <ArrowUpDown className="w-4 h-4 text-white/40" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="bg-[--card] text-white border border-[--border] rounded px-2 py-1 text-sm focus:outline-none"
                >
                  <option value="rarity">Rarity</option>
                  <option value="name">Name</option>
                  <option value="quantity">Quantity</option>
                </select>
              </div>
            </div>

            {boostTimeRemaining && (
              <div className="mb-4 bg-[--synth]/10 border border-[--synth]/20 rounded px-3 py-2 text-sm text-[--synth] flex items-center gap-2">
                <span>⏱️ Boost active: {boostTimeRemaining}</span>
              </div>
            )}

            {filteredItems.length > 0 ? (
              <StaggerChildren staggerDelay={0.03} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map((item) => (
                  <StaggerItem key={item.id || item.name}>
                    <Card className={`border ${RARITY_BORDERS[item.rarity] || 'border-white/10'} hover:scale-105 transition-transform duration-200`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold text-sm truncate ${RARITY_COLORS[item.rarity] || 'text-white/50'}`}>
                          {item.name}
                        </h3>
                        {item.quantity > 1 && (
                          <Badge variant="default" className="text-xs">×{item.quantity}</Badge>
                        )}
                      </div>
                      <Badge variant={RARITY_BADGE[item.rarity] ?? 'default'} className="mb-2 text-xs">
                        {item.rarity}
                      </Badge>
                      {item.description && (
                        <p className="text-xs text-white/40 mb-2 line-clamp-2">{item.description}</p>
                      )}
                      {(item.gatheringBonus ?? 0) > 0 && (
                        <p className="text-xs text-[--synth] mt-1">+{item.gatheringBonus}% gathering</p>
                      )}
                      <div className="text-xs text-white/30">
                        {(item.type || '').replace(/_/g, ' ')}
                      </div>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerChildren>
            ) : (
              <div className="text-center py-12 text-white/40">
                <Package className="w-16 h-16 mx-auto mb-4 text-white/20" />
                <p className="text-lg mb-2">No items found</p>
                <p className="text-sm">Explore caves (F key) to find items and diggers</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
