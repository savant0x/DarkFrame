/**
 * Micro-Interaction Utilities
 * 
 * Reusable motion configurations for common interactions
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Collection of framer-motion configurations for micro-interactions.
 * Provides consistent animation patterns across the application.
 * 
 * @example
 * <motion.button {...interactions.tap} {...interactions.hover}>
 *   Click me
 * </motion.button>
 */

import { Variants } from 'framer-motion';

// ============================================================
// INTERACTION PRESETS
// ============================================================

/**
 * Tap (click/press) interaction
 * Slightly scales down element on press
 */
export const tapInteraction = {
  whileTap: { scale: 0.95 },
  transition: { duration: 0.1 },
};

/**
 * Hover interaction
 * Scales up element on hover
 */
export const hoverInteraction = {
  whileHover: { scale: 1.05 },
  transition: { duration: 0.2 },
};

/**
 * Lift interaction (card hover)
 * Lifts element with shadow increase
 */
export const liftInteraction = {
  whileHover: { y: -4, scale: 1.02 },
  transition: { duration: 0.2 },
};

/**
 * Press interaction (button press)
 * Scales down and slightly shifts
 */
export const pressInteraction = {
  whileTap: { scale: 0.92, y: 2 },
  transition: { duration: 0.1 },
};

/**
 * Glow interaction (hover glow effect)
 * Increases brightness on hover
 */
export const glowInteraction = {
  whileHover: { filter: 'brightness(1.2)' },
  transition: { duration: 0.3 },
};

/**
 * Shake interaction (error feedback)
 * Shakes element left-right
 */
export const shakeAnimation = {
  x: [0, -10, 10, -10, 10, 0],
  transition: { duration: 0.4 },
};

/**
 * Pulse interaction (attention grabber)
 * Pulses scale and opacity
 */
export const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

/**
 * Bounce interaction (playful feedback)
 * Bounces element vertically
 */
export const bounceAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 0.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// ============================================================
// COMBINED INTERACTION SETS
// ============================================================

/**
 * Standard interactive element (buttons, links)
 * Combines hover and tap
 */
export const standardInteraction = {
  ...hoverInteraction,
  ...tapInteraction,
};

/**
 * Card interaction (hoverable cards)
 * Combines lift and tap
 */
export const cardInteraction = {
  ...liftInteraction,
  ...tapInteraction,
};

/**
 * Button interaction (primary buttons)
 * Combines glow and press
 */
export const buttonInteraction = {
  ...glowInteraction,
  ...pressInteraction,
};

// ============================================================
// FOCUS STATES
// ============================================================

/**
 * Focus ring animation
 * Animates focus ring appearance
 */
export const focusRingVariants: Variants = {
  unfocused: {
    scale: 1,
    opacity: 0,
  },
  focused: {
    scale: 1.05,
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

/**
 * Focus glow animation
 * Adds glow effect on focus
 */
export const focusGlowVariants: Variants = {
  unfocused: {
    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
  },
  focused: {
    boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
    transition: { duration: 0.2 },
  },
};

// ============================================================
// LOADING STATES
// ============================================================

/**
 * Skeleton shimmer effect
 * Animates gradient across skeleton
 */
export const shimmerAnimation = {
  backgroundPosition: ['200% 0', '-200% 0'],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'linear',
  },
};

/**
 * Spin animation (loading spinners)
 * Continuous rotation
 */
export const spinAnimation = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear',
  },
};

// ============================================================
// NOTIFICATION ANIMATIONS
// ============================================================

/**
 * Slide in from right (notifications)
 */
export const slideInRightVariants: Variants = {
  hidden: { x: 400, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    x: 400,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Slide in from top (banners)
 */
export const slideInTopVariants: Variants = {
  hidden: { y: -100, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    y: -100,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Scale in (modals, popups)
 */
export const scaleInVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Create stagger children container
 * @param staggerDelay - Delay between each child animation (seconds)
 */
export function createStaggerContainer(staggerDelay = 0.1): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };
}

/**
 * Create stagger child item
 * @param direction - Animation direction ('up' | 'down' | 'left' | 'right')
 */
export function createStaggerItem(
  direction: 'up' | 'down' | 'left' | 'right' = 'up'
): Variants {
  const directionMap = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return {
    hidden: {
      opacity: 0,
      ...directionMap[direction],
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.3 },
    },
  };
}

/**
 * Create elastic scale animation
 * @param scale - Target scale value
 */
export function createElasticScale(scale = 1.1) {
  return {
    whileHover: {
      scale,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
      },
    },
  };
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Consistent animation timings across app
// - Reusable motion props for common interactions
// - Combines multiple interactions (hover + tap)
// - Accessible focus state animations
// - Notification and loading state variants
// - Utility functions for dynamic configurations
// ============================================================
// END OF FILE
// ============================================================
