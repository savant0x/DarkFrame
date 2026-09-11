
/**
 * @file components/clan/ClanManagementView.tsx
 * @created 2025-10-19
 * @overview Full-page clan management interface for in-game view
 * 
 * OVERVIEW:
 * Complete clan management interface that fills the game's center panel.
 * Shows either create/join options (no clan) or full management interface (has clan).
 * This is NOT a modal - it's a full-width page component that works with GameLayout.
 * 
 * IMPLEMENTATION NOTES:
 * - Replaces modal ClanPanel for in-game view
 * - Uses same components but in full-page layout
 * - Matches other game views (leaderboard, stats, etc.)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { RichTextEditor } from '@/components/ui';
import { SafeHtmlRenderer } from '@/components/SafeHtmlRenderer';
import { 
  Users, 
  Crown, 
  Shield, 
  Coins, 
  Map, 
  Swords, 

  Sparkles,
  UserPlus,
  LogOut,
  Info,
  TrendingUp,


  Loader2,
  
  Wallet,
  Check,
  X,
  AlertCircle,
  
} from 'lucide-react';
import { toast } from 'sonner';
import { CLAN_CONSTANTS, type Clan } from '@/types/clan.types';
import { ClanRole } from '@/types/clan.types';
import type { SanitizedPlayer } from '@/types/game.types';
import ClanMembersPanel from './ClanMembersPanel';
import ClanBankPanel from './ClanBankPanel';
import ClanTerritoryPanel from './ClanTerritoryPanel';
import ClanWarfarePanel from './ClanWarfarePanel';
import ClanChatPanel from './ClanChatPanel';

type ClanTab = 'overview' | 'members' | 'bank' | 'territory' | 'warfare' | 'research' | 'perks' | 'chat';

export default function ClanManagementView() {
  const { player, refreshPlayer } = useGameContext();
  const [isLoading, setIsLoading] = useState(false);
  const [clanData, setClanData] = useState<Clan | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'create' | 'join'>('main');

  // Fetch clan data if player is in a clan
  const fetchClanData = useCallback(async () => {
    if (!player?.clanId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/clan/${player.clanId}`);
      const data = await response.json();

      if (data.success) {
        setClanData(data.clan);
      } else {
        toast.error('Failed to load clan data');
      }
    } catch (error) {
      console.error('Error fetching clan data:', error);
      toast.error('Failed to load clan data');
    } finally {
      setIsLoading(false);
    }
  }, [player?.clanId]);

  useEffect(() => {
    if (player?.clanId) {
      fetchClanData();
    }
  }, [player?.clanId, fetchClanData]);

  const handleLeaveClan = async () => {
    if (!(await confirmDialog('Are you sure you want to leave this clan?'))) return;

    try {
      const response = await fetch('/api/clan/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player?.username })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to leave clan');
      }

      toast.success('Left clan successfully');
      await refreshPlayer();
      setClanData(null);
    } catch (error) {
      console.error('Error leaving clan:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to leave clan');
    }
  };

  const handleClanSuccess = async () => {
    setViewMode('main');
    await refreshPlayer();
    await fetchClanData();
  };

  if (!player) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
      </div>
    );
  }

  // NO CLAN - Show create/join interface
  if (!player.clanId) {
    if (viewMode === 'create') {
      return <CreateClanView player={player} onBack={() => setViewMode('main')} onSuccess={handleClanSuccess} />;
    }
    if (viewMode === 'join') {
      return <JoinClanView player={player} onBack={() => setViewMode('main')} onSuccess={handleClanSuccess} />;
    }
    return <NoClanView onCreateClick={() => setViewMode('create')} onJoinClick={() => setViewMode('join')} />;
  }

  // HAS CLAN - Show management interface
  return (
    <ClanManagementInterface
      player={player}
      clanData={clanData}
      onLeaveClan={handleLeaveClan}
      onRefresh={fetchClanData}
    />
  );
}

/**
 * No Clan View - Create or Join options
 */
interface NoClanViewProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

