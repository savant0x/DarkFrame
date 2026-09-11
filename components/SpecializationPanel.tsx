// ============================================================
// FILE: SpecializationPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2026-09-08 (FID-20260908-011 neon-noir structural pass)
// ============================================================
// OVERVIEW:
// Specialization management interface for choosing and managing doctrine system.
// Displays 3 available doctrines (Offensive, Defensive, Tactical) with their bonuses
// and exclusive units. Allows Level 15+ players to choose initial specialization (25 RP)
// or respec to different doctrine (50 RP + resources, 48h cooldown). Shows mastery
// progress with milestone tracking. Uses keyboard shortcut (Shift+P for Progression).
// Styling: token primitives only (nn-panel / nn-chip / nn-btn / nn-well / nn-num);
// no legacy UI-kit or transitions imports. Logic byte-preserved.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { X, Scale } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { toast } from '@/lib/toast';
import MasteryProgressBar from '@/components/MasteryProgressBar';
import { formatNumber } from '@/utils/formatting';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface DoctrineConfig {
  name: string;
  icon: string;
  description: string;
  bonuses: {
    strengthMultiplier?: number;
    defenseMultiplier?: number;
    balancedMultiplier?: number;
    metalCostMultiplier?: number;
    energyCostMultiplier?: number;
  };
  color: string;
  bgColor: string;
  borderColor: string;
}

interface SpecializationData {
  doctrine: 'none' | 'offensive' | 'defensive' | 'tactical';
  name: string;
  icon: string;
  description: string;
  bonuses: DoctrineConfig['bonuses'];
  masteryLevel: number;
  masteryXP: number;
}

interface MasteryStatus {
  hasSpecialization: boolean;
  doctrine?: string;
  config?: DoctrineConfig;
  mastery?: {
    level: number;
    maxLevel: number;
    totalXP: number;
    xpForNextLevel: number;
    xpProgress: number;
    xpNeeded: number;
    progressPercent: number;
  };
  milestones?: {
    reached: Array<{ level: number; bonusPercent: number; description: string }>;
    next: { level: number; bonusPercent: number; description: string; xpToReach: number } | null;
  };
  stats?: {
    totalUnitsBuilt: number;
    totalBattlesWon: number;
  };
}

/**
 * FID-011: doctrine key → token accent map. The server payload still carries
 * legacy Tailwind color strings in `color`/`bgColor`/`borderColor` (the doctrine
 * API was left byte-identical by design), so the client owns presentation:
 * each doctrine renders on its token accent, with flat token fills.
 */
