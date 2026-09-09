/**
 * @file components/clan/ClanPanel.tsx
 * @created 2025-10-19
 * @overview Main clan interface with tabbed navigation for all clan features
 * 
 * OVERVIEW:
 * Comprehensive clan management panel providing access to all clan features including:
 * - Clan overview and statistics
 * - Member management and roles
 * - Bank operations and fund distribution
 * - Territory control and management
 * - Warfare and battle management
 * - Research tree progression
 * - Perk system activation
 * 
 * Handles both "no clan" state (create/join options) and "has clan" state
 * (full management interface). Integrates with all clan services via API routes.
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 1 - Core Clan UI Components
 * - Keyboard shortcut: C key to toggle panel
 * - Permission-based UI (leader/co-leader/officer/member)
 * - Real-time updates via context refresh
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';
import { useGameContext } from '@/context/GameContext';

import { 
  Users, 
  Crown, 
  Shield, 
  Coins, 
  Map, 
  Swords, 
  Beaker, 
  Sparkles,
  UserPlus,
  LogOut,
  Info,
  TrendingUp,
  Calendar,

  Loader2,
  UserCog,
  Wallet,
  Check,
  X,
  AlertCircle,
  
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan } from '@/types/clan.types';
import { ClanRole } from '@/types/clan.types';
import type { SanitizedPlayer } from '@/types/game.types';


import ClanMembersPanel from './ClanMembersPanel';
import ClanBankPanel from './ClanBankPanel';
import ClanTerritoryPanel from './ClanTerritoryPanel';
import ClanWarfarePanel from './ClanWarfarePanel';
import ClanChatPanel from './ClanChatPanel';

interface ClanPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClanPanel({ isOpen }: ClanPanelProps) {
  const { player, refreshPlayer } = useGameContext();
  const [isLoading, setIsLoading] = useState(false);
  const [clanData, setClanData] = useState<Clan | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'create' | 'join'>('main');

  /**
   * Fetches comprehensive clan data from API
   */
  const fetchClanData = useCallback(async () => {
    if (!player?.clanId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/clan/${player.clanId}`);
      if (!response.ok) throw new Error('Failed to fetch clan data');
      
      const data = await response.json();
      setClanData(data.clan);
    } catch (error) {
      console.error('Error fetching clan data:', error);
      toast.error('Failed to load clan information');
    } finally {
      setIsLoading(false);
    }
  }, [player?.clanId]);

  // Fetch clan data if player is in a clan
  useEffect(() => {
    if (player?.clanId && isOpen) {
      fetchClanData();
    }
  }, [player?.clanId, isOpen, fetchClanData]);

  /**
   * Handles successful clan creation or join
   */
  const handleClanSuccess = async () => {
    setViewMode('main');
    await refreshPlayer();
    await fetchClanData();
  };

  /**
   * Handles leaving the clan with confirmation
   */
  const handleLeaveClan = async () => {
    if (!player?.clanId) return;

    // Confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to leave this clan? You will lose access to all clan benefits and resources.'
    );
    
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/clan/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username })
      });

      if (!response.ok) throw new Error('Failed to leave clan');

      const data = await response.json();
      toast.success(data.message || 'Successfully left the clan');
      
      await refreshPlayer();
      setClanData(null);
    } catch (error) {
      console.error('Error leaving clan:', error);
      toast.error('Failed to leave clan');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        title="Clan Management"
        className="fixed right-4 top-20 w-[600px] max-h-[calc(100vh-8rem)] overflow-y-auto z-50 nn-panel"
      >
        {isLoading || !player ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
          </div>
        ) : !player.clanId ? (
          // NO CLAN STATE - Show appropriate view based on mode
          viewMode === 'create' ? (
            <CreateClanView
              player={player}
              onBack={() => setViewMode('main')}
              onSuccess={handleClanSuccess}
            />
          ) : viewMode === 'join' ? (
            <JoinClanView
              player={player}
              onBack={() => setViewMode('main')}
              onSuccess={handleClanSuccess}
            />
          ) : (
            <NoClanView 
              onCreateClick={() => setViewMode('create')}
              onJoinClick={() => setViewMode('join')}
            />
          )
        ) : (
          // HAS CLAN STATE - Full Management Interface
          <ClanManagementView
            player={player}
            clanData={clanData}
            onLeaveClan={handleLeaveClan}
            onRefresh={fetchClanData}
          />
        )}
      </div>
    </>
  );
}

/**
 * No Clan View - Displayed when player is not in a clan
 */
interface NoClanViewProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

function NoClanView({ onCreateClick, onJoinClick }: NoClanViewProps) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-none bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
            <Users className="w-10 h-10 text-[color:var(--nn-violet)]" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)] mb-2">
              You{"'"}re Not in a Clan
            </h3>
            <p className="nn-text-secondary text-sm max-w-md mx-auto">
              Join forces with other players or create your own clan to unlock exclusive benefits,
              territory control, and cooperative gameplay features.
            </p>
          </div>
        </div>
      </div>

      <div className="nn-divider"  />

      <div>
        <div className="space-y-3">
          <button className="nn-btn nn-btn--primary"
            onClick={onCreateClick} >
            <Crown className="w-5 h-5 mr-2" />
            Create New Clan
          </button>
          
          <button className="nn-btn"
            onClick={onJoinClick} >
            <UserPlus className="w-5 h-5 mr-2" />
            Join Existing Clan
          </button>
        </div>
      </div>

      <div className="nn-divider"  />

      <div>
        <div className="nn-surface rounded-none p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[color:var(--nn-cyan)]" />
            Clan Benefits
          </h4>
          <ul className="text-sm nn-text-secondary space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--nn-green)] mt-0.5">✓</span>
              <span>Shared resources and clan bank</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--nn-green)] mt-0.5">✓</span>
              <span>Territory control and passive income</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--nn-green)] mt-0.5">✓</span>
              <span>Cooperative research and perks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--nn-green)] mt-0.5">✓</span>
              <span>Clan warfare and alliances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--nn-green)] mt-0.5">✓</span>
              <span>Exclusive clan chat and coordination</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Clan Management View - Full interface when player is in a clan
 */
interface ClanManagementViewProps {
  player: SanitizedPlayer;
  clanData: Clan | null;
  onLeaveClan: () => void;
  onRefresh: () => void;
}

type ClanTab = 'overview' | 'members' | 'bank' | 'territory' | 'warfare' | 'social' | 'research' | 'perks';

function ClanManagementView({
  player,
  clanData,
  onLeaveClan,
  onRefresh
}: ClanManagementViewProps) {
  const [activeTab, setActiveTab] = useState<ClanTab>('overview');

  if (!clanData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
      </div>
    );
  }

  // Determine player's role and permissions
  const playerMember = clanData.members.find(m => m.username === player.username);
  const playerRole = playerMember?.role || ClanRole.MEMBER;
  const _isLeader = playerRole === ClanRole.LEADER;
  const _isCoLeader = playerRole === ClanRole.CO_LEADER;
  const _isOfficer = playerRole === ClanRole.OFFICER;

  return (
    <div className="h-full w-full flex flex-col space-y-4 p-4">
      {/* Clan Header */}
      <ClanHeader
        clan={clanData}
        playerRole={playerRole}
        onLeaveClan={onLeaveClan}
      />

      <div className="nn-divider"  />

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        <TabButton
          icon={<Info className="w-4 h-4" />}
          label="Overview"
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          icon={<UserCog className="w-4 h-4" />}
          label="Members"
          active={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          badge={clanData.members.length}
        />
        <TabButton
          icon={<Wallet className="w-4 h-4" />}
          label="Bank"
          active={activeTab === 'bank'}
          onClick={() => setActiveTab('bank')}
        />
        <TabButton
          icon={<Map className="w-4 h-4" />}
          label="Territory"
          active={activeTab === 'territory'}
          onClick={() => setActiveTab('territory')}
        />
        <TabButton
          icon={<Swords className="w-4 h-4" />}
          label="Warfare"
          active={activeTab === 'warfare'}
          onClick={() => setActiveTab('warfare')}
        />
        <TabButton
          icon={<Users className="w-4 h-4" />}
          label="Social"
          active={activeTab === 'social'}
          onClick={() => setActiveTab('social')}
        />
        <TabButton
          icon={<Beaker className="w-4 h-4" />}
          label="Research"
          active={activeTab === 'research'}
          onClick={() => setActiveTab('research')}
          disabled
        />
        <TabButton
          icon={<Sparkles className="w-4 h-4" />}
          label="Perks"
          active={activeTab === 'perks'}
          onClick={() => setActiveTab('perks')}
          disabled
        />
      </div>

      <div className="nn-divider"  />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <OverviewSection clan={clanData} />
        )}
        {activeTab === 'members' && (
          <ClanMembersPanel
            clan={clanData}
            currentUserRole={playerRole}
            currentUsername={player.username}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'bank' && (
          <ClanBankPanel
            clan={clanData}
            currentUserRole={playerRole}
            playerResources={{
              metal: player.resources?.metal || 0,
              energy: player.resources?.energy || 0,
              researchPoints: player.researchPoints
            }}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'territory' && (
          <ClanTerritoryPanel
            clan={clanData}
            currentUserRole={playerRole}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'warfare' && (
          <ClanWarfarePanel
            clan={clanData}
            currentUserRole={playerRole}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'social' && (
          <ClanChatPanel
            clanId={clanData._id?.toString() || player.clanId || ''}
            currentUserId={player.username}
            currentUserRole={playerRole}
          />
        )}
        {activeTab === 'research' && (
          <ComingSoonTab feature="Clan Research" />
        )}
        {activeTab === 'perks' && (
          <ComingSoonTab feature="Clan Perks" />
        )}
      </div>
    </div>
  );
}

/**
 * Tab Button Component
 */
interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
}

function TabButton({ icon, label, active, onClick, badge, disabled }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-none border transition-all
        ${active 
          ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]' 
          : disabled
          ? 'nn-surface border-[color:var(--nn-glass-border)] nn-text-tertiary cursor-not-allowed'
          : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary hover:nn-surface border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {badge !== undefined && (
        <span className="nn-chip nn-chip--cyan text-xs">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Coming Soon Tab Placeholder
 */
interface ComingSoonTabProps {
  feature: string;
}

function ComingSoonTab({ feature }: ComingSoonTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Shield className="w-16 h-16 nn-text-tertiary mb-4" />
      <h3 className="text-lg font-semibold nn-text-secondary mb-2">{feature}</h3>
      <p className="text-sm nn-text-secondary">Coming in Phase 3-4</p>
    </div>
  );
}

/**
 * Clan Header - Displays clan name, level, and quick actions
 */
interface ClanHeaderProps {
  clan: Clan;
  playerRole: ClanRole;
  onLeaveClan: () => void;
}

function ClanHeader({ clan, playerRole, onLeaveClan }: ClanHeaderProps) {
  const getRoleBadgeColor = (role: ClanRole) => {
    switch (role) {
      case ClanRole.LEADER: return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-amber)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]';
      case ClanRole.CO_LEADER: return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-amber)] border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]';
      case ClanRole.OFFICER: return 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-cyan)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]';
      case ClanRole.ELITE: return 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-violet)] border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]';
      default: return 'nn-surface nn-text-secondary border-[color:var(--nn-glass-border)]';
    }
  };

  return (
    <div className="bg-gradient-to-br from-[color:var(--nn-violet)] to-[color:var(--nn-cyan)] rounded-none p-4 border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">{clan.name}</h2>
            <span className={`nn-chip ${getRoleBadgeColor(playerRole)} border px-2 py-0.5 text-xs font-semibold`}>
              {playerRole}
            </span>
          </div>
          
          <p className="text-sm nn-text-secondary line-clamp-2">
            {clan.description || 'No description provided'}
          </p>
        </div>

        <button className="nn-btn nn-btn--danger"
          onClick={onLeaveClan} >
          <LogOut className="w-4 h-4 mr-1" />
          Leave
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="nn-surface rounded-none p-2 text-center">
          <div className="text-xs nn-text-secondary mb-1">Level</div>
          <div className="text-lg font-bold text-[color:var(--nn-cyan)]">{clan.level.currentLevel}</div>
        </div>
        <div className="nn-surface rounded-none p-2 text-center">
          <div className="text-xs nn-text-secondary mb-1">Members</div>
          <div className="text-lg font-bold text-[color:var(--nn-violet)]">{clan.members.length}/{clan.maxMembers}</div>
        </div>
        <div className="nn-surface rounded-none p-2 text-center">
          <div className="text-xs nn-text-secondary mb-1">Territory</div>
          <div className="text-lg font-bold text-[color:var(--nn-green)]">{clan.territories?.length || 0}</div>
        </div>
        <div className="nn-surface rounded-none p-2 text-center">
          <div className="text-xs nn-text-secondary mb-1">Power</div>
          <div className="text-lg font-bold text-[color:var(--nn-magenta)]">{clan.stats.totalPower?.toLocaleString() || 0}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Overview Section - Clan statistics and general information
 */
function OverviewSection({ clan }: { clan: Clan }) {
  return (
    <div className="space-y-4">
      <div className="nn-surface rounded-none p-4">
        <h3 className="text-sm font-semibold text-[color:var(--nn-text-primary)] mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[color:var(--nn-cyan)]" />
          Clan Progress
        </h3>
        
        {/* XP Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs nn-text-secondary">
            <span>XP Progress</span>
            <span>{clan.level.currentLevelXP?.toLocaleString() || 0} / {clan.level.xpToNextLevel?.toLocaleString() || 1000} XP</span>
          </div>
          <div className="h-2 nn-surface rounded-none overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-cyan)] transition-all duration-500"
              style={{ width: `${Math.min(((clan.level.currentLevelXP || 0) / (clan.level.xpToNextLevel || 1000)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Founded"
          value={new Date(clan.createdAt).toLocaleDateString()}
        />
        <StatCard
          icon={<Crown className="w-5 h-5" />}
          label="Leader"
          value={clan.members.find(m => m.role === ClanRole.LEADER)?.username || 'Unknown'}
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Privacy"
          value={clan.settings.requiresApproval ? 'Private' : 'Public'}
        />
        <StatCard
          icon={<Coins className="w-5 h-5" />}
          label="Bank"
          value={`${((clan.bank?.treasury.metal || 0) + (clan.bank?.treasury.energy || 0)).toLocaleString()}`}
        />
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="nn-surface rounded-none p-3 flex items-center gap-3">
      <div className="text-[color:var(--nn-cyan)]">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs nn-text-secondary">{label}</div>
        <div className="text-sm font-semibold text-[color:var(--nn-text-primary)] truncate">{value}</div>
      </div>
    </div>
  );
}

/**
 * Create Clan View - Inline form for creating a new clan
 */
interface CreateClanViewProps {
  player: SanitizedPlayer;
  onBack: () => void;
  onSuccess: () => void;
}

function CreateClanView({ player, onBack, onSuccess }: CreateClanViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    minLevel: 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const CREATION_COSTS = { metal: 50000, energy: 50000, researchPoints: 100 };

  const validateName = (name: string): string | null => {
    if (name.length < 3) return 'Name must be at least 3 characters';
    if (name.length > 30) return 'Name must be at most 30 characters';
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) return 'Only letters, numbers, and spaces allowed';
    return null;
  };

  const checkNameAvailability = async (name: string) => {
    const validationError = validateName(name);
    if (validationError) {
      setNameAvailable(null);
      return;
    }

    setIsCheckingName(true);
    try {
      const response = await fetch(`/api/clan/check-name?name=${encodeURIComponent(name)}`);
      const data = await response.json();
      setNameAvailable(data.available);
    } catch {
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleChange = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
    if (field === 'name' && typeof value === 'string' && value) {
      checkNameAvailability(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;
    if (nameAvailable === false) newErrors.name = 'Clan name already taken';
    if (player.resources.metal < CREATION_COSTS.metal) newErrors.submit = 'Insufficient metal';
    if (player.resources.energy < CREATION_COSTS.energy) newErrors.submit = 'Insufficient energy';
    if (player.researchPoints < CREATION_COSTS.researchPoints) newErrors.submit = 'Insufficient RP';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player.username,
          name: formData.name.trim(),
          description: formData.description.trim(),
          isPublic: formData.isPublic,
          minLevel: formData.minLevel,
          minPower: 0
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create clan');

      toast.success('Clan created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Failed to create clan');
      setErrors({ submit: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canAfford = player.resources.metal >= CREATION_COSTS.metal &&
    player.resources.energy >= CREATION_COSTS.energy &&
    player.researchPoints >= CREATION_COSTS.researchPoints;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button */}
      <div>
        <button
          onClick={onBack} className="nn-btn nn-btn--ghost mb-2"
        >
          ← Back
        </button>
      </div>

      {/* Cost Display */}
      <div>
        <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
          <h3 className="text-sm font-semibold text-[color:var(--nn-text-primary)] mb-3 flex items-center gap-2">
            <Coins className="w-4 h-4 text-[color:var(--nn-amber)]" />
            Creation Cost
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xs nn-text-secondary mb-1">Metal</div>
              <div className={`text-lg font-bold ${player.resources.metal >= CREATION_COSTS.metal ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                {CREATION_COSTS.metal.toLocaleString()}
              </div>
              <div className="text-xs nn-text-secondary">Have: {player.resources.metal.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs nn-text-secondary mb-1">Energy</div>
              <div className={`text-lg font-bold ${player.resources.energy >= CREATION_COSTS.energy ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                {CREATION_COSTS.energy.toLocaleString()}
              </div>
              <div className="text-xs nn-text-secondary">Have: {player.resources.energy.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs nn-text-secondary mb-1">RP</div>
              <div className={`text-lg font-bold ${player.researchPoints >= CREATION_COSTS.researchPoints ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                {CREATION_COSTS.researchPoints}
              </div>
              <div className="text-xs nn-text-secondary">Have: {player.researchPoints}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Clan Name */}
        <div>
          <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
            Clan Name <span className="text-[color:var(--nn-magenta)]">*</span>
          </label>
          <div className="relative">
            <input className="nn-input"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter clan name (3-30 characters)"
              maxLength={30}
             />
            {formData.name.length >= 3 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingName ? (
                  <Loader2 className="nn-spin-icon w-5 h-5 text-[color:var(--nn-cyan)]" />
                ) : nameAvailable === true ? (
                  <Check className="w-5 h-5 text-[color:var(--nn-green)]" />
                ) : nameAvailable === false ? (
                  <X className="w-5 h-5 text-[color:var(--nn-magenta)]" />
                ) : null}
              </div>
            )}
          </div>
          {errors.name && (
            <p className="text-[color:var(--nn-magenta)] text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.name}
            </p>
          )}
          <p className="nn-text-secondary text-xs mt-1">{formData.name.length}/30 characters</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe your clan's purpose and goals..."
            className="w-full px-4 py-2 nn-surface border border-[color:var(--nn-glass-border)] rounded-none text-[color:var(--nn-text-primary)] placeholder-text-secondary focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            rows={3}
            maxLength={500}
          />
          <p className="nn-text-secondary text-xs mt-1">{formData.description.length}/500 characters</p>
        </div>

        {/* Privacy & Min Level */}
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">Privacy</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('isPublic', true)}
                  className={`flex-1 px-3 py-2 rounded-none border text-sm transition-colors ${
                    formData.isPublic ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] text-[color:var(--nn-green)]' : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('isPublic', false)}
                  className={`flex-1 px-3 py-2 rounded-none border text-sm transition-colors ${
                    !formData.isPublic ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] text-[color:var(--nn-violet)]' : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary'
                  }`}
                >
                  Private
                </button>
              </div>
              <p className="text-xs nn-text-secondary mt-1">{formData.isPublic ? 'Anyone can join' : 'Requires approval'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">Minimum Level</label>
              <input className="nn-input"
                type="number"
                value={formData.minLevel}
                onChange={(e) => handleChange('minLevel', parseInt(e.target.value) || 1)}
                min={1}
                max={50}
               />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div>
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[color:var(--nn-magenta)] flex-shrink-0" />
              <p className="text-[color:var(--nn-magenta)] text-sm">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div>
          <div className="flex gap-3">
            <button className="nn-btn" type="button" onClick={onBack} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="nn-btn nn-btn--primary"
              type="submit" disabled={isSubmitting || !canAfford || nameAvailable === false || formData.name.length < 3} >
              Create Clan
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Join Clan View - Inline search and join interface
 */
/**
 * Clan DTO returned by GET /api/clan/search (documented response contract):
 * { success, clans: [{_id, name, tag, description, memberCount, maxMembers,
 *   leaderUsername, level}], totalPages, total }.
 */
interface ClanSearchResult {
  _id: string;
  name: string;
  tag: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  leaderUsername: string;
  level: number;
}

interface JoinClanViewProps {
  player: SanitizedPlayer;
  onBack: () => void;
  onSuccess: () => void;
}

function JoinClanView({ player, onBack, onSuccess }: JoinClanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [clans, setClans] = useState<ClanSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchClans();
  }, []);

  const fetchClans = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clan/search');
      const data = await response.json();
      if (data.success) {
        setClans(data.clans);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (clanId: string) => {
    setIsJoining(true);
    try {
      const response = await fetch('/api/clan/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username, clanId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to join clan');

      toast.success('Successfully joined clan!');
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Failed to join clan');
    } finally {
      setIsJoining(false);
    }
  };

  const filteredClans = clans.filter(clan =>
    clan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 p-6">
      {/* Back Button */}
      <div>
        <button onClick={onBack} className="nn-btn nn-btn--ghost mb-2">
          ← Back
        </button>
      </div>

      {/* Search */}
      <div>
        <input className="nn-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search clans..."
         />
      </div>

      {/* Clan List */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
          </div>
        ) : filteredClans.length === 0 ? (
          <div className="text-center py-12">
            <p className="nn-text-secondary">No clans found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filteredClans.map(clan => (
              <div key={clan._id} className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-[color:var(--nn-text-primary)] font-bold">{clan.name}</h4>
                    <p className="text-sm nn-text-secondary">{clan.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm nn-text-secondary">
                    {clan.memberCount}/{clan.maxMembers} members • Level {clan.level}
                  </div>
                  <button className="nn-btn nn-btn--primary"
                    onClick={() => handleJoin(clan._id)} disabled={isJoining}
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
