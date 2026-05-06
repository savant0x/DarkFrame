/**
 * @file components/TopNavBar.tsx
 * @created 2025-10-18
 * @updated 2025-01-19 - Added panel toggle callbacks for navigation
 * @overview Top navigation bar with player profile, navigation links, time, and logout
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { 
  User, Trophy, BarChart3, Zap, LogOut, 
  Settings, Clock, Users, Shield, Sparkles, Flag, Mail, UserPlus
} from 'lucide-react';

interface TopNavBarProps {
  onLeaderboardClick?: () => void;
  onStatsClick?: () => void;
  onTechTreeClick?: () => void;
  onClansClick?: () => void;
  onAdminClick?: () => void;
  onClanClick?: () => void;
  onProfileClick?: () => void;
  onFlagTrackerClick?: () => void;
  onWMDClick?: () => void;
  onDMClick?: () => void; // New: DM panel toggle
  onFriendsClick?: () => void; // New: Friends panel toggle
  flagTrackerActive?: boolean; // Visual indicator for toggle state
  dmUnreadCount?: number; // New: Unread DM count for badge
  friendRequestCount?: number; // New: Pending friend request count for badge
}

export default function TopNavBar({ 
  onLeaderboardClick,
  onStatsClick,
  onTechTreeClick,
  onClansClick,
  onAdminClick,
  onClanClick,
  onProfileClick,
  onFlagTrackerClick,
  onWMDClick,
  onDMClick,
  onFriendsClick,
  flagTrackerActive = false,
  dmUnreadCount = 0,
  friendRequestCount = 0
}: TopNavBarProps = {}) {
  const { player, logout } = useGameContext();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [clanData, setClanData] = useState<{ name: string; tag: string } | null>(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  // Fetch clan data if player is in a clan
  useEffect(() => {
    const fetchClanData = async () => {
      if (!player?.clanId) {
        setClanData(null);
        return;
      }

      try {
        const response = await fetch(`/api/clan?clanId=${player.clanId}`);
        if (response.ok) {
          const data = await response.json();
          setClanData({ name: data.name, tag: data.tag });
        }
      } catch (error) {
        console.error('Failed to fetch clan data:', error);
      }
    };

    fetchClanData();
  }, [player?.clanId]);

  // Check for new clan activity (simplified - checks every 30 seconds)
  useEffect(() => {
    if (!player?.clanId) return;

    const checkActivity = async () => {
      try {
        const response = await fetch(`/api/clan/activity?clanId=${player.clanId}&limit=1`);
        if (response.ok) {
          const data = await response.json();
          // If there's activity in the last 5 minutes, show notification
          if (data.activities && data.activities.length > 0) {
            const lastActivity = new Date(data.activities[0].timestamp);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            setHasNewActivity(lastActivity > fiveMinutesAgo);
          }
        }
      } catch (error) {
        // Silently fail - not critical
      }
    };

    checkActivity();
    const interval = setInterval(checkActivity, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [player?.clanId]);

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: 'short',
        day: 'numeric'
      };
      const formatted = now.toLocaleString('en-US', options);
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!player) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Game Title */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white font-display">DarkFrame</h1>
          <span className="text-xs text-white/50">Online Strategy Game</span>
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center gap-2">
          <button
            onClick={onLeaderboardClick || (() => router.push('/leaderboard'))}
            className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard
          </button>
          <button
            onClick={onStatsClick || (() => router.push('/stats'))}
            className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Stats
          </button>
          <button
            onClick={onTechTreeClick || (() => router.push('/tech-tree'))}
            className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Tech Tree
          </button>
          
          {/* Direct Messages Button */}
          {onDMClick && (
            <button
              onClick={onDMClick}
              className="relative px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
              title="Direct Messages"
            >
              <Mail className="w-3.5 h-3.5" />
              Messages
              {dmUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
                  {dmUnreadCount > 99 ? '99+' : dmUnreadCount}
                </span>
              )}
            </button>
          )}
          
          {/* Friends Button */}
          {onFriendsClick && (
            <button
              onClick={onFriendsClick}
              className="relative px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
              title="Friends"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Friends
              {friendRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
                  {friendRequestCount > 99 ? '99+' : friendRequestCount}
                </span>
              )}
            </button>
          )}
          
          {/* Flag Tracker Button - LESSON #36 */}
        {onFlagTrackerClick && (
          <button
            onClick={onFlagTrackerClick}
            className={`px-3 py-1.5 text-xs rounded border transition-all flex items-center gap-1.5 ${
              flagTrackerActive
                ? 'bg-amber-500/30 text-white border-amber-400 shadow-lg shadow-amber-500/20'
                : 'text-white/80 hover:text-white hover:bg-amber-500/20 border-amber-500/30'
            }`}
            title="Track the Flag Bearer (Hotkey: Q)"
          >
            <Flag className="w-3.5 h-3.5" />
            Flag Tracker
          </button>
        )}
          
          {/* VIP Upgrade Link */}
          <button
            onClick={() => router.push('/game/vip-upgrade')}
            className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
              player.vip
                ? 'text-yellow-300 hover:text-yellow-200 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : 'text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40'
            }`}
            title={player.vip ? 'VIP Member - View Benefits' : 'Upgrade to VIP for 2x Speed'}
          >
            <Sparkles className={`w-3.5 h-3.5 ${player.vip ? 'animate-pulse' : ''}`} />
            {player.vip ? 'VIP ⚡' : 'Get VIP'}
          </button>

          {/* WMD Link */}
          <button
            onClick={onWMDClick || (() => router.push('/wmd'))}
            className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-red-500/20 rounded border border-red-500/30 transition-all flex items-center gap-1.5"
            title="Weapons of Mass Destruction"
          >
            ⚔️ WMD
          </button>

          {player.level >= 10 && (
            <button
              onClick={onClansClick || (() => router.push('/clans'))}
              className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Clans
            </button>
          )}
          {player.isAdmin && (
            <button
              onClick={onAdminClick || (() => router.push('/admin'))}
              className="px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-purple-500/20 rounded border border-purple-500/30 transition-all flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </nav>

        {/* Right: Player Info, Time, Logout */}
        <div className="flex items-center gap-3">
          {/* Time Display */}
          <div className="flex items-center gap-1.5 text-xs text-white/70 px-2 py-1 bg-gray-800/60 rounded border border-cyan-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{currentTime}</span>
          </div>

          {/* Clan Badge (if player is in a clan) */}
          {clanData && (
            <button
              onClick={onClanClick || (() => router.push('/clan'))}
              className="relative flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded transition-all group"
              title={`${clanData.name} - Click to view Clan page`}
            >
              {/* Notification Dot */}
              {hasNewActivity && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
              
              <Shield className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-purple-300 group-hover:text-purple-200 leading-tight">
                  [{clanData.tag}]
                </span>
                <span className="text-[10px] text-purple-400/70 group-hover:text-purple-300/70 leading-tight">
                  {clanData.name.length > 15 ? clanData.name.substring(0, 15) + '...' : clanData.name}
                </span>
              </div>
            </button>
          )}

          {/* Player Profile */}
          <button
            onClick={onProfileClick || (() => router.push('/profile'))}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded transition-all"
            title="Edit Base Message"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-white font-semibold">{player.username}</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 disabled:bg-gray-700 text-white text-xs font-bold rounded border-2 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLoggingOut ? 'Logging out...' : 'LOGOUT'}
          </button>
        </div>
      </div>
    </div>
  );
}