const DOCTRINE_ACCENT: Record<string, { panel: string; text: string; accentVar: string }> = {
  offensive: { panel: 'nn-text-magenta', text: 'nn-text-magenta', accentVar: 'var(--nn-magenta)' },
  defensive: { panel: 'nn-text-cyan', text: 'nn-text-cyan', accentVar: 'var(--nn-cyan)' },
  tactical: { panel: 'nn-text-violet', text: 'nn-text-violet', accentVar: 'var(--nn-violet)' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Specialization Panel Component
 *
 * Features:
 * - Visual doctrine cards with bonuses and exclusive units
 * - Choose button for initial specialization (Level 15+, 25 RP)
 * - Respec button with cost display and confirmation (50 RP + resources, 48h cooldown)
 * - Mastery progress display with milestone tracking
 * - Keyboard shortcut support (Shift+P for Progression panel)
 */
const SpecializationPanel: React.FC = () => {
  const { refreshGameState } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doctrines, setDoctrines] = useState<Record<string, DoctrineConfig>>({});
  /** Shape of GET /api/specialization/choose success payload (subset consumed here). */
  interface ChooseSpecializationResponse {
    success: boolean;
    hasSpecialization?: boolean;
    canChoose?: boolean;
    reason?: string;
    requirements?: {
      currentLevel: number;
      requiredLevel: number;
      currentRP: number;
      requiredRP: number;
    };
    doctrines?: Record<string, DoctrineConfig>;
    specialization?: SpecializationData;
    [key: string]: unknown;
  }
  const [eligibility, setEligibility] = useState<ChooseSpecializationResponse | null>(null);
  /** Shape of GET /api/specialization/switch eligibility payload (subset consumed here). */
  interface RespecEligibilityResponse {
    success: boolean;
    canRespec?: boolean;
    reason?: string;
    costs?: {
      rp: number;
      metal: number;
      energy: number;
      cooldownHours: number;
    };
    cooldown?: {
      active: boolean;
      remainingHours: number;
    };
  }
  const [respecEligibility, setRespecEligibility] = useState<RespecEligibilityResponse | null>(null);
  const [masteryStatus, setMasteryStatus] = useState<MasteryStatus | null>(null);
  const [showRespecConfirm, setShowRespecConfirm] = useState(false);
  const [selectedDoctrine, setSelectedDoctrine] = useState<string | null>(null);

  // ============================================================
  // KEYBOARD SHORTCUT
  // ============================================================

  /**
   * Handle keyboard shortcut (Shift+P for Progression panel)
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Shift+P: bare P is the game page's Player Leaderboard — single-mapping rule.
      // (This panel lives on /game/specialization; the Shift requirement keeps the
      // binding distinct if both pages ever share a layout.)
      if (e.key.toLowerCase() === 'p' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Ignore if typing in input field
        if (isTypingInInput()) {
          return;
        }

        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  /**
   * Fetch specialization data when panel opens
   * Loads eligibility, doctrines, respec status, and mastery progress
   */
  useEffect(() => {
    if (isOpen) {
      fetchSpecializationData();
    }
  }, [isOpen]);

  const fetchSpecializationData = async () => {
    try {
      // Fetch eligibility for choosing
      const chooseRes = await fetch('/api/specialization/choose');
      const chooseData = await chooseRes.json();

      if (chooseData.success) {
        setEligibility(chooseData);
        setDoctrines(chooseData.doctrines || {});
      }

      // If player has specialization, fetch respec eligibility and mastery
      if (chooseData.hasSpecialization) {
        const respecRes = await fetch('/api/specialization/switch');
        const respecData = await respecRes.json();
        if (respecData.success) {
          setRespecEligibility(respecData);
        }

        const masteryRes = await fetch('/api/specialization/mastery');
        const masteryData = await masteryRes.json();
        if (masteryData.success) {
          setMasteryStatus(masteryData);
        }
      }
    } catch (error) {
      console.error('Error fetching specialization data:', error);
      toast.error('Failed to load specialization data');
    }
  };

  // ============================================================
  // ACTION HANDLERS
  // ============================================================

  /**
   * Handle choosing initial doctrine specialization
   * @param doctrine - Doctrine key (offensive, defensive, tactical)
   */
  const handleChooseDoctrine = async (doctrine: string) => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/specialization/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctrine })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Specialized in ${data.specialization.name}!`);
        await refreshGameState();
        await fetchSpecializationData();
      } else {
        toast.error(extractApiError(data, response.status));
      }
    } catch (error) {
      console.error('Error choosing specialization:', error);
      toast.error('An error occurred while choosing specialization');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle respeccing to a different doctrine
   * Costs 50 RP + 50k Metal + 50k Energy, resets mastery
   */
  const handleRespecDoctrine = async () => {
    if (!selectedDoctrine || loading) return;

    setLoading(true);
    setShowRespecConfirm(false);

    try {
      const response = await fetch('/api/specialization/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDoctrine: selectedDoctrine })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Respecialized to ${data.specialization.name}!`);
        await refreshGameState();
        await fetchSpecializationData();
        setSelectedDoctrine(null);
      } else {
        toast.error(extractApiError(data, response.status));
      }
    } catch (error) {
      console.error('Error respeccing:', error);
      toast.error('An error occurred while respeccing');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open respec confirmation modal
   * @param doctrine - Target doctrine key
   */
  const openRespecConfirm = (doctrine: string) => {
    setSelectedDoctrine(doctrine);
    setShowRespecConfirm(true);
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  /**
   * Render doctrine card with bonuses and action buttons
   * @param doctrineKey - Doctrine identifier
   * @param config - Doctrine configuration
   */
  const getDoctrineCard = (doctrineKey: string, config: DoctrineConfig) => {
    const isCurrentDoctrine = masteryStatus?.doctrine === doctrineKey;
    const canChoose = eligibility?.canChoose && !eligibility?.hasSpecialization;
    const canRespec = respecEligibility?.canRespec && !isCurrentDoctrine;
    const accent = DOCTRINE_ACCENT[doctrineKey] || DOCTRINE_ACCENT.tactical;

    return (
      <div key={doctrineKey} className="nn-fade">
        <div
          className={`nn-panel ${isCurrentDoctrine ? 'ring-2 ring-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]' : ''}`}
          style={{ '--nn-accent': accent.accentVar } as React.CSSProperties}
        >
          <div className="nn-panel__header">
            <span className="nn-panel__title">{config.icon} {config.name}</span>
            {isCurrentDoctrine && (
              <span className="nn-chip nn-chip--amber ml-2">Current Doctrine</span>
            )}
          </div>

          <div className="nn-panel__body">
            {/* Description */}
            <p className="nn-text-dim text-sm mb-4 leading-relaxed">{config.description}</p>

            {/* Bonuses — ledger wells */}
            <div className="mb-4 space-y-2">
              <p className="nn-lab uppercase">Bonuses</p>
              {config.bonuses.strengthMultiplier && (
                <div className="nn-well py-1.5">
                  <span className="nn-lab">Strength</span>
                  <span className="nn-num text-sm nn-text-green">
                    +{((config.bonuses.strengthMultiplier - 1) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {config.bonuses.defenseMultiplier && (
                <div className="nn-well py-1.5">
                  <span className="nn-lab">Defense</span>
                  <span className="nn-num text-sm nn-text-cyan">
                    +{((config.bonuses.defenseMultiplier - 1) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {config.bonuses.balancedMultiplier && (
                <div className="nn-well py-1.5">
                  <span className="nn-lab">Balanced Stats</span>
                  <span className="nn-num text-sm nn-text-violet">
                    +{((config.bonuses.balancedMultiplier - 1) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {config.bonuses.metalCostMultiplier && (
                <div className="nn-well py-1.5">
                  <span className="nn-lab">Metal Cost</span>
                  <span className="nn-num text-sm nn-text-amber">
                    {((1 - config.bonuses.metalCostMultiplier) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {config.bonuses.energyCostMultiplier && (
                <div className="nn-well py-1.5">
                  <span className="nn-lab">Energy Cost</span>
                  <span className="nn-num text-sm nn-text-cyan">
                    {((1 - config.bonuses.energyCostMultiplier) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 space-y-2">
              {canChoose && (
                <button
                  onClick={() => handleChooseDoctrine(doctrineKey)}
                  disabled={loading}
                  className="nn-btn nn-btn--green w-full"
                >
                  {loading ? 'Choosing…' : 'Choose (25 RP)'}
                </button>
              )}

              {canRespec && (
                <button
                  onClick={() => openRespecConfirm(doctrineKey)}
                  disabled={loading || respecEligibility?.cooldown?.active}
                  className="nn-btn nn-btn--primary w-full"
                >
                  {respecEligibility?.cooldown?.active
                    ? `Cooldown (${respecEligibility.cooldown.remainingHours}h)`
                    : 'Respec (50 RP + Resources)'}
                </button>
              )}

              {isCurrentDoctrine && !canChoose && !canRespec && (
                <div className="text-center nn-lab italic py-2">
                  Current specialization
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // FLOATING BUTTON (CLOSED STATE)
  // ============================================================

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-40 nn-btn nn-btn--violet"
        aria-label="Open specialization panel"
      >
        <Scale className="w-4 h-4 mr-2" />
        Specialization (Shift+P)
      </button>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="nn-panel w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}
        role="dialog"
        aria-label="Specialization system"
      >
        {/* Header — scanline instrument strip */}
        <div className="nn-panel__header nn-panel__header--violet">
          <span className="nn-panel__title">Specialization System</span>
          <span className="nn-panel__meta">Choose your doctrine and master your path to power</span>
          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto nn-abtn nn-abtn--ghost px-3"
            aria-label="Close specialization"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !eligibility ? (
            <div className="flex items-center justify-center py-12">
              <span className="nn-spin-icon h-7 w-7" aria-label="Loading specialization data" />
            </div>
          ) : (
            <>
              {/* Requirements Display (if not eligible) */}
              {!eligibility?.hasSpecialization && eligibility && !eligibility.canChoose && (
                <div className="nn-panel nn-panel--magenta">
                  <div className="nn-panel__body">
                    <p className="nn-text-magenta font-semibold mb-2 text-sm">Requirements Not Met</p>
                    <p className="nn-text-dim text-sm mb-3">{eligibility.reason}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="nn-well py-1.5">
                        <span className="nn-lab">Level</span>
                        <span className="nn-num">
                          {eligibility.requirements?.currentLevel} / {eligibility.requirements?.requiredLevel}
                        </span>
                      </div>
                      <div className="nn-well py-1.5">
                        <span className="nn-lab">Research Points</span>
                        <span className="nn-num">
                          {eligibility.requirements?.currentRP} / {eligibility.requirements?.requiredRP}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mastery Progress (if has specialization) */}
              {masteryStatus?.hasSpecialization && masteryStatus.mastery && (
                <div className="nn-panel nn-panel--violet">
                  <div className="nn-panel__header nn-panel__header--violet">
                    <span className="nn-panel__title">Mastery Progress</span>
                  </div>
                  <div className="nn-panel__body">
                    <MasteryProgressBar
                      masteryLevel={masteryStatus.mastery.level}
                      masteryXP={masteryStatus.mastery.totalXP}
                      maxLevel={masteryStatus.mastery.maxLevel}
                    />

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="nn-well py-2">
                        <span className="nn-lab">Specialized Units Built</span>
                        <span className="nn-num text-lg">
                          {masteryStatus.stats?.totalUnitsBuilt || 0}
                        </span>
                      </div>
                      <div className="nn-well py-2">
                        <span className="nn-lab">Battles Won</span>
                        <span className="nn-num text-lg">
                          {masteryStatus.stats?.totalBattlesWon || 0}
                        </span>
                      </div>
                    </div>

                    {/* Next Milestone */}
                    {masteryStatus.milestones?.next && (
                      <div className="mt-4 border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] p-3">
                        <p className="nn-text-violet font-semibold text-sm mb-1">
                          Next Milestone: {masteryStatus.milestones.next.level}%
                        </p>
                        <p className="nn-text-dim text-xs mb-1">
                          {masteryStatus.milestones.next.description}
                        </p>
                        <span className="nn-chip nn-chip--violet">
                          {masteryStatus.milestones.next.xpToReach.toLocaleString()} XP needed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Doctrine Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(doctrines).map(([key, config]) =>
                  getDoctrineCard(key, config)
                )}
              </div>

              {/* Respec Cost Info */}
              {eligibility?.hasSpecialization && respecEligibility && (
                <div className="nn-panel nn-panel--amber">
                  <div className="nn-panel__header nn-panel__header--amber">
                    <span className="nn-panel__title">Respec Costs</span>
                  </div>
                  <div className="nn-panel__body">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="nn-well py-2">
                        <span className="nn-lab">RP Cost</span>
                        <span className="nn-num">{respecEligibility.costs?.rp || 50}</span>
                      </div>
                      <div className="nn-well py-2">
                        <span className="nn-lab">Metal</span>
                        <span className="nn-num">{formatNumber(respecEligibility.costs?.metal || 50000)}</span>
                      </div>
                      <div className="nn-well py-2">
                        <span className="nn-lab">Energy</span>
                        <span className="nn-num">{formatNumber(respecEligibility.costs?.energy || 50000)}</span>
                      </div>
                      <div className="nn-well py-2">
                        <span className="nn-lab">Cooldown</span>
                        <span className="nn-num">{respecEligibility.costs?.cooldownHours || 48}h</span>
                      </div>
                    </div>
                    <p className="nn-lab mt-3 italic">
                      Note: Respeccing resets mastery to 0% but keeps old specialized units
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 text-center nn-lab border-t border-[color-mix(in_oklab,var(--nn-glass-border))]">
          Press <kbd className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] font-mono">Shift+P</kbd> to toggle this panel
        </div>
      </div>

      {/* Respec Confirmation Modal */}
      {showRespecConfirm && selectedDoctrine && (
        <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_90%,transparent)] flex items-center justify-center z-[60]">
          <div
            className="nn-panel nn-panel--amber max-w-md w-full"
            role="dialog"
            aria-label="Confirm respec"
          >
            <div className="nn-panel__header nn-panel__header--amber">
              <span className="nn-panel__title">Confirm Respec</span>
            </div>
            <div className="nn-panel__body p-6">
              <p className="nn-text-dim mb-4 text-sm">
                Are you sure you want to respec to{' '}
                <span className="nn-text-primary font-semibold">{doctrines[selectedDoctrine]?.name}</span>?
              </p>

              <div className="nn-panel nn-panel--magenta mb-4">
                <div className="nn-panel__body">
                  <p className="nn-text-magenta font-semibold text-sm mb-3">This will cost:</p>
                  <div className="space-y-2 text-sm nn-text-dim">
                    <div className="nn-well py-1.5">
                      <span className="nn-lab">Research Points</span>
                      <span className="nn-num">50</span>
                    </div>
                    <div className="nn-well py-1.5">
                      <span className="nn-lab">Metal</span>
                      <span className="nn-num">50,000</span>
                    </div>
                    <div className="nn-well py-1.5">
                      <span className="nn-lab">Energy</span>
                      <span className="nn-num">50,000</span>
                    </div>
                  </div>
                  <p className="nn-lab mt-3 italic">
                    Your mastery will reset to 0%
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRespecDoctrine}
                  disabled={loading}
                  className="nn-btn nn-btn--danger flex-1"
                >
                  {loading ? 'Respeccing…' : 'Confirm Respec'}
                </button>
                <button
                  onClick={() => {
                    setShowRespecConfirm(false);
                    setSelectedDoctrine(null);
                  }}
                  disabled={loading}
                  className="nn-btn nn-btn--ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecializationPanel;

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: Shift+P (bare P is the leaderboard — single-mapping rule)
// - Initial choice: Level 15+, 25 RP
// - Respec: 50 RP, 50k Metal, 50k Energy, 48h cooldown
// - Three doctrines: Offensive (magenta), Defensive (cyan), Tactical (violet)
// - Doctrine presentation is client-owned: server payload's legacy color
//   strings are ignored in favor of the DOCTRINE_ACCENT token map (FID-011)
// - Mastery progress tracking with milestone rewards (MasteryProgressBar)
// - Current doctrine highlighted with amber ring
// - Confirmation modal for respeccing with cost breakdown
// - Toast notifications for success/error feedback
// - Token primitives only: nn-panel / nn-well / nn-num / nn-lab / nn-btn / nn-chip
// ============================================================
// END OF FILE
// ============================================================
