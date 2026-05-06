// ============================================================
// FILE: SpecializationPanel.tsx
// CREATED: 2025-01-17
// LAST MODIFIED: 2025-01-17
// ============================================================
// OVERVIEW:
// Specialization management interface for choosing and managing doctrine system.
// Displays 3 available doctrines (Offensive, Defensive, Tactical) with their bonuses
// and exclusive units. Allows Level 15+ players to choose initial specialization (25 RP)
// or respec to different doctrine (50 RP + resources, 48h cooldown). Shows mastery
// progress with milestone tracking. Uses keyboard shortcut (P for Progression).
// Integrates design system components (Card, Button, Badge, Panel, ProgressBar,
// StaggerChildren, LoadingSpinner, toast).
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { Divider } from '@/components/ui/Divider';
import { StaggerChildren, StaggerItem } from '@/components/transitions/StaggerChildren';
import { LoadingSpinner } from '@/components/transitions/LoadingSpinner';
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
  bonuses: any;
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

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * Specialization Panel Component
 * 
 * Features:
 * - Visual doctrine cards with icons, descriptions, and bonuses
 * - Choose button for initial specialization (Level 15+, 25 RP)
 * - Respec button with cost display and confirmation (50 RP + resources, 48h cooldown)
 * - Mastery progress display with milestone tracking
 * - Keyboard shortcut support (P for Progression panel)
 * - Design system integration with animations
 */
