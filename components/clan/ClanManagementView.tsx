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

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { 
  Button, 
  Badge, 
  Divider,
  Input,
  RichTextEditor
} from '@/components/ui';
import { SafeHtmlRenderer } from '@/components/SafeHtmlRenderer';
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
  useEffect(() => {
    if (player?.clanId) {
      fetchClanData();
    }
  }, [player?.clanId]);

  const fetchClanData = async () => {
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
  };

  const handleLeaveClan = async () => {
    if (!confirm('Are you sure you want to leave this clan?')) return;

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
    } catch (error: any) {
      console.error('Error leaving clan:', error);
      toast.error(error.message || 'Failed to leave clan');
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
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
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
      <StaggerChildren className="space-y-8">
        <StaggerItem>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-purple-500/10 border-2 border-purple-500/30">
              <Users className="w-12 h-12 text-purple-400" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">
                You're Not in a Clan
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Join forces with other players or create your own clan to unlock exclusive benefits,
                territory control, and cooperative gameplay features.
              </p>
            </div>
          </div>
        </StaggerItem>

        <Divider />

        <StaggerItem>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <button
              onClick={onCreateClick}
              className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-500/50 rounded-lg p-8 hover:border-purple-400 transition-all hover:scale-105 group"
            >
              <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold text-white mb-2">Create New Clan</h3>
              <p className="text-gray-400 text-sm mb-4">
                Found your own clan and lead it to glory. Recruit members and build your empire.
              </p>
              <div className="text-sm text-cyan-400">
                Cost: 50K Metal + 50K Energy + 100 RP
              </div>
            </button>
            
            <button
              onClick={onJoinClick}
              className="bg-gradient-to-br from-cyan-900/30 to-teal-900/30 border-2 border-cyan-500/50 rounded-lg p-8 hover:border-cyan-400 transition-all hover:scale-105 group"
            >
              <UserPlus className="w-12 h-12 text-cyan-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold text-white mb-2">Join Existing Clan</h3>
              <p className="text-gray-400 text-sm mb-4">
                Browse and join established clans. Find your place among fellow commanders.
              </p>
              <div className="text-sm text-cyan-400">
                Free to join
              </div>
            </button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Clan Benefits
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Shared resources and clan bank</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Territory control and passive income</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Cooperative research and perks</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Clan warfare and alliances</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Exclusive clan chat and coordination</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Leaderboard rankings and prestige</span>
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerChildren>
    </div>
  );
}

// Import the CreateClanView and JoinClanView from ClanPanel
// (These are the same components we just created)
import { useState as useReactState } from 'react';

