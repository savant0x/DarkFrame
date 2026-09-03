// ============================================================
// FILE: TierUnlockPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2025-01-17
// ============================================================
// OVERVIEW:
// Unit Tier unlock management component using Research Points (RP).
// Displays all 5 tiers with lock/unlock status, level and RP requirements,
// and unlock functionality. Features confirmation modal, success notifications,
// and real-time tier status updates. Integrates design system components
// (Card, Badge, Button, ProgressBar, Panel, StaggerChildren, LoadingSpinner, toast).
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { UnitTier, TIER_UNLOCK_REQUIREMENTS } from '@/types/game.types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Divider } from '@/components/ui/Divider';
import { StaggerChildren, StaggerItem } from '@/components/transitions/StaggerChildren';
import { LoadingSpinner } from '@/components/transitions/LoadingSpinner';
import { toast } from '@/lib/toast';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get color classes for tier card styling
 * @param tier - Unit tier number
 * @returns Tailwind border and background classes
 */
function getTierColor(tier: UnitTier): string {
  const map: Record<UnitTier, string> = {
    [UnitTier.Tier1]: 'border-gray-500 bg-gray-800/50',
    [UnitTier.Tier2]: 'border-green-500 bg-green-900/30',
    [UnitTier.Tier3]: 'border-blue-500 bg-blue-900/30',
    [UnitTier.Tier4]: 'border-purple-500 bg-purple-900/30',
    [UnitTier.Tier5]: 'border-yellow-500 bg-yellow-900/30',
  };
  return map[tier] || map[UnitTier.Tier1];
}

/**
 * Get icon emoji for tier
 * @param tier - Unit tier number
 * @returns Icon emoji string
 */
