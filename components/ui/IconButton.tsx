/**
 * IconButton Component
 * 
 * Icon-only button with tooltip
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * IconButton is a compact button that displays only an icon.
 * Supports variants, sizes, and optional tooltip.
 * 
 * @example
 * <IconButton 
 *   icon={<Settings />}
 *   tooltip="Settings"
 *   onClick={handleClick}
 * />
 */

'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { tapScale } from '@/lib/animations';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'base' | 'lg';
  tooltip?: string;
}

const variantClasses = {
  default: `
    bg-bg-tertiary hover:bg-bg-hover active:bg-border-main
    text-text-primary border border-border-main
  `,
  primary: `
    bg-primary-600 hover:bg-primary-700 active:bg-primary-800
    text-white border border-primary-500
  `,
  danger: `
    bg-red-600 hover:bg-red-700 active:bg-red-800
    text-white border border-red-500
  `,
  ghost: `
    bg-transparent hover:bg-bg-tertiary active:bg-bg-hover
    text-text-primary border border-transparent
  `,
};

const sizeClasses = {
  sm: 'w-8 h-8 p-1.5',
  base: 'w-10 h-10 p-2',
  lg: 'w-12 h-12 p-2.5',
};

export function IconButton({
  icon,
  variant = 'default',
  size = 'base',
  tooltip,
  disabled = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <motion.button
      className={`
        inline-flex items-center justify-center
        rounded-lg transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      whileTap={!disabled ? tapScale : undefined}
      title={tooltip}
      aria-label={tooltip}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Icon-only button for compact UI
// - 4 variants: default, primary, danger, ghost
// - 3 sizes: sm, base, lg
// - Tooltip support via title attribute
// - Tap scale animation
// - Accessible with aria-label
// ============================================================
// END OF FILE
// ============================================================
