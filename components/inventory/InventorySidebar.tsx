'use client';

import type { InventoryPayload } from '@/types/api-responses';

interface InventorySidebarProps {
  data: InventoryPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function InventorySidebar({ data, loading, error, onRetry }: InventorySidebarProps) {
  if (loading) {
    return (
      <div className="w-56 flex-shrink-0 bg-[--shadow] border-r border-[--border] p-3 space-y-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-white/5 rounded w-3/4" />
          <div className="h-8 bg-white/5 rounded" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-56 flex-shrink-0 bg-[--shadow] border-r border-[--border] p-3">
        <p className="text-xs text-[--neon-red] mb-2">{error}</p>
        <button onClick={onRetry} className="text-xs text-[--electric] hover:underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const capacityPercent = data.capacity > 0 ? Math.min((data.used / data.capacity) * 100, 100) : 0;
  const totalDiggers = data.diggers.common + data.diggers.uncommon + data.diggers.rare + data.diggers.epic + data.diggers.legendary;

  return (
    <div className="w-56 flex-shrink-0 bg-[--shadow] border-r border-[--border] p-3 space-y-3 overflow-y-auto">
      {/* Capacity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[--text-3] uppercase tracking-wider">Capacity</span>
          <span className="text-[10px] text-[--text-2] font-mono">{data.used}/{data.capacity}</span>
        </div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${capacityPercent}%`,
              background: capacityPercent > 80 ? 'var(--neon-red)' : capacityPercent > 50 ? 'var(--neon-yellow)' : 'var(--synth)',
            }}
          />
        </div>
      </div>

      {/* Gathering Bonus */}
      <div className="bg-[--card] border border-[--border] rounded-lg p-2.5">
        <h3 className="text-[10px] text-[--text-3] uppercase tracking-wider mb-2">Gathering Bonus</h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[--text-2]">⚙ Metal</span>
            <span className="text-xs text-[--synth] font-mono font-bold">+{data.gatheringBonus.metalBonus.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[--text-2]">⚡ Energy</span>
            <span className="text-xs text-[--electric] font-mono font-bold">+{data.gatheringBonus.energyBonus.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Digger Count by Rarity */}
      <div className="bg-[--card] border border-[--border] rounded-lg p-2.5">
        <h3 className="text-[10px] text-[--text-3] uppercase tracking-wider mb-2">Diggers ({totalDiggers})</h3>
        <div className="space-y-1">
          {([
            { key: 'legendary' as const, label: 'Legendary', color: 'text-[--neon-yellow]' },
            { key: 'epic' as const, label: 'Epic', color: 'text-[--neon-pink]' },
            { key: 'rare' as const, label: 'Rare', color: 'text-[--electric]' },
            { key: 'uncommon' as const, label: 'Uncommon', color: 'text-[--synth]' },
            { key: 'common' as const, label: 'Common', color: 'text-white/50' },
          ]).map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between">
              <span className={`text-[10px] ${color}`}>● {label}</span>
              <span className="text-[10px] text-[--text-2] font-mono">{data.diggers[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Shrine Boosts */}
      {data.activeShrineBoosts.length > 0 && (
        <div className="bg-[--card] border border-[--border] rounded-lg p-2.5">
          <h3 className="text-[10px] text-[--text-3] uppercase tracking-wider mb-2">Shrine Boosts</h3>
          <div className="space-y-1">
            {data.activeShrineBoosts.map((boost) => {
              const expires = new Date(boost.expiresAt);
              const now = new Date();
              const diff = expires.getTime() - now.getTime();
              const expired = diff <= 0;
              const h = Math.floor(Math.max(diff, 0) / 3600000);
              const m = Math.floor((Math.max(diff, 0) % 3600000) / 60000);
              return (
                <div key={boost.tier} className="flex items-center justify-between">
                  <span className={`text-[10px] ${expired ? 'text-[--text-3] line-through' : 'text-[--neon-pink]'}`}>
                    {boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1)}
                  </span>
                  <span className={`text-[10px] font-mono ${expired ? 'text-[--text-3]' : 'text-[--synth]'}`}>
                    {expired ? 'Expired' : `${h}h ${m}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
