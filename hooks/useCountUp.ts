/**
 * useCountUp Hook
 * 
 * Animates number count-up effect
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Custom hook that animates a number from start to end value
 * with configurable duration and easing.
 * 
 * @example
 * const count = useCountUp(1000, { duration: 2000 });
 * return <div>{Math.round(count)}</div>;
 */

'use client';

import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  duration?: number; // Animation duration in ms
  delay?: number; // Delay before starting
  enabled?: boolean; // Enable/disable animation
}

export function useCountUp(
  end: number,
  options: UseCountUpOptions = {}
): number {
  const {
    duration = 1000,
    delay = 0,
    enabled = true,
  } = options;

  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(end);
      return;
    }

    const startTime = Date.now() + delay;
    const endTime = startTime + duration;

    const animate = () => {
      const now = Date.now();

      if (now < startTime) {
        requestAnimationFrame(animate);
        return;
      }

      if (now >= endTime) {
        setCount(end);
        return;
      }

      // Easing function (easeOutCubic)
      const elapsed = now - startTime;
      const progress = elapsed / duration;
      const eased = 1 - Math.pow(1 - progress, 3);

      setCount(end * eased);
      requestAnimationFrame(animate);
    };

    const animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, delay, enabled]);

  return count;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Uses requestAnimationFrame for smooth animation
// - EaseOutCubic easing for natural feel
// - Configurable duration and delay
// - Can be disabled for instant update
// - Returns current animated value
// - Automatically cancels on unmount
// ============================================================
// END OF FILE
// ============================================================
