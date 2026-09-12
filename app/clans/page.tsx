/**
 * @file app/clans/page.tsx
 * @created 2025-10-19
 * @overview Comprehensive clan leaderboards with multiple ranking categories
 * 
 * OVERVIEW:
 * Dedicated leaderboard page displaying top 100 clans across multiple metrics:
 * - Power: Overall clan strength rating
 * - Level: Clan progression level
 * - Territory: Number of controlled tiles
 * - Wealth: Total bank treasury value
 * - Victories: Combined base attack wins by members
 * - Wars Won: Successful war victories
 * - Alliances: Number of active alliances
 * 
 * Features:
 * - Real-time rankings with automatic updates
 * - Category-based filtering
 * - Search by clan name
 * - Pagination (25 clans per page)
 * - Detailed clan cards with stats
 * - Join/View clan buttons
 * - Rank badges (Top 3 get special styling)
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 4 - Clan Leaderboards
 * - Public route accessible to all players
 * - Integrates with clan search/join system
 * - Responsive design for various screen sizes
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { 
  Trophy, 
  TrendingUp, 
  Map, 
  Coins, 
  Swords, 

  Handshake,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  Medal,
  Loader2,
  Eye,
  
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import type { Clan } from '@/types/clan.types';

// FID-20260912-071: quick-create — the modal existed (and worked) but nothing
// mounted it; clanless players had no create path anywhere in the UI.
const CreateClanModal = dynamic(
  () => import('@/components/clan/CreateClanModal'),
  { ssr: false }
);

type LeaderboardCategory = 'power' | 'level' | 'territory' | 'wealth' | 'victories' | 'wars' | 'alliances';

interface LeaderboardEntry {
  clan: Clan;
  rank: number;
  value: number;
  change?: number; // Rank change from last update
}

export default function ClansLeaderboard() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState<LeaderboardCategory>('power');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalClans, setTotalClans] = useState(0);

  const clansPerPage = 25;
  const totalPages = Math.ceil(totalClans / clansPerPage);

  /**
   * Fetches leaderboard data from API
   */
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        page: currentPage.toString(),
        limit: clansPerPage.toString(),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/clan/leaderboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setTotalClans(data.total || 0);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Failed to load leaderboard');
      setLeaderboard([]);
    } finally {
      setIsLoading(false);
    }
  }, [category, currentPage, searchQuery]);

  // Fetch leaderboard data when category, page, or search changes
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  /**
   * Handles category change and resets to page 1
   */
  const handleCategoryChange = (newCategory: LeaderboardCategory) => {
    setCategory(newCategory);
    setCurrentPage(1);
  };

  /**
   * Handles search with debouncing
   */
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  /**
   * Navigates to clan details or join interface
   */
  const handleViewClan = (clanId: string) => {
    router.push(`/game?clanId=${clanId}`);
  };

  return (
    <div className="h-screen bg-gradient-to-b from-bg-void via-bg-space to-black text-[color:var(--nn-text-primary)] overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <div className="mb-6">
          <button 
            onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2 text-[color:var(--nn-cyan)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </button>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="w-10 h-10 text-[color:var(--nn-amber)]" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-violet)] bg-clip-text text-transparent">
              Clan Leaderboards
            </h1>
          </div>
          <p className="nn-text-secondary text-lg mb-4">
            Compete for supremacy across {totalClans} clans
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="nn-btn nn-btn--primary w-auto px-5 py-2.5 mx-auto"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create Clan
          </button>
        </div>

        {/* Category Tabs */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <CategoryButton
              icon={<TrendingUp className="w-4 h-4" />}
              label="Power"
              active={category === 'power'}
              onClick={() => handleCategoryChange('power')}
            />
            <CategoryButton
              icon={<Shield className="w-4 h-4" />}
              label="Level"
              active={category === 'level'}
              onClick={() => handleCategoryChange('level')}
            />
            <CategoryButton
              icon={<Map className="w-4 h-4" />}
              label="Territory"
              active={category === 'territory'}
              onClick={() => handleCategoryChange('territory')}
            />
            <CategoryButton
              icon={<Coins className="w-4 h-4" />}
              label="Wealth"
              active={category === 'wealth'}
              onClick={() => handleCategoryChange('wealth')}
            />
            <CategoryButton
              icon={<Swords className="w-4 h-4" />}
              label="Victories"
              active={category === 'victories'}
              onClick={() => handleCategoryChange('victories')}
            />
            <CategoryButton
              icon={<Trophy className="w-4 h-4" />}
              label="Wars Won"
              active={category === 'wars'}
              onClick={() => handleCategoryChange('wars')}
            />
            <CategoryButton
              icon={<Handshake className="w-4 h-4" />}
              label="Alliances"
              active={category === 'alliances'}
              onClick={() => handleCategoryChange('alliances')}
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 nn-text-secondary" />
            <input
              placeholder="Search clan by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="nn-input pl-12 text-center"
             />
          </div>
        </div>

        <div className="nn-divider"  />

        {/* Leaderboard Content */}
        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-[color:var(--nn-cyan)]" />
            <p className="nn-text-secondary text-lg">Loading leaderboard...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 nn-text-tertiary" />
            <p className="nn-text-secondary text-lg mb-2">
              {searchQuery ? 'No clans found matching your search' : 'No clans in this category yet'}
            </p>
            <p className="nn-text-secondary text-sm mb-4">
              {searchQuery ? 'Try a different search term' : 'Be the first to create a clan!'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreate(true)}
                className="nn-btn nn-btn--primary w-auto px-5 py-2.5 mx-auto"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create Clan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div key={entry.clan._id?.toString()}>
                <LeaderboardCard
                  entry={entry}
                  category={category}
                  onView={() => handleViewClan(entry.clan._id!.toString())}
                />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading} className="nn-btn nn-btn--ghost gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`nn-btn w-10 h-10 p-0 ${currentPage === pageNum ? 'nn-btn--primary' : ''}`}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading} className="nn-btn nn-btn--ghost gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm nn-text-secondary">
          <p>Showing {((currentPage - 1) * clansPerPage) + 1} - {Math.min(currentPage * clansPerPage, totalClans)} of {totalClans} clans</p>
          <p className="mt-2">Rankings update every 5 minutes</p>
        </div>
      </div>

      {/* Quick-create modal (FID-20260912-071) */}
      <CreateClanModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          toast.success('Clan created! It will appear in the leaderboard momentarily.');
          void fetchLeaderboard();
        }}
      />
    </div>
  );
}

