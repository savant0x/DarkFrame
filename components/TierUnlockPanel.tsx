// ============================================================
// FILE: TierUnlockPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2026-09-08 (FID-20260908-011 neon-noir structural pass)
// ============================================================
// OVERVIEW:
// Unit Tier unlock management component using Research Points (RP).
// Displays all 5 tiers with lock/unlock status, level and RP requirements,
// and unlock functionality. Features confirmation modal, success notifications,
// and real-time tier status updates.
// Styling: token primitives only (nn-panel / nn-chip / nn-abtn / nn-meter-free
// ledger rows); no legacy UI-kit imports. Logic byte-preserved from the
// pre-migration component.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { useGameContext } from '@/context/GameContext';
import { UnitTier, TIER_UNLOCK_REQUIREMENTS } from '@/types/game.types';
import { toast } from '@/lib/toast';
import { FlaskConical } from 'lucide-react';

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
 * @returns Token border and background classes
 */
function getTierColor(tier: UnitTier): string {
  const map: Record<UnitTier, string> = {
    [UnitTier.Tier1]: 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]',
    [UnitTier.Tier2]: 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]',
    [UnitTier.Tier3]: 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]',
    [UnitTier.Tier4]: 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]',
    [UnitTier.Tier5]: 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]',
  };
  return map[tier] || map[UnitTier.Tier1];
}

/**
 * Get icon glyph for tier (FID-011: emoji slab → token display glyphs)
 * @param tier - Unit tier number
 * @returns Icon glyph string
 */
