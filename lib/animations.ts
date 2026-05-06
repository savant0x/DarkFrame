/**
 * Animation Utilities
 * 
 * Helper functions and constants for framer-motion animations
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Provides reusable animation variants and utilities for consistent
 * motion design across the application. All animations are optimized
 * for 60fps performance.
 */

import { Variants, Transition } from 'framer-motion';

/**
 * Standard transition timing
 */
export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' },
  base: { duration: 0.2, ease: 'easeOut' },
  slow: { duration: 0.3, ease: 'easeOut' },
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
  springBouncy: { type: 'spring' as const, stiffness: 400, damping: 20 },
} as const;

/**
 * Fade in animation variant
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

/**
 * Slide up animation variant
 */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: -20, transition: transitions.fast },
};

/**
 * Slide down animation variant
 */
export const slideDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: 20, transition: transitions.fast },
};

/**
 * Slide from left animation variant
 */
export const slideFromLeft: Variants = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0, transition: transitions.base },
  exit: { opacity: 0, x: 50, transition: transitions.fast },
};

/**
 * Slide from right animation variant
 */
export const slideFromRight: Variants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0, transition: transitions.base },
  exit: { opacity: 0, x: -50, transition: transitions.fast },
};

/**
 * Scale in animation variant
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.9, transition: transitions.fast },
};

/**
 * Scale and rotate animation variant (for modals)
 */
export const scaleRotate: Variants = {
  initial: { opacity: 0, scale: 0.8, rotate: -5 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: transitions.springBouncy },
  exit: { opacity: 0, scale: 0.8, rotate: 5, transition: transitions.fast },
};

/**
 * Stagger container variant
 * Use with staggerItem for list animations
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Stagger item variant
 * Use with staggerContainer
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: -10, transition: transitions.fast },
};

/**
 * Hover scale animation
 * Use as whileHover prop
 */
export const hoverScale = {
  scale: 1.05,
  transition: transitions.fast,
};

/**
 * Hover lift animation (with shadow)
 * Use as whileHover prop
 */
export const hoverLift = {
  y: -2,
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  transition: transitions.fast,
};

/**
 * Tap scale animation
 * Use as whileTap prop
 */
export const tapScale = {
  scale: 0.95,
  transition: transitions.fast,
};

/**
 * Page transition variants
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

/**
 * Modal backdrop variants
 */
export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Modal content variants
 */
export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.15 },
  },
};

/**
 * Tooltip variants
 */
export const tooltip: Variants = {
  initial: { opacity: 0, scale: 0.8, y: -5 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, scale: 0.8, y: -5, transition: { duration: 0.1 } },
};

/**
 * Notification slide in from right
 */
export const notificationSlideIn: Variants = {
  initial: { opacity: 0, x: 300 },
  animate: { opacity: 1, x: 0, transition: transitions.spring },
  exit: { opacity: 0, x: 300, transition: transitions.base },
};

/**
 * Progress bar fill animation
 */
export const progressFill: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: { scaleX: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

/**
 * Pulse animation (for attention)
 */
export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Shimmer loading animation
 */
export const shimmer: Variants = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/**
 * Number count-up spring config
 */
export const countUpSpring = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 15,
  mass: 0.5,
};

/**
 * Create a stagger delay for index-based animations
 * 
 * @param index - Item index in list
 * @param baseDelay - Base delay in seconds (default 0.05)
 * @returns Delay in seconds
 */
export function getStaggerDelay(index: number, baseDelay: number = 0.05): number {
  return index * baseDelay;
}

/**
 * Create a custom transition with duration
 * 
 * @param duration - Duration in seconds
 * @param ease - Easing function
 * @returns Transition object
 */
export function createTransition(
  duration: number = 0.2,
  ease: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear' = 'easeOut'
): Transition {
  return { duration, ease };
}

/**
 * Spring transition with custom stiffness and damping
 * 
 * @param stiffness - Spring stiffness (default 300)
 * @param damping - Spring damping (default 30)
 * @returns Transition object
 */
export function createSpring(
  stiffness: number = 300,
  damping: number = 30
): Transition {
  return { type: 'spring', stiffness, damping };
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All animations optimized for 60fps
// - Variants follow framer-motion convention
// - Spring animations for natural feel
// - Stagger animations for lists
// - Hover/tap states for interactivity
// - Modal and tooltip animations
// - Page transitions for routing
// - Progress and loading animations
// ============================================================
// END OF FILE
// ============================================================
