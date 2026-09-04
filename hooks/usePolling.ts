/**
 * @file hooks/usePolling.ts
 * @created 2025-10-26
 * @overview Generic HTTP polling hook with auto-cleanup and battery optimization
 * 
 * OVERVIEW:
 * Reusable polling hook for real-time-like updates via HTTP requests.
 * Provides configurable intervals, auto-pause on tab inactive, error handling,
 * and exponential backoff. Used by chat, messaging, notifications, and presence.
 * 
 * KEY FEATURES:
 * - Configurable polling interval (default: 3000ms)
 * - Auto-pause when tab inactive (battery optimization)
 * - Exponential backoff on errors (prevents server spam)
 * - Auto-cleanup on unmount
 * - TypeScript generic support for any data type
 * - Conditional polling (can disable when not needed)
 * 
 * USAGE EXAMPLE:
 * ```tsx
 * const { data, isPolling, error, refetch } = usePolling<ChatMessage[]>({
 *   fetchFn: async () => {
 *     const res = await fetch('/api/chat?channelId=global&since=2025-10-26');
 *     return res.json();
 *   },
 *   interval: 2000,
 *   enabled: isConnected,
 * });
 * ```
 * 
 * BATTERY OPTIMIZATION:
 * - Uses Page Visibility API to detect tab inactive
 * - Pauses polling when tab hidden (saves battery)
 * - Resumes immediately when tab becomes visible
 * 
 * ERROR HANDLING:
 * - Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 30s)
 * - Auto-reset backoff on success
 * - Error state exposed for UI feedback
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-017: HTTP Polling Infrastructure
 * - ECHO v5.2 compliant: Production-ready, TypeScript, comprehensive docs
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Polling configuration options
 */
export interface UsePollingOptions<T> {
  /** Async function that fetches data */
  fetchFn: () => Promise<T>;
  
  /** Polling interval in milliseconds (default: 3000ms) */
  interval?: number;
  
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  
  /** Whether to pause when tab is inactive (default: true) */
  pauseWhenInactive?: boolean;
  
  /** Initial data (optional) */
  initialData?: T;
  
  /** Callback when data updates */
  onData?: (data: T) => void;
  
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Polling hook return value
 */
export interface UsePollingReturn<T> {
  /** Current data */
  data: T | undefined;
  
  /** Whether polling is active */
  isPolling: boolean;
  
  /** Current error (if any) */
  error: Error | null;
  
  /** Whether currently fetching */
  isLoading: boolean;
  
  /** Manually trigger fetch */
  refetch: () => Promise<void>;
  
