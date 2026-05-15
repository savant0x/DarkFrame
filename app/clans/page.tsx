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
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

type LeaderboardCategory = 'power' | 'level' | 'territory' | 'wealth' | 'victories' | 'wars' | 'alliances';

interface LeaderboardEntry {
  clan: Clan;
  rank: number;
  value: number;
  change?: number;
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

  useEffect(() => {
    fetchLeaderboard();
  }, [category, currentPage, searchQuery]);

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

  const handleCategoryChange = (newCategory: LeaderboardCategory) => {
    setCategory(newCategory);
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleViewClan = (clanId: string) => {
    router.push(`/game?clanId=${clanId}`);
  };

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
              <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Trophy className="w-10 h-10 text-[--neon-yellow]" />
                  <h1 className="text-4xl font-bold text-[--electric]">
                    Clan Leaderboards
                  </h1>
                </div>
                <p className="text-white/60 text-lg">
                  Compete for supremacy across {totalClans} clans
                </p>
              </div>

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

              <div className="mb-6">
                <div className="relative max-w-md mx-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    placeholder="Search clan by name..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-12 text-center"
                  />
                </div>
              </div>

              <Divider />

              {isLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-16 h-16 mx-auto mb-4 text-[--electric] animate-spin" />
                  <p className="text-white/60 text-lg">Loading leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-20">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-white/40" />
                  <p className="text-white/60 text-lg mb-2">
                    {searchQuery ? 'No clans found matching your search' : 'No clans in this category yet'}
                  </p>
                  <p className="text-white/40 text-sm">
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

              <div className="mt-8 text-center text-sm text-white/40">
                <p>Showing {((currentPage - 1) * clansPerPage) + 1} - {Math.min(currentPage * clansPerPage, totalClans)} of {totalClans} clans</p>
                <p className="mt-2">Rankings update every 5 minutes</p>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}

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
          ? 'bg-[--electric]/15 border-[--electric]/25 text-[--electric]'
          : 'bg-[--card] border-[--border] text-white/60 hover:bg-[--card] hover:border-[--electric]/20 hover:text-[--electric]'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </button>
  );
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  category: LeaderboardCategory;
  onView: () => void;
}

function LeaderboardCard({ entry, category, onView }: LeaderboardCardProps) {
  const { clan, rank, value, change } = entry;

  const getRankDisplay = () => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-2 text-[--neon-yellow]">
          <Crown className="w-6 h-6" />
          <span className="text-2xl font-bold">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center gap-2 text-white/60">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">2</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center gap-2 text-[--solar]">
          <Medal className="w-6 h-6" />
          <span className="text-2xl font-bold">3</span>
        </div>
      );
    }
    return (
      <span className="text-2xl font-bold text-white/40">#{rank}</span>
    );
  };

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
    ? 'border-[--neon-yellow]/20'
    : rank === 2
    ? 'border-white/20'
    : rank === 3
    ? 'border-[--solar]/20'
    : 'border-[--border]';

  const bgColor = rank === 1
    ? 'bg-[--neon-yellow]/10'
    : rank === 2
    ? 'bg-white/5'
    : rank === 3
    ? 'bg-[--solar]/10'
    : 'bg-[--card]';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 hover:border-[--electric]/20 transition-all`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-16 text-center">
          {getRankDisplay()}
        </div>

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
              <span className="text-white/40">Level:</span>
              <span className="text-[--electric] ml-2 font-semibold">{clan.level.currentLevel}</span>
            </div>
            <div>
              <span className="text-white/40">Members:</span>
              <span className="text-[--neon-pink] ml-2 font-semibold">
                {clan.members.length}/{clan.maxMembers}
              </span>
            </div>
            <div>
              <span className="text-white/40">Territories:</span>
              <span className="text-[--synth] ml-2 font-semibold">{clan.territories?.length || 0}</span>
            </div>
            <div>
              <span className="text-white/40">Leader:</span>
              <span className="text-[--neon-yellow] ml-2 font-semibold truncate">
                {clan.members.find(m => m.role === 'LEADER')?.username || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-white mb-1">
            {getValueDisplay()}
          </div>
          <Button
            onClick={onView}
            variant="ghost"
            className="gap-2 text-[--electric] hover:text-[--electric]"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