/**
 * Category Button Component
 */
interface CategoryButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function CategoryButton({ icon, label, active, onClick }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 px-4 py-3 rounded-none border transition-all
        ${active 
          ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)] shadow-lg shadow-cyan-500/20' 
          : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary hover:nn-surface border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * Leaderboard Card Component
 */
interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  category: LeaderboardCategory;
  onView: () => void;
}

function LeaderboardCard({ entry, category, onView }: LeaderboardCardProps) {
  const { clan, rank, value, change } = entry;

  /**
   * Gets rank display with special styling for top 3
   */
  const getRankDisplay = () => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-2 text-[color:var(--nn-amber)]">
          <Crown className="w-6 h-6" />
          <span className="text-2xl font-bold">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center gap-2 nn-text-primary">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">2</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center gap-2 text-[color:var(--nn-amber)]">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">3</span>
        </div>
      );
    }
    return (
      <span className="text-2xl font-bold nn-text-secondary">#{rank}</span>
    );
  };

  /**
   * Gets value display based on category
   */
  const getValueDisplay = () => {
    switch (category) {
      case 'power':
        return `${value.toLocaleString()} Power`;
      case 'level':
        return `Level ${value}`;
      case 'territory':
        return `${value} Tiles`;
      case 'wealth':
        return `${value.toLocaleString()} Resources`;
      case 'victories':
        return `${value.toLocaleString()} Victories`;
      case 'wars':
        return `${value} Wars Won`;
      case 'alliances':
        return `${value} Alliances`;
      default:
        return value.toString();
    }
  };

  /**
   * Gets rank change indicator
   */
  const getRankChange = () => {
    if (!change || change === 0) return null;
    
    if (change > 0) {
      return (
        <span className="nn-chip nn-chip--green text-xs gap-1">
          <TrendingUp className="w-3 h-3" />
          +{change}
        </span>
      );
    }
    
    return (
      <span className="nn-chip nn-chip--magenta text-xs gap-1">
        <TrendingUp className="w-3 h-3 rotate-180" />
        {change}
      </span>
    );
  };

  const borderColor = rank === 1 
    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]' 
    : rank === 2 
    ? 'border-[color:var(--nn-glass-border)]' 
    : rank === 3 
    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]'
    : 'border-[color:var(--nn-glass-border)]';

  const bgColor = rank === 1
    ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]'
    : rank === 2
    ? 'nn-surface/40'
    : rank === 3
    ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]'
    : 'nn-surface';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-none p-4 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] transition-all`}>
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-16 text-center">
          {getRankDisplay()}
        </div>

        {/* Clan Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)] truncate">
              {clan.name}
            </h3>
            {getRankChange()}
            {clan.settings?.requiresApproval ? (
              <span className="nn-chip text-xs">Private</span>
            ) : (
              <span className="nn-chip nn-chip--green text-xs">Public</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="nn-text-secondary">Level:</span>
              <span className="text-[color:var(--nn-cyan)] ml-2 font-semibold">{clan.level.currentLevel}</span>
            </div>
            <div>
              <span className="nn-text-secondary">Members:</span>
              <span className="text-[color:var(--nn-violet)] ml-2 font-semibold">
                {clan.members.length}/{clan.maxMembers}
              </span>
            </div>
            <div>
              <span className="nn-text-secondary">Territories:</span>
              <span className="text-[color:var(--nn-green)] ml-2 font-semibold">{clan.territories?.length || 0}</span>
            </div>
            <div>
              <span className="nn-text-secondary">Leader:</span>
              <span className="text-[color:var(--nn-amber)] ml-2 font-semibold truncate">
                {clan.members.find(m => m.role === 'LEADER')?.username || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Value Display */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-[color:var(--nn-text-primary)] mb-1">
            {getValueDisplay()}
          </div>
          <button
            onClick={onView} className="nn-btn nn-btn--ghost gap-2 text-[color:var(--nn-cyan)]"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
        </div>
      </div>
    </div>
  );
}
