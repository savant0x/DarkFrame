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

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { 
  Panel, 
  Button, 
  Badge, 
  Divider,
  Input
} from '@/components/ui';
import { StaggerChildren, StaggerItem } from '@/components/transitions';
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
  MapPin,
  Loader2,
  UserCog,
  Wallet,
  Check,
  X,
  AlertCircle,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan } from '@/types/clan.types';
import { ClanRole } from '@/types/clan.types';
import JoinClanModal from './JoinClanModal';
import ClanMembersPanel from './ClanMembersPanel';
import ClanBankPanel from './ClanBankPanel';
import ClanTerritoryPanel from './ClanTerritoryPanel';
import ClanWarfarePanel from './ClanWarfarePanel';
import ClanChatPanel from './ClanChatPanel';

interface ClanPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClanPanel({ isOpen, onClose }: ClanPanelProps) {
  const { player, refreshPlayer } = useGameContext();
  const [isLoading, setIsLoading] = useState(false);
  const [clanData, setClanData] = useState<Clan | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'create' | 'join'>('main');

  // Fetch clan data if player is in a clan
  useEffect(() => {
    if (player?.clanId && isOpen) {
      fetchClanData();
    }
  }, [player?.clanId, isOpen]);

  /**
   * Fetches comprehensive clan data from API
   */
  const fetchClanData = async () => {
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
  };

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
      <Panel
        title="Clan Management"
        icon={<Users className="w-5 h-5" />}
        className="fixed right-4 top-20 w-[600px] max-h-[calc(100vh-8rem)] overflow-y-auto z-50"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : !player?.clanId ? (
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
      </Panel>
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
    <StaggerChildren className="space-y-6 p-6">
      <StaggerItem>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 border-2 border-purple-500/30">
            <Users className="w-10 h-10 text-purple-400" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-2">
              You're Not in a Clan
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Join forces with other players or create your own clan to unlock exclusive benefits,
              territory control, and cooperative gameplay features.
            </p>
          </div>
        </div>
      </StaggerItem>

      <Divider />

      <StaggerItem>
        <div className="space-y-3">
          <Button
            onClick={onCreateClick}
            variant="primary"
            fullWidth
            size="lg"
          >
            <Crown className="w-5 h-5 mr-2" />
            Create New Clan
          </Button>
          
          <Button
            onClick={onJoinClick}
            variant="secondary"
            fullWidth
            size="lg"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Join Existing Clan
          </Button>
        </div>
      </StaggerItem>

      <Divider />

      <StaggerItem>
        <div className="bg-slate-800/30 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            Clan Benefits
          </h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Shared resources and clan bank</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Territory control and passive income</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Cooperative research and perks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Clan warfare and alliances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Exclusive clan chat and coordination</span>
            </li>
          </ul>
        </div>
      </StaggerItem>
    </StaggerChildren>
  );
}

/**
 * Clan Management View - Full interface when player is in a clan
 */
interface ClanManagementViewProps {
  player: any;
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
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // Determine player's role and permissions
  const playerMember = clanData.members.find(m => m.username === player.username);
  const playerRole = playerMember?.role || ClanRole.MEMBER;
  const isLeader = playerRole === ClanRole.LEADER;
  const isCoLeader = playerRole === ClanRole.CO_LEADER;
  const isOfficer = playerRole === ClanRole.OFFICER;

