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

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { Button, Input, Badge } from '@/components/ui';
import { 
  X, 
  Search, 
  Users, 
  Shield, 
  Crown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  Unlock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Clan } from '@/types/clan.types';

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
  const [clans, setClans] = useState<Clan[]>([]);
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
  const fetchClans = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: CLANS_PER_PAGE.toString(),
        ...(filters.name && { name: filters.name }),
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
    } catch (error: any) {
      console.error('Error fetching clans:', error);
      toast.error(error.message || 'Failed to load clans');
      setClans([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles joining a clan
   */
  const handleJoinClan = async (clanId: string, clanName: string) => {
    if (!player) {
      toast.error('Player data not loaded');
      return;
    }

    setJoiningClanId(clanId);
    try {
      const response = await fetch('/api/clan/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player.username,
          clanId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to join clan');
      }

      toast.success(`Successfully joined ${clanName}!`);
      await refreshPlayer();
      onSuccess();
    } catch (error: any) {
      console.error('Error joining clan:', error);
      toast.error(error.message || 'Failed to join clan');
    } finally {
      setJoiningClanId(null);
    }
  };

  /**
   * Handles filter changes
   */
  const handleFilterChange = (field: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Applies filters and resets to page 1
   */
  const applyFilters = () => {
    setCurrentPage(1);
    fetchClans(1);
  };

  /**
   * Resets all filters to defaults
   */
  const resetFilters = () => {
    setFilters({
      name: '',
      publicOnly: true,
      minLevel: 1,
      maxLevel: 50,
      minMembers: 0,
      maxMembers: 100
    });
    setCurrentPage(1);
    fetchClans(1);
  };

  /**
   * Checks if player meets clan requirements
   */
  const meetsRequirements = (clan: Clan): { eligible: boolean; reason?: string } => {
    if (!player) return { eligible: false, reason: 'Player data not loaded' };

    if (player.level < clan.settings.minLevelToJoin) {
      return { eligible: false, reason: `Requires level ${clan.settings.minLevelToJoin}` };
    }

    return { eligible: true };
  };

  // Load clans on mount
  useEffect(() => {
    if (isOpen) {
      fetchClans(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-6xl h-[85vh] bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-purple-500/30 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-b border-purple-500/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">Join a Clan</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search & Filters Bar */}
          <div className="border-b border-slate-700 px-6 py-4 space-y-3 flex-shrink-0">
            {/* Search Row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Search clans by name..."
                  className="pl-10 w-full"
                />
              </div>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="secondary"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button
                onClick={applyFilters}
                variant="primary"
                disabled={isLoading}
              >
                Search
              </Button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-slate-800/50 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-3 gap-4">
                  {/* Public Only Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2">
                      Privacy
                    </label>
                    <button
                      onClick={() => handleFilterChange('publicOnly', !filters.publicOnly)}
                      className={`w-full px-3 py-2 rounded border transition-colors ${
                        filters.publicOnly
                          ? 'bg-green-500/20 border-green-500 text-green-400'
                          : 'bg-slate-700 border-slate-600 text-gray-400'
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
                    <label className="block text-xs font-semibold text-gray-400 mb-2">
                      Level Range
                    </label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={filters.minLevel}
                        onChange={(e) => handleFilterChange('minLevel', parseInt(e.target.value) || 1)}
                        min={1}
                        max={50}
                        className="w-full"
                      />
                      <span className="text-gray-400">-</span>
                      <Input
                        type="number"
                        value={filters.maxLevel}
                        onChange={(e) => handleFilterChange('maxLevel', parseInt(e.target.value) || 50)}
                        min={1}
                        max={50}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Members Range */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2">
                      Member Count
                    </label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={filters.minMembers}
                        onChange={(e) => handleFilterChange('minMembers', parseInt(e.target.value) || 0)}
                        min={0}
                        max={100}
                        className="w-full"
                      />
                      <span className="text-gray-400">-</span>
                      <Input
                        type="number"
                        value={filters.maxMembers}
                        onChange={(e) => handleFilterChange('maxMembers', parseInt(e.target.value) || 100)}
                        min={0}
                        max={100}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={resetFilters} variant="secondary" size="sm">
                    Reset Filters
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Clans Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-400">Loading clans...</p>
                </div>
              </div>
            ) : clans.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <Users className="w-16 h-16 text-gray-600 mx-auto" />
                  <p className="text-gray-400 text-lg">No clans found</p>
                  <p className="text-gray-500 text-sm">Try adjusting your search filters</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {clans.map((clan) => {
                  const eligibility = meetsRequirements(clan);
                  const clanIdStr = clan._id?.toString() || '';
                  const isJoining = joiningClanId === clanIdStr;

                  return (
                    <motion.div
                      key={clanIdStr}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-all p-4 space-y-3"
                    >
                      {/* Clan Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-white truncate">
                              {clan.name}
                            </h3>
                            {clan.settings.requiresApproval ? (
                              <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            ) : (
                              <Unlock className="w-4 h-4 text-green-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {clan.description || 'No description'}
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-gray-400">Level</div>
                          <div className="text-sm font-bold text-cyan-400">
                            {clan.level.currentLevel}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Members</div>
                          <div className="text-sm font-bold text-purple-400">
                            {clan.members.length}/{clan.maxMembers}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Power</div>
                          <div className="text-sm font-bold text-yellow-400">
                            {clan.stats.totalPower.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Leader & Requirements */}
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Crown className="w-3 h-3 text-yellow-400" />
                          <span>Leader: {clan.members.find(m => m.role === 'LEADER')?.username || 'Unknown'}</span>
                        </div>
                        {clan.settings.minLevelToJoin > 1 && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <TrendingUp className="w-3 h-3" />
                            <span>Requires Level {clan.settings.minLevelToJoin}</span>
                          </div>
                        )}
                      </div>

                      {/* Join Button */}
                      <div>
                        {!eligibility.eligible ? (
                          <div className="bg-red-500/10 border border-red-500/30 rounded px-3 py-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-xs text-red-400">{eligibility.reason}</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleJoinClan(clanIdStr, clan.name)}
                            variant="primary"
                            size="sm"
                            fullWidth
                            disabled={isJoining || clan.members.length >= clan.maxMembers}
                            loading={isJoining}
                          >
                            {clan.members.length >= clan.maxMembers
                              ? 'Full'
                              : clan.settings.requiresApproval
                              ? 'Request to Join'
                              : 'Join Clan'}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && clans.length > 0 && (
            <div className="border-t border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => fetchClans(currentPage - 1)}
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => fetchClans(currentPage + 1)}
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
