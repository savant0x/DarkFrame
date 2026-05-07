/**
 * Badge Component
 * 
 * Status indicator badge with variants
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Badge component for displaying status, tags, or labels with
 * color-coded variants. Supports icons and removable state.
 * 
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" icon={<AlertCircle />}>Warning</Badge>
 */

'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'base' | 'lg';
  icon?: ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  children: ReactNode;
}

const variantClasses = {
  default: 'bg-white/5 text-[--text-2] border-[--border]',
  primary: 'bg-[--electric]/10 text-[--electric] border-[--electric]/20',
  success: 'bg-[--synth]/10 text-[--synth] border-[--synth]/20',
  warning: 'bg-[--neon-yellow]/10 text-[--neon-yellow] border-[--neon-yellow]/20',
  error: 'bg-[--neon-red]/10 text-[--neon-red] border-[--neon-red]/20',
  info: 'bg-[--electric]/10 text-[--electric] border-[--electric]/20',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  base: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function Badge({
  variant = 'default',
  size = 'base',
  icon,
  removable = false,
  onRemove,
  className = '',
  children,
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-md border
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
      {removable && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 6 color variants with subtle backgrounds
// - 3 sizes: sm, base, lg
// - Optional icon support
// - Removable with onRemove callback
// - Inline-flex for proper alignment
// - Border for definition
// ============================================================
// END OF FILE
// ============================================================
