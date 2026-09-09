/**
 * @file components/clan/JoinClanModal.tsx
 * @created 2025-10-19
 * @overview Modal for browsing and joining existing clans
 * 
 * OVERVIEW:
 * Full-featured clan browsing interface with:
 * - Search functionality (by name)
 * - Filter options (public only, by level range, by member count)
 * - Paginated clan grid (20 clans per page)
 * - Clan cards with detailed information
 * - Join button with eligibility checks
 * - Real-time availability updates
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 1.2 - Clan Creation & Join Modals
 * - Uses DarkFrame design system
 * - API integration: GET /api/clan/search, POST /api/clan/join
 * - Toast notifications for feedback
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';
import { useGameContext } from '@/context/GameContext';

import { 
  X, 
  Search, 
  Users, 

  Crown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';


/**
 * Clan DTO returned by GET /api/clan/search (documented response contract):
 * { success, clans: [{_id, name, tag, description, memberCount, maxMembers,
 *   leaderUsername, level}], totalPages, total }.
 *
 * NOTE: the route does NOT return the full Clan document (members, settings,
 * stats). Filter parameters (q, minLevel, maxLevel, minMembers, maxMembers,
 * publicOnly) are supported by the route as of SCOPE #35; `name` is sent as
 * `q` because that is the route's search parameter.
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

interface JoinClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SearchFilters {
  name: string;
  publicOnly: boolean;
  minLevel: number;
  maxLevel: number;
  minMembers: number;
  maxMembers: number;
}

const CLANS_PER_PAGE = 20;

export default function JoinClanModal({ isOpen, onClose, onSuccess }: JoinClanModalProps) {
  const { player, refreshPlayer } = useGameContext();
  const [clans, setClans] = useState<ClanSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [joiningClanId, setJoiningClanId] = useState<string | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({
    name: '',
    publicOnly: true,
    minLevel: 1,
    maxLevel: 50,
    minMembers: 0,
    maxMembers: 100
  });

  /**
   * Fetches clans from API based on filters
   */
  const fetchClans = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: CLANS_PER_PAGE.toString(),
        ...(filters.name && { q: filters.name }),
        ...(filters.publicOnly && { publicOnly: 'true' }),
        minLevel: filters.minLevel.toString(),
        maxLevel: filters.maxLevel.toString(),
        minMembers: filters.minMembers.toString(),
        maxMembers: filters.maxMembers.toString()
      });

      const response = await fetch(`/api/clan/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch clans');
      }

      setClans(data.clans || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching clans:', error);
      toast.error(getErrorMessage(error) || 'Failed to load clans');
      setClans([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.name, filters.publicOnly, filters.minLevel, filters.maxLevel, filters.minMembers, filters.maxMembers]);

  // Load clans on mount
  useEffect(() => {
    if (isOpen) {
      fetchClans(1);
    }
  }, [isOpen, fetchClans]);

  const handleFilterChange = (key: keyof SearchFilters, value: SearchFilters[keyof SearchFilters]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchClans(1);
  };

  const resetFilters = () => {
    setFilters({
      name: '',
      publicOnly: true,
      minLevel: 1,
      maxLevel: 50,
      minMembers: 0,
      maxMembers: 100
    });
    fetchClans(1);
  };

  const meetsRequirements = (clan: ClanSearchResult) => {
    if (!player) return { eligible: false, reason: 'Player data not loaded' };
    // minLevelToJoin is not part of the search DTO; the level gate is enforced
    // server-side on join. Capacity uses the DTO's memberCount.
    if (clan.memberCount >= clan.maxMembers) return { eligible: false, reason: 'Clan is full' };
    return { eligible: true, reason: '' };
  };

  const handleJoinClan = async (clanId: string, clanName: string) => {
    setJoiningClanId(clanId);
    try {
      const response = await fetch('/api/clan/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to join clan');
      toast.success(`Successfully joined ${clanName}`);
      refreshPlayer?.();
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Failed to join clan');
    } finally {
      setJoiningClanId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — FID-013: framer motion.div → plain node with gated nn-fade */}
      <div
        className="nn-fade absolute inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — FID-013: framer motion.div → plain node with gated nn-fade; gradient slab → token void */}
      <div
        className="nn-fade relative w-full max-w-6xl h-[85vh] bg-[color:var(--nn-void)] rounded-none border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header — gradient strip → quiet accent tint */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_12%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-[color:var(--nn-violet)]" />
              <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Join a Clan</h2>
            </div>
            <button
              onClick={onClose}
              className="nn-text-secondary hover:text-[color:var(--nn-text-primary)] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search & Filters Bar */}
          <div className="border-b border-[color:var(--nn-glass-border)] px-6 py-4 space-y-3 flex-shrink-0">
            {/* Search Row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 nn-text-secondary" />
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Search clans by name..."
                  className="nn-input pl-10 w-full"
                 />
              </div>
              <button className="nn-btn"
                onClick={() => setShowFilters(!showFilters)} >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
              <button className="nn-btn nn-btn--primary"
                onClick={applyFilters} disabled={isLoading}
              >
                Search
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="nn-fade nn-surface rounded-none p-4 space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  {/* Public Only Toggle */}
                  <div>
                    <label className="block text-xs font-semibold nn-text-secondary mb-2">
                      Privacy
                    </label>
                    <button
                      onClick={() => handleFilterChange('publicOnly', !filters.publicOnly)}
                      className={`w-full px-3 py-2 rounded-none border transition-colors ${
                        filters.publicOnly
                          ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] text-[color:var(--nn-green)]'
                          : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary'
                      }`}
                    >
                      {filters.publicOnly ? (
                        <>
                          <Unlock className="w-4 h-4 inline mr-2" />
                          Public Only
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 inline mr-2" />
                          All Clans
                        </>
                      )}
                    </button>
                  </div>

                  {/* Level Range */}
                  <div>
                    <label className="block text-xs font-semibold nn-text-secondary mb-2">
                      Level Range
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={filters.minLevel}
                        onChange={(e) => handleFilterChange('minLevel', parseInt(e.target.value) || 1)}
                        min={1}
                        max={50}
                        className="nn-input w-full"
                       />
                      <span className="nn-text-secondary">-</span>
                      <input
                        type="number"
                        value={filters.maxLevel}
                        onChange={(e) => handleFilterChange('maxLevel', parseInt(e.target.value) || 50)}
                        min={1}
                        max={50}
                        className="nn-input w-full"
                       />
                    </div>
                  </div>

                  {/* Members Range */}
                  <div>
                    <label className="block text-xs font-semibold nn-text-secondary mb-2">
                      Member Count
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={filters.minMembers}
                        onChange={(e) => handleFilterChange('minMembers', parseInt(e.target.value) || 0)}
                        min={0}
                        max={100}
                        className="nn-input w-full"
                       />
                      <span className="nn-text-secondary">-</span>
                      <input
                        type="number"
                        value={filters.maxMembers}
                        onChange={(e) => handleFilterChange('maxMembers', parseInt(e.target.value) || 100)}
                        min={0}
                        max={100}
                        className="nn-input w-full"
                       />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="nn-btn" onClick={resetFilters} >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clans Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] border-t-transparent rounded-none mx-auto" />
                  <p className="nn-text-secondary">Loading clans...</p>
                </div>
              </div>
            ) : clans.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <Users className="w-16 h-16 nn-text-tertiary mx-auto" />
                  <p className="nn-text-secondary text-lg">No clans found</p>
                  <p className="nn-text-secondary text-sm">Try adjusting your search filters</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {clans.map((clan) => {
                  const eligibility = meetsRequirements(clan);
                  const clanIdStr = clan._id?.toString() || '';
                  const isJoining = joiningClanId === clanIdStr;

                  return (
                    <div
                      key={clanIdStr}
                      className="nn-fade nn-surface rounded-none border border-[color:var(--nn-glass-border)] border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] transition-all p-4 space-y-3"
                    >
                      {/* Clan Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] truncate">
                              {clan.name}
                            </h3>
                            <Unlock className="w-4 h-4 text-[color:var(--nn-green)] flex-shrink-0" />
                          </div>
                          <p className="text-xs nn-text-secondary line-clamp-2">
                            {clan.description || 'No description'}
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs nn-text-secondary">Level</div>
                          <div className="text-sm font-bold text-[color:var(--nn-cyan)]">
                            {clan.level}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs nn-text-secondary">Members</div>
                          <div className="text-sm font-bold text-[color:var(--nn-violet)]">
                            {clan.memberCount}/{clan.maxMembers}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs nn-text-secondary">Tag</div>
                          <div className="text-sm font-bold text-[color:var(--nn-amber)]">
                            {clan.tag}
                          </div>
                        </div>
                      </div>

                      {/* Leader & Requirements */}
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 nn-text-secondary">
                          <Crown className="w-3 h-3 text-[color:var(--nn-amber)]" />
                          <span>Leader: {clan.leaderUsername}</span>
                        </div>
                      </div>

                      {/* Join Button */}
                      <div>
                        {!eligibility.eligible ? (
                          <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none px-3 py-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-[color:var(--nn-magenta)] flex-shrink-0" />
                            <span className="text-xs text-[color:var(--nn-magenta)]">{eligibility.reason}</span>
                          </div>
                        ) : (
                          <button className="nn-btn nn-btn--primary"
                            onClick={() => handleJoinClan(clanIdStr, clan.name)} disabled={isJoining || clan.memberCount >= clan.maxMembers} >
                            {clan.memberCount >= clan.maxMembers
                              ? 'Full'
                              : 'Join Clan'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && clans.length > 0 && (
            <div className="border-t border-[color:var(--nn-glass-border)] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="text-sm nn-text-secondary">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button className="nn-btn"
                  onClick={() => fetchClans(currentPage - 1)} disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="nn-btn"
                  onClick={() => fetchClans(currentPage + 1)} disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
