/**
 * StaggerChildren Component
 * 
 * Stagger animation for list items
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Wrapper that staggers the animation of child elements.
 * Perfect for animating lists, grids, and repeating elements.
 * 
 * @example
 * <StaggerChildren staggerDelay={0.1}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </StaggerChildren>
 */

'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  staggerDelay?: number;
  variant?: 'fade' | 'slide' | 'scale';
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay: number) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const itemVariants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  },
};

export function StaggerChildren({
  children,
  staggerDelay = 0.1,
  variant = 'fade',
  className,
}: StaggerChildrenProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      custom={staggerDelay}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  variant?: 'fade' | 'slide' | 'scale';
  className?: string;
}

export function StaggerItem({
  children,
  variant = 'fade',
  className,
}: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants[variant]} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================
// USAGE EXAMPLE:
// ============================================================
// <StaggerChildren staggerDelay={0.1} variant="slide">
//   {items.map(item => (
//     <StaggerItem key={item.id}>
//       <Card>{item.content}</Card>
//     </StaggerItem>
//   ))}
// </StaggerChildren>
// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Parent-child relationship for stagger effect
// - 3 animation variants: fade, slide, scale
// - Configurable stagger delay (default 100ms)
// - Use StaggerItem for each child element
// - Works with any content (cards, list items, etc.)
// ============================================================
// END OF FILE
// ============================================================
