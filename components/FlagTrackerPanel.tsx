/**
 * @file components/FlagTrackerPanel.tsx
 * @created 2025-10-20
 * @overview Flag Bearer tracking panel component
 * 
 * OVERVIEW:
 * Displays real-time information about the current Flag Bearer including their
 * location, distance from viewer, compass direction, and attack options.
 * Much simpler and more focused than a full map - shows exactly what players
 * need to track and engage the Flag Bearer.
 * 
 * Features:
 * - Current Flag Bearer info (name, level, position)
 * - Distance and direction calculations
 * - Visual compass rose with direction arrow
 * - Attack range indicator (in range / out of range)
 * - Track and Attack action buttons
 * - Real-time WebSocket updates
 * - Mobile-friendly compact design
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  type FlagBearer, 
  type FlagTrackerData,
  CompassDirection,
  FLAG_CONFIG 
} from '@/types/flag.types';
import { 
  buildTrackerData, 
  formatDistance, 
  getCompassArrow,
  formatHoldDuration,
  getTimeRemaining,
  isFlagExpiringSoon
} from '@/lib/flagService';

/**
 * FlagTrackerPanel Props
 */
interface FlagTrackerPanelProps {
  /** Current player position for distance/direction calculations */
  playerPosition: { x: number; y: number };
  
  /** Current Flag Bearer data (from API or WebSocket) */
  flagBearer: FlagBearer | null;
  
  /** Callback when user clicks Track button */
  onTrack?: (bearer: FlagBearer) => void;
  
  /** Callback when user clicks Attack button */
  onAttack?: (bearer: FlagBearer) => void;
  
  /** Whether attack is on cooldown */
  attackOnCooldown?: boolean;
  
  /** Remaining cooldown time in seconds */
  cooldownRemaining?: number;
  
  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Flag Tracker Panel Component
 * 
 * Shows current Flag Bearer location and provides tracking/attack actions.
 * Updates in real-time via WebSocket events.
 * 
 * @example
 * ```tsx
 * <FlagTrackerPanel
 *   playerPosition={{ x: 75, y: 75 }}
 *   flagBearer={currentBearer}
 *   onTrack={(bearer) => router.push(`/profile/${bearer.username}`)}
 *   onAttack={(bearer) => handleAttack(bearer.playerId)}
 *   attackOnCooldown={false}
 * />
 * ```
 */
export default function FlagTrackerPanel({
  playerPosition,
  flagBearer,
  onTrack,
  onAttack,
  attackOnCooldown = false,
  cooldownRemaining = 0,
  compact = false
}: FlagTrackerPanelProps) {
  const router = useRouter();
  const [trackerData, setTrackerData] = useState<FlagTrackerData | null>(null);
  
  // Main panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  // Collapsible section state (individual sections)
  const [showBearerInfo, setShowBearerInfo] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCompass, setShowCompass] = useState(true);
  
  // Calculate tracker data whenever bearer or player position changes
  useEffect(() => {
    const data = buildTrackerData(flagBearer, playerPosition);
    setTrackerData(data);
  }, [flagBearer, playerPosition]);
  
  // No bearer - show empty state
  if (!flagBearer || !trackerData) {
    return (
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🏳️</div>
          <div>
            <h3 className="text-lg font-bold text-gray-400">No Flag Bearer</h3>
            <p className="text-sm text-gray-500">The flag is currently unclaimed</p>
          </div>
        </div>
      </div>
    );
  }
  
  const { bearer, distance, direction, inAttackRange } = trackerData;
  
  // TypeScript safety: bearer is guaranteed non-null here due to early return above
  if (!bearer) return null;
  
  const compassArrow = getCompassArrow(direction);
  const timeRemaining = getTimeRemaining(bearer.holdDuration);
  const isExpiringSoon = isFlagExpiringSoon(bearer.holdDuration);
  