const SpecializationPanel: React.FC = () => {
  const { refreshGameState } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doctrines, setDoctrines] = useState<Record<string, DoctrineConfig>>({});
  const [eligibility, setEligibility] = useState<any>(null);
  const [respecEligibility, setRespecEligibility] = useState<any>(null);
  const [masteryStatus, setMasteryStatus] = useState<MasteryStatus | null>(null);
  const [showRespecConfirm, setShowRespecConfirm] = useState(false);
  const [selectedDoctrine, setSelectedDoctrine] = useState<string | null>(null);

  // ============================================================
  // KEYBOARD SHORTCUT
  // ============================================================

  /**
   * Handle keyboard shortcut (P for Progression panel)
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
        toast.error(data.error || 'Failed to choose specialization');
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
        toast.error(data.error || 'Failed to respec');
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

    return (
      <StaggerItem key={doctrineKey}>
        <Card
          className={`
            border-2 ${config.borderColor} ${config.bgColor}
            ${isCurrentDoctrine ? 'ring-4 ring-yellow-500/50' : ''}
            transition-all hover:scale-[1.02] hover:shadow-lg
          `}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{config.icon}</span>
                <div>
                  <h3 className={`text-xl font-bold ${config.color}`}>{config.name}</h3>
                  {isCurrentDoctrine && (
                    <Badge variant="default" className="bg-yellow-500 text-yellow-900 mt-1">
                      ★ CURRENT DOCTRINE ★
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm mb-4 leading-relaxed">{config.description}</p>

            {/* Bonuses */}
            <div className="mb-4 space-y-1">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Bonuses:</p>
              {config.bonuses.strengthMultiplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-900/50 text-green-400 text-xs">
                    +{((config.bonuses.strengthMultiplier - 1) * 100).toFixed(0)}% Strength
                  </Badge>
                </div>
              )}
              {config.bonuses.defenseMultiplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-900/50 text-blue-400 text-xs">
                    +{((config.bonuses.defenseMultiplier - 1) * 100).toFixed(0)}% Defense
                  </Badge>
                </div>
              )}
              {config.bonuses.balancedMultiplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-purple-900/50 text-purple-400 text-xs">
                    +{((config.bonuses.balancedMultiplier - 1) * 100).toFixed(0)}% Balanced Stats
                  </Badge>
                </div>
              )}
              {config.bonuses.metalCostMultiplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-orange-900/50 text-orange-400 text-xs">
                    {((1 - config.bonuses.metalCostMultiplier) * 100).toFixed(0)}% Metal Cost
                  </Badge>
                </div>
              )}
              {config.bonuses.energyCostMultiplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-cyan-900/50 text-cyan-400 text-xs">
                    {((1 - config.bonuses.energyCostMultiplier) * 100).toFixed(0)}% Energy Cost
                  </Badge>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4">
              {canChoose && (
                <Button
                  variant="success"
                  size="base"
                  onClick={() => handleChooseDoctrine(doctrineKey)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Choosing...' : 'Choose (25 RP)'}
                </Button>
              )}

              {canRespec && (
                <Button
                  variant="primary"
                  size="base"
                  onClick={() => openRespecConfirm(doctrineKey)}
                  disabled={loading || respecEligibility?.cooldown?.active}
                  className="w-full"
                >
                  {respecEligibility?.cooldown?.active
                    ? `Cooldown (${respecEligibility.cooldown.remainingHours}h)`
                    : 'Respec (50 RP + Resources)'}
                </Button>
              )}

              {isCurrentDoctrine && !canChoose && !canRespec && (
                <div className="text-center text-sm text-gray-400 italic py-2">
                  Current specialization
                </div>
              )}
            </div>
          </div>
        </Card>
      </StaggerItem>
    );
  };

  // ============================================================
  // FLOATING BUTTON (CLOSED STATE)
  // ============================================================

  if (!isOpen) {
    return (
      <Button
        variant="primary"
        size="base"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 shadow-lg z-40 bg-purple-600 hover:bg-purple-700"
      >
        <span className="mr-2">⚖️</span>
        Specialization (P)
      </Button>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-3xl font-bold text-white">Specialization System</h2>
            <p className="text-gray-200 text-sm mt-1">
              Choose your doctrine and master your path to power
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !eligibility ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Requirements Display (if not eligible) */}
              {!eligibility?.hasSpecialization && eligibility && !eligibility.canChoose && (
                <Panel className="bg-red-900/30 border border-red-500">
                  <p className="text-red-400 font-semibold mb-2">Requirements Not Met:</p>
                  <p className="text-gray-300 text-sm mb-3">{eligibility.reason}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Level:</span>
                      <Badge variant="default" className="ml-2">
                        {eligibility.requirements?.currentLevel} / {eligibility.requirements?.requiredLevel}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-400">Research Points:</span>
                      <Badge variant="default" className="ml-2">
                        {eligibility.requirements?.currentRP} / {eligibility.requirements?.requiredRP}
                      </Badge>
                    </div>
                  </div>
                </Panel>
              )}

              {/* Mastery Progress (if has specialization) */}
              {masteryStatus?.hasSpecialization && masteryStatus.mastery && (
                <Panel className="border border-purple-500">
                  <h3 className="text-xl font-bold text-purple-400 mb-4">Mastery Progress</h3>
                  <MasteryProgressBar
                    masteryLevel={masteryStatus.mastery.level}
                    masteryXP={masteryStatus.mastery.totalXP}
                    maxLevel={masteryStatus.mastery.maxLevel}
                  />
                  
                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Specialized Units Built:</p>
                      <Badge variant="default" className="text-lg">
                        {masteryStatus.stats?.totalUnitsBuilt || 0}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Battles Won:</p>
                      <Badge variant="default" className="text-lg">
                        {masteryStatus.stats?.totalBattlesWon || 0}
                      </Badge>
                    </div>
                  </div>

                  {/* Next Milestone */}
                  {masteryStatus.milestones?.next && (
                    <div className="mt-4 bg-purple-900/30 border border-purple-500 rounded p-3">
                      <p className="text-purple-400 font-semibold text-sm mb-1">
                        Next Milestone: {masteryStatus.milestones.next.level}%
                      </p>
                      <p className="text-gray-300 text-xs mb-1">
                        {masteryStatus.milestones.next.description}
                      </p>
                      <Badge variant="default" className="text-xs">
                        {masteryStatus.milestones.next.xpToReach.toLocaleString()} XP needed
                      </Badge>
                    </div>
                  )}
                </Panel>
              )}

              <Divider />

              {/* Doctrine Cards */}
              <StaggerChildren staggerDelay={0.1}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(doctrines).map(([key, config]) =>
                    getDoctrineCard(key, config)
                  )}
                </div>
              </StaggerChildren>

              {/* Respec Cost Info */}
              {eligibility?.hasSpecialization && respecEligibility && (
                <>
                  <Divider />
                  <Panel className="bg-yellow-900/30 border border-yellow-500">
                    <p className="text-yellow-400 font-semibold mb-3">Respec Costs:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">RP Cost:</p>
                        <Badge variant="default" className="text-base">
                          {respecEligibility.costs?.rp || 50}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Metal:</p>
                        <Badge variant="default" className="text-base">
                          {formatNumber(respecEligibility.costs?.metal || 50000)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Energy:</p>
                        <Badge variant="default" className="text-base">
                          {formatNumber(respecEligibility.costs?.energy || 50000)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Cooldown:</p>
                        <Badge variant="default" className="text-base">
                          {respecEligibility.costs?.cooldownHours || 48}h
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">
                      Note: Respeccing resets mastery to 0% but keeps old specialized units
                    </p>
                  </Panel>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-3 text-center text-gray-400 text-sm border-t border-gray-600">
          Press <kbd className="px-2 py-1 bg-gray-600 rounded font-mono">P</kbd> to toggle this panel
        </div>
      </Card>

      {/* Respec Confirmation Modal */}
      {showRespecConfirm && selectedDoctrine && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
          <Card className="max-w-md border-2 border-yellow-500">
            <div className="p-6">
              <h3 className="text-xl font-bold text-yellow-400 mb-4">Confirm Respec</h3>
              <p className="text-gray-300 mb-4">
                Are you sure you want to respec to{' '}
                <span className="text-white font-semibold">{doctrines[selectedDoctrine]?.name}</span>?
              </p>
              
              <Panel className="bg-red-900/30 border border-red-500 mb-4">
                <p className="text-red-400 font-semibold text-sm mb-3">This will cost:</p>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <Badge variant="default">50 Research Points</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <Badge variant="default">50,000 Metal</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <Badge variant="default">50,000 Energy</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 italic">
                  Your mastery will reset to 0%
                </p>
              </Panel>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="base"
                  onClick={handleRespecDoctrine}
                  disabled={loading}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                >
                  {loading ? 'Respeccing...' : 'Confirm Respec'}
                </Button>
                <Button
                  variant="ghost"
                  size="base"
                  onClick={() => {
                    setShowRespecConfirm(false);
                    setSelectedDoctrine(null);
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SpecializationPanel;

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Keyboard shortcut: P key (for Progression)
// - Initial choice: Level 15+, 25 RP
// - Respec: 50 RP, 50k Metal, 50k Energy, 48h cooldown
// - Three doctrines: Offensive (Strength +), Defensive (Defense +), Tactical (Balanced +)
// - Mastery progress tracking with milestone rewards
// - Current doctrine highlighted with ring effect
// - Design system integration: Card, Button, Badge, Panel, Divider, StaggerChildren, LoadingSpinner, toast
// - Responsive grid layout (1/3 columns based on screen size)
// - Smooth animations with stagger effects (0.1s delay)
// - Hover effects on doctrine cards (scale + shadow)
// - Floating button when closed (bottom-left, purple)
// - Confirmation modal for respeccing with cost breakdown
// - Toast notifications for success/error feedback
// ============================================================
// END OF FILE
// ============================================================
