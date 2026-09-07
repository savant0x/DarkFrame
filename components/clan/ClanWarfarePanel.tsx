/**
 * @file components/clan/ClanWarfarePanel.tsx
 * @created 2025-10-19
 * @overview Clan warfare and alliance management interface
 * 
 * OVERVIEW:
 * Comprehensive warfare management panel providing:
 * - War declaration interface
 * - Active wars tracking with real-time status
 * - War history and statistics
 * - Alliance creation and management
 * - Alliance contract terms
 * - War costs and requirements
 * 
 * Warfare mechanics:
 * - Wars cost 2000 Metal + 2000 Energy to declare
 * - Only Leaders and Co-Leaders can manage wars
 * - Wars have DECLARED → ACTIVE → ENDED lifecycle
 * - Alliances prevent wars between member clans
 * - Territory at stake in wars
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 3 - Territory & Warfare UI
 * - Permission-based war management (canManageWars)
 * - Real-time war status updates
 * - Integration with territory system
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';
import { Button, Input, Badge, Divider } from '@/components/ui';
import { 
  Swords, 
  Shield, 
  Users, 
  AlertTriangle,

  Clock,
  Trophy,
  Handshake,

  X,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan, ClanWar } from '@/types/clan.types';
import { ClanRole, ROLE_PERMISSIONS, ClanWarStatus } from '@/types/clan.types';


interface ClanWarfarePanelProps {
  clan: Clan;
  currentUserRole: ClanRole;
  onRefresh: () => void;
}

type WarfareTab = 'wars' | 'alliances';

export default function ClanWarfarePanel({
  clan,
  currentUserRole,
  onRefresh
}: ClanWarfarePanelProps) {
  const [activeTab, setActiveTab] = useState<WarfareTab>('wars');
  const [wars, setWars] = useState<ClanWar[]>([]);
  const [alliances, setAlliances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showAllianceModal, setShowAllianceModal] = useState(false);

  // Permission check
  const canManageWars = ROLE_PERMISSIONS[currentUserRole].canManageWars;

  /**
   * Fetches all wars involving the clan
   */
  const fetchWars = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clan/wars?clanId=${clan._id}`);
      if (!response.ok) throw new Error('Failed to fetch wars');
      
      const data = await response.json();
      setWars(data.wars || []);
    } catch (error) {
      console.error('Error fetching wars:', error);
      toast.error('Failed to load wars');
    } finally {
      setIsLoading(false);
    }
  }, [clan._id]);

  /**
   * Fetches all alliances involving the clan
   */
  const fetchAlliances = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clan/alliances?clanId=${clan._id}`);
      if (!response.ok) throw new Error('Failed to fetch alliances');
      
      const data = await response.json();
      setAlliances(data.alliances || []);
    } catch (error) {
      console.error('Error fetching alliances:', error);
      toast.error('Failed to load alliances');
    } finally {
      setIsLoading(false);
    }
  }, [clan._id]);

  // Fetch data on mount and tab change
  useEffect(() => {
    if (activeTab === 'wars') {
      fetchWars();
    } else {
      fetchAlliances();
    }
  }, [activeTab, fetchWars, fetchAlliances]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          onClick={() => setActiveTab('wars')}
          variant={activeTab === 'wars' ? 'secondary' : 'ghost'}
          className={`flex-1 gap-2 ${activeTab === 'wars' ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]' : ''}`}
        >
          <Swords className="w-4 h-4" />
          Wars
          {wars.length > 0 && (
            <Badge variant="error" className="text-xs">{wars.length}</Badge>
          )}
        </Button>
        <Button
          onClick={() => setActiveTab('alliances')}
          variant={activeTab === 'alliances' ? 'secondary' : 'ghost'}
          className={`flex-1 gap-2 ${activeTab === 'alliances' ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' : ''}`}
        >
          <Handshake className="w-4 h-4" />
          Alliances
          {alliances.length > 0 && (
            <Badge variant="success" className="text-xs">{alliances.length}</Badge>
          )}
        </Button>
      </div>

      <Divider />

      {/* Permission Notice */}
      {!canManageWars && (
        <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[color:var(--nn-amber)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-[color:var(--nn-amber)] font-medium">Leadership Required</p>
            <p className="text-text-secondary mt-1">
              Only Leaders and Co-Leaders can declare wars or create alliances.
            </p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'wars' ? (
        <WarsTab
          wars={wars}
          clan={clan}
          canManageWars={canManageWars}
          isLoading={isLoading}
          onDeclareWar={() => setShowDeclareModal(true)}
          onRefresh={fetchWars}
        />
      ) : (
        <AlliancesTab
          alliances={alliances}
          clan={clan}
          canManageWars={canManageWars}
          isLoading={isLoading}
          onCreateAlliance={() => setShowAllianceModal(true)}
          onRefresh={fetchAlliances}
        />
      )}

      {/* Declare War Modal */}
      {showDeclareModal && (
        <DeclareWarModal
          clanId={clan._id!.toString()}
          onClose={() => setShowDeclareModal(false)}
          onSuccess={() => {
            fetchWars();
            onRefresh();
          }}
        />
      )}

      {/* Create Alliance Modal */}
      {showAllianceModal && (
        <CreateAllianceModal
          clanId={clan._id!.toString()}
          onClose={() => setShowAllianceModal(false)}
          onSuccess={() => {
            fetchAlliances();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Wars Tab Component
 */
interface WarsTabProps {
  wars: ClanWar[];
  clan: Clan;
  canManageWars: boolean;
  isLoading: boolean;
  onDeclareWar: () => void;
  onRefresh: () => void;
}

function WarsTab({ wars, clan, canManageWars, isLoading, onDeclareWar, onRefresh }: WarsTabProps) {
  const activeWars = wars.filter(w => w.status === ClanWarStatus.ACTIVE);
  const declaredWars = wars.filter(w => w.status === ClanWarStatus.DECLARED);
  const endedWars = wars.filter(w => w.status === ClanWarStatus.ENDED);

  return (
    <div className="space-y-4">
      {/* Action Button */}
      {canManageWars && (
        <Button onClick={onDeclareWar} className="w-full gap-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)]">
          <Swords className="w-4 h-4" />
          Declare War
        </Button>
      )}

      {/* War Costs Info */}
      <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3">
        <p className="text-sm text-[color:var(--nn-magenta)] mb-2 font-medium">War Declaration Cost:</p>
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <span>2,000 Metal</span>
          <span>•</span>
          <span>2,000 Energy</span>
        </div>
      </div>

      {/* Wars List */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">
          <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
          <p>Loading wars...</p>
        </div>
      ) : wars.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-secondary mb-2">No wars declared</p>
          {canManageWars && (
            <p className="text-sm text-text-secondary">
              Your clan is at peace. Declare war to expand your territory.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Wars */}
          {activeWars.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--nn-magenta)] mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Active Wars ({activeWars.length})
              </h3>
              <div className="space-y-3">
                {activeWars.map(war => (
                  <WarCard
                    key={war._id?.toString() || war.warId}
                    war={war}
                    currentClanId={clan._id!.toString()}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Declared Wars */}
          {declaredWars.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--nn-amber)] mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Pending Wars ({declaredWars.length})
              </h3>
              <div className="space-y-3">
                {declaredWars.map(war => (
                  <WarCard
                    key={war._id?.toString() || war.warId}
                    war={war}
                    currentClanId={clan._id!.toString()}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ended Wars */}
          {endedWars.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                War History ({endedWars.length})
              </h3>
              <div className="space-y-3">
                {endedWars.slice(0, 5).map(war => (
                  <WarCard
                    key={war._id?.toString() || war.warId}
                    war={war}
                    currentClanId={clan._id!.toString()}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * War Card Component
 */
interface WarCardProps {
  war: ClanWar;
  currentClanId: string;
  onRefresh: () => void;
}

function WarCard({ war, currentClanId }: WarCardProps) {
  const isAttacker = war.attackerClanId === currentClanId;
  const opponentId = isAttacker ? war.defenderClanId : war.attackerClanId;
  
  const getStatusBadge = () => {
    switch (war.status) {
      case ClanWarStatus.ACTIVE:
        return <Badge variant="error">Active</Badge>;
      case ClanWarStatus.DECLARED:
        return <Badge variant="warning">Declared</Badge>;
      case ClanWarStatus.ENDED:
        return <Badge variant="default">Ended</Badge>;
      case ClanWarStatus.TRUCE:
        return <Badge variant="info">Truce</Badge>;
      default:
        return null;
    }
  };

  const timeSinceStart = war.startedAt 
    ? Math.floor((Date.now() - new Date(war.startedAt).getTime()) / (1000 * 60 * 60))
    : 0;

  return (
    <div className={`border rounded-none p-4 ${
      war.status === ClanWarStatus.ACTIVE 
        ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]' 
        : 'bg-glass-light border-glass-border'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-[color:var(--nn-magenta)]" />
          <span className="font-semibold text-[color:var(--nn-text-primary)]">
            {isAttacker ? 'Attacking' : 'Defending'} vs Clan {opponentId.slice(0, 8)}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* War Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-text-secondary">Your Wins:</span>
          <span className="text-[color:var(--nn-green)] ml-2 font-semibold">
            {isAttacker ? war.stats.attackerBattlesWon : war.stats.defenderBattlesWon}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Their Wins:</span>
          <span className="text-[color:var(--nn-magenta)] ml-2 font-semibold">
            {isAttacker ? war.stats.defenderBattlesWon : war.stats.attackerBattlesWon}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Territory Gained:</span>
          <span className="text-[color:var(--nn-cyan)] ml-2 font-semibold">
            +{isAttacker ? war.stats.attackerTerritoryGained : war.stats.defenderTerritoryGained}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Territory Lost:</span>
          <span className="text-[color:var(--nn-amber)] ml-2 font-semibold">
            -{isAttacker ? war.stats.defenderTerritoryGained : war.stats.attackerTerritoryGained}
          </span>
        </div>
      </div>

      {/* War Duration */}
      {war.status === ClanWarStatus.ACTIVE && (
        <div className="mt-3 pt-3 border-t border-glass-border flex items-center gap-2 text-sm text-text-secondary">
          <Clock className="w-4 h-4" />
          <span>Duration: {timeSinceStart}h</span>
        </div>
      )}

      {/* Winner Display */}
      {war.status === ClanWarStatus.ENDED && war.winner && (
        <div className="mt-3 pt-3 border-t border-glass-border">
          {war.winner === currentClanId ? (
            <div className="flex items-center gap-2 text-[color:var(--nn-green)]">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">Victory!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[color:var(--nn-magenta)]">
              <XCircle className="w-4 h-4" />
              <span className="font-semibold">Defeat</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Alliances Tab Component
 */
interface AlliancesTabProps {
  alliances: any[];
  clan: Clan;
  canManageWars: boolean;
  isLoading: boolean;
  onCreateAlliance: () => void;
  onRefresh: () => void;
}

function AlliancesTab({ alliances, clan, canManageWars, isLoading, onCreateAlliance, onRefresh }: AlliancesTabProps) {
  return (
    <div className="space-y-4">
      {/* Action Button */}
      {canManageWars && (
        <Button onClick={onCreateAlliance} className="w-full gap-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)]">
          <Handshake className="w-4 h-4" />
          Propose Alliance
        </Button>
      )}

      {/* Alliance Benefits */}
      <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-3">
        <p className="text-sm text-[color:var(--nn-green)] mb-2 font-medium">Alliance Benefits:</p>
        <ul className="text-xs text-text-secondary space-y-1">
          <li>• Cannot declare war on allied clans</li>
          <li>• Shared intelligence on enemy movements</li>
          <li>• Coordinated warfare strategies</li>
          <li>• Mutual defense pacts</li>
        </ul>
      </div>

      {/* Alliances List */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">
          <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
          <p>Loading alliances...</p>
        </div>
      ) : alliances.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-secondary mb-2">No active alliances</p>
          {canManageWars && (
            <p className="text-sm text-text-secondary">
              Form alliances to strengthen your clan{"'"}s position
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {alliances.map(alliance => (
            <AllianceCard
              key={alliance._id?.toString() || alliance.allianceId}
              alliance={alliance}
              currentClanId={clan._id!.toString()}
              canManage={canManageWars}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Alliance Card Component
 */
interface AllianceCardProps {
  alliance: any;
  currentClanId: string;
  canManage: boolean;
  onRefresh: () => void;
}

function AllianceCard({ alliance, currentClanId, canManage, onRefresh }: AllianceCardProps) {
  const alliedClanIds = alliance.clanIds?.filter((id: string) => id !== currentClanId) || [];
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(alliance.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleBreakAlliance = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to break this alliance? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/clan/alliance/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: currentClanId,
          allianceId: alliance._id?.toString()
        })
      });

      if (!response.ok) throw new Error('Failed to break alliance');

      const data = await response.json();
      toast.success(data.message || 'Alliance broken');
      onRefresh();
    } catch (error) {
      console.error('Error breaking alliance:', error);
      toast.error('Failed to break alliance');
    }
  };

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-[color:var(--nn-green)]" />
          <span className="font-semibold text-[color:var(--nn-text-primary)]">
            Alliance with {alliedClanIds.length} clan{alliedClanIds.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Badge variant="success">Active</Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-text-secondary">Allied Clans:</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {alliedClanIds.map((clanId: string) => (
              <Badge key={clanId} variant="info" className="text-xs">
                {clanId.slice(0, 8)}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="text-text-secondary">Duration:</span>
          <span className="text-text-primary ml-2">{daysSinceCreation}d</span>
        </div>
        {alliance.terms && (
          <div>
            <span className="text-text-secondary">Terms:</span>
            <p className="text-text-secondary mt-1 text-xs">{alliance.terms}</p>
          </div>
        )}
      </div>

      {canManage && (
        <div className="mt-3 pt-3 border-t border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]">
          <Button
            onClick={handleBreakAlliance}
            variant="ghost"
            className="w-full text-[color:var(--nn-magenta)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"
          >
            <X className="w-4 h-4 mr-2" />
            Break Alliance
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Declare War Modal
 */
interface DeclareWarModalProps {
  clanId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function DeclareWarModal({ clanId, onClose, onSuccess }: DeclareWarModalProps) {
  const [targetClanId, setTargetClanId] = useState('');
  const [isDeclaring, setIsDeclaring] = useState(false);

  const handleDeclare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetClanId.trim()) {
      toast.error('Please enter a target clan ID');
      return;
    }

    setIsDeclaring(true);
    try {
      const response = await fetch('/api/clan/war/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attackerClanId: clanId,
          defenderClanId: targetClanId.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to declare war');
      }

      const data = await response.json();
      toast.success(data.message || 'War declared!');
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error declaring war:', error);
      toast.error(getErrorMessage(error) || 'Failed to declare war');
    } finally {
      setIsDeclaring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-glass-dark border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[color:var(--nn-text-primary)] mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-[color:var(--nn-magenta)]" />
          Declare War
        </h2>

        <form onSubmit={handleDeclare} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">
              Target Clan ID
            </label>
            <Input
              placeholder="Enter clan ID to attack..."
              value={targetClanId}
              onChange={(e) => setTargetClanId(e.target.value)}
              required
            />
          </div>

          {/* War Costs */}
          <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3">
            <p className="text-sm text-[color:var(--nn-magenta)] mb-2 font-medium">Declaration Cost:</p>
            <div className="space-y-1 text-sm text-text-secondary">
              <div>• 2,000 Metal</div>
              <div>• 2,000 Energy</div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[color:var(--nn-amber)] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-text-secondary">
                <p className="text-[color:var(--nn-amber)] font-medium mb-1">Warning:</p>
                <p>War is costly and risky. Ensure your clan is prepared for battle.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="flex-1"
              disabled={isDeclaring}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)]"
              disabled={isDeclaring}
            >
              {isDeclaring ? (
                <>Declaring...</>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  Declare War
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Create Alliance Modal
 */
interface CreateAllianceModalProps {
  clanId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateAllianceModal({ clanId, onClose, onSuccess }: CreateAllianceModalProps) {
  const [allyClanId, setAllyClanId] = useState('');
  const [terms, setTerms] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allyClanId.trim()) {
      toast.error('Please enter an ally clan ID');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/clan/alliance/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanIds: [clanId, allyClanId.trim()],
          terms: terms.trim() || 'Mutual defense and cooperation'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create alliance');
      }

      const data = await response.json();
      toast.success(data.message || 'Alliance created!');
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating alliance:', error);
      toast.error(getErrorMessage(error) || 'Failed to create alliance');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-glass-dark border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[color:var(--nn-text-primary)] mb-4 flex items-center gap-2">
          <Handshake className="w-5 h-5 text-[color:var(--nn-green)]" />
          Propose Alliance
        </h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">
              Ally Clan ID
            </label>
            <Input
              placeholder="Enter clan ID to ally with..."
              value={allyClanId}
              onChange={(e) => setAllyClanId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">
              Alliance Terms (Optional)
            </label>
            <textarea
              placeholder="Enter alliance terms and conditions..."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              className="w-full bg-glass-light border border-glass-border rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Benefits */}
          <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-3">
            <p className="text-sm text-[color:var(--nn-green)] mb-2 font-medium">Alliance Benefits:</p>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• Cannot declare war on each other</li>
              <li>• Coordinated military strategies</li>
              <li>• Shared intelligence network</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="flex-1"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)]"
              disabled={isCreating}
            >
              {isCreating ? (
                <>Creating...</>
              ) : (
                <>
                  <Handshake className="w-4 h-4" />
                  Propose Alliance
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