  // Full panel view with main collapsible header
  return (
    <div 
      className={`
        bg-gray-900 border-2 rounded-lg overflow-hidden transition-all duration-300
        ${inAttackRange ? 'border-green-500' : 'border-red-500'}
      `}
    >
      {/* Main Header - Always Visible, Clickable to Collapse Entire Panel */}
      <div 
        className="bg-gray-800 border-b border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-pulse">🏴</div>
            <div>
              <h3 className="text-lg font-bold text-white">Flag Bearer</h3>
              <p className="text-xs text-gray-400">Track and attack to claim the flag</p>
            </div>
          </div>
          <span className="text-gray-400 text-xl">{isPanelCollapsed ? '▶' : '▼'}</span>
        </div>
      </div>
      
      {/* Panel Content - Collapsible */}
      {!isPanelCollapsed && (
        <div className="p-4 space-y-3">
          {/* Bearer Info Section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {/* Header - Clickable to collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBearerInfo(!showBearerInfo);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <span>👤</span>
                <span>Bearer Info</span>
              </span>
              <span className="text-gray-400 text-sm">{showBearerInfo ? '▼' : '▶'}</span>
            </button>
            
            {/* Collapsible Content */}
            {showBearerInfo && (
              <div className="px-3 py-3 border-t border-gray-700 space-y-2">
                {/* Username and Level */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Player</div>
                    <div className="text-base font-bold text-white">{bearer.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Level</div>
                    <div className="text-base font-bold text-cyan-400">{bearer.level}</div>
                  </div>
                </div>
                
                {/* HP Bar */}
                {bearer.currentHP !== undefined && bearer.maxHP !== undefined && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Health</div>
                    <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-red-500 h-full transition-all duration-300"
                        style={{ width: `${(bearer.currentHP / bearer.maxHP) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-center">
                      {bearer.currentHP.toLocaleString()} / {bearer.maxHP.toLocaleString()}
                    </div>
                  </div>
                )}
                
                {/* Hold Duration */}
                <div className="bg-gray-900 rounded px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Holding Flag</span>
                  <span className={`text-xs font-bold ${isExpiringSoon ? 'text-yellow-400' : 'text-green-400'}`}>
                    {formatHoldDuration(bearer.holdDuration)} ({timeRemaining})
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Location & Distance Section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {/* Header - Clickable to collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLocation(!showLocation);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <span>📍</span>
                <span>Location & Distance</span>
              </span>
              <span className="text-gray-400 text-sm">{showLocation ? '▼' : '▶'}</span>
            </button>
            
            {/* Collapsible Content */}
            {showLocation && (
              <div className="grid grid-cols-2 gap-2 px-3 py-3 border-t border-gray-700">
                {/* Location */}
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">Location</div>
                  <div className="text-sm font-bold text-white">
                    ({bearer.position.x}, {bearer.position.y})
                  </div>
                </div>
                
                {/* Distance */}
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">Distance</div>
                  <div className="text-sm font-bold text-cyan-400">
                    {formatDistance(distance)}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Attack Range Status - Above Compass */}
          <div 
            className={`
              rounded-lg p-2 text-center font-bold text-xs border
              ${inAttackRange 
                ? 'bg-green-900/30 border-green-500 text-green-400' 
                : 'bg-red-900/30 border-red-500 text-red-400'
              }
            `}
          >
            {inAttackRange ? (
              <div className="flex items-center justify-center gap-2">
                <span>✓</span>
                <span>IN RANGE</span>
                <span className="opacity-75">(≤{FLAG_CONFIG.ATTACK_RANGE})</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>✗</span>
                <span>OUT OF RANGE</span>
                <span className="opacity-75">(+{distance - FLAG_CONFIG.ATTACK_RANGE} tiles)</span>
              </div>
            )}
          </div>
          
          {/* Compass Direction Section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {/* Header - Clickable to collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCompass(!showCompass);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <span>🧭</span>
                <span>Direction</span>
              </span>
              <span className="text-gray-400 text-sm">{showCompass ? '▼' : '▶'}</span>
            </button>
            
            {/* Collapsible Content */}
            {showCompass && (
              <div className="px-3 py-3 border-t border-gray-700">
                <div className="flex items-center justify-center gap-4">
                  {/* Compass Rose */}
                  <div className="relative w-16 h-16">
                    {/* Background circle */}
                    <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
                    
                    {/* Cardinal directions */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">
                      N
                    </div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-xs text-gray-500 font-bold">
                      S
                    </div>
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">
                      W
                    </div>
                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">
                      E
                    </div>
                    
                    {/* Direction Arrow */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-2xl text-cyan-400"
                      style={{
                        transform: `rotate(${getRotationForDirection(direction)}deg)`
                      }}
                    >
                      ↑
                    </div>
                  </div>
                  
                  {/* Direction Label */}
                  <div className="text-center">
                    <div className="text-2xl mb-1">{compassArrow}</div>
                    <div className="text-lg font-bold text-white">{direction}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons - Compact */}
          <div className="flex gap-2 justify-center pt-1">
            {/* Track Button */}
            <button
              onClick={() => {
                if (onTrack) {
                  onTrack(bearer);
                } else {
                  router.push(`/profile/${bearer.username}`);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <span>🔍</span>
              <span>Track</span>
            </button>
            
            {/* Attack Button */}
            <button
              onClick={() => onAttack && onAttack(bearer)}
              disabled={!inAttackRange || attackOnCooldown}
              className={`
                font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm
                ${!inAttackRange || attackOnCooldown
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }
              `}
              title={
                attackOnCooldown 
                  ? `Cooldown: ${cooldownRemaining}s` 
                  : !inAttackRange 
                  ? 'Move closer to attack' 
                  : 'Attack Flag Bearer'
              }
            >
              <span>⚔️</span>
              <span>
                {attackOnCooldown 
                  ? `${cooldownRemaining}s` 
                  : 'Attack'
                }
              </span>
            </button>
          </div>
          
          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
            💡 Track to view profile • Attack to defeat and claim flag
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get CSS rotation angle for compass direction
 * 
 * @param direction - Compass direction enum
 * @returns Rotation angle in degrees (0° = North)
 */
function getRotationForDirection(direction: CompassDirection): number {
  const rotations: Record<CompassDirection, number> = {
    [CompassDirection.North]: 0,
    [CompassDirection.NorthEast]: 45,
    [CompassDirection.East]: 90,
    [CompassDirection.SouthEast]: 135,
    [CompassDirection.South]: 180,
    [CompassDirection.SouthWest]: 225,
    [CompassDirection.West]: 270,
    [CompassDirection.NorthWest]: 315
  };
  
  return rotations[direction];
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Visual Design:**
 *    - Clean card layout with clear sections
 *    - Green border when in range, red when out of range
 *    - Animated flag icon (pulsing) for visual interest
 *    - Compass rose with rotating arrow
 *    - Mobile-responsive (compact mode)
 * 
 * 2. **User Experience:**
 *    - All critical info at a glance
 *    - Clear visual feedback (colors, icons)
 *    - Disabled states with helpful tooltips
 *    - Compact mode for mobile (expandable)
 *    - Real-time updates via props
 * 
 * 3. **Interactivity:**
 *    - Track button: Navigate to player profile
 *    - Attack button: Initiate combat (only when in range)
 *    - Cooldown display prevents spam
 *    - Responsive hover states
 * 
 * 4. **Data Display:**
 *    - Bearer name, level, HP
 *    - Exact coordinates
 *    - Distance in tiles
 *    - Compass direction with visual arrow
 *    - Hold duration with expiry warning
 *    - Range status (in/out of range)
 * 
 * 5. **Performance:**
 *    - Memoized calculations in flagService
 *    - Only re-renders on prop changes
 *    - Lightweight DOM (no heavy graphics)
 *    - CSS animations for smooth transitions
 */
