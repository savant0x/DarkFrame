/**
 * @file components/BalanceIndicator.tsx
 * @created 2025-10-17
 * @overview Visual balance meter showing STR vs DEF distribution
 * 
 * OVERVIEW:
 * Displays horizontal bar with STR (left) and DEF (right) proportions. Color-coded
 * by balance status (red/yellow/green/gold) with ratio percentage and status icon.
 */

'use client';

import { BalanceEffects } from '@/types';
import { getBalanceStatusIcon, getBalanceStatusColor, formatBalanceRatio } from '@/lib/balanceService';

interface BalanceIndicatorProps {
  balanceEffects: BalanceEffects;
  str: number;
  def: number;
}

export default function BalanceIndicator({ balanceEffects, str, def }: BalanceIndicatorProps) {
  const total = str + def;
  
  // Handle no army case
  if (total === 0) {
    return (
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-3 rounded-none">
        <p className="text-[color:var(--nn-text-secondary)] text-sm text-center">No army built yet</p>
      </div>
    );
  }
  
  // Calculate percentages
  const strPercent = (str / total) * 100;
  const defPercent = (def / total) * 100;
  
  // Determine bar color based on status
  const getBarColor = () => {
    switch (balanceEffects.status) {
      case 'CRITICAL': return { str: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]', def: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]' };
      case 'IMBALANCED': return { str: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]', def: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]' };
      case 'BALANCED': return { str: 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]', def: 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' };
      case 'OPTIMAL': return { str: 'bg-[color-mix(in_oklab,var(--nn-amber)_12%,transparent)]', def: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]' };
    }
  };
  
  const barColors = getBarColor();
  const statusColor = getBalanceStatusColor(balanceEffects.status);
  const statusIcon = getBalanceStatusIcon(balanceEffects.status);
  
  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-3 rounded-none space-y-2">
      {/* Status Header */}
      <div className="flex justify-between items-center">
        <span className="text-[color:var(--nn-text-secondary)] text-sm">Balance Status:</span>
        <span className={`${statusColor} font-bold text-sm flex items-center gap-1`}>
          <span>{statusIcon}</span>
          <span>{balanceEffects.status}</span>
        </span>
      </div>
      
      {/* Balance Bar */}
      <div className="relative h-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-full overflow-hidden flex">
        {/* STR Side (Left) */}
        <div
          className={`${barColors.str} flex items-center justify-start px-2 transition-all duration-300`}
          style={{ width: `${strPercent}%` }}
        >
          {strPercent > 15 && (
            <span className="text-[color:var(--nn-text-primary)] text-xs font-bold">
              🎯 {strPercent.toFixed(0)}%
            </span>
          )}
        </div>
        
        {/* DEF Side (Right) */}
        <div
          className={`${barColors.def} flex items-center justify-end px-2 transition-all duration-300`}
          style={{ width: `${defPercent}%` }}
        >
          {defPercent > 15 && (
            <span className="text-[color:var(--nn-text-primary)] text-xs font-bold">
              {defPercent.toFixed(0)}% 🛡️
            </span>
          )}
        </div>
      </div>
      
      {/* Balance Ratio */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-[color:var(--nn-magenta)]">
          🎯 STR: {str}
        </span>
        <span className={`${statusColor} font-bold`}>
          Ratio: {formatBalanceRatio(balanceEffects.ratio)}
        </span>
        <span className="text-[color:var(--nn-cyan)]">
          DEF: {def} 🛡️
        </span>
      </div>
      
      {/* Description */}
      <div className="text-xs text-[color:var(--nn-text-secondary)] text-center pt-1 border-t border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]">
        {balanceEffects.status === 'CRITICAL' && (
          <span>Heavily imbalanced - severe penalties active!</span>
        )}
        {balanceEffects.status === 'IMBALANCED' && (
          <span>Slightly imbalanced - some penalties active</span>
        )}
        {balanceEffects.status === 'BALANCED' && (
          <span>Balanced army - no penalties</span>
        )}
        {balanceEffects.status === 'OPTIMAL' && (
          <span>Perfect balance - bonuses active! ✨</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
