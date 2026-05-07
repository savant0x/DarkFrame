import React from 'react';
import { formatNumber } from '@/utils/formatting';

interface XPProgressBarProps {
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
  totalXP: number;
  compact?: boolean;
}

export default function XPProgressBar({ level, currentLevelXP, xpForNextLevel, totalXP, compact = false }: XPProgressBarProps) {
  const pct = Math.min((currentLevelXP / xpForNextLevel) * 100, 100);

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-[--text-3]">Lv.{level}</span>
          <span className="text-xs text-[--text-3]">{Math.floor(pct)}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-[--electric] transition-all duration-500 ease-out rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-bold text-[--text-1]">Lv.{level}</span>
        <span className="text-xs text-[--text-3]">{Math.floor(pct)}% to next</span>
      </div>
      <div className="h-4 bg-white/[0.04] rounded overflow-hidden border border-[--border]">
        <div className="h-full bg-[--electric] transition-all duration-500 ease-out flex items-center justify-end pr-2 rounded" style={{ width: `${pct}%` }}>
          {pct > 12 && <span className="text-[10px] font-bold text-white">{Math.floor(pct)}%</span>}
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[--text-3]">{formatNumber(currentLevelXP)} XP</span>
        <span className="text-[10px] text-[--text-3]">{formatNumber(totalXP)} total</span>
      </div>
    </div>
  );
}