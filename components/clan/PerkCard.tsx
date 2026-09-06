/**
 * Perk Card Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Reusable card component for displaying individual clan perks. Shows perk details,
 * tier badge, category icon, bonus information, cost breakdown, and activation state.
 * Handles locked/unlocked/active states with appropriate visual feedback.
 * 
 * Features:
 * - Tier-based color coding (Bronze/Silver/Gold/Legendary)
 * - Category icon display
 * - Bonus type and value with formatting
 * - Cost breakdown (Metal/Energy/RP)
 * - Lock indicator with levels to unlock
 * - Activate/Deactivate buttons
 * - Loading state during actions
 * - Hover effects and tooltips
 * 
 * Props:
 * - perk: Perk data object
 * - isActive: Whether perk is currently active
 * - isLocked: Whether perk is locked (level requirement not met)
 * - canActivate: Whether user can activate (slot available)
 * - levelsToUnlock: Levels remaining to unlock
 * - onActivate: Callback for activation
 * - onDeactivate: Callback for deactivation
 * - isLoading: Loading state for async operations
 */

'use client';

import { formatNumberAbbreviated } from '@/utils/formatting';

interface PerkCardProps {
  perk: {
    id: string;
    name: string;
    description: string;
    category: 'COMBAT' | 'ECONOMIC' | 'SOCIAL' | 'STRATEGIC';
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'LEGENDARY';
    requiredLevel: number;
    cost: {
      metal: number;
      energy: number;
      researchPoints: number;
    };
    bonus: {
      type: 'attack' | 'defense' | 'resource_yield' | 'xp_gain' | 'territory_cost' | 'max_members';
      value: number;
    };
    activatedAt?: string;
    activatedBy?: string;
  };
  isActive?: boolean;
  isLocked?: boolean;
  canActivate?: boolean;
  levelsToUnlock?: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
  isLoading?: boolean;
}

export default function PerkCard({
  perk,
  isActive = false,
  isLocked = false,
  canActivate = true,
  levelsToUnlock,
  onActivate,
  onDeactivate,
  isLoading = false,
}: PerkCardProps) {
  // Get tier color classes
  const getTierColors = (tier: string) => {
    switch (tier) {
      case 'BRONZE':
        return {
          border: 'border-orange-700',
          text: 'text-orange-400',
          bg: 'bg-orange-900/20',
          badge: 'bg-orange-900/50',
        };
      case 'SILVER':
        return {
          border: 'border-blue-700',
          text: 'text-blue-400',
          bg: 'bg-blue-900/20',
          badge: 'bg-blue-900/50',
        };
      case 'GOLD':
        return {
          border: 'border-yellow-700',
          text: 'text-yellow-400',
          bg: 'bg-yellow-900/20',
          badge: 'bg-yellow-900/50',
        };
      case 'LEGENDARY':
        return {
          border: 'border-purple-700',
          text: 'text-purple-400',
          bg: 'bg-purple-900/20',
          badge: 'bg-purple-900/50',
        };
      default:
        return {
          border: 'border-glass-border',
          text: 'text-text-secondary',
          bg: 'bg-glass-dark',
          badge: 'bg-glass-dark',
        };
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'COMBAT': return '⚔️';
      case 'ECONOMIC': return '💰';
      case 'SOCIAL': return '👥';
      case 'STRATEGIC': return '🗺️';
      default: return '🔷';
    }
  };

  // Format bonus display
  const formatBonus = (type: string, value: number): string => {
    switch (type) {
      case 'attack': return `+${value}% Attack`;
      case 'defense': return `+${value}% Defense`;
      case 'resource_yield': return `+${value}% Resources`;
      case 'xp_gain': return `+${value}% XP`;
      case 'territory_cost': return `-${value}% Territory Cost`;
      case 'max_members': return `+${value} Max Members`;
      default: return `+${value}%`;
    }
  };

  const colors = getTierColors(perk.tier);

  return (
    <div
      className={`rounded-lg p-4 border-2 transition-all ${
        isActive
          ? `${colors.border} ${colors.bg} shadow-lg`
          : isLocked
          ? 'border-glass-border bg-glass-dark opacity-60'
          : `${colors.border} bg-glass-dark hover:shadow-md`
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getCategoryIcon(perk.category)}</span>
          <div className={`px-2 py-1 rounded text-xs font-bold ${colors.badge} ${colors.text}`}>
            {perk.tier}
          </div>
        </div>
        {isActive && (
          <div className="px-2 py-1 bg-green-900/50 border border-green-700 rounded">
            <span className="text-green-400 text-xs font-bold">ACTIVE</span>
          </div>
        )}
        {isLocked && (
          <div className="text-text-secondary text-lg">🔒</div>
        )}
      </div>

      {/* Perk Name */}
      <h4 className={`font-bold mb-1 ${isLocked ? 'text-text-secondary' : 'text-white'}`}>
        {perk.name}
      </h4>

      {/* Description */}
      <p className={`text-xs mb-3 ${isLocked ? 'text-text-tertiary' : 'text-text-secondary'}`}>
        {perk.description}
      </p>

      {/* Bonus Display */}
      <div className={`mb-3 px-3 py-2 ${colors.bg} border ${colors.border} rounded text-center`}>
        <div className={`font-bold ${colors.text}`}>
          {formatBonus(perk.bonus.type, perk.bonus.value)}
        </div>
      </div>

      {/* Cost */}
      <div className="space-y-1 mb-3">
        <div className="text-xs text-text-secondary">Cost:</div>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="text-center">
            <div className="text-orange-400">{formatNumberAbbreviated(perk.cost.metal)}</div>
            <div className="text-text-secondary">Metal</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400">{formatNumberAbbreviated(perk.cost.energy)}</div>
            <div className="text-text-secondary">Energy</div>
          </div>
          <div className="text-center">
            <div className="text-purple-400">{formatNumberAbbreviated(perk.cost.researchPoints)}</div>
            <div className="text-text-secondary">RP</div>
          </div>
        </div>
      </div>

      {/* Required Level (for locked) */}
      {isLocked && levelsToUnlock && (
        <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-700 rounded text-center">
          <div className="text-red-400 text-xs">
            🔒 Level {perk.requiredLevel} required
          </div>
          <div className="text-text-secondary text-xs">
            ({levelsToUnlock} level{levelsToUnlock !== 1 ? 's' : ''} to unlock)
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!isLocked && (
        <div>
          {isActive ? (
            <button
              onClick={onDeactivate}
              disabled={isLoading}
              className={`w-full px-4 py-2 rounded font-semibold transition ${
                isLoading
                  ? 'bg-glass-light text-text-secondary cursor-not-allowed'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {isLoading ? 'Deactivating...' : 'Deactivate'}
            </button>
          ) : (
            <button
              onClick={onActivate}
              disabled={isLoading || !canActivate}
              className={`w-full px-4 py-2 rounded font-semibold transition ${
                isLoading || !canActivate
                  ? 'bg-glass-light text-text-secondary cursor-not-allowed'
                  : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
              }`}
            >
              {isLoading
                ? 'Activating...'
                : !canActivate
                ? 'Slots Full'
                : 'Activate'}
            </button>
          )}
        </div>
      )}

      {/* Activated Info (for active perks) */}
      {isActive && perk.activatedBy && perk.activatedAt && (
        <div className="mt-2 text-xs text-text-secondary text-center">
          Activated by {perk.activatedBy}
          <br />
          {new Date(perk.activatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

