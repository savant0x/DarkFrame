/**
 * StatCard Component
 * 
 * Displays a key metric with icon, label, and value
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * StatCard is a reusable component for displaying important metrics
 * in a visually appealing card format. Supports icons, trend indicators,
 * and optional animations.
 * 
 * @example
 * <StatCard
 *   label="Total Power"
 *   value={12500}
 *   icon={<Zap className="w-5 h-5" />}
 *   trend={{ value: 15, direction: 'up' }}
 *   color="primary"
 * />
 */

'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { scaleIn } from '@/lib/animations';

interface TrendData {
  value: number;
  direction: 'up' | 'down';
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: TrendData;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'metal' | 'energy' | 'xp';
  className?: string;
  animate?: boolean;
}

const colorClasses = {
  primary: 'text-primary-500 bg-primary-500/10',
  success: 'text-green-500 bg-green-500/10',
  warning: 'text-yellow-500 bg-yellow-500/10',
  error: 'text-red-500 bg-red-500/10',
  metal: 'text-metal bg-metal/10',
  energy: 'text-energy bg-energy/10',
  xp: 'text-xp bg-xp/10',
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'primary',
  className = '',
  animate = true,
}: StatCardProps) {
  const colorClass = colorClasses[color];

  const content = (
    <div
      className={`
        bg-bg-secondary border border-border-light rounded-lg p-6
        hover:border-border-main transition-colors duration-200
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 rounded-md ${colorClass}`}>
              {icon}
            </div>
          )}
          <span className="text-text-secondary text-sm font-medium">
            {label}
          </span>
        </div>
        {trend && (
          <div
            className={`
              flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded
              ${trend.direction === 'up' 
                ? 'text-green-500 bg-green-500/10' 
                : 'text-red-500 bg-red-500/10'
              }
            `}
          >
            {trend.direction === 'up' ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="text-text-primary text-2xl font-bold">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        variants={scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Supports 7 color variants
// - Optional icon and trend indicator
// - Number formatting with toLocaleString
// - Hover state for interactivity
// - Optional framer-motion animation
// - Responsive padding and spacing
// ============================================================
// END OF FILE
// ============================================================