function NoClanView({ onCreateClick, onJoinClick }: NoClanViewProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-8">
        <div>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-none bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
              <Users className="w-12 h-12 text-[color:var(--nn-violet)]" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-[color:var(--nn-text-primary)] mb-3">
                You{"'"}re Not in a Clan
              </h2>
              <p className="nn-text-secondary text-lg max-w-2xl mx-auto">
                Join forces with other players or create your own clan to unlock exclusive benefits,
                territory control, and cooperative gameplay features.
              </p>
            </div>
          </div>
        </div>

        <div className="nn-divider"  />

        {/* Create / Join — nn-panel action cards (FID-029 §2.1: gradient slabs
            removed; create card shows the REAL service cost from CLAN_CONSTANTS,
            not a stale literal) */}
        <div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <button
              onClick={onCreateClick}
              className="nn-panel text-left p-6 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <Crown className="w-5 h-5" style={{ color: 'var(--nn-amber)' }} />
                <h3 className="nn-panel__title" style={{ fontSize: 16 }}>Create New Clan</h3>
              </div>
              <p className="nn-text-secondary text-sm mb-4">
                Found your own clan and lead it to glory. Recruit members and build your empire.
              </p>
              <div className="flex items-center gap-2">
                <span className="nn-chip nn-chip--violet">{CLAN_CONSTANTS.CREATION_COST.metal.toLocaleString()} Metal</span>
                <span className="nn-chip nn-chip--violet">{CLAN_CONSTANTS.CREATION_COST.energy.toLocaleString()} Energy</span>
              </div>
            </button>

            <button
              onClick={onJoinClick}
              className="nn-panel text-left p-6 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <UserPlus className="w-5 h-5" style={{ color: 'var(--nn-cyan)' }} />
                <h3 className="nn-panel__title" style={{ fontSize: 16 }}>Join Existing Clan</h3>
              </div>
              <p className="nn-text-secondary text-sm mb-4">
                Browse and join established clans. Find your place among fellow commanders.
              </p>
              <div className="flex items-center gap-2">
                <span className="nn-chip nn-chip--green">Free to join</span>
              </div>
            </button>
          </div>
        </div>

        <div>
          <div className="nn-surface rounded-none p-6 border border-[color:var(--nn-glass-border)]">
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[color:var(--nn-amber)]" />
              Clan Benefits
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Shared resources and clan bank</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Territory control and passive income</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Cooperative research and perks</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Clan warfare and alliances</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Exclusive clan chat and coordination</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[color:var(--nn-green)] mt-0.5 flex-shrink-0" />
                <span className="nn-text-primary">Leaderboard rankings and prestige</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Import the CreateClanView and JoinClanView from ClanPanel
// (These are the same components we just created)

/**
 * Create Clan View - Inline form
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
    description: ''
  });
  // FID-20260909-029 §2.1: required by CreateClanSchema (2–5, A-Z0-9; service
  // allows 2–6) — the in-game form previously never sent one.
  const [tag, setTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // FID-20260909-029 §2.1: single source of truth — the service charges
  // CLAN_CONSTANTS.CREATION_COST (1.5M/1.5M, no RP). The old literal
  // ({50K, 50K, 100 RP}) was dead pricing that produced false "Insufficient RP".
  const CREATION_COSTS = CLAN_CONSTANTS.CREATION_COST;

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

  // No formatting helpers needed - RichTextEditor handles it all

  const handleChange = (field: keyof typeof formData, value: string | number | boolean) => {
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
    if (!tag || tag.length < 2) newErrors.submit = 'Clan tag must be at least 2 characters';
    if (player.resources.metal < CREATION_COSTS.metal) newErrors.submit = 'Insufficient metal';
    if (player.resources.energy < CREATION_COSTS.energy) newErrors.submit = 'Insufficient energy';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // FID-20260909-029 §2.1: CreateClanSchema requires `tag` and strips
        // everything else — the old isPublic/minLevel/minPower fields never
        // persisted (no columns) and tag's absence 400'd every submit.
        body: JSON.stringify({
          name: formData.name.trim(),
          tag: tag.trim(),
          description: formData.description.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create clan');

      toast.success('Clan created successfully!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create clan';
      toast.error(message);
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canAfford = player.resources.metal >= CREATION_COSTS.metal &&
    player.resources.energy >= CREATION_COSTS.energy;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="space-y-6">
        {/* Back Button */}
        <div>
          <button className="nn-btn nn-btn--ghost" onClick={onBack} >
            ← Back
          </button>
        </div>

        {/* Header */}
        <div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[color:var(--nn-text-primary)] mb-2 flex items-center justify-center gap-3">
              <Crown className="w-8 h-8 text-[color:var(--nn-amber)]" />
              Create New Clan
            </h2>
            <p className="nn-text-secondary">Establish your clan and recruit members</p>
          </div>
        </div>

        {/* Cost Display */}
        <div>
          <div className="nn-surface rounded-none p-6 border border-[color:var(--nn-glass-border)]">
            <h3 className="text-sm font-semibold text-[color:var(--nn-text-primary)] mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4 text-[color:var(--nn-amber)]" />
              Creation Cost
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs nn-text-secondary mb-1">Metal</div>
                <div className={`text-xl font-bold ${player.resources.metal >= CREATION_COSTS.metal ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                  {CREATION_COSTS.metal.toLocaleString()}
                </div>
                <div className="text-xs nn-text-secondary">Have: {player.resources.metal.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs nn-text-secondary mb-1">Energy</div>
                <div className={`text-xl font-bold ${player.resources.energy >= CREATION_COSTS.energy ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                  {CREATION_COSTS.energy.toLocaleString()}
                </div>
                <div className="text-xs nn-text-secondary">Have: {player.resources.energy.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Clan Name */}
          <div>
            <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Clan Name <span className="text-[color:var(--nn-magenta)]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                placeholder="Enter clan name (3-30 characters)"
                maxLength={30}
                className="w-full px-4 py-3 pr-12 nn-surface border border-[color:var(--nn-glass-border)] rounded-none text-[color:var(--nn-text-primary)] placeholder-text-secondary focus:outline-none focus:border-cyan-500 transition-colors"
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
            
            {/* Rich Text Editor */}
            <RichTextEditor
              value={formData.description}
              onChange={(html) => handleChange('description', html)}
              maxLength={500}
              placeholder="Describe your clan's purpose, goals, and values... Format it to make it stand out!"
              minHeight="180px"
            />

            {/* Preview */}
            <div className="mt-2 nn-surface nn-surface--dark border border-[color:var(--nn-glass-border)] rounded-none p-3">
              <p className="text-xs nn-text-secondary mb-1">Preview:</p>
              <SafeHtmlRenderer 
                html={formData.description}
                fallback="Your clan description will appear here..."
                className="text-[color:var(--nn-text-primary)] text-sm"
              />
            </div>
          </div>

          {/* Clan Tag (schema-required: 2–5 chars, A-Z0-9) */}
          <div>
            <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Clan Tag <span className="text-[color:var(--nn-magenta)]">*</span>
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder="e.g. DW (2-5 letters/numbers)"
              maxLength={5}
              className="nn-input w-full"
            />
            <p className="text-xs nn-text-secondary mt-1">Short identifier shown next to your clan name. 2–5 uppercase letters/numbers.</p>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div>
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[color:var(--nn-magenta)] flex-shrink-0 mt-0.5" />
                <p className="text-[color:var(--nn-magenta)]">{errors.submit}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div>
            <div className="flex gap-4">
              <button className="nn-btn" type="button" onClick={onBack} disabled={isSubmitting} >
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
    </div>
  );
}

