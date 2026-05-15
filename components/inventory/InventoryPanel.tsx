'use client';

import { useState, useEffect, useCallback } from 'react';
import type { InventoryPayload, InventoryItemPayload } from '@/types/api-responses';
import { InventorySidebar } from './InventorySidebar';
import { InventoryFilterBar } from './InventoryFilterBar';
import { InventoryItemList } from './InventoryItemList';
import { ItemDetailModal } from './ItemDetailModal';

export function InventoryPanel() {
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'diggers' | 'tradeable'>('all');
  const [sortBy, setSortBy] = useState<'rarity' | 'name' | 'bonus' | 'quantity'>('rarity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItemPayload | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/player/inventory');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to load');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const filteredItems = (() => {
    if (!data?.items) return [];
    let items = [...data.items];
    if (filter === 'diggers') items = items.filter(i => i.category === 'digger');
    else if (filter === 'tradeable') items = items.filter(i => i.category === 'tradeable');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    const rarityOrder: Record<string, number> = { Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4 };
    items.sort((a, b) => {
      if (sortBy === 'rarity') return (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'bonus') return b.gatheringBonus - a.gatheringBonus;
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      return 0;
    });
    return items;
  })();

  return (
    <div className="h-full flex flex-col bg-[--void]">
      <div className="flex-1 flex overflow-hidden">
        <InventorySidebar data={data} loading={loading} error={error} onRetry={fetchInventory} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <InventoryFilterBar
            filter={filter}
            onFilterChange={setFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            itemCount={filteredItems.length}
            totalCount={data?.items.length ?? 0}
          />
          <InventoryItemList
            items={filteredItems}
            loading={loading}
            error={error}
            onItemClick={setSelectedItem}
            onRetry={fetchInventory}
          />
        </div>
      </div>
      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
