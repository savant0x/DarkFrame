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

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Badge, Divider } from '@/components/ui';
import { StaggerChildren, StaggerItem } from '@/components/transitions';
import { 
  Trophy, 
  TrendingUp, 
  Map, 
  Coins, 
  Swords, 
  Users, 
  Handshake,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  Medal,
  Loader2,
  Eye,
  UserPlus,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan } from '@/types/clan.types';

type LeaderboardCategory = 'power' | 'level' | 'territory' | 'wealth' | 'victories' | 'wars' | 'alliances';

interface LeaderboardEntry {
  clan: Clan;
  rank: number;
  value: number;
  change?: number; // Rank change from last update
}

export default function ClansLeaderboard() {
  const router = useRouter();
  const [category, setCategory] = useState<LeaderboardCategory>('power');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalClans, setTotalClans] = useState(0);

  const clansPerPage = 25;
  const totalPages = Math.ceil(totalClans / clansPerPage);

  // Fetch leaderboard data when category, page, or search changes
  useEffect(() => {
    fetchLeaderboard();
  }, [category, currentPage, searchQuery]);

  /**
   * Fetches leaderboard data from API
   */
  const fetchLeaderboard = async () => {
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
  };

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
    <div className="h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            onClick={() => router.push('/game')} 
            variant="ghost" 
            className="gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Clan Leaderboards
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Compete for supremacy across {totalClans} clans
          </p>
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              placeholder="Search clan by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 text-center"
            />
          </div>
        </div>

        <Divider />

        {/* Leaderboard Content */}
        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-cyan-400 animate-spin" />
            <p className="text-gray-400 text-lg">Loading leaderboard...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg mb-2">
              {searchQuery ? 'No clans found matching your search' : 'No clans in this category yet'}
            </p>
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'Try a different search term' : 'Be the first to create a clan!'}
            </p>
          </div>
        ) : (
          <StaggerChildren className="space-y-3">
            {leaderboard.map((entry) => (
              <StaggerItem key={entry.clan._id?.toString()}>
                <LeaderboardCard
                  entry={entry}
                  category={category}
                  onView={() => handleViewClan(entry.clan._id!.toString())}
                />
              </StaggerItem>
            ))}
          </StaggerChildren>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              variant="ghost"
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

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
                  <Button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    variant={currentPage === pageNum ? 'primary' : 'ghost'}
                    className="w-10 h-10 p-0"
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              variant="ghost"
              className="gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Showing {((currentPage - 1) * clansPerPage) + 1} - {Math.min(currentPage * clansPerPage, totalClans)} of {totalClans} clans</p>
          <p className="mt-2">Rankings update every 5 minutes</p>
        </div>
      </div>
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
        flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all
        ${active 
          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-lg shadow-cyan-500/20' 
          : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:border-cyan-500/30 hover:text-cyan-400'
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
        <div className="flex items-center gap-2 text-yellow-400">
          <Crown className="w-6 h-6" />
          <span className="text-2xl font-bold">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center gap-2 text-gray-300">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">2</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center gap-2 text-orange-400">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">3</span>
        </div>
      );
    }
    return (
      <span className="text-2xl font-bold text-gray-500">#{rank}</span>
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
        <Badge variant="success" className="text-xs gap-1">
          <TrendingUp className="w-3 h-3" />
          +{change}
        </Badge>
      );
    }
    
    return (
      <Badge variant="error" className="text-xs gap-1">
        <TrendingUp className="w-3 h-3 rotate-180" />
        {change}
      </Badge>
    );
  };

  const borderColor = rank === 1 
    ? 'border-yellow-500/50' 
    : rank === 2 
    ? 'border-gray-400/50' 
    : rank === 3 
    ? 'border-orange-500/50'
    : 'border-gray-700/50';

  const bgColor = rank === 1
    ? 'bg-yellow-500/10'
    : rank === 2
    ? 'bg-gray-500/10'
    : rank === 3
    ? 'bg-orange-500/10'
    : 'bg-gray-800/50';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 hover:border-cyan-500/30 transition-all`}>
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-16 text-center">
          {getRankDisplay()}
        </div>

        {/* Clan Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white truncate">
              {clan.name}
            </h3>
            {getRankChange()}
            {clan.settings?.requiresApproval ? (
              <Badge variant="default" className="text-xs">Private</Badge>
            ) : (
              <Badge variant="success" className="text-xs">Public</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Level:</span>
              <span className="text-cyan-400 ml-2 font-semibold">{clan.level.currentLevel}</span>
            </div>
            <div>
              <span className="text-gray-500">Members:</span>
              <span className="text-purple-400 ml-2 font-semibold">
                {clan.members.length}/{clan.maxMembers}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Territories:</span>
              <span className="text-green-400 ml-2 font-semibold">{clan.territories?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Leader:</span>
              <span className="text-yellow-400 ml-2 font-semibold truncate">
                {clan.members.find(m => m.role === 'LEADER')?.username || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Value Display */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-white mb-1">
            {getValueDisplay()}
          </div>
          <Button
            onClick={onView}
            variant="ghost"
            className="gap-2 text-cyan-400 hover:text-cyan-300"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
