// ============================================================
// FILE: components/TileHarvestStatus.tsx
// CREATED: 2025-01-23
// ============================================================
// OVERVIEW:
// Tile harvest cooldown indicator component displayed in top-right corner.
// Shows last harvest time and countdown until next harvest is available.
// Automatically updates every second with smooth animations.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { TerrainType } from '@/types/game.types';

interface TileHarvestStatusProps {
  currentTile: {
    x: number;
    y: number;
    terrain: TerrainType;
    lastHarvestedBy?: Array<{
      playerId: string;
      timestamp: Date;
      resetPeriod: string;
    }>;
  } | null;
  playerUsername: string;
}

const HARVEST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export default function TileHarvestStatus({ currentTile, playerUsername }: TileHarvestStatusProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(true);

  useEffect(() => {
    if (!currentTile) {
      setTimeLeft(null);
      setIsReady(true);
      return;
    }

    // Only show for harvestable terrains
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
      if (!currentTile.lastHarvestedBy) {
        setTimeLeft(null);
        setIsReady(true);
        return;
      }

      // Find this player's last harvest
      const playerHarvest = currentTile.lastHarvestedBy.find(
        (h) => h.playerId === playerUsername
      );

      if (!playerHarvest) {
        setTimeLeft(null);
        setIsReady(true);
        return;
      }

      const lastHarvestTime = new Date(playerHarvest.timestamp).getTime();
      const now = Date.now();
      const elapsed = now - lastHarvestTime;
      const remaining = HARVEST_COOLDOWN_MS - elapsed;

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

  // Don't render if no current tile or not harvestable
  if (!currentTile) return null;

  const harvestableTerrains = [
    TerrainType.Metal,
    TerrainType.Energy,
    TerrainType.Cave,
    TerrainType.Forest,
  ];

  if (!harvestableTerrains.includes(currentTile.terrain)) return null;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
              <span className="text-xs font-semibold">Harvest Cooldown</span>
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
