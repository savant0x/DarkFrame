/**
 * Card Component
 * 
 * Generic card container with optional hover effects
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Card is a simple container component with consistent styling.
 * Supports hover effects, padding variants, and clickable state.
 * 
 * @example
 * <Card hoverable onClick={handleClick}>
 *   <h3>Card Title</h3>
 *   <p>Card content here</p>
 * </Card>
 */

'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { hoverLift } from '@/lib/animations';

interface CardProps {
  children: ReactNode;
  hoverable?: boolean;
  clickable?: boolean;
  padding?: 'none' | 'sm' | 'base' | 'lg';
  onClick?: () => void;
  className?: string;
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-3',
  base: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  hoverable = false,
  clickable = false,
  padding = 'base',
  onClick,
  className = '',
}: CardProps) {
  const isInteractive = hoverable || clickable || onClick;

  const content = (
    <div
      className={`
        bg-bg-secondary border border-border-light rounded-lg
        ${paddingClasses[padding]}
        ${isInteractive ? 'transition-all duration-200' : ''}
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );

  if (hoverable) {
    return (
      <motion.div whileHover={hoverLift}>
        {content}
      </motion.div>
    );
  }

  return content;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Simple container with consistent styling
// - Optional hover lift effect
// - Clickable state with cursor pointer
// - 4 padding variants: none, sm, base, lg
// - Reusable for various content types
// ============================================================
// END OF FILE
// ============================================================
