/**
 * useMediaQuery Hook
 * 
 * Reactive media query detection
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Custom hook that returns boolean based on media query match.
 * Automatically updates when viewport size changes.
 * 
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */

'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  // Check if window is defined (client-side)
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Return early if window is not defined (SSR)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Update state when media query status changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Add event listener (modern browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

// ============================================================
// COMMON BREAKPOINT HELPERS
// ============================================================

/**
 * Check if viewport is mobile (< 640px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)');
}

/**
 * Check if viewport is tablet (640px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
}

/**
 * Check if viewport is desktop (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * Check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Check if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - SSR-safe with typeof window checks
// - Automatically updates on viewport resize
// - Handles modern and legacy browsers
// - Provides common breakpoint helpers
// - Cleanup on unmount to prevent memory leaks
// ============================================================
// END OF FILE
// ============================================================
