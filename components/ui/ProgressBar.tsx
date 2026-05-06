/**
 * ProgressBar Component
 * 
 * Animated progress bar with label and percentage
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * ProgressBar displays progress visually with smooth animations.
 * Supports color variants, labels, and percentage display.
 * 
 * @example
 * <ProgressBar 
 *   value={75} 
 *   max={100}
 *   label="XP Progress"
 *   color="xp"
 *   showPercentage
 * />
 */

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'xp' | 'health' | 'energy';
  size?: 'sm' | 'base' | 'lg';
  showPercentage?: boolean;
  showValues?: boolean;
  animate?: boolean;
  className?: string;
}

const colorClasses = {
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  xp: 'bg-xp',
  health: 'bg-health',
  energy: 'bg-energy',
};

const sizeClasses = {
  sm: 'h-1.5',
  base: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max,
  label,
  color = 'primary',
  size = 'base',
  showPercentage = false,
  showValues = false,
  animate = true,
  className = '',
}: ProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  useEffect(() => {
    if (animate) {
      // Animate to target value
      const duration = 500; // ms
      const steps = 30;
      const increment = value / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(value, current + increment);
        setDisplayValue(current);

        if (step >= steps) {
          clearInterval(timer);
          setDisplayValue(value);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value, animate]);

  return (
    <div className={`w-full ${className}`}>
      {/* Label and Value Display */}
      {(label || showPercentage || showValues) && (
        <div className="flex items-center justify-between mb-1.5 text-sm">
          <span className="text-text-secondary font-medium">{label}</span>
          <div className="flex items-center gap-2 text-text-tertiary">
            {showValues && (
              <span>
                {Math.round(displayValue)}/{max}
              </span>
            )}
            {showPercentage && (
              <span className="font-semibold">
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div
        className={`
          w-full bg-bg-tertiary rounded-full overflow-hidden
          ${sizeClasses[size]}
        `}
      >
        <motion.div
          className={`
            h-full rounded-full
            ${colorClasses[color]}
          `}
          initial={{ width: '0%' }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: animate ? 0.5 : 0,
            ease: 'easeOut',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Smooth width animation with framer-motion
// - Number count-up animation option
// - 7 color variants for different contexts
// - 3 sizes: sm, base, lg
// - Optional label, percentage, and value display
// - Responsive and accessible
// - Percentage clamped to 0-100%
// ============================================================
// END OF FILE
// ============================================================
