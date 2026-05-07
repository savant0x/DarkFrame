'use client';

import React from 'react';
import { MapPin, Flag } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import MovementControls from './MovementControls';
import type { FlagBearer } from '@/types';
import { TerrainType } from '@/types';

interface ControlsPanelProps { flagBearer?: FlagBearer | null; onBeforeMove?: () => void; }

function getTerrainColor(terrain: string): string {
  switch (terrain) {
    case TerrainType.Metal: return 'bg-[--electric]/8 text-[--electric] border-transparent';
    case TerrainType.Energy: return 'bg-[--neon-yellow]/8 text-[--neon-yellow] border-transparent';
    case TerrainType.Cave: return 'bg-[--neon-pink]/8 text-[--neon-pink] border-transparent';
    case TerrainType.Forest: return 'bg-[--synth]/8 text-[--synth] border-transparent';
    case TerrainType.Factory: return 'bg-[--solar]/8 text-[--solar] border-transparent';
    case TerrainType.Bank: return 'bg-[--neon-yellow]/8 text-[--neon-yellow] border-transparent';
    case TerrainType.Shrine: return 'bg-[--neon-pink]/8 text-[--neon-pink] border-transparent';
    case TerrainType.AuctionHouse: return 'bg-[--electric]/8 text-[--electric] border-transparent';
    case TerrainType.Wasteland: return 'bg-white/5 text-[--text-2] border-transparent';
    default: return 'bg-white/5 text-[--text-2] border-transparent';
  }
}

export default function ControlsPanel({ flagBearer, onBeforeMove }: ControlsPanelProps) {
  const { player, currentTile } = useGameContext();

  return (
    <div className="p-2 space-y-2">
      {/* Position */}
      {player && (
        <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-[--electric]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[--electric]" /> POSITION
          </div>
          <div className="p-2.5 text-center">
            <div className="text-lg font-mono font-bold text-[--text-1] mb-1.5">({player.currentPosition.x}, {player.currentPosition.y})</div>
            {currentTile && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-[--text-2]">Terrain:</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getTerrainColor(currentTile.terrain)}`}>{currentTile.terrain}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Movement */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <MovementControls onBeforeMove={onBeforeMove} />
      </div>

      <a href="/help" target="_blank" className="block text-center text-[--text-3] hover:text-[--text-1] text-xs underline transition-colors">📖 How to Play</a>
    </div>
  );
}
