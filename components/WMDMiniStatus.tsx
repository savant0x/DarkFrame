/**
 * @file components/WMDMiniStatus.tsx
 * @created 2025-10-22
 * @updated 2026-09-06 — FID-20260906-012 Phase 2-R1: rebuilt to approved
 *   sample §04 WMD markup (magenta module, 2×2 stat grid) with parity.
 * @overview WMD Compact Status Widget — magenta threat module, click opens WMD Hub
 */

'use client';

import { useState, useEffect } from 'react';
import { Crosshair } from 'lucide-react';

interface WMDStatus {
  rp: number;
  missilesReady: number;
  batteriesActive: number;
  spiesAvailable: number;
  pendingVotes: number;
  hasAlerts: boolean;
}

interface WMDMiniStatusProps {
  onClick?: () => void;
}

/** Threat module — sample §04: magenta panel, grid2x2 wells, CLICK TO OPEN footnote. */
export default function WMDMiniStatus({ onClick }: WMDMiniStatusProps) {
  const [status, setStatus] = useState<WMDStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/wmd/status');

      // Handle authentication errors silently (user doesn't have WMD access)
      if (res.status === 401) {
        setLoading(false);
        return;
      }

      const data: { success: boolean; status?: WMDStatus } = await res.json();
      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch WMD status:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      onClick={onClick}
      className="nn-panel nn-panel--magenta cursor-pointer"
      style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}
    >
      <div className="nn-panel__header nn-panel__header--magenta">
        <Crosshair className="nn-panel__icon" />
        <span className="nn-panel__title">WMD</span>
        {status?.hasAlerts && (
          <span
            aria-label="Alerts pending"
            className="ml-2 h-2 w-2 nn-pulse rounded-none"
            style={{ background: 'var(--nn-magenta)', boxShadow: '0 0 8px var(--nn-magenta)' }}
          />
        )}
        <span className="nn-panel__meta">THREAT MONITOR</span>
      </div>

      {loading || !status ? (
        <div className="nn-panel__body">
          <p className="nn-footnote">Syncing…</p>
        </div>
      ) : (
        <div className="nn-panel__body">
          {/* 2×2 stat grid (sample `.wmd-grid`) */}
          <div className="nn-grid2x2">
            <div className="nn-well">
              <span className="nn-lab">RP</span>
              <b className="nn-num" style={{ color: 'var(--nn-cyan)', fontSize: 14 }}>{status.rp.toLocaleString()}</b>
            </div>
            <div className="nn-well">
              <span className="nn-lab">Missiles</span>
              <b className="nn-num" style={{ color: 'var(--nn-magenta)', fontSize: 14 }}>{status.missilesReady}</b>
            </div>
            <div className="nn-well">
              <span className="nn-lab">Batteries</span>
              <b className="nn-num" style={{ color: 'var(--nn-amber)', fontSize: 14 }}>{status.batteriesActive}</b>
            </div>
            <div className="nn-well">
              <span className="nn-lab">Spies</span>
              <b className="nn-num" style={{ color: 'var(--nn-violet)', fontSize: 14 }}>{status.spiesAvailable}</b>
            </div>
          </div>

          {/* Pending votes */}
          {status.pendingVotes > 0 && (
            <div className="nn-well" style={{ margin: '4px 12px 8px' }}>
              <span className="nn-lab">Votes</span>
              <b className="nn-num" style={{ color: 'var(--nn-cyan)', fontSize: 12 }}>
                {status.pendingVotes} pending
              </b>
            </div>
          )}

          <p className="nn-footnote" style={{ letterSpacing: '0.12em' }}>CLICK TO OPEN</p>
        </div>
      )}
    </div>
  );
}
