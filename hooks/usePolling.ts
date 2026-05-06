'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePollingOptions<T> {
  fetchFn: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
  pauseWhenInactive?: boolean;
  initialData?: T;
  onData?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UsePollingReturn<T> {
  data: T | undefined;
  isPolling: boolean;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  backoffDelay: number;
}

const DEFAULT_INTERVAL = 3000;
const MIN_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const BACKOFF_MULTIPLIER = 2;

export function usePolling<T = unknown>({
  fetchFn,
  interval = DEFAULT_INTERVAL,
  enabled = true,
  pauseWhenInactive = true,
  initialData,
  onData,
  onError,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(enabled);
  const [backoffDelay, setBackoffDelay] = useState(interval);
  const [isTabVisible, setIsTabVisible] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const currentBackoffRef = useRef(interval);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const fetchFnRef = useRef(fetchFn);
  const enabledRef = useRef(enabled);
  const pauseRef = useRef(pauseWhenInactive);
  const visibleRef = useRef(true);

  // Keep refs current without triggering effect re-runs
  onDataRef.current = onData;
  onErrorRef.current = onError;
  fetchFnRef.current = fetchFn;
  enabledRef.current = enabled;
  pauseRef.current = pauseWhenInactive;
  visibleRef.current = isTabVisible;

  // Visibility tracking
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

  const fetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      if (!isMountedRef.current) return;

      setData(result);
      setError(null);
      currentBackoffRef.current = interval;
      setBackoffDelay(interval);

      if (onDataRef.current) {
        onDataRef.current(result);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      currentBackoffRef.current = Math.min(
        currentBackoffRef.current * BACKOFF_MULTIPLIER,
        MAX_BACKOFF
      );
      setBackoffDelay(currentBackoffRef.current);
      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [interval]);

  // Polling loop
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const doFetch = () => {
      if (!enabledRef.current) return;
      if (pauseRef.current && !visibleRef.current) return;
      fetch();
    };

    doFetch();
    intervalRef.current = setInterval(doFetch, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, fetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return {
    data,
    isPolling,
    error,
    isLoading,
    refetch,
    backoffDelay,
  };
}
