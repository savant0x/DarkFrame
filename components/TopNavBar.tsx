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
  onDMClick?: () => void;
  onFriendsClick?: () => void;
  flagTrackerActive?: boolean;
  dmUnreadCount?: number;
  friendRequestCount?: number;
}

export default function TopNavBar({
  onLeaderboardClick, onStatsClick, onTechTreeClick, onClansClick,
  onAdminClick, onClanClick, onProfileClick, onFlagTrackerClick,
  onWMDClick, onDMClick, onFriendsClick,
  flagTrackerActive = false, dmUnreadCount = 0, friendRequestCount = 0,
}: TopNavBarProps = {}) {
  const { player, logout } = useGameContext();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [clanData, setClanData] = useState<{ name: string; tag: string } | null>(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  useEffect(() => {
    if (!player?.clanId) { setClanData(null); return; }
    fetch(`/api/clan?clanId=${player.clanId}`).then(r => r.json()).then(d => {
      setClanData({ name: d.name, tag: d.tag });
    }).catch(() => {});
  }, [player?.clanId]);

  useEffect(() => {
    if (!player?.clanId) return;
    const check = async () => {
      try {
        const r = await fetch(`/api/clan/activity?clanId=${player.clanId}&limit=1`);
        if (r.ok) {
          const d = await r.json();
          if (d.activities?.length > 0) {
            setHasNewActivity(new Date(d.activities[0].timestamp) > new Date(Date.now() - 5 * 60000));
          }
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, [player?.clanId]);

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric',
    }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      const d = await r.json();
      if (d.success) router.push('/login');
    } catch {} finally { setIsLoggingOut(false); }
  };

  if (!player) return null;

  const navBtn = "px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/5 rounded border border-transparent hover:border-white/10 transition-all flex items-center gap-1";
  const badge = "absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 text-white text-[9px] font-bold rounded-full flex items-center justify-center";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[--shadow] border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white font-display">DarkFrame</h1>
          <span className="text-xs text-white/40 hidden sm:inline">Online Strategy Game</span>
        </div>

        {/* Center */}
        <nav className="flex items-center gap-1">
          <button onClick={onLeaderboardClick || (() => router.push('/leaderboard'))} className={navBtn}><Trophy className="w-3 h-3" /> <span className="hidden sm:inline">Leaderboard</span></button>
          <button onClick={onStatsClick || (() => router.push('/stats'))} className={navBtn}><BarChart3 className="w-3 h-3" /> <span className="hidden sm:inline">Stats</span></button>
          <button onClick={onTechTreeClick || (() => router.push('/tech-tree'))} className={navBtn}><Zap className="w-3 h-3" /> <span className="hidden sm:inline">Tech</span></button>

          {onDMClick && (
            <button onClick={onDMClick} className={`relative ${navBtn}`}><Mail className="w-3 h-3" />
              {dmUnreadCount > 0 && <span className={`${badge} bg-[--neon-red]`}>{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</span>}
            </button>
          )}
          {onFriendsClick && (
            <button onClick={onFriendsClick} className={`relative ${navBtn}`}><UserPlus className="w-3 h-3" />
              {friendRequestCount > 0 && <span className={`${badge} bg-[--solar]`}>{friendRequestCount > 99 ? '99+' : friendRequestCount}</span>}
            </button>
          )}
          {onFlagTrackerClick && (
            <button onClick={onFlagTrackerClick} className={`px-2 py-1 text-xs rounded border transition-all flex items-center gap-1 ${flagTrackerActive ? 'bg-[--solar]/20 text-white border-[--solar]/40' : 'text-white/70 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}>
              <Flag className="w-3 h-3" /> <span className="hidden sm:inline">Flag</span>
            </button>
          )}

          <button onClick={() => router.push('/game/vip-upgrade')} className={`px-2 py-1 text-xs font-semibold rounded border transition-all flex items-center gap-1 ${player.vip ? 'text-[--neon-yellow] bg-[--neon-yellow]/10 border-[--neon-yellow]/30' : 'text-[--neon-pink] bg-[--neon-pink]/10 border-[--neon-pink]/25'}`}>
            <Sparkles className={`w-3 h-3 ${player.vip ? 'animate-pulse' : ''}`} /> {player.vip ? 'VIP' : 'Get VIP'}
          </button>
          <button onClick={onWMDClick || (() => router.push('/wmd'))} className={navBtn}><span className="text-sm">⚔</span> <span className="hidden sm:inline">WMD</span></button>
          {player.level >= 10 && (<button onClick={onClansClick || (() => router.push('/clans'))} className={navBtn}><Users className="w-3 h-3" /> <span className="hidden sm:inline">Clans</span></button>)}
          {player.isAdmin && (<button onClick={onAdminClick || (() => router.push('/admin'))} className={navBtn}><Settings className="w-3 h-3" /> <span className="hidden sm:inline">Admin</span></button>)}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[--text-2] px-2 py-1 bg-white/[0.04] rounded border border-[--border]">
            <Clock className="w-3 h-3" /> <span className="font-mono text-xs">{currentTime}</span>
          </div>
          {clanData && (
            <button onClick={onClanClick || (() => router.push('/clan'))} className="relative flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all group">
              {hasNewActivity && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[--neon-red] rounded-full animate-pulse" />}
              <Shield className="w-3.5 h-3.5 text-[--neon-pink]" /> <span className="text-[10px] font-bold text-[--neon-pink]">[{clanData.tag}]</span>
            </button>
          )}
          <button onClick={onProfileClick || (() => router.push('/profile'))} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all">
            <div className="w-5 h-5 rounded-full bg-[--electric] flex items-center justify-center"><User className="w-3 h-3 text-white" /></div>
            <span className="text-xs text-white font-semibold">{player.username}</span>
          </button>
          <button onClick={handleLogout} disabled={isLoggingOut} className="px-2 py-1 bg-[--neon-red] hover:bg-[--neon-red]/80 disabled:bg-white/10 text-white text-xs font-bold rounded border border-[--neon-red]/30 transition-all flex items-center gap-1">
            <LogOut className="w-3 h-3" /> {isLoggingOut ? '...' : 'OUT'}
          </button>
        </div>
      </div>
    </div>
  );
}