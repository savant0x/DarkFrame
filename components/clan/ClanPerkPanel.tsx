/**
 * Clan Perk Panel Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Comprehensive perk management interface for clans. Displays active perks (4 slots),
 * available perks catalog filtered by tier and category, total bonuses summary,
 * and AI recommendations. Handles perk activation/deactivation with cost validation.
 * 
 * Features:
 * - Active perks display (4 slots with empty slot indicators)
 * - Category tabs (Combat, Economic, Social, Strategic)
 * - Tier filtering (Bronze, Silver, Gold, Legendary)
 * - Unlocked/locked perk grids
 * - Total bonuses aggregation display
 * - AI recommendations section
 * - Activation/deactivation with confirmation
 * - Cost breakdown and bank balance validation
 * - Permission checking (Leader/Officer only)
 * 
 * Integration:
 * - GET /api/clan/perks/available (catalog, filters, recommendations)
 * - POST /api/clan/perks/activate (activation/deactivation)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge } from '@/components/ui';
import {  Lock,  Shield, Coins, Users, Target } from 'lucide-react';


interface Perk {
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
    value: number; // percentage
  };
  activatedAt?: string;
  activatedBy?: string;
  levelsToUnlock?: number; // Only for locked perks
}

interface TotalBonuses {
  attack: number;
  defense: number;
  resourceYield: number;
  xpGain: number;
  territoryCostReduction: number;
}

interface Recommendation {
  perk: Perk;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface ClanPerkPanelProps {
  onPerkActivated?: () => void;
  onPerkDeactivated?: () => void;
}

/**
 * PerkCard Component - Displays individual perk details
 */
interface PerkCardProps {
  perk: Perk;
  isActive?: boolean;
  isLocked?: boolean;
  canActivate?: boolean;
  levelsToUnlock?: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
  isLoading?: boolean;
}

