/**
 * @file components/ControlsPanel.tsx
 * @created 2025-01-17
 * @updated 2026-09-06 — FID-20260906-012 Phase 2: NEON NOIR controls rail.
 * @overview Right sidebar: position readout, flag bearer status, movement cluster
 */

'use client';

import React from 'react';
import { MapPin, Flag } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import MovementControls from './MovementControls';
import type { FlagBearer } from '@/types';

interface ControlsPanelProps {
  flagBearer?: FlagBearer | null;
}

/**
 * Controls Panel — NEON NOIR (§5.1 right rail).
 * Position as an instrument readout (Orbitron coords + terrain chip),
 * flag bearer as an amber alert module, movement as the HUD D-pad cluster.
 */
export default function ControlsPanel({ flagBearer }: ControlsPanelProps) {
  const { player, currentTile } = useGameContext();

  const isCurrentPlayerBearer = flagBearer && player && flagBearer.username === player.username;

  return (
    <div className="p-3 space-y-3">
      {/* Position readout */}
      {player && (
        <div className="nn-panel p-3">
          <h3 className="nn-panel__header mb-3">
            <MapPin className="h-3.5 w-3.5" />
            Position
          </h3>
          <div className="text-center">
            <div className="nn-num mb-2 text-3xl text-[color:var(--nn-cyan)] [text-shadow:0_0_16px_color-mix(in_oklab,var(--nn-cyan)_40%,transparent)]">
              {`[${player.currentPosition.x}, ${player.currentPosition.y}]`}
            </div>
            {currentTile && (
              <span className="nn-chip nn-chip--cyan">{currentTile.terrain}</span>
            )}
          </div>
        </div>
      )}

      {/* Flag Bearer — amber alert module (only when player holds the flag) */}
      {isCurrentPlayerBearer && (
        <div className="nn-panel nn-panel--amber p-3">
          <h3 className="nn-panel__header nn-panel__header--amber mb-3">
            <Flag className="h-3.5 w-3.5" />
            Flag Bearer
          </h3>
          <div className="space-y-2">
            <div className="text-center font-orbitron text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--nn-amber)]">
              You hold the flag
            </div>

            <div className="nn-row justify-between">
              <span className="nn-row__label">Harvest bonus</span>
              <span className="nn-num text-[color:var(--nn-green)]">+100%</span>
            </div>
            <div className="nn-row justify-between">
              <span className="nn-row__label">XP bonus</span>
              <span className="nn-num text-[color:var(--nn-violet)]">+100%</span>
            </div>

            <p className="nn-footnote mt-2 text-center">
              You leave a visible trail others can track
            </p>
          </div>
        </div>
      )}

      {/* Movement cluster */}
      <div className="nn-panel p-3">
        <MovementControls />
      </div>

      {/* Help */}
      <a
        href="/help"
        target="_blank"
        className="nn-link block text-center text-xs"
      >
        How to Play
      </a>
    </div>
  );
}
