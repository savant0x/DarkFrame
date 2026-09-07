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
  default: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]',
  primary: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  success: 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]',
  warning: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-amber)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]',
  error: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]',
  info: 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-cyan)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]',
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
        font-medium rounded-none border
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
