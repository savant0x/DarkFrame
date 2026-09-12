'use client';

/**
 * @file hooks/useBearerStatus.ts
 * @created 2026-09-12
 * @overview FID-20260912-077 — client-side bearer awareness for blocked UI.
 *
 * Every bearer-restricted endpoint 403s with the real reason (FID-061 §5.5),
 * but the panels hitting them were blind: the bearer opened the bank/auction/
 * factory panels, filled in a form, hit submit, and only THEN learned the
 * action was impossible. This hook gives surfaces the same knowledge the
 * server has: `isBearer` + the human-readable restriction summary.
 *
 * Data source: GET /api/flag (already polled every 30s by the game page, but
 * panels live outside that tree — this hook self-polls on a slower 60s cadence
 * and refetches on window focus so a capture that just freed you shows fast).
 */

import { useCallback, useEffect, useState } from 'react';

export interface BearerStatus {
  /** Is the viewing player the current Flag Bearer? */
  isBearer: boolean;
  /** Bearer's username when known (lets panels show "Flag_Bearer_1027 holds it"). */
  holderUsername: string | null;
  /** True while the first fetch is in flight. */
  loading: boolean;
}

const INITIAL: BearerStatus = { isBearer: false, holderUsername: null, loading: true };

export function useBearerStatus(): BearerStatus {
  const [status, setStatus] = useState<BearerStatus>(INITIAL);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch('/api/flag');
      const data = await response.json().catch(() => null);
      if (data?.success && data?.data) {
        setStatus({
          isBearer: Boolean(data.data.actions?.isBearer),
          holderUsername: data.data.bearer?.username ?? null,
          loading: false,
        });
      } else {
        setStatus((s) => ({ ...s, loading: false }));
      }
    } catch {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refetch();
    const interval = setInterval(() => void refetch(), 60_000);
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refetch]);

  return status;
}