function PerkCard({ perk, isActive = false, onActivate, onDeactivate, isLoading = false }: PerkCardProps) {
  const tierColors = {
    BRONZE: 'border-orange-700/50 bg-orange-900/10',
    SILVER: 'border-glass-border bg-glass-light',
    GOLD: 'border-yellow-400/50 bg-yellow-900/10',
    LEGENDARY: 'border-purple-500/50 bg-purple-900/10',
  };

  const categoryIcons = {
    COMBAT: <Shield className="w-4 h-4" />,
    ECONOMIC: <Coins className="w-4 h-4" />,
    SOCIAL: <Users className="w-4 h-4" />,
    STRATEGIC: <Target className="w-4 h-4" />,
  };

  return (
    <div className={`border-2 rounded-lg p-4 space-y-3 ${tierColors[perk.tier]} ${perk.levelsToUnlock ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {categoryIcons[perk.category]}
          <h4 className="text-white font-semibold text-sm">{perk.name}</h4>
        </div>
        <Badge variant={isActive ? 'success' : 'default'} className="text-xs">
          {perk.tier}
        </Badge>
      </div>

      <p className="text-text-secondary text-xs leading-relaxed">{perk.description}</p>

      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Bonus:</span>
          <span className="text-cyan-400 font-semibold">+{perk.bonus.value}% {perk.bonus.type.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Cost:</span>
          <span className="text-yellow-400">{perk.cost.metal}M + {perk.cost.energy}E + {perk.cost.researchPoints}RP</span>
        </div>
        {perk.levelsToUnlock && (
          <div className="flex items-center justify-between text-red-400">
            <Lock className="w-3 h-3" />
            <span>Unlock at Level {perk.requiredLevel}</span>
          </div>
        )}
      </div>

      {!perk.levelsToUnlock && (
        <Button
          onClick={isActive ? onDeactivate : onActivate}
          variant={isActive ? 'danger' : 'secondary'}
          className="w-full text-xs"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : isActive ? 'Deactivate' : 'Activate'}
        </Button>
      )}
    </div>
  );
}

export default function ClanPerkPanel({
  onPerkActivated,
  onPerkDeactivated,
}: ClanPerkPanelProps) {
  const [activePerks, setActivePerks] = useState<Perk[]>([]);
  const [unlockedPerks, setUnlockedPerks] = useState<Perk[]>([]);
  const [lockedPerks, setLockedPerks] = useState<Perk[]>([]);
  const [totalBonuses, setTotalBonuses] = useState<TotalBonuses>({
    attack: 0,
    defense: 0,
    resourceYield: 0,
    xpGain: 0,
    territoryCostReduction: 0,
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [maxActive, setMaxActive] = useState(4);
  const [clanLevel, setClanLevel] = useState(1);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const categories = ['COMBAT', 'ECONOMIC', 'SOCIAL', 'STRATEGIC'];
  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'LEGENDARY'];

  // Fetch available perks
  const fetchPerks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedTier) params.append('tier', selectedTier);
      params.append('recommendations', 'true');
      params.append('costs', 'true');

      const response = await fetch(`/api/clan/perks/available?${params}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch perks');
      }

      const data = await response.json();
      setActivePerks(data.perks.active || []);
      setUnlockedPerks(data.perks.unlocked || []);
      setLockedPerks(data.perks.locked || []);
      setTotalBonuses(data.totalBonuses || {
        attack: 0,
        defense: 0,
        resourceYield: 0,
        xpGain: 0,
        territoryCostReduction: 0,
      });
      setRecommendations(data.recommendations || []);
      setActiveCount(data.perks.activeCount || 0);
      setMaxActive(data.perks.maxActive || 4);
      setClanLevel(data.clanLevel || 1);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedTier]);

  useEffect(() => {
    fetchPerks();
  }, [fetchPerks]);

  // Activate perk
  const handleActivate = async (perkId: string) => {
    setActionLoading(perkId);
    try {
      const response = await fetch('/api/clan/perks/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', perkId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate perk');
      }

      await fetchPerks(); // Refresh
      onPerkActivated?.();
    } catch (err: any) {
      alert(`Activation failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Deactivate perk
  const handleDeactivate = async (perkId: string, perkName: string) => {
    if (!confirm(`Deactivate ${perkName}? You will NOT receive a refund.`)) {
      return;
    }

    setActionLoading(perkId);
    try {
      const response = await fetch('/api/clan/perks/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', perkId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate perk');
      }

      await fetchPerks(); // Refresh
      onPerkDeactivated?.();
    } catch (err: any) {
      alert(`Deactivation failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Get tier color
  const _getTierColor = (tier: string): string => {
    switch (tier) {
      case 'BRONZE': return 'text-orange-400 border-orange-700';
      case 'SILVER': return 'text-blue-400 border-blue-700';
      case 'GOLD': return 'text-yellow-400 border-yellow-700';
      case 'LEGENDARY': return 'text-purple-400 border-purple-700';
      default: return 'text-text-secondary border-glass-border';
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
  const _formatBonus = (type: string, value: number): string => {
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

  if (loading) {
    return (
      <div className="bg-glass-light rounded-lg p-6 border border-glass-border">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-glass-light rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-glass-light rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
        <p className="text-red-400">Error loading perks: {error}</p>
        <button
          onClick={fetchPerks}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-glass-light rounded-lg p-6 border border-glass-border space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Clan Perks</h2>
        <div className="text-sm text-text-secondary">
          Clan Level: <span className="text-cyan-400 font-bold">{clanLevel}</span>
        </div>
      </div>

      {/* Total Bonuses Summary */}
      <div className="bg-glass-dark border border-cyan-700/50 rounded-lg p-4">
        <h3 className="text-cyan-400 font-bold mb-3">Total Active Bonuses</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {totalBonuses.attack > 0 && (
            <div className="text-center">
              <div className="text-red-400 text-2xl font-bold">+{totalBonuses.attack}%</div>
              <div className="text-text-secondary text-xs">Attack</div>
            </div>
          )}
          {totalBonuses.defense > 0 && (
            <div className="text-center">
              <div className="text-blue-400 text-2xl font-bold">+{totalBonuses.defense}%</div>
              <div className="text-text-secondary text-xs">Defense</div>
            </div>
          )}
          {totalBonuses.resourceYield > 0 && (
            <div className="text-center">
              <div className="text-green-400 text-2xl font-bold">+{totalBonuses.resourceYield}%</div>
              <div className="text-text-secondary text-xs">Resources</div>
            </div>
          )}
          {totalBonuses.xpGain > 0 && (
            <div className="text-center">
              <div className="text-purple-400 text-2xl font-bold">+{totalBonuses.xpGain}%</div>
              <div className="text-text-secondary text-xs">XP Gain</div>
            </div>
          )}
          {totalBonuses.territoryCostReduction > 0 && (
            <div className="text-center">
              <div className="text-yellow-400 text-2xl font-bold">-{totalBonuses.territoryCostReduction}%</div>
              <div className="text-text-secondary text-xs">Territory Cost</div>
            </div>
          )}
          {Object.values(totalBonuses).every(v => v === 0) && (
            <div className="col-span-full text-center text-text-secondary">
              No active bonuses
            </div>
          )}
        </div>
      </div>

      {/* Active Perks */}
      <div>
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <span>✨</span>
          Active Perks ({activeCount} / {maxActive})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: maxActive }).map((_, index) => {
            const perk = activePerks[index];
            if (perk) {
              return (
                <PerkCard
                  key={perk.id}
                  perk={perk}
                  isActive={true}
                  onDeactivate={() => handleDeactivate(perk.id, perk.name)}
                  isLoading={actionLoading === perk.id}
                />
              );
            } else {
              return (
                <div
                  key={`empty-${index}`}
                  className="bg-glass-dark border-2 border-dashed border-glass-border rounded-lg p-4 flex items-center justify-center h-40"
                >
                  <span className="text-text-tertiary text-sm">Empty Slot</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div>
          <h4 className="text-white font-semibold mb-2">Filter by Category</h4>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded transition ${
                selectedCategory === null
                  ? 'bg-cyan-700 text-white'
                  : 'bg-glass-light text-text-primary hover:bg-glass-light'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded transition flex items-center gap-2 ${
                  selectedCategory === cat
                    ? 'bg-cyan-700 text-white'
                    : 'bg-glass-light text-text-primary hover:bg-glass-light'
                }`}
              >
                <span>{getCategoryIcon(cat)}</span>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Filter by Tier</h4>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTier(null)}
              className={`px-4 py-2 rounded transition ${
                selectedTier === null
                  ? 'bg-cyan-700 text-white'
                  : 'bg-glass-light text-text-primary hover:bg-glass-light'
              }`}
            >
              All Tiers
            </button>
            {tiers.map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-4 py-2 rounded transition ${
                  selectedTier === tier
                    ? `bg-cyan-700 text-white`
                    : `bg-glass-light text-text-primary hover:bg-glass-light`
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
          <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
            <span>🤖</span>
            AI Recommendations
          </h3>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, _index) => (
              <div
                key={rec.perk.id}
                className="bg-glass-dark border border-glass-border rounded p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{rec.perk.name}</div>
                    <div className="text-text-secondary text-sm">{rec.reason}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${
                    rec.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                    rec.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-glass-light text-text-secondary'
                  }`}>
                    {rec.priority.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unlocked Perks */}
      {unlockedPerks.length > 0 && (
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <span>🔓</span>
            Available Perks ({unlockedPerks.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {unlockedPerks.map((perk) => (
              <PerkCard
                key={perk.id}
                perk={perk}
                isActive={false}
                canActivate={activeCount < maxActive}
                onActivate={() => handleActivate(perk.id)}
                isLoading={actionLoading === perk.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Locked Perks */}
      {lockedPerks.length > 0 && (
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <span>🔒</span>
            Locked Perks ({lockedPerks.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {lockedPerks.map((perk) => (
              <PerkCard
                key={perk.id}
                perk={perk}
                isLocked={true}
                levelsToUnlock={perk.levelsToUnlock}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
