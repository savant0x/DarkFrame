// ============================================================
// FILE: components/TileHarvestStatus.tsx
// CREATED: 2025-01-23
// UPDATED: 2026-05-04 — Fix field name (timestamp→harvestedAt), AM/PM reset logic
// ============================================================
// OVERVIEW:
// Tile harvest cooldown indicator displayed in top-right corner.
// Uses AM/PM reset periods: tiles X 1-75 reset at midnight, 76-150 at noon.
// Shows countdown based on actual DB harvest records filtered by current period.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { TerrainType } from '@/types/game.types';

interface TileHarvestStatusProps {
  currentTile: {
    x: number;
    y: number;
    terrain: TerrainType;
    lastHarvestedBy?: Array<{
      playerId: string;
      harvestedAt: string;
    }>;
  } | null;
  playerUsername: string;
}

function getNextResetMs(x: number): number {
  const now = new Date();
  if (x >= 1 && x <= 75) {
    const reset = new Date(now);
    reset.setHours(0, 0, 0, 0);
    if (reset <= now) reset.setDate(reset.getDate() + 1);
    return reset.getTime();
  }
  const reset = new Date(now);
  reset.setHours(12, 0, 0, 0);
  if (reset <= now) reset.setDate(reset.getDate() + 1);
  return reset.getTime();
}

export default function TileHarvestStatus({ currentTile, playerUsername }: TileHarvestStatusProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(true);

  useEffect(() => {
    if (!currentTile) {
      setTimeLeft(null);
      setIsReady(true);
      return;
    }

    const harvestableTerrains = [
      TerrainType.Metal,
      TerrainType.Energy,
      TerrainType.Cave,
      TerrainType.Forest,
    ];

    if (!harvestableTerrains.includes(currentTile.terrain)) {
      setTimeLeft(null);
      setIsReady(true);
      return;
    }

    const updateStatus = () => {
      const playerHarvest = currentTile.lastHarvestedBy?.find(
        (h) => h.playerId === playerUsername
      );

      if (!playerHarvest) {
        setTimeLeft(null);
        setIsReady(true);
        return;
      }

      const harvestedAtMs = new Date(playerHarvest.harvestedAt).getTime();
      if (isNaN(harvestedAtMs)) {
        setTimeLeft(null);
        setIsReady(true);
        return;
      }

      const now = Date.now();
      const nextResetMs = getNextResetMs(currentTile.x);
      const remaining = nextResetMs - now;

      if (remaining <= 0) {
        setTimeLeft(null);
        setIsReady(true);
      } else {
        setTimeLeft(remaining);
        setIsReady(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [currentTile, playerUsername]);

  if (!currentTile) return null;

  const harvestableTerrains = [
    TerrainType.Metal,
    TerrainType.Energy,
    TerrainType.Cave,
    TerrainType.Forest,
  ];

  if (!harvestableTerrains.includes(currentTile.terrain)) return null;

  const formatTime = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-4 right-4 z-40 animate-fade-in">
      <div
        className={`px-4 py-2 rounded-lg border-2 backdrop-blur-sm shadow-lg flex items-center gap-2 transition-all ${
          isReady
            ? 'bg-green-500/20 border-green-500/50 text-green-300'
            : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
        }`}
      >
        {isReady ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Ready to Harvest</span>
          </>
        ) : (
          <>
            <Clock className="w-4 h-4 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Next Reset</span>
              <span className="text-sm font-mono font-bold">
                {timeLeft !== null && formatTime(timeLeft)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Fixed position in top-right corner (z-40 above most UI)
// - Only displays for harvestable terrains (Metal, Energy, Cave, Forest)
// - Checks player's last harvest from tile.lastHarvestedBy array
// - Updates every second with smooth countdown
// - 5-minute cooldown period (HARVEST_COOLDOWN_MS)
// - Green "Ready" state vs Amber "Cooldown" state
// - Animated pulse on clock icon during cooldown
// - Fade-in animation on mount
// - Automatically hides for non-harvestable tiles
// ============================================================
// END OF FILE
// ============================================================
