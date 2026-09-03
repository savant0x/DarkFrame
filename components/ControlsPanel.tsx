// ============================================================
// FILE: ControlsPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2025-10-27
// ============================================================
// OVERVIEW:
// Right sidebar controls panel component providing player position info,
// movement controls, flag bearer status, and gameplay instructions.
// Displays current coordinates, terrain type, flag bearer bonuses,
// loading/error states, and keyboard shortcut reference guide.
// Integrates design system components (Panel, Badge, Button, Divider, Card).
// ============================================================

'use client';

import React from 'react';
import { MapPin, Map, Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import MovementControls from './MovementControls';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Card } from '@/components/ui/Card';
import type { FlagBearer } from '@/types';

// ============================================================
// COMPONENT PROPS
// ============================================================

interface ControlsPanelProps {
  flagBearer?: FlagBearer | null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Controls Panel Component
 * 
 * Right sidebar providing:
 * - Current position display with coordinates and terrain
 * - Flag bearer status and bonuses (when player holds flag)
 * - Loading and error state indicators
 * - Movement controls component integration
 * - Keyboard shortcuts reference guide
 * - Logout functionality
 * - Design system integration for consistent styling
 */
export default function ControlsPanel({ flagBearer }: ControlsPanelProps) {
  const { player, currentTile, isLoading, error } = useGameContext();
  const router = useRouter();

  // Check if current player is the flag bearer
  const isCurrentPlayerBearer = flagBearer && player && flagBearer.username === player.username;

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="p-3 space-y-3">
      {/* Position Info */}
      {player && (
        <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          {/* Banner Title */}
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              POSITION
            </h3>
          </div>
          {/* Content */}
          <div className="p-3 text-center">
            <div className="text-2xl font-mono font-bold text-white mb-2">
              ({player.currentPosition.x}, {player.currentPosition.y})
            </div>
            {currentTile && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-white/70">Terrain:</span>
                <span className="text-xs text-white font-semibold px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded">
                  {currentTile.terrain}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flag Bearer Status - Only show when player holds the flag */}
      {isCurrentPlayerBearer && (
        <div className="bg-gradient-to-br from-yellow-900/60 to-orange-900/60 backdrop-blur-sm border-2 border-yellow-500/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.4)] animate-pulse">
          {/* Banner Title */}
          <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-b border-yellow-500/50 px-3 py-2">
            <h3 className="text-sm font-bold text-yellow-100 font-display flex items-center gap-2">
              <Flag className="w-4 h-4" />
              FLAG BEARER
            </h3>
          </div>
          {/* Content */}
          <div className="p-3 space-y-2">
            <div className="text-center">
              <div className="text-4xl mb-2">🏴</div>
              <div className="text-xs text-yellow-100 font-bold mb-3">
                You hold the flag!
              </div>
            </div>
            
            {/* Bonuses */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs bg-green-900/40 border border-green-500/30 rounded px-2 py-1.5">
                <span className="text-green-100">Harvest Bonus:</span>
                <span className="text-green-300 font-bold">+100%</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-blue-900/40 border border-blue-500/30 rounded px-2 py-1.5">
                <span className="text-blue-100">XP Bonus:</span>
                <span className="text-blue-300 font-bold">+100%</span>
              </div>
            </div>
            
            {/* Warning */}
            <div className="text-[10px] text-yellow-200/70 text-center mt-2 italic">
              ⚠️ You leave a visible trail that others can track
            </div>
          </div>
        </div>
      )}

      {/* Movement Controls */}
      <div className="bg-gray-900/60 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)] p-3">
        <MovementControls />
      </div>

      {/* How to Play Link */}
      <a 
        href="/help"
        target="_blank"
        className="block text-center text-white/70 hover:text-white text-xs underline transition-colors"
      >
        📖 How to Play
      </a>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Position display: Shows current (x, y) coordinates with terrain type
// - Flag bearer status: Shows when player holds flag with +100% bonuses
// - Loading state: Animated spinner with blue theme
// - Error state: Red alert card with error message
// - Movement controls: Integrated MovementControls component
// - Instructions: Comprehensive keyboard shortcut reference with badges
// - Logout: Calls /api/auth/logout, clears context, redirects to login
// - Design system integration: Panel, Badge, Button, Card, Divider
// - Toast notifications for logout success/error
// - Responsive layout with consistent spacing (space-y-3)
// - All interactive elements use Button component with variants
// - Keyboard shortcuts displayed in monospace font badges
// - Loading/error states use Card component with themed borders
// - Map wrap reminder in footer with icon
// - Flag bearer panel uses yellow/orange theme with pulse animation
// ============================================================
// END OF FILE
// ============================================================
