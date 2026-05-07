'use client';

import { BalanceEffects } from '@/types';
import { getBalanceStatusIcon, getBalanceStatusColor, formatBalanceRatio } from '@/lib/balanceService';

interface BalanceIndicatorProps { balanceEffects: BalanceEffects; str: number; def: number; }

export default function BalanceIndicator({ balanceEffects, str, def }: BalanceIndicatorProps) {
  const total = str + def;
  if (total === 0) return <div className="bg-[--row-even] p-2 rounded"><p className="text-[--text-3] text-xs text-center">No army built yet</p></div>;

  const strPct = (str / total) * 100;
  const defPct = (def / total) * 100;
  const statusColor = getBalanceStatusColor(balanceEffects.status);
  const statusIcon = getBalanceStatusIcon(balanceEffects.status);

  return (
    <div className="bg-[--row-even] p-2 rounded space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[--text-2] text-xs">Balance</span>
        <span className={`${statusColor} font-bold text-xs flex items-center gap-1`}><span>{statusIcon}</span><span>{balanceEffects.status}</span></span>
      </div>
      <div className="relative h-3 bg-white/[0.04] rounded-full overflow-hidden flex border border-[--border]">
        <div className="bg-[--neon-red]/80 flex items-center justify-start px-1 transition-all duration-300" style={{ width: `${strPct}%` }}>
          {strPct > 15 && <span className="text-white text-[10px] font-bold">{strPct.toFixed(0)}%</span>}
        </div>
        <div className="bg-[--electric]/80 flex items-center justify-end px-1 transition-all duration-300" style={{ width: `${defPct}%` }}>
          {defPct > 15 && <span className="text-white text-[10px] font-bold">{defPct.toFixed(0)}%</span>}
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-[--neon-red]">STR {str.toLocaleString()}</span>
        <span className={`${statusColor} font-bold`}>{formatBalanceRatio(balanceEffects.ratio)}</span>
        <span className="text-[--electric]">DEF {def.toLocaleString()}</span>
      </div>
      <div className="text-xs text-[--text-3] text-center pt-1 border-t border-[--border]">
        {balanceEffects.status === 'CRITICAL' && <span>Severe penalties active</span>}
        {balanceEffects.status === 'IMBALANCED' && <span>Slightly imbalanced</span>}
        {balanceEffects.status === 'BALANCED' && <span>No penalties</span>}
        {balanceEffects.status === 'OPTIMAL' && <span>Perfect balance — bonuses!</span>}
      </div>
    </div>
  );
}