/**
 * Join Clan View - Browse and join clans
 */
interface JoinClanViewProps {
  player: SanitizedPlayer;
  onBack: () => void;
  onSuccess: () => void;
}

function JoinClanView({ player, onBack, onSuccess }: JoinClanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [clans, setClans] = useState<Clan[]>([]);
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
      toast.error(error instanceof Error ? error.message : 'Failed to join clan');
    } finally {
      setIsJoining(false);
    }
  };

  const filteredClans = clans.filter(clan =>
    clan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div>
          <button onClick={onBack} className="nn-btn nn-btn--ghost mb-4">
            ← Back
          </button>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[color:var(--nn-text-primary)] mb-2 flex items-center justify-center gap-3">
              <UserPlus className="w-8 h-8 text-[color:var(--nn-cyan)]" />
              Join a Clan
            </h2>
            <p className="nn-text-secondary">Browse and join established clans</p>
          </div>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            placeholder="Search clans by name..."
            className="nn-input text-lg"
           />
        </div>

        {/* Clan List */}
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="nn-spin-icon w-10 h-10 text-[color:var(--nn-cyan)]" />
            </div>
          ) : filteredClans.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 nn-text-tertiary mx-auto mb-4" />
              <p className="nn-text-secondary text-lg">No clans found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClans.map(clan => (
                <div key={clan._id} className="nn-surface rounded-none p-6 border border-[color:var(--nn-glass-border)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)]">{clan.name}</h3>
                        <span className={`nn-chip ${clan.settings?.requiresApproval ? '' : 'nn-chip--green'}`}>
                          {clan.settings?.requiresApproval ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <SafeHtmlRenderer 
                        html={clan.description || ''}
                        fallback="No description provided"
                        className="nn-text-secondary text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm nn-text-secondary">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{clan.members.length}/{clan.maxMembers} members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Level {clan.level.currentLevel}</span>
                      </div>
                      {clan.stats?.totalTerritories && clan.stats.totalTerritories > 0 && (
                        <div className="flex items-center gap-2">
                          <Map className="w-4 h-4" />
                          <span>{clan.stats.totalTerritories} territories</span>
                        </div>
                      )}
                    </div>
                    <button className="nn-btn nn-btn--primary"
                      onClick={() => clan._id && handleJoin(clan._id)} disabled={isJoining}
                    >
                      Join Clan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Clan Management Interface - Full management when player has clan
 */
interface ClanManagementInterfaceProps {
  player: SanitizedPlayer;
  clanData: Clan | null;
  onLeaveClan: () => void;
  onRefresh: () => void;
}

function ClanManagementInterface({
  player,
  clanData,
  onLeaveClan,
  onRefresh
}: ClanManagementInterfaceProps) {
  const [activeTab, setActiveTab] = useState<ClanTab>('overview');

  if (!clanData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="nn-spin-icon w-10 h-10 text-[color:var(--nn-cyan)]" />
      </div>
    );
  }

  const playerMember = clanData.members.find(m => m.username === player.username);
  const playerRole = playerMember?.role || ClanRole.MEMBER;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Clan Header */}
      <div className="bg-gradient-to-br from-[color:var(--nn-violet)] to-[color:var(--nn-cyan)] rounded-none p-6 border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-none bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[color:var(--nn-violet)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[color:var(--nn-text-primary)] mb-1">{clanData.name}</h1>
              <p className="nn-text-secondary mb-3">{clanData.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[color:var(--nn-cyan)]" />
                  <span className="text-[color:var(--nn-text-primary)]">{clanData.members.length}/{clanData.maxMembers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[color:var(--nn-violet)]" />
                  <span className="text-[color:var(--nn-text-primary)]">Level {clanData.level.currentLevel}</span>
                </div>
                <span className="nn-chip">{playerRole}</span>
              </div>
            </div>
          </div>
          <button className="nn-btn nn-btn--ghost" onClick={onLeaveClan} >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Clan
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap border-b border-[color:var(--nn-glass-border)] pb-2">
        <TabButton icon={<Info />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <TabButton icon={<Users />} label="Members" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <TabButton icon={<Wallet />} label="Bank" active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} />
        <TabButton icon={<Map />} label="Territory" active={activeTab === 'territory'} onClick={() => setActiveTab('territory')} />
        <TabButton icon={<Swords />} label="Warfare" active={activeTab === 'warfare'} onClick={() => setActiveTab('warfare')} />
        <TabButton icon={<Users />} label="Chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard icon={<Coins />} label="Total Power" value={clanData.stats?.totalPower?.toLocaleString() || '0'} />
            <StatCard icon={<Map />} label="Territories" value={clanData.stats?.totalTerritories || 0} />
            <StatCard icon={<Shield />} label="Wars Won" value={clanData.stats?.warsWon || 0} />
          </div>
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
              metal: player.resources.metal,
              energy: player.resources.energy,
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
        {activeTab === 'chat' && (
          <ClanChatPanel 
            clanId={clanData._id?.toString() || ''} 
            currentUserId={player.username} 
            currentUserRole={playerRole} 
          />
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${
        active
          ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]'
          : 'nn-surface border border-[color:var(--nn-glass-border)] nn-text-secondary text-[color:var(--nn-cyan)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-[color:var(--nn-cyan)]">{icon}</div>
        <div className="text-sm nn-text-secondary">{label}</div>
      </div>
      <div className="text-2xl font-bold text-[color:var(--nn-text-primary)]">{value}</div>
    </div>
  );
}
