/**
 * AutoFarmPanel.tsx
 * Created: 2025-10-19
 * Updated: 2026-09-06 — FID-20260906-012 Phase 2-R1: rebuilt to approved
 *   sample §04 Auto-Farm markup (violet module) with parity.
 *
 * OVERVIEW:
 * Sidebar control panel for auto-farm system. Start/Pause/Stop controls,
 * live status, position, progress. All logic/handlers unchanged.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, Bot, Zap, Settings2 } from 'lucide-react';
import { AutoFarmStatus } from '@/types/autoFarm.types';

interface AutoFarmPanelProps {
  status: AutoFarmStatus;
  currentPosition: { x: number; y: number };
  tilesCompleted: number;
  lastAction?: string;
  isVIP?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const PROGRESS_MAX = 22500;

/**
 * Auto-Farm control panel — sample §04: violet module with status dot row,
 * position row, segmented tile meter, and outline control buttons.
 */
export default function AutoFarmPanel({
  status,
  currentPosition,
  tilesCompleted,
  lastAction = 'Ready',
  isVIP = false,
  onStart,
  onPause,
  onResume,
  onStop
}: AutoFarmPanelProps) {
  const router = useRouter();

  const isActive = status === AutoFarmStatus.ACTIVE;
  const isPaused = status === AutoFarmStatus.PAUSED;
  const isStopped = status === AutoFarmStatus.STOPPED;

  const handleSettingsClick = () => {
    router.push('/game/auto-farm-settings');
  };

  const statusLabel = isActive ? 'ACTIVE' : isPaused ? 'PAUSED' : 'STOPPED';
  const statusColor = isActive ? 'var(--nn-green)' : isPaused ? 'var(--nn-amber)' : 'var(--nn-text-tertiary)';
  const progressPct = Math.min((tilesCompleted / PROGRESS_MAX) * 100, 100);

  return (
    <div className="nn-panel nn-panel--violet" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
      {/* Header — sample: Auto-Farm + BASIC tier meta + settings gear */}
      <div className="nn-panel__header nn-panel__header--violet">
        <Bot className="nn-panel__icon" />
        <span className="nn-panel__title">Auto-Farm</span>
        <span className="nn-panel__meta">
          {isVIP ? 'VIP TIER' : 'BASIC TIER'}
          <button
            onClick={handleSettingsClick}
            title="Auto-Farm Settings"
            className="ml-1.5 inline-flex align-middle text-[color:var(--nn-text-tertiary)] transition-colors hover:text-[color:var(--nn-cyan)]"
          >
            <Settings2 style={{ width: 12, height: 12 }} />
          </button>
        </span>
      </div>

      <div className="nn-panel__body">
        {/* Status row — sample: dot + Orbitron status label */}
        <div className="nn-row">
          <span className="nn-row__label">Status</span>
          <b className="flex items-center">
            <i
              aria-hidden
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
                marginRight: 7,
                ...(isActive ? { animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : {})
              }}
            />
            <span className="nn-num" style={{ color: statusColor, fontSize: 11, letterSpacing: '0.12em' }}>
              {statusLabel}
            </span>
          </b>
        </div>

        {/* Position row */}
        <div className="nn-row">
          <span className="nn-row__label">Position</span>
          <b className="nn-num">[{currentPosition.x}, {currentPosition.y}]</b>
        </div>

        {/* Tiles meter — sample `.prog` violet block */}
        <div className="nn-progblock">
          <div className="nn-meter__lab">
            <span>TILES · {tilesCompleted.toLocaleString()} / {PROGRESS_MAX.toLocaleString()}</span>
            <b className="nn-num" style={{ color: 'var(--nn-violet)' }}>{progressPct.toFixed(2)}%</b>
          </div>
          <div className="nn-meter">
            <div className="nn-meter__seg nn-meter__seg--vio" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Live action row (hidden when stopped) */}
        {!isStopped && (
          <div className="nn-row">
            <span className="nn-row__label">Last action</span>
            <b style={{ fontSize: 12, color: isActive ? 'var(--nn-green)' : 'var(--nn-amber)' }}>
              {isActive ? lastAction : 'Paused'}
            </b>
          </div>
        )}

        {/* Speed tier row */}
        <div className="nn-row">
          <span className="nn-row__label">Speed Tier</span>
          <b style={{ color: 'var(--nn-violet)', fontSize: 12 }}>
            {isVIP ? 'VIP · 5.6 hrs' : 'Basic · 11.6 hrs'}
          </b>
        </div>

        {/* Control buttons — sample outline btnrow */}
        <div className="nn-actions2" style={{ paddingTop: 8 }}>
          {isStopped && (
            <button onClick={onStart} className="nn-btn nn-btn--primary nn-btn--flex">
              <Play /> Start Auto-Farm
            </button>
          )}

          {isActive && (
            <>
              <button onClick={onPause} className="nn-btn nn-btn--ghost nn-btn--flex">
                <Pause /> Pause
              </button>
              <button onClick={onStop} className="nn-btn nn-btn--magenta">
                <Square /> Stop
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button onClick={onResume} className="nn-btn nn-btn--primary nn-btn--flex">
                <Play /> Resume
              </button>
              <button onClick={onStop} className="nn-btn nn-btn--magenta">
                <Square /> Stop
              </button>
            </>
          )}
        </div>

        {/* Info message */}
        <p className="nn-footnote">
          {isStopped && 'Configure settings and start farming'}
          {isActive && 'Auto-farming in progress'}
          {isPaused && 'Paused — resume anytime'}
        </p>

        {/* VIP upgrade CTA — sample: full-width amber outline button */}
        {!isVIP && (
          <>
            <div className="nn-actions2" style={{ paddingTop: 0, paddingBottom: 8 }}>
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="nn-btn nn-btn--amber nn-btn--flex"
              >
                <Zap /> Get VIP · 2x Speed
              </button>
            </div>
            <p className="nn-footnote" style={{ paddingBottom: 10 }}>Complete the map in 5.6 hours instead of 11.6</p>
          </>
        )}
      </div>
    </div>
  );
}
