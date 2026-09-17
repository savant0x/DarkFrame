/**
 * @file components/clan/ClanTerritoryPanel.tsx
 * @created 2025-10-19
 * @overview Clan territory management interface
 * 
 * OVERVIEW:
 * Comprehensive territory management panel providing:
 * - List of all clan-controlled territories
 * - Territory claiming interface
 * - Income tracking per territory
 * - Defense bonus calculations
 * - Territory coordinates and map position
 * - Unclaim/abandon territory functionality
 * 
 * Territory mechanics:
 * - Each territory grants passive income
 * - Adjacent territories provide +10% defense bonus each
 * - Territories can be claimed by officers and above
 * - Territories at risk during wars
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 3 - Territory & Warfare UI
 * - Permission-based claiming (canManageTerritories)
 * - Real-time territory count updates
 * - Integration with warfare system
 * - FID-20260916-013: War Captures section — enumerate ALL outgoing ACTIVE
 *   wars (GET /api/clan/warfare/capture/targets), per-tile capture actions
 *   (POST /api/clan/warfare/capture) gated to Officer+ (server mirror).
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';

import {
  MapPin,
  Map,
  Shield,
  Coins,
  Plus,
  Trash2,
  Search,
  Swords,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan, ClanTerritory, ClanRole as ClanRoleType } from '@/types/clan.types';
import { ClanRole, ROLE_PERMISSIONS } from '@/types/clan.types';

/**
 * FID-20260916-013 §5.3 — capture-permission gate.
 *
 * The server's requireRole hardcodes ['LEADER','CO_LEADER','OFFICER'] — OFFICER
 * CAN capture even though ROLE_PERMISSIONS.canManageWars is false for OFFICER.
 * This presentational gate keys on OFFICER-or-above to mirror the server
 * exactly, not canManageWars.
 */
function canCapture(role: ClanRoleType): boolean {
  return role === ClanRole.LEADER || role === ClanRole.CO_LEADER || role === ClanRole.OFFICER;
}

/** Mirrors clanWarfareService.CaptureTarget (wire shape of the targets route). */
interface CaptureTarget {
  tileX: number;
  tileY: number;
  defenseBonus: number;
}

/** Mirrors clanWarfareService.WarCaptureTargets — one outgoing ACTIVE war. */
interface WarCaptureTargets {
  warId: string;
  defenderClanId: string;
  defenderTag: string;
  capturesToday: number;
  capturesCap: number;
  targets: CaptureTarget[];
}

/** Wire shape of GET /api/clan/warfare/capture/targets (this section's data source). */
interface CaptureTargetsResponse {
  success: boolean;
  activeWars: WarCaptureTargets[];
}


interface ClanTerritoryPanelProps {
  clan: Clan;
  currentUserRole: ClanRole;
  onRefresh: () => void;
}

