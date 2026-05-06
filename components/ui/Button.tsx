/**
 * Button Component
 * 
 * Reusable button with variants and sizes
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Button component with multiple variants (primary, secondary, danger, ghost)
 * and sizes (sm, base, lg). Supports icons, loading state, and disabled state.
 * 
 * @example
 * <Button variant="primary" size="base" onClick={handleClick}>
 *   Click Me
 * </Button>
 */

'use client';

import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { tapScale } from '@/lib/animations';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'base' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses = {
  primary: `
    bg-primary-600 hover:bg-primary-700 active:bg-primary-800
    text-white border border-primary-500
    shadow-md hover:shadow-lg
  `,
  secondary: `
    bg-bg-tertiary hover:bg-bg-hover active:bg-border-main
    text-text-primary border border-border-main
    shadow-sm hover:shadow-md
  `,
  danger: `
    bg-red-600 hover:bg-red-700 active:bg-red-800
    text-white border border-red-500
    shadow-md hover:shadow-lg
  `,
  ghost: `
    bg-transparent hover:bg-bg-tertiary active:bg-bg-hover
    text-text-primary border border-transparent
    hover:border-border-light
  `,
  success: `
    bg-green-600 hover:bg-green-700 active:bg-green-800
    text-white border border-green-500
    shadow-md hover:shadow-lg
  `,
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm h-8',
  base: 'px-4 py-2 text-base h-10',
  lg: 'px-6 py-3 text-lg h-12',
};

export function Button({
  variant = 'primary',
  size = 'base',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      whileTap={!isDisabled ? tapScale : undefined}
      {...props}
    >
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </motion.button>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 5 variants: primary, secondary, danger, ghost, success
// - 3 sizes: sm, base, lg
// - Loading state with spinner
// - Optional icon with position control
// - Full width option
// - Tap scale animation
// - Disabled state handling
// - All button HTML attributes supported
// ============================================================
// END OF FILE
// ============================================================
