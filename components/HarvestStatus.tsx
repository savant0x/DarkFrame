/**
 * @file components/HarvestStatus.tsx
 * @created 2025-10-16
 * @overview Visual indicator showing harvest availability for current tile
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameContext } from '@/context/GameContext';
import { TerrainType } from '@/types';

interface HarvestStatusProps {
  onHarvestClick?: () => void;
  isHarvesting?: boolean;
}

export default function HarvestStatus({ onHarvestClick, isHarvesting }: HarvestStatusProps) {
  const { player, currentTile } = useGameContext();
  const [status, setStatus] = useState<'available' | 'harvested' | 'not-harvestable'>('not-harvestable');
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  // Fetch harvest status
  useEffect(() => {
    if (!player || !currentTile) return;
    
    const isHarvestable = [
      TerrainType.Metal,
      TerrainType.Energy,
      TerrainType.Cave,
      TerrainType.Forest
    ].includes(currentTile.terrain);
    
    if (!isHarvestable) {
      setStatus('not-harvestable');
      return;
    }
    
    // Check harvest status via API
    async function checkStatus() {
      try {
        const response = await fetch(`/api/harvest/status?username=${player!.username}`);
        const data = await response.json();
        
        if (data.canHarvest) {
          setStatus('available');
          setResetTime(null);
        } else {
          setStatus('harvested');
          setResetTime(data.nextResetTime ? new Date(data.nextResetTime) : null);
        }
      } catch (error) {
        console.error('Failed to fetch harvest status:', error);
        setStatus('not-harvestable');
      }
    }
    
    checkStatus();
  }, [player, currentTile]);
  
  // Update countdown timer
  useEffect(() => {
    if (status !== 'harvested' || !resetTime) return;
    
    function updateTimer() {
      const now = new Date();
      const diff = resetTime!.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('00:00:00');
        setStatus('available'); // Reset happened
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [status, resetTime]);
  
  if (!player || !currentTile || status === 'not-harvestable') {
    return null;
  }
  
  return (
    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
      {status === 'available' && (
        <button
          onClick={onHarvestClick}
          disabled={isHarvesting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all hover:scale-105 text-lg"
        >
          {isHarvesting ? 'HARVESTING...' : `HARVEST (${currentTile.terrain === TerrainType.Cave || currentTile.terrain === TerrainType.Forest ? 'F' : 'G'})`}
        </button>
      )}
      
      {status === 'harvested' && (
        <div className="bg-gray-900/80 backdrop-blur-sm text-white font-bold py-2 px-4 rounded-lg border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <div className="text-center">
            <div className="text-sm">✗ HARVESTED</div>
            {timeRemaining && (
              <div className="text-xs mt-1 text-white/70">
                Resets: <span className="font-mono">{timeRemaining}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// - Shows green "HARVEST" button when tile can be harvested (clickable)
// - Shows red "✗ HARVESTED" with countdown when already harvested
// - Positioned below resource panel (bottom-24)
// - Keyboard shortcuts shown in button: G for Metal/Energy, F for Cave/Forest
// - Auto-updates countdown every second
// - Only renders on Metal/Energy/Cave/Forest tiles
// - Fetches status from harvest API
// - Calls onHarvestClick prop to open HarvestModal
// ============================================================
