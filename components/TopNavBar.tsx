/**
 * @file components/TopNavBar.tsx
 * @created 2025-10-18
 * @updated 2026-09-06 — FID-20260906-012 Phase 2: NEON NOIR top navigation shell.
 * @overview Top navigation bar with player profile, navigation links, resources, and logout
 *
 * NEON NOIR (§5.1):
 * - 56px void bar, 1px cyan bottom edge, borderless nav items with active underline glow
 * - Metal/Energy readouts as Orbitron tabular resource chips (amber = metal, cyan = energy)
 * - WMD threat slot: dormant until `/api/wmd/status` reports hasAlerts, then pulses magenta
 * - All callbacks/props preserved from the pre-reskin contract.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import {
  User, Trophy, BarChart3, Zap, LogOut,
  Settings, Clock, Users, Shield, Sparkles, Flag, Mail, UserPlus, Crosshair
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
  /** Live resource readouts (NEON NOIR §5.1 ticker). Optional for non-game pages. */
  metal?: number;
  energy?: number;
}

/** Wire shape of GET /api/wmd/status (fields the nav consumes; others ignored). */
interface WmdStatusWire {
  success: boolean;
  status: {
    hasAlerts: boolean;
    missilesReady: number;
  };
}

/** One borderless nav item; `active` gets the cyan underline glow. */
function NavItem({
  label,
  icon,
  onClick,
  title,
  active = false,
  accent,
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  accent?: 'flag' | 'vip';
  badge?: number;
}) {
  const accentClass =
    accent === 'flag'
      ? active
        ? 'text-[color:var(--nn-amber)] nn-navitem--flag-active'
        : 'hover:text-[color:var(--nn-amber)]'
      : accent === 'vip'
        ? 'text-[color:var(--nn-violet)] hover:text-[color:var(--nn-violet-bright,var(--nn-violet))]'
        : '';
  return (
    <button onClick={onClick} title={title} className={`nn-navitem ${active ? 'nn-navitem--active' : ''} ${accentClass}`}>
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="nn-navitem__badge">{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
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
  friendRequestCount = 0,
  metal,
  energy
}: TopNavBarProps = {}) {
  const { player } = useGameContext();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [clanData, setClanData] = useState<{ name: string; tag: string } | null>(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [wmdAlerts, setWmdAlerts] = useState(false);

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
          const data: { name: string; tag: string } = await response.json();
          setClanData({ name: data.name, tag: data.tag });
        }
      } catch (error) {
        console.error('Failed to fetch clan data:', error);
      }
    };

    fetchClanData();
  }, [player?.clanId]);

  // Check for new clan activity (checks every 30 seconds)
  useEffect(() => {
    if (!player?.clanId) return;

    const checkActivity = async () => {
      try {
        const response = await fetch(`/api/clan/activity?clanId=${player.clanId}&limit=1`);
        if (response.ok) {
          const data: { activities?: Array<{ timestamp: string }> } = await response.json();
          // If there's activity in the last 5 minutes, show notification
          if (data.activities && data.activities.length > 0) {
            const lastActivity = new Date(data.activities[0].timestamp);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            setHasNewActivity(lastActivity > fiveMinutesAgo);
          }
        }
      } catch {
        // Silently fail - not critical
      }
    };

    checkActivity();
    const interval = setInterval(checkActivity, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [player?.clanId]);

  // WMD threat slot (NEON NOIR §5.1): dormant until an actionable alert exists
  useEffect(() => {
    if (!player?.username) return;

    const checkThreat = async () => {
      try {
        const response = await fetch('/api/wmd/status');
        if (!response.ok) return;
        const data: WmdStatusWire = await response.json();
        setWmdAlerts(Boolean(data.status?.hasAlerts));
      } catch {
        // threat slot is advisory; keep last state
      }
    };

    checkThreat();
    const interval = setInterval(checkThreat, 30000);
    return () => clearInterval(interval);
  }, [player?.username]);

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
      const data: { success: boolean } = await response.json();

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
    <header className="nn-topnav">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Game Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-[0.18em] text-[color:var(--nn-text-primary)] font-display [text-shadow:0_0_14px_color-mix(in_oklab,var(--nn-cyan)_45%,transparent)]">
            DARK<span className="text-[color:var(--nn-cyan)]">FRAME</span>
          </h1>
        </div>

        {/* Center: Navigation */}
        <nav className="flex items-center">
          <NavItem
            label="Leaderboard"
            icon={<Trophy className="h-3.5 w-3.5" />}
            onClick={onLeaderboardClick || (() => router.push('/leaderboard'))}
          />
          <NavItem
            label="Stats"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            onClick={onStatsClick || (() => router.push('/stats'))}
          />
          <NavItem
            label="Tech Tree"
            icon={<Zap className="h-3.5 w-3.5" />}
            onClick={onTechTreeClick || (() => router.push('/tech-tree'))}
          />

          {onDMClick && (
            <NavItem
              label="Messages"
              icon={<Mail className="h-3.5 w-3.5" />}
              onClick={onDMClick}
              title="Direct Messages"
              badge={dmUnreadCount}
            />
          )}

          {onFriendsClick && (
            <NavItem
              label="Friends"
              icon={<UserPlus className="h-3.5 w-3.5" />}
              onClick={onFriendsClick}
              title="Friends"
              badge={friendRequestCount}
            />
          )}

          {/* Flag Tracker — amber accent, active state = amber underline (LESSON #36) */}
          {onFlagTrackerClick && (
            <NavItem
              label="Flag Tracker"
              icon={<Flag className="h-3.5 w-3.5" />}
              onClick={onFlagTrackerClick}
              title="Track the Flag Bearer (Hotkey: Q)"
              active={flagTrackerActive}
              accent="flag"
            />
          )}

          {/* VIP — violet (research/VIP signal) */}
          <NavItem
            label={player.vip ? 'VIP ⚡' : 'Get VIP'}
            icon={<Sparkles className={`h-3.5 w-3.5 ${player.vip ? 'nn-pulse' : ''}`} />}
            onClick={() => router.push('/game/vip-upgrade')}
            title={player.vip ? 'VIP Member - View Benefits' : 'Upgrade to VIP for 2x Speed'}
            accent="vip"
          />

          {/* WMD threat slot — pulses magenta only when armed/alerted */}
          <button
            onClick={onWMDClick || (() => router.push('/wmd'))}
            className={`nn-threat ${wmdAlerts ? 'nn-threat--armed' : ''}`}
            title="Weapons of Mass Destruction"
          >
            <Crosshair className="h-3.5 w-3.5" />
            WMD
            {wmdAlerts && <span className="nn-threat__dot" />}
          </button>

          {player.level >= 10 && (
            <NavItem
              label="Clans"
              icon={<Users className="h-3.5 w-3.5" />}
              onClick={onClansClick || (() => router.push('/clans'))}
            />
          )}
          {player.isAdmin && (
            <NavItem
              label="Admin"
              icon={<Settings className="h-3.5 w-3.5" />}
              onClick={onAdminClick || (() => router.push('/admin'))}
            />
          )}
        </nav>

        {/* Right: Resources, Time, Clan, Player, Logout */}
        <div className="flex items-center gap-2.5">
          {/* Resource readouts — Orbitron tabular */}
          {metal !== undefined && (
            <div className="nn-resource" title="Metal reserves">
              <span className="nn-resource__label">Metal</span>
              <span className="nn-resource__value">{metal.toLocaleString()}</span>
            </div>
          )}
          {energy !== undefined && (
            <div className="nn-resource nn-resource--energy" title="Energy reserves">
              <span className="nn-resource__label">Energy</span>
              <span className="nn-resource__value">{energy.toLocaleString()}</span>
            </div>
          )}

          {/* Time Display */}
          <div className="hidden items-center gap-1.5 px-2 py-1 text-xs text-[color:var(--nn-text-secondary)] xl:flex">
            <Clock className="h-3.5 w-3.5 text-[color:var(--nn-text-tertiary)]" />
            <span className="font-orbitron tabular-nums tracking-wide">{currentTime}</span>
          </div>

          {/* Clan Badge */}
          {clanData && (
            <button
              onClick={onClanClick || (() => router.push('/clan'))}
              className="relative flex items-center gap-2 rounded-none border border-[color-mix(in_oklab,var(--nn-violet)_40%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_10%,transparent)] px-2.5 py-1 transition-all hover:bg-[color-mix(in_oklab,var(--nn-violet)_20%,transparent)]"
              title={`${clanData.name} - Click to view Clan page`}
            >
              {hasNewActivity && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 nn-pulse rounded-full bg-[color:var(--nn-magenta)] shadow-[0_0_8px_color-mix(in_oklab,var(--nn-magenta)_80%,transparent)]" />
              )}
              <Shield className="h-4 w-4 text-[color:var(--nn-violet)]" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-orbitron text-[11px] font-semibold text-[color:var(--nn-violet)]">
                  [{clanData.tag}]
                </span>
                <span className="max-w-24 truncate text-[9px] uppercase tracking-wider text-[color:var(--nn-text-tertiary)]">
                  {clanData.name}
                </span>
              </div>
            </button>
          )}

          {/* Player Profile */}
          <button
            onClick={onProfileClick || (() => router.push('/profile'))}
            className="flex items-center gap-2 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] px-2.5 py-1 transition-all hover:bg-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)]"
            title="Edit Base Message"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)]">
              <User className="h-3.5 w-3.5 text-[color:var(--nn-cyan)]" />
            </div>
            <span className="font-orbitron text-xs font-semibold tracking-wide text-[color:var(--nn-text-primary)]">
              {player.username}
            </span>
          </button>

          {/* Logout — magenta = destructive signal */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 rounded-none border border-[color-mix(in_oklab,var(--nn-magenta)_40%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_12%,transparent)] px-2.5 py-1.5 font-orbitron text-[10px] font-bold uppercase tracking-widest text-[color:var(--nn-magenta)] transition-all hover:bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] hover:shadow-[0_0_14px_color-mix(in_oklab,var(--nn-magenta)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isLoggingOut ? '...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  );
}