export default function ClanTerritoryPanel({
  clan,
  currentUserRole,
  onRefresh
}: ClanTerritoryPanelProps) {
  const [territories, setTerritories] = useState<ClanTerritory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [warTargets, setWarTargets] = useState<WarCaptureTargets[]>([]);
  const [captureLoading, setCaptureLoading] = useState(true);
  const [busyWarId, setBusyWarId] = useState<string | null>(null);

  // Permission checks
  const canManage = ROLE_PERMISSIONS[currentUserRole].canManageTerritories;
  const canWarCapture = canCapture(currentUserRole);

  /**
   * Fetches all territories owned by the clan
   */
  const fetchTerritories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clan/territory/list?clanId=${clan._id}`);
      if (!response.ok) throw new Error('Failed to fetch territories');
      
      const data = await response.json();
      setTerritories(data.territories || []);
    } catch (error) {
      console.error('Error fetching territories:', error);
      toast.error('Failed to load territories');
    } finally {
      setIsLoading(false);
    }
  }, [clan._id]);

  // Fetch territories on mount
  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  /**
   * FID-20260916-013 §5.3 — fetches ALL outgoing ACTIVE wars with capturable
   * enemy tiles. Empty array = no wars: rendered as guidance, not an error.
   */
  const fetchCaptureTargets = useCallback(async () => {
    setCaptureLoading(true);
    try {
      const response = await fetch('/api/clan/warfare/capture/targets');
      if (!response.ok) throw new Error('Failed to fetch capture targets');
      const data: CaptureTargetsResponse = await response.json();
      setWarTargets(data.activeWars || []);
    } catch (error) {
      console.error('Error fetching capture targets:', error);
      toast.error('Failed to load war capture targets');
      setWarTargets([]);
    } finally {
      setCaptureLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptureTargets();
  }, [fetchCaptureTargets]);

  /**
   * Filters territories based on search query
   */
  const filteredTerritories = territories.filter(territory => {
    if (!searchQuery) return true;
    const coords = `(${territory.tileX}, ${territory.tileY})`;
    return coords.includes(searchQuery) || territory.claimedBy.toLowerCase().includes(searchQuery.toLowerCase());
  });

  /**
   * Calculates total passive income from all territories
   */
  const calculateTotalIncome = () => {
    // Base income per territory: 100 metal, 100 energy per hour
    const baseIncomePerTerritory = 100;
    return {
      metal: territories.length * baseIncomePerTerritory,
      energy: territories.length * baseIncomePerTerritory
    };
  };

  const totalIncome = calculateTotalIncome();

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Map className="w-5 h-5 text-[color:var(--nn-cyan)]" />}
          label="Territories"
          value={territories.length}
          subtext="Tiles controlled"
        />
        <StatCard
          icon={<Coins className="w-5 h-5 text-[color:var(--nn-amber)]" />}
          label="Income/Hour"
          value={`${totalIncome.metal}M / ${totalIncome.energy}E`}
          subtext="Passive generation"
        />
        <StatCard
          icon={<Shield className="w-5 h-5 text-[color:var(--nn-violet)]" />}
          label="Avg Defense"
          value={`+${Math.round((territories.reduce((sum, t) => sum + t.defenseBonus, 0) / (territories.length || 1)))}%`}
          subtext="Territory bonus"
        />
      </div>

      <div className="nn-divider"  />

      {/* Search and Actions */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 nn-text-secondary" />
          <input
            placeholder="Search by coordinates or claimer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nn-input pl-10"
           />
        </div>
        {canManage && (
          <button
            onClick={() => setShowClaimModal(true)}
            className="nn-btn gap-2"
          >
            <Plus className="w-4 h-4" />
            Claim Territory
          </button>
        )}
      </div>

      {/* Permission Notice */}
      {!canManage && (
        <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[color:var(--nn-amber)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-[color:var(--nn-amber)] font-medium">Limited Access</p>
            <p className="nn-text-secondary mt-1">
              Only Officers and above can claim or manage territories.
            </p>
          </div>
        </div>
      )}

      {/* Territories List */}
      {isLoading ? (
        <div className="text-center py-12 nn-text-secondary">
          <Map className="nn-pulse w-12 h-12 mx-auto mb-3" />
          <p>Loading territories...</p>
        </div>
      ) : filteredTerritories.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 mx-auto mb-3 nn-text-tertiary" />
          <p className="nn-text-secondary mb-2">
            {searchQuery ? 'No matching territories found' : 'No territories claimed yet'}
          </p>
          {!searchQuery && canManage && (
            <p className="text-sm nn-text-secondary">
              Click &quot;Claim Territory&quot; to expand your clan{"'"}s domain
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredTerritories.map((territory) => (
            <TerritoryCard
              key={territory._id?.toString() || `${territory.tileX}-${territory.tileY}`}
              territory={territory}
              canManage={canManage}
              onUnclaim={() => handleUnclaim(territory)}
            />
          ))}
        </div>
      )}

      {/* War Captures (FID-20260916-013 §5.3) — data source: GET /api/clan/warfare/capture/targets */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-[color:var(--nn-magenta)]" />
          <h3 className="text-sm font-semibold text-[color:var(--nn-text-primary)] uppercase tracking-wide">
            War Captures
          </h3>
        </div>
        {captureLoading ? (
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-4 text-center nn-text-secondary text-sm">
            Loading war targets...
          </div>
        ) : warTargets.length === 0 ? (
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-4 nn-text-secondary text-sm">
            No active wars. Declare war from the Warfare panel to capture enemy territory.
          </div>
        ) : (
          <div className="space-y-3">
            {warTargets.map((war) => (
              <div
                key={war.warId}
                className="nn-surface border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="nn-chip nn-chip--magenta text-xs">vs [{war.defenderTag}]</span>
                    <span className="text-xs nn-text-secondary">
                      Captures today: {war.capturesToday}/{war.capturesCap}
                    </span>
                  </div>
                  <span className="text-xs nn-text-secondary flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Settles 48h after declaration
                  </span>
                </div>
                {canWarCapture ? (
                  war.targets.length === 0 ? (
                    <p className="text-xs nn-text-secondary">Enemy clan holds no territory.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {war.targets.map((tile) => {
                        const capped = war.capturesToday >= war.capturesCap;
                        return (
                          <button
                            key={`${tile.tileX}-${tile.tileY}`}
                            onClick={() => handleCapture(war, tile)}
                            disabled={busyWarId === war.warId || capped}
                            className="nn-btn nn-btn--ghost text-xs"
                            title={
                              capped
                                ? `Capture (${tile.tileX}, ${tile.tileY}) — daily capture limit reached`
                                : `Capture (${tile.tileX}, ${tile.tileY}) — treasury cost paid win or lose`
                            }
                          >
                            <MapPin className="w-3 h-3" />
                            ({tile.tileX}, {tile.tileY})
                            <span className="nn-chip nn-chip--green ml-1">+{tile.defenseBonus}% def</span>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-xs nn-text-secondary">
                    Only Officers and above can capture enemy territory.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="nn-divider" />

      {/* Claim Territory Modal */}
      {showClaimModal && (
        <ClaimTerritoryModal
          clanId={clan._id!.toString()}
          onClose={() => setShowClaimModal(false)}
          onSuccess={() => {
            fetchTerritories();
            onRefresh();
          }}
        />
      )}
    </div>
  );

  /**
   * FID-20260916-013 §5.3 — attempts a contested capture.
   * The server's message is always surfaced verbatim: captures toast success,
   * repels toast as errors (success:false), refusals arrive as 4xx messages.
   */
  async function handleCapture(war: WarCaptureTargets, tile: CaptureTarget) {
    // Confirm-then-fire (FID §5): the treasury fee is paid win or lose.
    const confirmed = window.confirm(
      `Capture territory at (${tile.tileX}, ${tile.tileY}) from [${war.defenderTag}]? The treasury cost is paid win or lose (+${tile.defenseBonus}% defense).`
    );
    if (!confirmed) return;

    setBusyWarId(war.warId);
    try {
      const response = await fetch('/api/clan/warfare/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetClanId: war.defenderClanId,
          tileX: tile.tileX,
          tileY: tile.tileY
        })
      });
      const data = await response.json().catch(() => null);
      if (data?.message) {
        if (data.success) {
          toast.success(data.message);
        } else {
          toast.error(data.message);
        }
      } else if (!response.ok) {
        toast.error('Capture attempt failed');
      }
      await fetchCaptureTargets();
      await onRefresh();
    } catch (error) {
      console.error('Error capturing territory:', error);
      toast.error(getErrorMessage(error) || 'Capture attempt failed');
    } finally {
      setBusyWarId(null);
    }
  }

  /**
   * Handles unclaiming/abandoning a territory
   */
  async function handleUnclaim(territory: ClanTerritory) {
    const confirmed = window.confirm(
      `Are you sure you want to abandon territory at (${territory.tileX}, ${territory.tileY})? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/clan/territory/unclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          tileX: territory.tileX,
          tileY: territory.tileY
        })
      });

      if (!response.ok) throw new Error('Failed to unclaim territory');

      const data = await response.json();
      toast.success(data.message || 'Territory abandoned successfully');
      
      await fetchTerritories();
      await onRefresh();
    } catch (error) {
      console.error('Error unclaiming territory:', error);
      toast.error('Failed to abandon territory');
    } finally {
      setIsLoading(false);
    }
  }
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm nn-text-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[color:var(--nn-text-primary)] mb-1">{value}</div>
      <div className="text-xs nn-text-secondary">{subtext}</div>
    </div>
  );
}

