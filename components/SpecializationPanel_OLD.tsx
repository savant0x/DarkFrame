/**
 * @file components/SpecializationPanel.tsx
 * @created 2025-01-17
 * @overview Main specialization management interface
 * 
 * OVERVIEW:
 * Displays available specialization doctrines (Offensive, Defensive, Tactical) with their
 * bonuses and exclusive units. Allows Level 15+ players to choose initial specialization
 * or respec to a different doctrine. Shows mastery progress and milestone rewards.
 * 
 * FEATURES:
 * - Visual doctrine cards with icons, descriptions, and bonuses
 * - Choose button for initial specialization (Level 15+, 25 RP)
 * - Respec button with cost display and confirmation (50 RP + resources, 48h cooldown)
 * - Mastery progress display with milestone tracking
 * - Keyboard shortcut support (P for Progression panel)
 * 
 * REQUIREMENTS:
 * - Initial choice: Level 15+, 25 RP
 * - Respec: 50 RP, 50k Metal, 50k Energy, 48h cooldown
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { logger } from '@/lib/logger';
import MasteryProgressBar from '@/components/MasteryProgressBar';

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

  // Keyboard shortcut (P for Progression)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          setIsOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Fetch specialization data when panel opens
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
      logger.error('Error fetching specialization data:', { error });
    }
  };

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
        logger.success(`Specialized in ${data.specialization.name}!`);
        await refreshGameState();
        await fetchSpecializationData();
      } else {
        logger.error('Failed to choose specialization:', { error: data.error });
        alert(data.error || 'Failed to choose specialization');
      }
    } catch (error) {
      logger.error('Error choosing specialization:', { error });
      alert('An error occurred while choosing specialization');
    } finally {
      setLoading(false);
    }
  };

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
        logger.success(`Respecialized to ${data.specialization.name}!`);
        await refreshGameState();
        await fetchSpecializationData();
        setSelectedDoctrine(null);
      } else {
        logger.error('Failed to respec:', { error: data.error });
        alert(data.error || 'Failed to respec');
      }
    } catch (error) {
      logger.error('Error respeccing:', { error });
      alert('An error occurred while respeccing');
    } finally {
      setLoading(false);
    }
  };

  const openRespecConfirm = (doctrine: string) => {
    setSelectedDoctrine(doctrine);
    setShowRespecConfirm(true);
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const getDoctrineCard = (doctrineKey: string, config: DoctrineConfig) => {
    const isCurrentDoctrine = masteryStatus?.doctrine === doctrineKey;
    const canChoose = eligibility?.canChoose && !eligibility?.hasSpecialization;
    const canRespec = respecEligibility?.canRespec && !isCurrentDoctrine;

    return (
      <div
        key={doctrineKey}
        className={`p-6 rounded-lg border-2 ${config.borderColor} ${config.bgColor} ${
          isCurrentDoctrine ? 'ring-4 ring-yellow-500/50' : ''
        } transition-all hover:scale-105`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <h3 className={`text-xl font-bold ${config.color}`}>{config.name}</h3>
              {isCurrentDoctrine && (
                <span className="text-xs text-yellow-400">★ CURRENT DOCTRINE ★</span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm mb-4">{config.description}</p>

        {/* Bonuses */}
        <div className="mb-4 space-y-1">
          <p className="text-xs text-gray-400 uppercase font-semibold">Bonuses:</p>
          {config.bonuses.strengthMultiplier && (
            <p className="text-sm text-green-400">
              +{((config.bonuses.strengthMultiplier - 1) * 100).toFixed(0)}% Strength
            </p>
          )}
          {config.bonuses.defenseMultiplier && (
            <p className="text-sm text-blue-400">
              +{((config.bonuses.defenseMultiplier - 1) * 100).toFixed(0)}% Defense
            </p>
          )}
          {config.bonuses.balancedMultiplier && (
            <p className="text-sm text-purple-400">
              +{((config.bonuses.balancedMultiplier - 1) * 100).toFixed(0)}% Balanced Stats
            </p>
          )}
          {config.bonuses.metalCostMultiplier && (
            <p className="text-sm text-orange-400">
              {((1 - config.bonuses.metalCostMultiplier) * 100).toFixed(0)}% Metal Cost
            </p>
          )}
          {config.bonuses.energyCostMultiplier && (
            <p className="text-sm text-cyan-400">
              {((1 - config.bonuses.energyCostMultiplier) * 100).toFixed(0)}% Energy Cost
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4">
          {canChoose && (
            <button
              onClick={() => handleChooseDoctrine(doctrineKey)}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-semibold transition-colors"
            >
              {loading ? 'Choosing...' : 'Choose (25 RP)'}
            </button>
          )}

          {canRespec && (
            <button
              onClick={() => openRespecConfirm(doctrineKey)}
              disabled={loading || respecEligibility?.cooldown?.active}
              className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded font-semibold transition-colors"
            >
              {respecEligibility?.cooldown?.active
                ? `Cooldown (${respecEligibility.cooldown.remainingHours}h)`
                : 'Respec (50 RP + Resources)'}
            </button>
          )}

          {isCurrentDoctrine && (
            <div className="text-center text-sm text-gray-400 italic py-2">
              Current specialization
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors z-40"
      >
        <span className="mr-2">⚖️</span>
        Specialization (P)
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-purple-500">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-purple-500 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-purple-400">Specialization System</h2>
            <p className="text-gray-400 text-sm mt-1">
              Choose your doctrine and master your path to power
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Requirements Display (if not eligible) */}
          {!eligibility?.hasSpecialization && eligibility && !eligibility.canChoose && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 font-semibold">Requirements Not Met:</p>
              <p className="text-gray-300 text-sm mt-2">{eligibility.reason}</p>
              <div className="mt-2 text-sm text-gray-400">
                <p>Level: {eligibility.requirements?.currentLevel} / {eligibility.requirements?.requiredLevel}</p>
                <p>Research Points: {eligibility.requirements?.currentRP} / {eligibility.requirements?.requiredRP}</p>
              </div>
            </div>
          )}

          {/* Mastery Progress (if has specialization) */}
          {masteryStatus?.hasSpecialization && masteryStatus.mastery && (
            <div className="bg-gray-800 rounded-lg p-6 border border-purple-500">
              <h3 className="text-xl font-bold text-purple-400 mb-4">Mastery Progress</h3>
              <MasteryProgressBar
                masteryLevel={masteryStatus.mastery.level}
                masteryXP={masteryStatus.mastery.totalXP}
                maxLevel={masteryStatus.mastery.maxLevel}
              />
              
              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Specialized Units Built:</p>
                  <p className="text-white font-semibold">{masteryStatus.stats?.totalUnitsBuilt || 0}</p>
                </div>
                <div>
                  <p className="text-gray-400">Battles Won:</p>
                  <p className="text-white font-semibold">{masteryStatus.stats?.totalBattlesWon || 0}</p>
                </div>
              </div>

              {/* Next Milestone */}
              {masteryStatus.milestones?.next && (
                <div className="mt-4 bg-purple-900/30 border border-purple-500 rounded p-3">
                  <p className="text-purple-400 font-semibold text-sm">
                    Next Milestone: {masteryStatus.milestones.next.level}%
                  </p>
                  <p className="text-gray-300 text-xs mt-1">
                    {masteryStatus.milestones.next.description}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {masteryStatus.milestones.next.xpToReach.toLocaleString()} XP needed
                  </p>
                </div>
              )}
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
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-400 font-semibold">Respec Costs:</p>
              <div className="grid grid-cols-4 gap-2 mt-2 text-sm text-gray-300">
                <div>
                  <p className="text-gray-400">RP Cost:</p>
                  <p className="font-semibold">{respecEligibility.costs?.rp || 50}</p>
                </div>
                <div>
                  <p className="text-gray-400">Metal:</p>
                  <p className="font-semibold">{formatNumber(respecEligibility.costs?.metal || 50000)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Energy:</p>
                  <p className="font-semibold">{formatNumber(respecEligibility.costs?.energy || 50000)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Cooldown:</p>
                  <p className="font-semibold">{respecEligibility.costs?.cooldownHours || 48}h</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">
                Note: Respeccing resets mastery to 0% but keeps old specialized units
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Respec Confirmation Modal */}
      {showRespecConfirm && selectedDoctrine && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md border-2 border-yellow-500">
            <h3 className="text-xl font-bold text-yellow-400 mb-4">Confirm Respec</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to respec to <span className="text-white font-semibold">{doctrines[selectedDoctrine]?.name}</span>?
            </p>
            <div className="bg-red-900/30 border border-red-500 rounded p-3 mb-4">
              <p className="text-red-400 font-semibold text-sm mb-2">This will cost:</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• 50 Research Points</li>
                <li>• 50,000 Metal</li>
                <li>• 50,000 Energy</li>
              </ul>
              <p className="text-xs text-gray-400 mt-2 italic">
                Your mastery will reset to 0%
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRespecDoctrine}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded font-semibold transition-colors"
              >
                {loading ? 'Respeccing...' : 'Confirm Respec'}
              </button>
              <button
                onClick={() => {
                  setShowRespecConfirm(false);
                  setSelectedDoctrine(null);
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecializationPanel;
