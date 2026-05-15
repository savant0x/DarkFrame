'use client';

import { Search } from 'lucide-react';

interface InventoryFilterBarProps {
  filter: 'all' | 'diggers' | 'tradeable';
  onFilterChange: (f: 'all' | 'diggers' | 'tradeable') => void;
  sortBy: 'rarity' | 'name' | 'bonus' | 'quantity';
  onSortChange: (s: 'rarity' | 'name' | 'bonus' | 'quantity') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  itemCount: number;
  totalCount: number;
}

const filterTabs: { key: 'all' | 'diggers' | 'tradeable'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'diggers', label: '⚙ Diggers' },
  { key: 'tradeable', label: '🎒 Tradeable' },
];

export function InventoryFilterBar({
  filter, onFilterChange, sortBy, onSortChange, searchQuery, onSearchChange, itemCount, totalCount,
}: InventoryFilterBarProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2.5 border-b border-[--border] bg-[--shadow]">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-3]" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[--card] border border-[--border] rounded-md text-xs text-[--text-1] placeholder:text-[--text-3] focus:outline-none focus:border-[--electric]/30 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                filter === tab.key
                  ? 'bg-[--electric]/15 border border-[--electric]/25 text-[--electric]'
                  : 'bg-white/[0.04] border border-[--border] text-[--text-2] hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
          className="bg-[--card] text-[--text-1] border border-[--border] rounded-md px-2 py-1 text-[10px] focus:outline-none"
        >
          <option value="rarity">Rarity</option>
          <option value="name">Name</option>
          <option value="bonus">Bonus</option>
          <option value="quantity">Quantity</option>
        </select>

        {/* Count */}
        <span className="text-[10px] text-[--text-3] font-mono">{itemCount}/{totalCount}</span>
      </div>
    </div>
  );
}