/**
 * Territory Card Component
 */
interface TerritoryCardProps {
  territory: ClanTerritory;
  canManage: boolean;
  onUnclaim: () => void;
}

function TerritoryCard({ territory, canManage, onUnclaim }: TerritoryCardProps) {
  const timeSinceClaim = Date.now() - new Date(territory.claimedAt).getTime();
  const daysSinceClaim = Math.floor(timeSinceClaim / (1000 * 60 * 60 * 24));

  return (
    <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-4 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Coordinates */}
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-[color:var(--nn-cyan)]" />
            <span className="text-lg font-semibold text-[color:var(--nn-text-primary)]">
              ({territory.tileX}, {territory.tileY})
            </span>
            <span className="nn-chip nn-chip--cyan text-xs">
              +{territory.defenseBonus}% Defense
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="nn-text-secondary">Claimed by:</span>
              <span className="nn-text-primary ml-2">{territory.claimedBy}</span>
            </div>
            <div>
              <span className="nn-text-secondary">Held for:</span>
              <span className="nn-text-primary ml-2">
                {daysSinceClaim === 0 ? 'Today' : `${daysSinceClaim}d`}
              </span>
            </div>
            <div>
              <span className="nn-text-secondary">Income:</span>
              <span className="text-[color:var(--nn-amber)] ml-2">100M + 100E/h</span>
            </div>
            <div>
              <span className="nn-text-secondary">Status:</span>
              <span className="text-[color:var(--nn-green)] ml-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Secured
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {canManage && (
          <button
            onClick={onUnclaim} className="nn-btn nn-btn--ghost text-[color:var(--nn-magenta)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Claim Territory Modal Component
 */
interface ClaimTerritoryModalProps {
  clanId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ClaimTerritoryModal({ clanId, onClose, onSuccess }: ClaimTerritoryModalProps) {
  const [tileX, setTileX] = useState('');
  const [tileY, setTileY] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);

  /**
   * Handles claiming a new territory
   */
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();

    const x = parseInt(tileX);
    const y = parseInt(tileY);

    if (isNaN(x) || isNaN(y)) {
      toast.error('Please enter valid coordinates');
      return;
    }

    setIsClaiming(true);
    try {
      const response = await fetch('/api/clan/territory/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          tileX: x,
          tileY: y
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim territory');
      }

      const data = await response.json();
      toast.success(data.message || 'Territory claimed successfully!');
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error claiming territory:', error);
      toast.error(getErrorMessage(error) || 'Failed to claim territory');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="nn-surface nn-surface--dark border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[color:var(--nn-text-primary)] mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[color:var(--nn-cyan)]" />
          Claim Territory
        </h2>

        <form onSubmit={handleClaim} className="space-y-4">
          {/* Coordinates Input */}
          <div>
            <label className="block text-sm nn-text-secondary mb-2">
              Territory Coordinates
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className="nn-input"
                type="number"
                placeholder="X coordinate"
                value={tileX}
                onChange={(e) => setTileX(e.target.value)}
                required
               />
              <input className="nn-input"
                type="number"
                placeholder="Y coordinate"
                value={tileY}
                onChange={(e) => setTileY(e.target.value)}
                required
               />
            </div>
            <p className="text-xs nn-text-secondary mt-2">
              Enter the map coordinates of the tile you want to claim
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-3">
            <p className="text-sm text-[color:var(--nn-cyan)] mb-2 font-medium">Territory Benefits:</p>
            <ul className="text-xs nn-text-secondary space-y-1">
              <li>• +100 Metal and Energy per hour</li>
              <li>• +10% defense bonus per adjacent clan territory</li>
              <li>• Strategic positioning for warfare</li>
              <li>• Contributes to clan power rating</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose} className="nn-btn nn-btn--ghost flex-1"
              disabled={isClaiming}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="nn-btn flex-1 gap-2"
              disabled={isClaiming}
            >
              {isClaiming ? (
                <>Claiming...</>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Claim Territory
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
