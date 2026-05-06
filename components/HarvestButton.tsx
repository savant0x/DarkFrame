 /**
 * @file components/HarvestButton.tsx
 * @created 2025-10-16
 * @overview Harvest action button with modal success display
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { TerrainType, HarvestResult } from '@/types';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

interface HarvestButtonProps {
  onHarvestResult?: (result: HarvestResult) => void;
}

export default function HarvestButton({ onHarvestResult }: HarvestButtonProps) {
  const { player, currentTile, isLoading } = useGameContext();
  const [isHarvesting, setIsHarvesting] = useState(false);
  
  // Early returns BEFORE hooks would violate rules of hooks
  // So we check these conditions later
  
  /**
   * Handle harvest action (wrapped in useCallback for stable reference)
   */
  const handleHarvest = useCallback(async () => {
    if (isHarvesting || isLoading || !player) return;
    
    setIsHarvesting(true);
    
    try {
      const response = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Send result to parent via callback
        if (onHarvestResult) {
          onHarvestResult(data);
        }
        
        // Do NOT refresh game state - keep page as is
        // The result is displayed inline without page reload
      } else {
        // Show failure message via callback
        if (onHarvestResult) {
          onHarvestResult({
            success: false,
            message: data.message || 'Harvest failed',
            metalGained: 0,
            energyGained: 0
          });
        }
      }
    } catch (error) {
      console.error('Harvest error:', error);
      if (onHarvestResult) {
        onHarvestResult({
          success: false,
          message: 'Network error - please try again',
          metalGained: 0,
          energyGained: 0
        });
      }
    } finally {
      setIsHarvesting(false);
    }
  }, [isHarvesting, isLoading, player, onHarvestResult]);
  
  /**
   * Keyboard shortcut support: 
   * G = Metal/Energy (Gather)
   * F = Cave/Forest (Find/Forage)
   */
  useEffect(() => {
    if (!player || !currentTile) return;
    
    // Capture currentTile in closure to satisfy TypeScript null checks
    const tile = currentTile;
    
    function handleKeyPress(event: KeyboardEvent) {
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }

      if (isHarvesting || isLoading) return;
      
      const isMetal = tile.terrain === TerrainType.Metal;
      const isEnergy = tile.terrain === TerrainType.Energy;
      const isCave = tile.terrain === TerrainType.Cave;
      const isForest = tile.terrain === TerrainType.Forest;
      
      // G for Metal/Energy gathering
      if ((event.key === 'g' || event.key === 'G') && (isMetal || isEnergy)) {
        console.log(`[HarvestButton] Received '${event.key}' keypress for ${tile.terrain} - triggering harvest`);
        event.preventDefault();
        handleHarvest();
      }
      
      // F for Cave/Forest exploration
      if ((event.key === 'f' || event.key === 'F') && (isCave || isForest)) {
        console.log(`[HarvestButton] Received '${event.key}' keypress for ${tile.terrain} - triggering harvest`);
        event.preventDefault();
        handleHarvest();
      }
    }
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isHarvesting, isLoading, player, currentTile]);
  
  // Early returns AFTER all hooks
  if (!player || !currentTile) return null;
  
  // Check if current tile is harvestable
  const isHarvestable = [
    TerrainType.Metal,
    TerrainType.Energy,
    TerrainType.Cave,
    TerrainType.Forest
  ].includes(currentTile.terrain);
  
  if (!isHarvestable) return null;
  
  // Get appropriate key hint based on terrain
  const getKeyHint = () => {
    if (!currentTile) return 'G';
    if (currentTile.terrain === TerrainType.Cave || currentTile.terrain === TerrainType.Forest) return 'F';
    return 'G'; // Metal or Energy
  };
  
  return (
    <>
      {/* Harvest Button */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={handleHarvest}
          disabled={isHarvesting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all hover:scale-105 disabled:cursor-not-allowed text-xl"
        >
          {isHarvesting ? 'HARVESTING...' : `HARVEST (${getKeyHint()})`}
        </button>
      </div>
    </>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Only shows on harvestable tiles (Metal, Energy, Cave, Forest)
// - Modal styled to match reference screenshot
// - Randomized success messages from harvestMessages.ts
// - Displays amount for resources, item for caves/forests
// - Auto-refreshes game state after harvest
// - Keyboard shortcuts: G key for resources, F key for caves/forests
// ============================================================
// END OF FILE
// ============================================================
