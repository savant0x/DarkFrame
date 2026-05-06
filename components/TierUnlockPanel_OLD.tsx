/**
 * TierUnlockPanel.tsx
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Component for displaying and managing unit tier unlocks using Research Points (RP).
 * Shows all 5 tiers with lock/unlock status, requirements, and unlock functionality.
 * 
 * Features:
 * - Visual tier cards with lock/unlock indicators
 * - Display level and RP requirements for locked tiers
 * - "Unlock Tier" button with validation
 * - Confirmation modal before RP spending
 * - Success/error feedback with animations
 * - Real-time tier status updates
 * 
 * Integration:
 * - Calls /api/tier/unlock (POST) to purchase tiers
 * - Calls /api/tier/unlock (GET) to fetch tier status
 * - Updates GameContext on successful unlock
 * 
 * Dependencies: useGameContext, TIER_UNLOCK_REQUIREMENTS, UnitTier enum
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { UnitTier, TIER_UNLOCK_REQUIREMENTS } from '@/types/game.types';

interface TierStatus {
  tier: UnitTier;
  unlocked: boolean;
  requiresLevel: number;
  requiresRP: number;
  canUnlock: boolean;
}

interface UnlockConfirmationProps {
  tier: UnitTier;
  rpCost: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for tier unlock
 * Displays RP cost and requires user confirmation before purchase
 */
