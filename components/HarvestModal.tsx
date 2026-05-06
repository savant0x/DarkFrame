// ============================================================
// FILE: components/HarvestModal.tsx
// CREATED: 2025-01-18
// LAST MODIFIED: 2025-01-18
// ============================================================
// OVERVIEW:
// Modal overlay for harvest actions matching reference design.
// Shows customizable pre-harvest text and displays results inline
// with success/failure messages and resource amounts.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { TerrainType } from '@/types';
import { X } from 'lucide-react';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface HarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HarvestResult {
  success: boolean;
  message: string;
  metalGained?: number;
  energyGained?: number;
  item?: {
    name: string;
    rarity: string;
  };
}

// ============================================================
// PRE-HARVEST MESSAGES
// ============================================================

const PRE_HARVEST_MESSAGES: Record<string, string[]> = {
  [TerrainType.Metal]: [
    'Need a new pilot? Go get some Metal for it. This is the place for gathering that.',
    'Gather Metal (<>)',
    'Metal deposits detected. Extract resources.',
    'Rich metal veins await your excavation.',
  ],
  [TerrainType.Energy]: [
    'It seems like you like an empty ground.',
    'You didn\'t do anything, try again some other time, maybe?',
    'Energy crystals pulse with power here.',
    'Harvest energy for your forces.',
  ],
  [TerrainType.Cave]: [
    'A dark cave entrance beckons...',
    'What mysteries lie within this cavern?',
    'Explore the depths for rare treasures.',
    'Ancient artifacts may be hidden here.',
  ],
  [TerrainType.Forest]: [
    'Dense foliage conceals valuable resources.',
    'The forest holds secrets worth discovering.',
    'Search among the trees for hidden items.',
    'Nature\'s bounty awaits the bold explorer.',
  ],
};

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Harvest Modal Component
 * 
 * Displays harvest interface with:
 * - Customizable pre-harvest message
 * - Harvest button with keyboard shortcut
 * - Inline result display (success/failure)
 * - Resource amounts or item found
 */