  return (
    <div className="h-full w-full flex flex-col space-y-4 p-4">
      {/* Clan Header */}
      <ClanHeader
        clan={clanData}
        playerRole={playerRole}
        onLeaveClan={onLeaveClan}
      />

      <Divider />

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

      <Divider />

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
              researchPoints: player.research?.researchPoints || 0
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
            currentUserId={player.id}
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
        flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
        ${active 
          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
          : disabled
          ? 'bg-gray-800/30 border-gray-700/30 text-gray-600 cursor-not-allowed'
          : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:border-cyan-500/30 hover:text-cyan-400'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {badge !== undefined && (
        <Badge variant="info" className="text-xs">
          {badge}
        </Badge>
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
      <Shield className="w-16 h-16 text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-400 mb-2">{feature}</h3>
      <p className="text-sm text-gray-500">Coming in Phase 3-4</p>
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
      case ClanRole.LEADER: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case ClanRole.CO_LEADER: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case ClanRole.OFFICER: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case ClanRole.ELITE: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-500/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-white">{clan.name}</h2>
            <Badge className={`${getRoleBadgeColor(playerRole)} border px-2 py-0.5 text-xs font-semibold`}>
              {playerRole}
            </Badge>
          </div>
          
          <p className="text-sm text-gray-400 line-clamp-2">
            {clan.description || 'No description provided'}
          </p>
        </div>

        <Button
          onClick={onLeaveClan}
          variant="danger"
          size="sm"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Leave
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-1">Level</div>
          <div className="text-lg font-bold text-cyan-400">{clan.level.currentLevel}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-1">Members</div>
          <div className="text-lg font-bold text-purple-400">{clan.members.length}/{clan.maxMembers}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-1">Territory</div>
          <div className="text-lg font-bold text-green-400">{clan.territories?.length || 0}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-1">Power</div>
          <div className="text-lg font-bold text-red-400">{clan.stats.totalPower?.toLocaleString() || 0}</div>
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
      <div className="bg-slate-800/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Clan Progress
        </h3>
        
        {/* XP Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>XP Progress</span>
            <span>{clan.level.currentLevelXP?.toLocaleString() || 0} / {clan.level.xpToNextLevel?.toLocaleString() || 1000} XP</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
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
    <div className="bg-slate-800/30 rounded-lg p-3 flex items-center gap-3">
      <div className="text-cyan-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-semibold text-white truncate">{value}</div>
      </div>
    </div>
  );
}

/**
 * Create Clan View - Inline form for creating a new clan
 */
interface CreateClanViewProps {
  player: any;
  onBack: () => void;
  onSuccess: () => void;
}

function CreateClanView({ player, onBack, onSuccess }: CreateClanViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: '',
    isPublic: true,
    minLevel: 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const METAL_COST = 1500000;
  const ENERGY_COST = 1500000;

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
    } catch (error) {
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
    if (field === 'name' && value) {
      checkNameAvailability(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;
    if (nameAvailable === false) newErrors.name = 'Clan name already taken';
    if (player.resources.metal < METAL_COST) newErrors.submit = 'Insufficient metal';
    if (player.resources.energy < ENERGY_COST) newErrors.submit = 'Insufficient energy';

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
          name: formData.name.trim(),
          tag: formData.tag.trim() || undefined,
          description: formData.description.trim(),
          isPublic: formData.isPublic,
          minLevel: formData.minLevel,
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create clan');

      toast.success('Clan created successfully!');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create clan');
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canAfford = player.resources.metal >= METAL_COST &&
    player.resources.energy >= ENERGY_COST;

  return (
    <StaggerChildren className="space-y-6 p-6">
      {/* Back Button */}
      <StaggerItem>
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="mb-2"
        >
          ← Back
        </Button>
      </StaggerItem>

      {/* Cost Display */}
      <StaggerItem>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            Creation Cost
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Metal</div>
              <div className={`text-lg font-bold ${player.resources.metal >= METAL_COST ? 'text-green-400' : 'text-red-400'}`}>
                {METAL_COST.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Have: {player.resources.metal.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Energy</div>
              <div className={`text-lg font-bold ${player.resources.energy >= ENERGY_COST ? 'text-green-400' : 'text-red-400'}`}>
                {ENERGY_COST.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Have: {player.resources.energy.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Clan Name */}
        <StaggerItem>
          <label className="block text-sm font-semibold text-white mb-2">
            Clan Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter clan name (3-30 characters)"
              maxLength={30}
            />
            {formData.name.length >= 3 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingName ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : nameAvailable === true ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : nameAvailable === false ? (
                  <X className="w-5 h-5 text-red-400" />
                ) : null}
              </div>
            )}
          </div>
          {errors.name && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.name}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-1">{formData.name.length}/30 characters</p>
        </StaggerItem>

        {/* Clan Tag */}
        <StaggerItem>
          <label className="block text-sm font-semibold text-white mb-2">
            Clan Tag <span className="text-gray-400 text-xs">(optional, auto-generated from name)</span>
          </label>
          <Input
            type="text"
            value={formData.tag}
            onChange={(e) => handleChange('tag', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="e.g. DARKW"
            maxLength={5}
          />
          <p className="text-gray-400 text-xs mt-1">2-5 uppercase letters/numbers</p>
        </StaggerItem>

        {/* Description */}
        <StaggerItem>
          <label className="block text-sm font-semibold text-white mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe your clan's purpose and goals..."
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            rows={3}
            maxLength={500}
          />
          <p className="text-gray-400 text-xs mt-1">{formData.description.length}/500 characters</p>
        </StaggerItem>

        {/* Privacy & Min Level */}
        <StaggerItem>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Privacy</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('isPublic', true)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    formData.isPublic ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-800 border-slate-600 text-gray-400'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('isPublic', false)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    !formData.isPublic ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-600 text-gray-400'
                  }`}
                >
                  Private
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{formData.isPublic ? 'Anyone can join' : 'Requires approval'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Minimum Level</label>
              <Input
                type="number"
                value={formData.minLevel}
                onChange={(e) => handleChange('minLevel', parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
            </div>
          </div>
        </StaggerItem>

        {/* Error Message */}
        {errors.submit && (
          <StaggerItem>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          </StaggerItem>
        )}

        {/* Action Buttons */}
        <StaggerItem>
          <div className="flex gap-3">
            <Button type="button" onClick={onBack} variant="secondary" fullWidth disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isSubmitting || !canAfford || nameAvailable === false || formData.name.length < 3}
              loading={isSubmitting}
            >
              Create Clan
            </Button>
          </div>
        </StaggerItem>
      </form>
    </StaggerChildren>
  );
}

/**
 * Join Clan View - Inline search and join interface
 */
interface JoinClanViewProps {
  player: any;
  onBack: () => void;
  onSuccess: () => void;
}

function JoinClanView({ player, onBack, onSuccess }: JoinClanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [clans, setClans] = useState<any[]>([]);
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to join clan');
    } finally {
      setIsJoining(false);
    }
  };

  const filteredClans = clans.filter(clan =>
    clan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <StaggerChildren className="space-y-4 p-6">
      {/* Back Button */}
      <StaggerItem>
        <Button onClick={onBack} variant="ghost" size="sm" className="mb-2">
          ← Back
        </Button>
      </StaggerItem>

      {/* Search */}
      <StaggerItem>
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search clans..."
        />
      </StaggerItem>

      {/* Clan List */}
      <StaggerItem>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : filteredClans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No clans found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filteredClans.map(clan => (
              <div key={clan._id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">{clan.name}</h4>
                    <p className="text-sm text-gray-400">{clan.description || 'No description'}</p>
                  </div>
                  <Badge variant={clan.settings?.requiresApproval ? 'default' : 'success'}>
                    {clan.settings?.requiresApproval ? 'Private' : 'Public'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {clan.members.length}/{clan.maxMembers} members • Level {clan.level.currentLevel}
                  </div>
                  <Button
                    onClick={() => handleJoin(clan._id)}
                    variant="primary"
                    size="sm"
                    disabled={isJoining}
                  >
                    Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </StaggerItem>
    </StaggerChildren>
  );
}
