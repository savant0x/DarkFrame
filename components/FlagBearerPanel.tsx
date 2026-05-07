'use client';

import { useState, useEffect } from 'react';
import { Flag } from 'lucide-react';
import type { FlagBearer } from '@/types';

interface FlagBearerPanelProps {
  flagBearer: FlagBearer;
  onRelease?: () => void;
  compact?: boolean;
}

export default function FlagBearerPanel({ flagBearer, onRelease, compact = false }: FlagBearerPanelProps) {
  const [holdTime, setHoldTime] = useState('');

  useEffect(() => {
    const update = () => {
      const held = flagBearer.holdDuration || 0;
      const hours = Math.floor(held / 3600);
      const mins = Math.floor((held % 3600) / 60);
      setHoldTime(`${hours}h ${mins}m`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [flagBearer.holdDuration]);

  if (compact) {
    return (
      <div className="bg-[--card] border border-[--solar]/20 rounded-lg overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[--solar]" />
            <span className="text-[13px] font-bold text-[--text-1]">Flag Bearer</span>
          </div>
          <span className="text-xs text-[--solar] font-mono">{holdTime}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gradient-to-r from-[--solar]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
        <Flag className="w-3.5 h-3.5 text-[--solar]" /> FLAG BEARER
      </div>
      <div className="p-2.5 space-y-2">
        <div className="text-center">
          <div className="text-2xl mb-1 text-[--solar]">⚑</div>
          <div className="text-xs text-[--solar] font-bold">You hold the flag!</div>
          <div className="text-[10px] text-[--text-3] mt-0.5">Held for {holdTime}</div>
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Harvest</td><td className="px-2 py-1 text-right text-[--synth] font-bold font-mono">+100%</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">XP</td><td className="px-2 py-1 text-right text-[--electric] font-bold font-mono">+100%</td></tr>
          </tbody>
        </table>
        {onRelease && (
          <button onClick={onRelease} className="w-full px-2 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[--text-2] hover:text-[--neon-red] rounded text-xs font-bold transition-all">
            Release Flag
          </button>
        )}
        <p className="text-[10px] text-[--text-3] text-center italic">Visible trail left</p>
      </div>
    </div>
  );
}
