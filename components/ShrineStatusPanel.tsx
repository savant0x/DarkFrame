/**
 * @file components/ShrineStatusPanel.tsx
 * @created 2026-05-06
 * @overview Compact shrine status widget for the sidebar.
 * Displays active shrine boosts, remaining timers, total bonus, and tradeable item count.
 * Read-only display — activation happens at the shrine tile (1,1) via ShrinePanel.
 *
 * Features:
 * - 4 shrine boost tiers (Spade/Heart/Diamond/Club) with status + timer
 * - Total gathering bonus multiplier
 * - Tradeable item count
 * - 30-second polling for live updates
 * - Click to open shrine view
 *
 * Dependencies: /api/shrine/status endpoint
 */

'use client';

import { useState, useEffect } from 'react';
import { ShrineBoostTier } from '@/types';

interface ShrineBoost {
  tier: ShrineBoostTier;
  expiresAt: string;
  yieldBonus: number;
}

interface ShrineStatusData {
  activeBoosts: ShrineBoost[];
  availableItems: any[];
}

interface ShrineStatusPanelProps {
  onClick?: () => void;
}

const TIER_CONFIG: Record<ShrineBoostTier, { name: string; icon: string }> = {
  spade: { name: 'Spade', icon: '♠️' },
  heart: { name: 'Heart', icon: '♥️' },
  diamond: { name: 'Diamond', icon: '♦️' },
  club: { name: 'Club', icon: '♣️' },
};

export default function ShrineStatusPanel({ onClick }: ShrineStatusPanelProps) {
  const [data, setData] = useState<ShrineStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/shrine/status');
      if (res.status === 401) {
        setLoading(false);
        return;
      }
      const result = await res.json();
      if (result.success) {
        setData({
          activeBoosts: result.activeBoosts || [],
          availableItems: result.availableItems || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch shrine status:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div
        onClick={onClick}
        className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">⛩️</span>
          <h3 className="text-sm font-bold text-white">Shrine Status</h3>
        </div>
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  const now = new Date();
  const activeCount = data.activeBoosts.filter(b => new Date(b.expiresAt) > now).length;
  const totalBonus = data.activeBoosts
    .filter(b => new Date(b.expiresAt) > now)
    .reduce((sum, b) => sum + b.yieldBonus, 0);

  const formatTimeRemaining = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getTierStatus = (tier: ShrineBoostTier): { icon: string; time: string } => {
    const boost = data.activeBoosts.find(b => b.tier === tier);
    if (!boost) return { icon: '❌', time: 'Inactive' };
    if (new Date(boost.expiresAt) <= now) return { icon: '❌', time: 'Expired' };
    return { icon: '✅', time: formatTimeRemaining(boost.expiresAt) };
  };

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⛩️</span>
          <h3 className="text-sm font-bold text-white">Shrine Status</h3>
        </div>
        <span className="text-xs text-purple-400 font-bold">{activeCount}/4</span>
      </div>

      {/* Tier Status List */}
      <div className="space-y-1 mb-2">
        {(Object.keys(TIER_CONFIG) as ShrineBoostTier[]).map(tier => {
          const config = TIER_CONFIG[tier];
          const status = getTierStatus(tier);
          return (
            <div key={tier} className="flex items-center justify-between text-xs">
              <span className="text-gray-300">
                {config.icon} {config.name}
              </span>
              <span className={status.icon === '✅' ? 'text-green-400 font-bold' : 'text-gray-500'}>
                {status.icon} {status.time}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t border-gray-700 pt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Total Bonus:</span>
          <span className="text-yellow-400 font-bold">+{(totalBonus * 100).toFixed(0)}% (x{(1 + totalBonus).toFixed(2)})</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Items:</span>
          <span className="text-purple-400 font-bold">{data.availableItems.length} tradeable</span>
        </div>
      </div>

      {/* Click Hint */}
      <p className="text-xs text-gray-500 mt-2 text-center">Click to open</p>
    </div>
  );
}
