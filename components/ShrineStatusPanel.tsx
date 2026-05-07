'use client';

import { useState, useEffect } from 'react';
import { ShrineBoostTier } from '@/types';

interface ShrineBoost { tier: ShrineBoostTier; expiresAt: string; yieldBonus: number; }
interface ShrineStatusData { activeBoosts: ShrineBoost[]; availableItems: any[]; }
interface ShrineStatusPanelProps { onClick?: () => void; }

const TIER_CONFIG: Record<ShrineBoostTier, { name: string; icon: string; color: string }> = {
  spade: { name: 'Spade', icon: '♠', color: 'text-white/60' },
  heart: { name: 'Heart', icon: '♥', color: 'text-[--neon-red]' },
  diamond: { name: 'Diamond', icon: '♦', color: 'text-[--electric]' },
  club: { name: 'Club', icon: '♣', color: 'text-[--synth]' },
};

export default function ShrineStatusPanel({ onClick }: ShrineStatusPanelProps) {
  const [data, setData] = useState<ShrineStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/shrine/status');
      if (res.status === 401) { setLoading(false); return; }
      const r = await res.json();
      if (r.success) setData({ activeBoosts: r.activeBoosts || [], availableItems: r.availableItems || [] });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); const i = setInterval(fetchStatus, 30000); return () => clearInterval(i); }, []);

  const now = new Date();
  const getTierStatus = (tier: ShrineBoostTier) => {
    const boost = data?.activeBoosts.find(b => b.tier === tier);
    if (!boost) return { active: false, time: '—' };
    if (new Date(boost.expiresAt) <= now) return { active: false, time: 'Expired' };
    const diff = new Date(boost.expiresAt).getTime() - now.getTime();
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    return { active: true, time: h > 0 ? `${h}h ${m}m` : `${m}m` };
  };

  const activeCount = data?.activeBoosts.filter(b => new Date(b.expiresAt) > now).length || 0;
  const totalBonus = data?.activeBoosts.filter(b => new Date(b.expiresAt) > now).reduce((s, b) => s + b.yieldBonus, 0) || 0;

  if (loading || !data) return <div className="bg-[--card] border border-[--border] rounded-lg p-2.5"><p className="text-xs text-[--text-3]">Loading…</p></div>;

  return (
    <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[--neon-pink]/8 to-transparent border-b border-[--border] cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">⛩</span>
          <span className="text-[13px] font-bold text-[--text-1]">Shrine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[--neon-pink] font-mono font-bold">{activeCount}/4</span>
          <span className="text-xs text-[--text-3]">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {collapsed && (
        <div className="px-3 py-1.5 text-xs text-[--text-2] border-t border-[--border]">
          <span className="text-[--neon-yellow] font-mono font-bold">+{(totalBonus * 100).toFixed(0)}%</span>
          <span className="ml-1">harvest · {data.availableItems.length} items</span>
        </div>
      )}

      {!collapsed && (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[--row-odd] border-t border-[--border]">
              <th className="text-left px-3 py-1 text-[--text-2] font-medium">Suit</th>
              <th className="text-left px-3 py-1 text-[--text-2] font-medium">Status</th>
              <th className="text-right px-3 py-1 text-[--text-2] font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(TIER_CONFIG) as ShrineBoostTier[]).map((tier, i) => {
              const config = TIER_CONFIG[tier];
              const status = getTierStatus(tier);
              return (
                <tr key={tier} className={`border-t border-[--border] ${i % 2 === 0 ? 'bg-[--row-even]' : 'bg-[--row-odd]'}`}>
                  <td className={`px-3 py-1 ${config.color}`}>{config.icon} {config.name}</td>
                  <td className="px-3 py-1"><span className={status.active ? 'text-[--synth]' : 'text-[--text-3]'}>{status.active ? '● Active' : '○ Inactive'}</span></td>
                  <td className={`px-3 py-1 text-right font-mono ${status.active ? 'text-[--synth]' : 'text-[--text-3]'}`}>{status.time}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[--row-even] border-t border-[--border]">
              <td className="px-3 py-1 text-[--text-3] font-medium" colSpan={2}>Total Bonus</td>
              <td className="px-3 py-1 text-right text-[--neon-yellow] font-bold font-mono">+{(totalBonus * 100).toFixed(0)}%</td>
            </tr>
            <tr className="bg-[--row-odd]">
              <td className="px-3 py-1 text-[--text-3]" colSpan={2}>Tradeable</td>
              <td className="px-3 py-1 text-right text-[--neon-pink] font-mono font-semibold">{data.availableItems.length}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}