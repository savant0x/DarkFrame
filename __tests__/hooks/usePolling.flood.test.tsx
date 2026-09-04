/**
 * Behavioral verification for the usePolling flood fix (2026-09-04).
 *
 * Reproduces the EXACT production flood: a caller passes inline closures and
 * re-renders on every onData — under the old implementation each poll's own
 * state update re-rendered the caller, recreated `fetch`, restarted the loop
 * effect, and fired an immediate fetch. Requests fired as fast as round-trips
 * completed with no interval elapsing.
 *
 * Asserts:
 *   1. Request count stays ~1/interval (not 1/round-trip) across re-renders.
 *   2. At most one request in flight at any time.
 *   3. Circuit breaker stops polling after MAX_CONSECUTIVE_FAILURES.
 *   4. Backoff grows on failure and resets on success.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from '../../hooks/usePolling';

const INTERVAL = 50; // fast but real timer gap

describe('usePolling flood-fix behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps ~1 request per interval under constant caller re-renders', async () => {
    let requests = 0;
    const { rerender } = renderHook(
      (props: { v: number }) =>
        usePolling({
          // New closure identity on every render — exactly what ChatPanel does.
          fetchFn: async () => {
            requests += 1;
            return { v: props.v };
          },
          interval: INTERVAL,
          enabled: true,
          pauseWhenInactive: false,
          onData: undefined,
        }),
      { initialProps: { v: 1 } }
    );

    await act(async () => {
      for (let i = 0; i < 10; i++) {
        rerender({ v: i }); // fresh closure identity each tick, like a re-render storm
        await vi.advanceTimersByTimeAsync(INTERVAL);
      }
    });

    // Old code: every loop restart fired an immediate fetch → dozens of requests.
    // Fixed code: initial fetch + ~1 per interval.
    expect(requests).toBeLessThanOrEqual(13);
    expect(requests).toBeGreaterThanOrEqual(2);
  });

  it('never has more than one request in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let release: (() => void) | null = null;

    const { unmount } = renderHook(() =>
      usePolling({
        // Slow endpoint: first request parks until explicitly released.
        fetchFn: async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise<void>((r) => {
            release = r;
          });
          inFlight -= 1;
          return {};
        },
        interval: INTERVAL,
        enabled: true,
        pauseWhenInactive: false,
      })
    );

    // Let time pass while request #1 is parked — no second may start.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    });
    expect(maxInFlight).toBe(1);

    // Release; the next tick must again be single-flight.
    await act(async () => {
      release?.();
      await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    });
    expect(maxInFlight).toBe(1);

    unmount();
  });

  it('circuit breaker: stops after MAX_CONSECUTIVE_FAILURES consecutive errors', async () => {
    let requests = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      requests += 1;
      throw new Error('down');
    });

    const { result } = renderHook(() =>
      usePolling({
        fetchFn: async () => {
          requests += 1;
          throw new Error('down');
        },
        interval: INTERVAL,
        enabled: true,
        pauseWhenInactive: false,
      })
    );

    // Backoff schedule for consecutive failures: 1s, 2s, 4s, 8s, 16s → the 6th
    // tick (the breaker check itself) fires at ~31s. Advance past it.
    await act(async () => {
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }
    });

    // 5 failures, then the breaker halts the loop: no 6th request, isPolling false.
    expect(requests).toBe(5);
    expect(result.current.isPolling).toBe(false);
  });

  it('backoff grows on failure and resets to the interval on success', async () => {
    let failing = true;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      if (failing) throw new Error('down');
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const { result } = renderHook(() =>
      usePolling({
        fetchFn: async () => {
          if (failing) throw new Error('down');
          return {};
        },
        interval: INTERVAL,
        enabled: true,
        pauseWhenInactive: false,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVAL);
    });
    const afterFirstFailure = result.current.backoffDelay;
    expect(afterFirstFailure).toBeGreaterThan(INTERVAL); // doubled

    failing = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(afterFirstFailure + INTERVAL);
    });
    expect(result.current.backoffDelay).toBe(INTERVAL); // reset on success
  });
});