function getTierIcon(tier: UnitTier): string {
  const map: Record<UnitTier, string> = {
    [UnitTier.Tier1]: 'I',
    [UnitTier.Tier2]: 'II',
    [UnitTier.Tier3]: 'III',
    [UnitTier.Tier4]: 'IV',
    [UnitTier.Tier5]: 'V',
  };
  return map[tier] || 'I';
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
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div
        className="nn-panel nn-panel--violet max-w-md w-full"
        role="dialog"
        aria-label={`Unlock Tier ${tier} confirmation`}
      >
        <div className="nn-panel__header nn-panel__header--violet">
          <span className="nn-panel__title">Unlock Tier {tier}?</span>
          <span className="nn-panel__meta">Permanent RP expenditure</span>
        </div>
        <div className="nn-panel__body p-6">
          <p className="text-[color:var(--nn-text-secondary)] mb-4 leading-relaxed text-sm">
            This will unlock <span className="nn-chip nn-chip--violet">Tier {tier}</span> units,
            granting access to 8 new powerful unit types.
          </p>

          <div className="nn-well mb-4" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
            <span className="nn-lab">Cost</span>
            <span className="nn-num nn-text-violet text-2xl font-bold">{rpCost} RP</span>
          </div>

          <p className="nn-note">
            <span className="nn-text-amber">This is a permanent unlock and cannot be undone.</span>
          </p>

          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} className="nn-btn nn-btn--ghost flex-1">
              Cancel
            </button>
            <button onClick={onConfirm} className="nn-btn nn-btn--violet flex-1">
              Unlock Now
            </button>
          </div>
        </div>
      </div>
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
        throw new Error(extractApiError(data, response.status));
      }

      // Success! Show notification and refresh data
      toast.success(`Tier ${tier} Unlocked! 8 new units available`);
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
      <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
        <div className="nn-panel__body flex items-center justify-center py-12">
          <span className="nn-spin-icon h-6 w-6" aria-label="Loading tier status" />
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
      {/* Header — scanline section instrument */}
      <div className="nn-panel__header">
        <span className="nn-panel__icon"><FlaskConical className="h-4 w-4" /></span>
        <span className="nn-panel__title">Research Tiers</span>
        <span className="nn-panel__meta">Unlock advanced unit types with RP</span>
        <div className="ml-auto text-right">
          <div className="nn-lab">Available RP</div>
          <div className="nn-num nn-text-violet text-xl font-bold">{player?.researchPoints || 0}</div>
        </div>
      </div>

      <div className="nn-panel__body">
        {/* Error Display */}
        {error && (
          <div className="nn-note mb-4" role="alert">
            <p className="nn-text-magenta text-sm">{error}</p>
          </div>
        )}

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tierStatuses.map((tierStatus) => (
            <div key={tierStatus.tier} className="nn-fade">
              <div
                className={`
                  nn-panel border ${getTierColor(tierStatus.tier)}
                  ${tierStatus.unlocked ? 'opacity-100' : 'opacity-75'}
                `}
              >
                <div className="p-4">
                  {/* Header — roman-numeral instrument label */}
                  <div className="text-center mb-3">
                    <div className="nn-num nn-text-violet text-2xl font-bold tracking-widest mb-1">
                      {getTierIcon(tierStatus.tier)}
                    </div>
                    <h3 className="nn-lab">Tier {tierStatus.tier}</h3>
                  </div>

                  {tierStatus.unlocked ? (
                    // Unlocked State
                    <div className="text-center space-y-2 border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] p-3">
                      <span className="nn-chip nn-chip--green">Unlocked</span>
                      <p className="nn-text-dim text-xs">8 units available</p>
                    </div>
                  ) : (
                    // Locked State — ledger rows + gated action
                    <div className="space-y-3">
                      <div className="space-y-2 text-xs">
                        <div className="nn-well py-1.5">
                          <span className="nn-lab">Required Level</span>
                          <span
                            className={`nn-chip ${
                              (player?.level || 0) >= tierStatus.requiresLevel
                                ? 'nn-chip--green'
                                : 'nn-chip--magenta'
                            }`}
                          >
                            {tierStatus.requiresLevel}
                          </span>
                        </div>
                        <div className="nn-well py-1.5">
                          <span className="nn-lab">Required RP</span>
                          <span
                            className={`nn-chip ${
                              (player?.researchPoints || 0) >= tierStatus.requiresRP
                                ? 'nn-chip--green'
                                : 'nn-chip--magenta'
                            }`}
                          >
                            {tierStatus.requiresRP}
                          </span>
                        </div>
                      </div>

                      {/* Unlock Button — violet = RP domain */}
                      <button
                        onClick={() => handleUnlockClick(tierStatus.tier)}
                        disabled={!tierStatus.canUnlock || unlocking}
                        className={`nn-abtn w-full ${
                          tierStatus.canUnlock
                            ? 'nn-abtn--violet'
                            : 'nn-abtn--ghost opacity-60 cursor-not-allowed'
                        }`}
                      >
                        {unlocking ? '…' : tierStatus.canUnlock ? 'Unlock' : 'Locked'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Information Footer — brief block */}
        <div className="nn-brief nn-brief--violet mt-6">
          <p className="text-sm text-[color:var(--nn-text-secondary)] flex items-start gap-2">
            <span className="nn-text-violet font-bold text-base">▸</span>
            <span>
              <span className="nn-text-violet font-bold">Tip:</span> Earn Research Points (RP) by leveling up.
              Higher levels grant more RP. Unlock tiers to access more powerful units!
            </span>
          </p>
        </div>
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
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Tier status management: Fetches from /api/tier/unlock (GET)
// - Auto-refreshes when player level or RP changes
// - Unlock flow: Click → Confirmation modal → POST /api/tier/unlock → Success toast
// - Visual feedback: accent-coded tier cards (green/cyan/violet/amber)
// - Lock/unlock indicators with semantic chips (green=met, magenta=unmet)
// - Toast notifications for success/error feedback
// - Responsive grid layout (1-5 columns based on screen size)
// - Stagger-free nn-fade entry on tier cards
// - Disabled buttons for ineligible unlocks with visual feedback
// - Confirmation modal prevents accidental purchases
// - Real-time RP balance display in header
// ============================================================
// END OF FILE
// ============================================================
