'use client';

import type { InventoryItemPayload } from '@/types/api-responses';
import { InventoryItemCard } from './InventoryItemCard';
import { Package, Search } from 'lucide-react';

interface InventoryItemListProps {
  items: InventoryItemPayload[];
  loading: boolean;
  error: string | null;
  onItemClick: (item: InventoryItemPayload) => void;
  onRetry: () => void;
}

export function InventoryItemList({ items, loading, error, onItemClick, onRetry }: InventoryItemListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[--electric] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[--text-3]">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-[--neon-red] mb-2">{error}</p>
          <button onClick={onRetry} className="text-xs text-[--electric] hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Package className="w-12 h-12 mx-auto mb-3 text-white/10" />
          <p className="text-sm text-[--text-2] mb-1">No items found</p>
          <p className="text-[10px] text-[--text-3]">Explore caves (F key) to find items and diggers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {items.map((item) => (
          <InventoryItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </div>
  );
}
