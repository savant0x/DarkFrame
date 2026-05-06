/**
 * Design Tokens
 * 
 * Central design system constants for DarkFrame UI
 * Provides consistent colors, typography, spacing, and effects
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Design tokens are the visual design atoms of the system. They define
 * all possible values for colors, typography, spacing, shadows, and other
 * design properties. This ensures visual consistency across the entire app.
 * 
 * Token Categories:
 * - Colors: Brand, semantic, neutral, game-specific
 * - Typography: Font families, sizes, weights, line heights
 * - Spacing: Consistent spacing scale (4px base unit)
 * - Shadows: Elevation system for depth
 * - Borders: Radius and width constants
 * - Transitions: Animation timing functions
 * - Z-Index: Layering system
 */

/**
 * Color Palette
 * Dark theme optimized for gaming experience
 */
export const colors = {
  // Brand Colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main brand color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Semantic Colors
  success: {
    light: '#4ade80',
    main: '#22c55e',
    dark: '#16a34a',
  },
  warning: {
    light: '#fbbf24',
    main: '#f59e0b',
    dark: '#d97706',
  },
  error: {
    light: '#f87171',
    main: '#ef4444',
    dark: '#dc2626',
  },
  info: {
    light: '#60a5fa',
    main: '#3b82f6',
    dark: '#2563eb',
  },

  // Neutral Scale (Dark Theme)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // Game-Specific Colors
  game: {
    metal: '#94a3b8',
    energy: '#fbbf24',
    researchPoints: '#a78bfa',
    health: '#ef4444',
    power: '#f59e0b',
    xp: '#3b82f6',
    gold: '#fbbf24',
    territory: '#22c55e',
  },

  // Rarity Colors
  rarity: {
    common: '#9ca3af',
    uncommon: '#4ade80',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
    mythic: '#ef4444',
  },

  // Background Colors
  background: {
    primary: '#0f172a', // Main dark background
    secondary: '#1e293b', // Card/panel background
    tertiary: '#334155', // Elevated elements
    hover: '#475569', // Hover states
  },

  // Border Colors
  border: {
    light: '#334155',
    main: '#475569',
    dark: '#64748b',
  },

  // Text Colors
  text: {
    primary: '#f1f5f9',
    secondary: '#cbd5e1',
    tertiary: '#94a3af',
    disabled: '#64748b',
  },
} as const;

/**
 * Typography System
 */
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['Fira Code', 'Monaco', 'Courier New', 'monospace'],
  },

  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem', // 48px
  },

  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

/**
 * Spacing Scale (4px base unit)
 */
export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
  32: '8rem', // 128px
} as const;

/**
 * Shadow System (Elevation)
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  glow: '0 0 20px rgb(14 165 233 / 0.5)', // Brand glow effect
} as const;

/**
 * Border Radius
 */
export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  base: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  '2xl': '1rem', // 16px
  full: '9999px',
} as const;

/**
 * Border Width
 */
export const borderWidth = {
  0: '0',
  1: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
} as const;

/**
 * Transition Timing
 */
export const transitions = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  timing: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

/**
 * Z-Index Layering System
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  notification: 1700,
} as const;

/**
 * Breakpoints (for useMediaQuery hook)
 */
export const breakpoints = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Component-Specific Tokens
 */
export const components = {
  button: {
    height: {
      sm: '2rem', // 32px
      base: '2.5rem', // 40px
      lg: '3rem', // 48px
    },
    padding: {
      sm: '0.5rem 1rem',
      base: '0.75rem 1.5rem',
      lg: '1rem 2rem',
    },
  },
  input: {
    height: {
      sm: '2rem',
      base: '2.5rem',
      lg: '3rem',
    },
  },
  card: {
    padding: '1.5rem',
    borderRadius: borderRadius.lg,
  },
  panel: {
    padding: '1.5rem',
    borderRadius: borderRadius.xl,
  },
} as const;

/**
 * Animation Presets
 */
export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  stagger: {
    container: {
      animate: {
        transition: {
          staggerChildren: 0.05,
        },
      },
    },
    item: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
    },
  },
} as const;

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All tokens use consistent naming and structure
// - Colors follow Tailwind convention (50-900 scale)
// - Spacing based on 4px grid system
// - Shadows provide elevation hierarchy
// - Transitions tuned for smooth UX
// - Z-index prevents stacking conflicts
// - Animation presets for framer-motion
// - Breakpoints match Tailwind defaults
// ============================================================
// END OF FILE
// ============================================================