function UnlockConfirmation({ tier, rpCost, onConfirm, onCancel }: UnlockConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-purple-500 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-2xl font-bold text-purple-400 mb-4">🔓 Unlock Tier {tier}?</h3>
        
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <p className="text-gray-300 mb-3">
            This will unlock <span className="text-purple-400 font-bold">Tier {tier}</span> units, granting access to 8 new powerful unit types.
          </p>
          <div className="flex items-center justify-center bg-purple-900/30 rounded-lg p-3">
            <span className="text-3xl mr-3">🧪</span>
            <span className="text-2xl font-bold text-purple-400">{rpCost} RP</span>
          </div>
          <p className="text-sm text-yellow-400 mt-3 text-center">
            ⚠️ This is a permanent unlock and cannot be undone
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
          >
            Unlock Now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Success notification for tier unlock
 * Displays celebration message with auto-dismiss
 */
function UnlockSuccess({ tier, onClose }: { tier: UnitTier; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 bg-green-600 border-2 border-green-400 rounded-lg p-4 shadow-2xl z-50 animate-slide-in-right">
      <div className="flex items-center gap-3">
        <span className="text-4xl">🎉</span>
        <div>
          <p className="font-bold text-white">Tier {tier} Unlocked!</p>
          <p className="text-sm text-green-100">8 new units available</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main TierUnlockPanel component
 * Manages tier display, unlock logic, and user interaction
 */
export default function TierUnlockPanel() {
  const { player, refreshPlayer } = useGameContext();
  const [tierStatuses, setTierStatuses] = useState<TierStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<UnitTier | null>(null);
  const [showSuccess, setShowSuccess] = useState<UnitTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch tier unlock status from API
  useEffect(() => {
    fetchTierStatus();
  }, [player?.level, player?.researchPoints]);

  const fetchTierStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tier/unlock');
      
      if (!response.ok) {
        throw new Error('Failed to fetch tier status');
      }

      const data = await response.json();
      setTierStatuses(data.tiers);
    } catch (err) {
      console.error('Error fetching tier status:', err);
      setError('Failed to load tier information');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockClick = (tier: UnitTier) => {
    setConfirmUnlock(tier);
  };

  const confirmUnlockTier = async () => {
    if (!confirmUnlock) return;

    const tier = confirmUnlock;
    setConfirmUnlock(null);

    try {
      setUnlocking(true);
      setError(null);

      const response = await fetch('/api/tier/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlock tier');
      }

      // Success! Show notification and refresh data
      setShowSuccess(tier);
      await refreshPlayer();
      await fetchTierStatus();

    } catch (err) {
      console.error('Error unlocking tier:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlock tier');
    } finally {
      setUnlocking(false);
    }
  };

  const getTierColor = (tier: UnitTier): string => {
    switch (tier) {
      case UnitTier.Tier1: return 'border-gray-500 bg-gray-800/50';
      case UnitTier.Tier2: return 'border-green-500 bg-green-900/30';
      case UnitTier.Tier3: return 'border-blue-500 bg-blue-900/30';
      case UnitTier.Tier4: return 'border-purple-500 bg-purple-900/30';
      case UnitTier.Tier5: return 'border-yellow-500 bg-yellow-900/30';
      default: return 'border-gray-500 bg-gray-800/50';
    }
  };

  const getTierIcon = (tier: UnitTier): string => {
    switch (tier) {
      case UnitTier.Tier1: return '⚔️';
      case UnitTier.Tier2: return '🛡️';
      case UnitTier.Tier3: return '🏹';
      case UnitTier.Tier4: return '🔥';
      case UnitTier.Tier5: return '⚡';
      default: return '🎖️';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-purple-400">🧪 Research Tiers</h2>
        <div className="bg-purple-900/30 px-4 py-2 rounded-lg">
          <span className="text-sm text-gray-400">Available RP:</span>
          <span className="text-xl font-bold text-purple-400 ml-2">{player?.researchPoints || 0}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">❌ {error}</p>
        </div>
      )}

      {/* Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {tierStatuses.map((tierStatus) => (
          <div
            key={tierStatus.tier}
            className={`border-2 rounded-lg p-4 transition-all ${getTierColor(tierStatus.tier)} ${
              tierStatus.unlocked ? 'opacity-100' : 'opacity-75'
            }`}
          >
            <div className="text-center mb-3">
              <div className="text-4xl mb-2">{getTierIcon(tierStatus.tier)}</div>
              <h3 className="text-lg font-bold text-white">Tier {tierStatus.tier}</h3>
            </div>

            {tierStatus.unlocked ? (
              // Unlocked State
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-2 text-center">
                <p className="text-green-400 font-bold text-sm">✅ Unlocked</p>
                <p className="text-xs text-green-300 mt-1">8 units available</p>
              </div>
            ) : (
              // Locked State
              <div className="space-y-2">
                <div className="bg-gray-800 rounded-lg p-2 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Required Level:</span>
                    <span className={`font-bold ${
                      (player?.level || 0) >= tierStatus.requiresLevel ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tierStatus.requiresLevel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Required RP:</span>
                    <span className={`font-bold ${
                      (player?.researchPoints || 0) >= tierStatus.requiresRP ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tierStatus.requiresRP}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleUnlockClick(tierStatus.tier)}
                  disabled={!tierStatus.canUnlock || unlocking}
                  className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${
                    tierStatus.canUnlock
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {unlocking ? '...' : tierStatus.canUnlock ? '🔓 Unlock' : '🔒 Locked'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Information Footer */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400">
          <span className="text-purple-400 font-bold">💡 Tip:</span> Earn Research Points (RP) by leveling up. 
          Higher levels grant more RP. Unlock tiers to access more powerful units!
        </p>
      </div>

      {/* Unlock Confirmation Modal */}
      {confirmUnlock !== null && (
        <UnlockConfirmation
          tier={confirmUnlock}
          rpCost={TIER_UNLOCK_REQUIREMENTS[confirmUnlock].rp}
          onConfirm={confirmUnlockTier}
          onCancel={() => setConfirmUnlock(null)}
        />
      )}

      {/* Success Notification */}
      {showSuccess !== null && (
        <UnlockSuccess
          tier={showSuccess}
          onClose={() => setShowSuccess(null)}
        />
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. TIER STATUS MANAGEMENT:
 *    - Fetches tier unlock status from /api/tier/unlock (GET)
 *    - Auto-refreshes when player level or RP changes
 *    - Displays real-time unlock eligibility
 * 
 * 2. UNLOCK FLOW:
 *    - User clicks "Unlock" button on eligible tier
 *    - Confirmation modal shows RP cost and warning
 *    - POST request to /api/tier/unlock with tier number
 *    - On success: Show celebration, refresh player data, update tier status
 * 
 * 3. VISUAL FEEDBACK:
 *    - Color-coded tiers (gray → green → blue → purple → yellow)
 *    - Lock/unlock icons and status badges
 *    - Green/red indicators for requirement fulfillment
 *    - Success notification with auto-dismiss
 * 
 * 4. ERROR HANDLING:
 *    - API failures show error banner
 *    - Disabled buttons for ineligible unlocks
 *    - Validation prevents invalid unlock attempts
 * 
 * 5. RESPONSIVE DESIGN:
 *    - Grid layout adapts to screen size (1-5 columns)
 *    - Mobile-friendly touch targets
 *    - Smooth animations and transitions
 * 
 * 6. INTEGRATION POINTS:
 *    - GameContext: player data, refreshPlayer()
 *    - API: /api/tier/unlock (GET/POST)
 *    - Types: UnitTier, TIER_UNLOCK_REQUIREMENTS
 * 
 * FUTURE ENHANCEMENTS:
 * - Tier preview (show unit types before unlock)
 * - Unlock animations with confetti
 * - Sound effects for unlock success
 * - Tier unlock history/timeline
 */