function getTierIcon(tier: UnitTier): string {
  const map: Record<UnitTier, string> = {
    [UnitTier.Tier1]: '⚔️',
    [UnitTier.Tier2]: '🛡️',
    [UnitTier.Tier3]: '🏹',
    [UnitTier.Tier4]: '🔥',
    [UnitTier.Tier5]: '⚡',
  };
  return map[tier] || '🎖️';
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

/**
 * Confirmation modal for tier unlock
 * Displays RP cost and requires user confirmation before purchase
 */
function UnlockConfirmation({ tier, rpCost, onConfirm, onCancel }: UnlockConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <Card className="max-w-md w-full border-2 border-purple-500">
        <div className="p-6">
          <h3 className="text-2xl font-bold text-purple-400 mb-4 flex items-center gap-2">
            <span>🔓</span>
            <span>Unlock Tier {tier}?</span>
          </h3>
          
          <Panel className="mb-6">
            <p className="text-gray-300 mb-4 leading-relaxed">
              This will unlock <Badge variant="default" className="bg-purple-900 text-purple-300">Tier {tier}</Badge> units, 
              granting access to 8 new powerful unit types.
            </p>
            
            <div className="flex items-center justify-center bg-purple-900/30 rounded-lg p-4 border border-purple-500">
              <span className="text-3xl mr-3">🧪</span>
              <div>
                <div className="text-sm text-gray-400">Cost:</div>
                <div className="text-2xl font-bold text-purple-400">{rpCost} RP</div>
              </div>
            </div>
            
            <p className="text-sm text-yellow-400 mt-4 text-center flex items-center justify-center gap-2">
              <span>⚠️</span>
              <span>This is a permanent unlock and cannot be undone</span>
            </p>
          </Panel>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="base"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="base"
              onClick={onConfirm}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Unlock Now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Main TierUnlockPanel component
 * Manages tier display, unlock logic, and user interaction
 * 
 * Features:
 * - Visual tier cards with lock/unlock indicators
 * - Display level and RP requirements for locked tiers
 * - "Unlock Tier" button with validation
 * - Confirmation modal before RP spending
 * - Success/error feedback with toast notifications
 * - Real-time tier status updates
 * - Design system integration with animations
 */
export default function TierUnlockPanel() {
  const { player, refreshPlayer } = useGameContext();
  const [tierStatuses, setTierStatuses] = useState<TierStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<UnitTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  /**
   * Fetch tier unlock status from API
   * Auto-refreshes when player level or RP changes
   */
  useEffect(() => {
    fetchTierStatus();
  }, [player?.level, player?.researchPoints]);

  const fetchTierStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tier/unlock');
      
      if (!response.ok) {
        throw new Error('Failed to fetch tier status');
      }

      const data = await response.json();
      setTierStatuses(data.tiers);
    } catch (err) {
      console.error('Error fetching tier status:', err);
      setError('Failed to load tier information');
      toast.error('Failed to load tier information');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ACTION HANDLERS
  // ============================================================

  /**
   * Handle unlock button click
   * Opens confirmation modal
   * @param tier - Tier number to unlock
   */
  const handleUnlockClick = (tier: UnitTier) => {
    setConfirmUnlock(tier);
  };

  /**
   * Confirm tier unlock purchase
   * Sends POST request to API and refreshes data on success
   */
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
      toast.success(`🎉 Tier ${tier} Unlocked! 8 new units available`);
      await refreshPlayer();
      await fetchTierStatus();

    } catch (err) {
      console.error('Error unlocking tier:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlock tier';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUnlocking(false);
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  if (loading) {
    return (
      <Panel className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </Panel>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <Panel>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧪</span>
          <div>
            <h2 className="text-2xl font-bold text-purple-400">Research Tiers</h2>
            <p className="text-sm text-gray-400">Unlock advanced unit types with RP</p>
          </div>
        </div>
        <Card className="bg-purple-900/30 px-4 py-2 border border-purple-500">
          <div className="text-sm text-gray-400">Available RP:</div>
          <div className="text-xl font-bold text-purple-400">{player?.researchPoints || 0}</div>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Panel className="bg-red-900/30 border border-red-500 mb-4">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </p>
        </Panel>
      )}

      <Divider className="my-6" />

      {/* Tier Cards Grid */}
      <StaggerChildren staggerDelay={0.08}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tierStatuses.map((tierStatus) => (
            <StaggerItem key={tierStatus.tier}>
              <Card
                className={`
                  border-2 ${getTierColor(tierStatus.tier)}
                  ${tierStatus.unlocked ? 'opacity-100' : 'opacity-75'}
                  transition-all hover:scale-[1.02]
                `}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="text-center mb-3">
                    <div className="text-4xl mb-2">{getTierIcon(tierStatus.tier)}</div>
                    <h3 className="text-lg font-bold text-white">Tier {tierStatus.tier}</h3>
                  </div>

                  {tierStatus.unlocked ? (
                    // Unlocked State
                    <div className="bg-green-900/30 border border-green-500 rounded-lg p-3 text-center">
                      <Badge variant="default" className="bg-green-500 text-white mb-2">
                        ✅ Unlocked
                      </Badge>
                      <p className="text-xs text-green-300">8 units available</p>
                    </div>
                  ) : (
                    // Locked State
                    <div className="space-y-3">
                      {/* Requirements */}
                      <div className="bg-gray-800 rounded-lg p-2 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Required Level:</span>
                          <Badge
                            variant="default"
                            className={
                              (player?.level || 0) >= tierStatus.requiresLevel
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-red-900/50 text-red-400'
                            }
                          >
                            {tierStatus.requiresLevel}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Required RP:</span>
                          <Badge
                            variant="default"
                            className={
                              (player?.researchPoints || 0) >= tierStatus.requiresRP
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-red-900/50 text-red-400'
                            }
                          >
                            {tierStatus.requiresRP}
                          </Badge>
                        </div>
                      </div>

                      {/* Unlock Button */}
                      <Button
                        variant={tierStatus.canUnlock ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => handleUnlockClick(tierStatus.tier)}
                        disabled={!tierStatus.canUnlock || unlocking}
                        className={`w-full ${
                          tierStatus.canUnlock
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {unlocking ? '...' : tierStatus.canUnlock ? '🔓 Unlock' : '🔒 Locked'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </div>
      </StaggerChildren>

      <Divider className="my-6" />

      {/* Information Footer */}
      <Panel className="bg-gray-800">
        <p className="text-sm text-gray-400 flex items-start gap-2">
          <span className="text-purple-400 font-bold text-base">💡</span>
          <span>
            <span className="text-purple-400 font-bold">Tip:</span> Earn Research Points (RP) by leveling up. 
            Higher levels grant more RP. Unlock tiers to access more powerful units!
          </span>
        </p>
      </Panel>

      {/* Unlock Confirmation Modal */}
      {confirmUnlock !== null && (
        <UnlockConfirmation
          tier={confirmUnlock}
          rpCost={TIER_UNLOCK_REQUIREMENTS[confirmUnlock].rp}
          onConfirm={confirmUnlockTier}
          onCancel={() => setConfirmUnlock(null)}
        />
      )}
    </Panel>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Tier status management: Fetches from /api/tier/unlock (GET)
// - Auto-refreshes when player level or RP changes
// - Unlock flow: Click → Confirmation modal → POST /api/tier/unlock → Success toast
// - Visual feedback: Color-coded tiers (gray/green/blue/purple/yellow)
// - Lock/unlock indicators with badges and icons
// - Green/red indicators for requirement fulfillment
// - Toast notifications for success/error feedback
// - Responsive grid layout (1-5 columns based on screen size)
// - Smooth animations with stagger effects (0.08s delay)
// - Hover effects on tier cards (scale)
// - Design system integration: Card, Badge, Button, Panel, Divider, StaggerChildren, LoadingSpinner, toast
// - Disabled buttons for ineligible unlocks with visual feedback
// - Confirmation modal prevents accidental purchases
// - Real-time RP balance display in header
// ============================================================
// END OF FILE
// ============================================================