/**
 * Create Clan View - Inline form
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

  // No formatting helpers needed - RichTextEditor handles it all

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
    <div className="max-w-3xl mx-auto">
      <StaggerChildren className="space-y-6">
        {/* Back Button */}
        <StaggerItem>
          <Button onClick={onBack} variant="ghost" size="sm">
            ← Back
          </Button>
        </StaggerItem>

        {/* Header */}
        <StaggerItem>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              Create New Clan
            </h2>
            <p className="text-gray-400">Establish your clan and recruit members</p>
          </div>
        </StaggerItem>

        {/* Cost Display */}
        <StaggerItem>
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              Creation Cost
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Metal</div>
                <div className={`text-xl font-bold ${player.resources.metal >= METAL_COST ? 'text-green-400' : 'text-red-400'}`}>
                  {METAL_COST.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Have: {player.resources.metal.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Energy</div>
                <div className={`text-xl font-bold ${player.resources.energy >= ENERGY_COST ? 'text-green-400' : 'text-red-400'}`}>
                  {ENERGY_COST.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Have: {player.resources.energy.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Clan Name */}
          <StaggerItem>
            <label className="block text-sm font-semibold text-white mb-2">
              Clan Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e: any) => handleChange('name', e.target.value)}
                placeholder="Enter clan name (3-30 characters)"
                maxLength={30}
                className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
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
              onChange={(e: any) => handleChange('tag', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder={`e.g. DW (auto: ${formData.name.replace(/[^a-zA-Z ]/g, '').split(' ').filter((w: string) => w).map((w: string) => w[0]?.toUpperCase() || '').join('').slice(0, 5)})`}
              maxLength={5}
            />
            <p className="text-gray-400 text-xs mt-1">2-5 uppercase letters/numbers</p>
          </StaggerItem>

          {/* Description */}
          <StaggerItem>
            <label className="block text-sm font-semibold text-white mb-2">Description</label>
            
            {/* Rich Text Editor */}
            <RichTextEditor
              value={formData.description}
              onChange={(html) => handleChange('description', html)}
              maxLength={500}
              placeholder="Describe your clan's purpose, goals, and values... Format it to make it stand out!"
              minHeight="180px"
            />

            {/* Preview */}
            <div className="mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Preview:</p>
              <SafeHtmlRenderer 
                html={formData.description}
                fallback="Your clan description will appear here..."
                className="text-white text-sm"
              />
            </div>
          </StaggerItem>

          {/* Privacy & Min Level */}
          <StaggerItem>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Privacy</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('isPublic', true)}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      formData.isPublic ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-800 border-slate-600 text-gray-400'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('isPublic', false)}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
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
                <input
                  type="number"
                  value={formData.minLevel}
                  onChange={(e: any) => handleChange('minLevel', parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          </StaggerItem>

          {/* Error Message */}
          {errors.submit && (
            <StaggerItem>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400">{errors.submit}</p>
              </div>
            </StaggerItem>
          )}

          {/* Action Buttons */}
          <StaggerItem>
            <div className="flex gap-4">
              <Button type="button" onClick={onBack} variant="secondary" fullWidth disabled={isSubmitting} size="lg">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={isSubmitting || !canAfford || nameAvailable === false || formData.name.length < 3}
                loading={isSubmitting}
              >
                Create Clan
              </Button>
            </div>
          </StaggerItem>
        </form>
      </StaggerChildren>
    </div>
  );
}

/**
 * Join Clan View - Browse and join clans
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
      if (data.success || data.clans) {
        setClans(data.clans || []);
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
        body: JSON.stringify({ clanId, username: player.username })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to join clan');
      }

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
    <div className="max-w-4xl mx-auto">
      <StaggerChildren className="space-y-6">
        {/* Back Button & Header */}
        <StaggerItem>
          <Button onClick={onBack} variant="ghost" size="sm" className="mb-4">
            ← Back
          </Button>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
              <UserPlus className="w-8 h-8 text-cyan-400" />
              Join a Clan
            </h2>
            <p className="text-gray-400">Browse and join established clans</p>
          </div>
        </StaggerItem>

        {/* Search */}
        <StaggerItem>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            placeholder="Search clans by name..."
            className="text-lg"
          />
        </StaggerItem>

        {/* Clan List */}
        <StaggerItem>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          ) : filteredClans.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No clans found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClans.map(clan => (
                <div key={clan.id} className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{clan.name}</h3>
                        <Badge variant={clan.settings?.requiresApproval ? 'default' : 'success'}>
                          {clan.settings?.requiresApproval ? 'Private' : 'Public'}
                        </Badge>
                      </div>
                      <SafeHtmlRenderer 
                        html={clan.description || ''}
                        fallback="No description provided"
                        className="text-gray-400 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{clan.memberCount}/{clan.maxMembers} members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Level {clan.level}</span>
                      </div>
                      {clan.territories > 0 && (
                        <div className="flex items-center gap-2">
                          <Map className="w-4 h-4" />
                          <span>{clan.territories} territories</span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleJoin(clan.id)}
                      variant="primary"
                      disabled={isJoining}
                    >
                      Join Clan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StaggerItem>
      </StaggerChildren>
    </div>
  );
}

/**
 * Clan Management Interface - Full management when player has clan
 */
interface ClanManagementInterfaceProps {
  player: any;
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
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const playerMember = clanData.members.find(m => m.username === player.username);
  const playerRole = playerMember?.role || ClanRole.MEMBER;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Clan Header */}
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-6 border border-purple-500/30">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{clanData.name}</h1>
              <p className="text-gray-400 mb-3">{clanData.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-white">{clanData.members.length}/{clanData.maxMembers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-white">Level {clanData.level.currentLevel}</span>
                </div>
                <Badge>{playerRole}</Badge>
              </div>
            </div>
          </div>
          <Button onClick={onLeaveClan} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Leave Clan
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap border-b border-slate-700 pb-2">
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
            playerResources={player.resources}
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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        active
          ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
          : 'bg-slate-800/50 border border-slate-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50'
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
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-cyan-400">{icon}</div>
        <div className="text-sm text-gray-400">{label}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