export default function HarvestModal({ isOpen, onClose }: HarvestModalProps) {
  const { player, currentTile, refreshGameState } = useGameContext();
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [result, setResult] = useState<HarvestResult | null>(null);
  const [preHarvestMessage, setPreHarvestMessage] = useState<string>('');

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Set random pre-harvest message when modal opens
   */
  useEffect(() => {
    if (isOpen && currentTile) {
      const messages = PRE_HARVEST_MESSAGES[currentTile.terrain] || [];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setPreHarvestMessage(randomMessage || 'Ready to harvest?');
      setResult(null); // Reset result when opening
    }
  }, [isOpen, currentTile]);

  /**
   * Keyboard shortcut: G or F to harvest
   */
  useEffect(() => {
    if (!isOpen || isHarvesting || result) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }

      const key = event.key.toLowerCase();
      
      // G for Metal/Energy
      if (key === 'g' && currentTile && 
          (currentTile.terrain === TerrainType.Metal || currentTile.terrain === TerrainType.Energy)) {
        event.preventDefault();
        handleHarvest();
      }
      
      // F for Cave/Forest
      if (key === 'f' && currentTile && 
          (currentTile.terrain === TerrainType.Cave || currentTile.terrain === TerrainType.Forest)) {
        event.preventDefault();
        handleHarvest();
      }

      // Escape to close
      if (key === 'escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, isHarvesting, result, currentTile, onClose]);

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle harvest action
   */
  const handleHarvest = async () => {
    if (!player || isHarvesting) return;

    setIsHarvesting(true);

    try {
      const response = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username }),
      });

      const data = await response.json();

      setResult({
        success: data.success,
        message: data.message,
        metalGained: data.metalGained,
        energyGained: data.energyGained,
        item: data.item,
      });

      // Refresh game state after successful harvest
      if (data.success) {
        setTimeout(() => {
          refreshGameState();
        }, 500);
      }

      // Auto-close modal after 2 seconds if successful
      if (data.success) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Harvest error:', error);
      setResult({
        success: false,
        message: 'Network error - please try again',
      });
    } finally {
      setIsHarvesting(false);
    }
  };

  /**
   * Get keyboard shortcut based on terrain
   */
  const getKeyHint = () => {
    if (!currentTile) return 'G';
    if (currentTile.terrain === TerrainType.Cave || currentTile.terrain === TerrainType.Forest) {
      return 'F';
    }
    return 'G';
  };

  /**
   * Get action verb based on terrain
   */
  const getActionVerb = () => {
    if (!currentTile) return 'Gather';
    if (currentTile.terrain === TerrainType.Cave) return 'Explore';
    if (currentTile.terrain === TerrainType.Forest) return 'Search';
    return 'Gather';
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!isOpen || !currentTile || !player) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gray-900/95 backdrop-blur-md border-2 border-cyan-500/50 rounded-lg shadow-[0_0_40px_rgba(0,240,255,0.4)] max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">
            {currentTile.terrain.toUpperCase()} {currentTile.terrain === TerrainType.Metal ? 'DEPOSIT' : 
             currentTile.terrain === TerrainType.Energy ? 'SOURCE' : ''}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Image placeholder (you can add actual terrain images here) */}
          <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-lg h-48 flex items-center justify-center mb-6 border border-cyan-500/20">
            <div className="text-6xl">
              {currentTile.terrain === TerrainType.Metal && '⛏️'}
              {currentTile.terrain === TerrainType.Energy && '⚡'}
              {currentTile.terrain === TerrainType.Cave && '🕳️'}
              {currentTile.terrain === TerrainType.Forest && '🌲'}
            </div>
          </div>

          {/* Pre-Harvest Message or Result */}
          {!result ? (
            <div className="text-center mb-6">
              <p className="text-white/90 text-lg mb-6">
                {preHarvestMessage}
              </p>
              <button
                onClick={handleHarvest}
                disabled={isHarvesting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition-all hover:scale-105 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              >
                {isHarvesting ? 'HARVESTING...' : `${getActionVerb()} (${getKeyHint()})`}
              </button>
            </div>
          ) : (
            <div className="text-center">
              {/* Success/Failure Message */}
              <div className={`mb-4 p-4 rounded-lg border-2 ${
                result.success 
                  ? 'bg-green-500/20 border-green-500/50' 
                  : 'bg-red-500/20 border-red-500/50'
              }`}>
                <p className={`text-lg font-semibold ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.message}
                </p>
              </div>

              {/* Resource Display */}
              {result.success && (result.metalGained || result.energyGained) && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {result.metalGained && result.metalGained > 0 && (
                    <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
                      <p className="text-white/70 text-sm mb-1">Metal</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        +{result.metalGained.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {result.energyGained && result.energyGained > 0 && (
                    <div className="bg-gray-800/50 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-white/70 text-sm mb-1">Energy</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        +{result.energyGained.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Item Display */}
              {result.success && result.item && (
                <div className="bg-purple-500/20 border-2 border-purple-500/50 rounded-lg p-4 mb-6">
                  <p className="text-white/70 text-sm mb-1">Item Found</p>
                  <p className="text-xl font-bold text-purple-400">{result.item.name}</p>
                  <p className="text-sm text-white/60 mt-1">{result.item.rarity}</p>
                </div>
              )}

              {/* Note about auto-close */}
              <p className="text-white/50 text-sm">
                {result.success ? 'Closing in 2 seconds...' : 'Press Escape to close'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Modal overlay matches reference design aesthetic
// - Pre-harvest messages randomized from terrain-specific arrays
// - Results display inline in modal (no separate notification)
// - Keyboard shortcuts: G (Metal/Energy), F (Cave/Forest), Escape (close)
// - Success/failure messages with color-coded styling
// - Resource amounts shown in separate boxes
// - Item discoveries displayed with rarity
// - Auto-refreshes game state on successful harvest
// ============================================================
// END OF FILE
// ============================================================
