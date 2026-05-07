'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';

interface WMDStatus { rp: number; missilesReady: number; batteriesActive: number; spiesAvailable: number; pendingVotes: number; hasAlerts: boolean; }
interface WMDMiniStatusProps { onClick?: () => void; }

export default function WMDMiniStatus({ onClick }: WMDMiniStatusProps) {
  const [status, setStatus] = useState<WMDStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/wmd/status');
      if (res.status === 401) { setLoading(false); return; }
      const data = await res.json();
      if (data.success) setStatus(data.status);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); const i = setInterval(fetchStatus, 30000); return () => clearInterval(i); }, []);

  if (loading || !status) {
    return (
      <div className="bg-[--shadow] border border-white/10 rounded-lg p-2.5">
        <div className="flex items-center gap-2 mb-1"><span className="text-sm">⚔</span><h3 className="text-xs font-semibold text-white">WMD</h3></div>
        <p className="text-xs text-white/40">Loading…</p>
      </div>
    );
  }

  const rows = [
    { label: 'RP', value: status.rp.toLocaleString(), color: 'text-[--electric]' },
    { label: 'Missiles', value: String(status.missilesReady), color: 'text-[--synth]' },
    { label: 'Batteries', value: String(status.batteriesActive), color: 'text-[--neon-yellow]' },
    { label: 'Spies', value: String(status.spiesAvailable), color: 'text-[--neon-pink]' },
  ];

  return (
    <div onClick={onClick} className="bg-[--shadow] border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors cursor-pointer">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-[--electric]/10 to-transparent border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚔</span>
          <h3 className="text-sm font-bold text-white">WMD</h3>
           {status.hasAlerts && <Badge className="bg-[--neon-red] animate-pulse text-xs px-1.5 py-0 text-white font-bold">!</Badge>}
        </div>
        {status.pendingVotes > 0 && <span className="text-xs text-[--electric] font-semibold font-mono">🗳 {status.pendingVotes}</span>}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={`border-t border-white/5 ${i % 2 === 0 ? 'bg-white/[0.03]' : 'bg-white/[0.06]'}`}>
              <td className="px-3 py-1 text-white/50 font-medium">{row.label}</td>
              <td className={`px-3 py-1 text-right font-mono font-bold ${row.color}`}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}