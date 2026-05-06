/**
 * Divider Component
 * 
 * Visual separator with optional label
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Divider creates visual separation between content sections.
 * Supports horizontal and vertical orientation with optional label.
 * 
 * @example
 * <Divider />
 * <Divider label="OR" />
 * <Divider orientation="vertical" />
 */

'use client';

import { ReactNode } from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: ReactNode;
  className?: string;
}

export function Divider({
  orientation = 'horizontal',
  label,
  className = '',
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={`
          w-px bg-border-light self-stretch
          ${className}
        `}
      />
    );
  }

  if (label) {
    return (
      <div className={`flex items-center gap-4 my-4 ${className}`}>
        <div className="flex-1 h-px bg-border-light" />
        <span className="text-text-tertiary text-sm font-medium">
          {label}
        </span>
        <div className="flex-1 h-px bg-border-light" />
      </div>
    );
  }

  return (
    <div
      className={`
        h-px bg-border-light my-4
        ${className}
      `}
    />
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Horizontal and vertical orientation
// - Optional label for horizontal dividers
// - Subtle border color
// - Default margin for spacing
// - Flexible and reusable
// ============================================================
// END OF FILE
// ============================================================