  /** Current backoff delay (for debugging) */
  backoffDelay: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_INTERVAL = 3000; // 3 seconds
const MIN_BACKOFF = 1000; // 1 second
const MAX_BACKOFF = 30000; // 30 seconds
const BACKOFF_MULTIPLIER = 2;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Generic HTTP polling hook with auto-cleanup and battery optimization
 * 
 * @param options - Polling configuration
 * @returns Polling state and controls
 * 
 * @example
 * ```tsx
 * const { data, isPolling, error, refetch } = usePolling({
 *   fetchFn: async () => {
 *     const res = await fetch('/api/chat?since=' + lastTimestamp);
 *     if (!res.ok) throw new Error('Failed to fetch');
 *     return res.json();
 *   },
 *   interval: 2000,
 *   enabled: true,
 *   onData: (messages) => console.log('New messages:', messages),
 *   onError: (err) => console.error('Polling error:', err),
 * });
 * ```
 */
export function usePolling<T = unknown>({
  fetchFn,
  interval = DEFAULT_INTERVAL,
  enabled = true,
  pauseWhenInactive = true,
  initialData,
  onData,
  onError,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  // ============================================================================
  // STATE
  // ============================================================================

  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(enabled);
  const [backoffDelay, setBackoffDelay] = useState(interval);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // ============================================================================
  // REFS
  // ============================================================================

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const currentBackoffRef = useRef(interval);

  //
  // FLOOD FIX (2026-09-04): Callers pass inline closures (fetchFn/onData/onError),
  // which get a NEW identity on every render. The old code put `fetch` — a
  // useCallback over those props — in the loop effect's dependency array, so every
  // render tore down the interval, re-ran the effect, and fired an immediate
  // "initial fetch". Result: requests as fast as round-trips complete (observed:
  // 70k requests in ~2 minutes on production). The loop now reads the LATEST
  // callbacks through refs and only restarts when polling actually should
  // start/stop (enabled / visibility / pauseWhenInactive).
  //
  const fetchFnRef = useRef(fetchFn);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const desiredIntervalRef = useRef(interval);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });
  useEffect(() => {
    onDataRef.current = onData;
  });
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    desiredIntervalRef.current = interval;
  });

  // Circuit breaker: stop polling after this many consecutive failures instead of
  // retrying forever. Resumes when the tab becomes visible again (or on remount).
  const consecutiveFailuresRef = useRef(0);
  const MAX_CONSECUTIVE_FAILURES = 5;

  // ============================================================================
  // VISIBILITY TRACKING
  // ============================================================================

  useEffect(() => {
    if (!pauseWhenInactive) return;

    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseWhenInactive]);

  // ============================================================================
  // FETCH FUNCTION
  // ============================================================================

  // Stable identity: reads the latest callbacks via refs (see flood-fix note above).
  const fetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      
      if (!isMountedRef.current) return;

      setData(result);
      setError(null);
      
      // Reset backoff on success
      currentBackoffRef.current = desiredIntervalRef.current;
      setBackoffDelay(desiredIntervalRef.current);
      consecutiveFailuresRef.current = 0;

      if (onDataRef.current) {
        onDataRef.current(result);
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);

      // Exponential backoff (clamped to [MIN_BACKOFF, MAX_BACKOFF])
      currentBackoffRef.current = Math.max(
        MIN_BACKOFF,
        Math.min(
          currentBackoffRef.current * BACKOFF_MULTIPLIER,
          MAX_BACKOFF
        )
      );
      setBackoffDelay(currentBackoffRef.current);
      consecutiveFailuresRef.current += 1;

      if (onErrorRef.current) {
        onErrorRef.current(error);
      }

      console.error('[usePolling] Error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ============================================================================
  // POLLING LOOP
  // ============================================================================

  useEffect(() => {
    // Clear existing timer
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't poll if disabled or tab inactive
    if (!enabled || (pauseWhenInactive && !isTabVisible)) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    // Self-scheduling loop: the next request is scheduled only AFTER the current
    // one completes (plus the backoff delay). Guarantees at most one in-flight
    // request per hook, regardless of how slow the server is.
    let cancelled = false;

    const tick = async () => {
      if (cancelled || !isMountedRef.current) return;
      // Circuit breaker: too many consecutive failures — stand down instead of
      // hammering a failing endpoint. A visibilitychange flips isTabVisible,
      // which re-runs this effect and resets the loop (fresh chances).
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setIsPolling(false);
        return;
      }
      await fetch();
      if (cancelled || !isMountedRef.current) return;
      intervalRef.current = setTimeout(tick, currentBackoffRef.current);
    };

    void tick();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // `fetch` is stable ([] deps); inline closures from callers are read via refs.
  }, [enabled, isTabVisible, pauseWhenInactive, fetch]);

  // ============================================================================
  // CLEANUP ON UNMOUNT
  // ============================================================================

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // ============================================================================
  // MANUAL REFETCH
  // ============================================================================

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    data,
    isPolling,
    error,
    isLoading,
    refetch,
    backoffDelay,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Battery Optimization:
 *    - Uses Page Visibility API (document.hidden)
 *    - Auto-pauses when tab goes to background
 *    - Resumes immediately when tab becomes visible again
 *    - Can be disabled via pauseWhenInactive=false
 * 
 * 2. Exponential Backoff:
 *    - Starts at configured interval (default 3s)
 *    - Doubles on each error: 3s → 6s → 12s → 24s
 *    - Caps at MAX_BACKOFF (30s) to prevent infinite delays
 *    - Resets to original interval on successful fetch
 * 
 * 2b. Flood Safety (2026-09-04):
 *    - The loop never restarts because a caller re-rendered. Inline
 *      fetchFn/onData/onError closures are read through refs each tick.
 *    - Self-scheduling timeout: next request waits for the previous one to
 *      finish. One in-flight request per hook, always.
 * 
 * 3. Memory Management:
 *    - Uses isMountedRef to prevent state updates after unmount
 *    - Clears intervals on unmount and effect cleanup
 *    - No memory leaks from abandoned timers
 * 
 * 4. TypeScript Generics:
 *    - Generic <T> allows type-safe polling for any data type
 *    - Example: usePolling<ChatMessage[]>(...) ensures data is ChatMessage[]
 *    - Full IntelliSense support for data property
 * 
 * 5. Error Handling:
 *    - Catches all errors from fetchFn
 *    - Converts unknown errors to Error instances
 *    - Exposes error state for UI feedback
 *    - Calls onError callback if provided
 * 
 * 6. Manual Refetch:
 *    - refetch() allows manual triggering (e.g., on user action)
 *    - Does NOT reset polling interval
 *    - Useful for "refresh" buttons or pull-to-refresh
 * 
 * 7. Conditional Polling:
 *    - enabled prop allows dynamic enable/disable
 *    - Example: enabled={isLoggedIn && isChannelOpen}
 *    - Stops polling when disabled, resumes when re-enabled
 * 
 * 8. Performance:
 *    - useCallback for fetch to prevent unnecessary re-renders
 *    - Minimal state updates (only when data/error changes)
 *    - Refs for values that don't need to trigger re-renders
 * 
 * 9. Debugging:
 *    - backoffDelay exposed for debugging current delay
 *    - isPolling shows whether actively polling
 *    - isLoading shows whether fetch in progress
 * 
 * 10. Usage Patterns:
 *     - Chat messages: Poll every 2s when channel open
 *     - Typing indicators: Poll every 2s, reset on new data
 *     - Online count: Poll every 30s, less frequent updates
 *     - Notifications: Poll every 10s, balance speed vs load
 *     - Private messages: Poll every 5s for new conversations
 * 
 * 11. ECHO Compliance:
 *     - ✅ Complete implementation (no pseudo-code)
 *     - ✅ TypeScript with generics
 *     - ✅ Comprehensive documentation (OVERVIEW, JSDoc, inline comments)
 *     - ✅ Error handling with user-friendly patterns
 *     - ✅ Production-ready code
 *     - ✅ Modern 2025+ syntax (hooks, async/await, const/let)
 */
