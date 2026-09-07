/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Player Detail Modal Component
 * 
 * Comprehensive admin view of individual player data.
 * Shows stats, inventory, recent activity, session history, and flags.
 * Provides admin actions: ban, unban, reset, give resources, clear flags.
 * 
 * Features:
 * - Tabbed interface (Overview, Activity, Sessions, Flags, Admin Actions)
 * - Real-time data fetching from player tracking endpoints
 * - Admin action confirmations with logging
 * - Loading and error states
 */

'use client';

import { useState, useEffect } from 'react';
import { formatDateTime } from '@/utils/formatting';
import { showSuccess, showError } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface PlayerDetailModalProps {
  username: string;
  onClose: () => void;
}

interface PlayerData {
  username: string;
  level: number;
  rank: number;
  xp: number;
  resources: {
    metal: number;
    energy: number;
  };
  position: {
    x: number;
    y: number;
  };
  baseLocation?: string;
  isBot: boolean;
  createdAt?: string;
  lastActive?: string;
  totalPlayTime?: number;
  achievements?: unknown[];
}

interface ActivityData {
  activities: Array<{
    actionType: string;
    timestamp: Date;
    details: Record<string, unknown> | null;
  }>;
  stats: {
    totalActions: number;
    mostCommonAction: string;
  };
}

interface SessionData {
  sessions: Array<{
    startTime: Date;
    endTime?: Date;
    duration: number;
    actionsPerformed: number;
  }>;
  stats: {
    totalSessions: number;
    avgDuration: number;
    totalPlayTime: number;
  };
}

interface FlagData {
  flags: Array<{
    flagType: string;
    severity: string;
    timestamp: Date;
    details: string;
  }>;
  maxSeverity: string;
  isBanned: boolean;
}

export default function PlayerDetailModal({ username, onClose }: PlayerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'sessions' | 'flags' | 'admin'>('overview');
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [flagData, setFlagData] = useState<FlagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load player data
  useEffect(() => {
    const loadPlayerData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [playerRes, activityRes, sessionRes, flagRes] = await Promise.all([
          fetch(`/api/admin/players/${username}`),
          fetch(`/api/admin/player-tracking/activity?username=${username}&limit=50`),
          fetch(`/api/admin/player-tracking/sessions?username=${username}&limit=20`),
          fetch(`/api/admin/anti-cheat/player-flags?username=${username}`)
        ]);

        // Some admin endpoints were removed in the Postgres pivot and may return an HTML
        // error/404 page — parse defensively and skip any response that is not JSON.
        const safeJson = async (res: Response) => {
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch {
            return { success: false };
          }
        };

        const [playerJson, activityJson, sessionJson, flagJson] = await Promise.all([
          safeJson(playerRes),
          safeJson(activityRes),
          safeJson(sessionRes),
          safeJson(flagRes)
        ]);

        if (playerJson.success) {
          setPlayerData(playerJson.data);
        }

        if (activityJson.success) {
          setActivityData(activityJson);
        }

        if (sessionJson.success) {
          setSessionData(sessionJson);
        }

        if (flagJson.success) {
          setFlagData(flagJson);
        }

      } catch (err) {
        console.error('Player data load error:', err);
        setError('Failed to load player data');
      } finally {
        setLoading(false);
      }
    };

    loadPlayerData();
  }, [username]);

  // Admin actions
  const handleBanPlayer = async () => {
    if (!(await confirmDialog(`Ban player ${username}? This will prevent them from logging in.`))) return;

    const reason = prompt('Ban reason:');
    if (!reason) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/anti-cheat/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason })
      });

      const data = await res.json();
      if (data.success) {
        showSuccess('Player banned successfully');
        window.location.reload();
      } else {
        showError(`Error: ${data.error}`);
      }
    } catch {
      showError('Failed to ban player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanPlayer = async () => {
    if (!(await confirmDialog(`Unban player ${username}?`))) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/anti-cheat/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (data.success) {
        showSuccess('Player unbanned successfully');
        window.location.reload();
      } else {
        showError(`Error: ${data.error}`);
      }
    } catch {
      showError('Failed to unban player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGiveResources = async () => {
    const metalStr = prompt('Metal amount to give:');
    const energyStr = prompt('Energy amount to give:');

    if (!metalStr && !energyStr) return;

    const metal = parseInt(metalStr || '0');
    const energy = parseInt(energyStr || '0');

    if (!(await confirmDialog(`Give ${metal} metal and ${energy} energy to ${username}?`))) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/give-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, metal, energy })
      });

      const data = await res.json();
      if (data.success) {
        showSuccess('Resources given successfully');
        window.location.reload();
      } else {
        showError(`Error: ${data.error}`);
      }
    } catch {
      showError('Failed to give resources');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearFlags = async () => {
    if (!(await confirmDialog(`Clear all flags for ${username}?`))) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/anti-cheat/clear-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (data.success) {
        showSuccess('Flags cleared successfully');
        window.location.reload();
      } else {
        showError(`Error: ${data.error}`);
      }
    } catch {
      showError('Failed to clear flags');
    } finally {
      setActionLoading(false);
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] rounded-none border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] p-4 flex justify-between items-center border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
            👤 {username}
            {playerData?.isBot && <span className="ml-2 text-sm text-[color:var(--nn-cyan)]">(BOT)</span>}
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
          {(['overview', 'activity', 'sessions', 'flags', 'admin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-none font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                  : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] mx-auto mb-3"></div>
              <p className="text-[color:var(--nn-text-secondary)]">Loading player data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-[color:var(--nn-magenta)] font-semibold mb-1">Error loading player data</p>
              <p className="text-[color:var(--nn-text-secondary)]">{error}</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && playerData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">Level</p>
                      <p className="text-2xl font-bold text-[color:var(--nn-amber)]">{playerData.level}</p>
                    </div>
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">Rank</p>
                      <p className="text-2xl font-bold text-[color:var(--nn-violet)]">{playerData.rank}</p>
                    </div>
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">Metal</p>
                      <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">{playerData.resources.metal.toLocaleString()}</p>
                    </div>
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <p className="text-[color:var(--nn-text-secondary)] text-sm">Energy</p>
                      <p className="text-2xl font-bold text-[color:var(--nn-amber)]">{playerData.resources.energy.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                    <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-3">Location</h3>
                    <p className="text-[color:var(--nn-text-primary)]">Position: ({playerData.position.x}, {playerData.position.y})</p>
                    {playerData.baseLocation && (
                      <p className="text-[color:var(--nn-text-secondary)]">Base: {playerData.baseLocation}</p>
                    )}
                  </div>

                  {playerData.createdAt && (
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-3">Account Info</h3>
                      <p className="text-[color:var(--nn-text-secondary)]">Created: {formatDateTime(playerData.createdAt)}</p>
                      {playerData.lastActive && (
                        <p className="text-[color:var(--nn-text-secondary)]">Last Active: {formatDateTime(playerData.lastActive)}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && activityData && (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none mb-4">
                    <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-2">Activity Summary</h3>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Actions: {activityData.stats.totalActions}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Most Common: {activityData.stats.mostCommonAction}</p>
                  </div>

                  <div className="space-y-2">
                    {activityData.activities.map((activity, idx) => (
                      <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[color:var(--nn-text-primary)] font-semibold">{activity.actionType}</p>
                            <p className="text-[color:var(--nn-text-secondary)] text-sm">{formatDateTime(activity.timestamp.toISOString())}</p>
                          </div>
                          {activity.details && (
                            <p className="text-[color:var(--nn-text-secondary)] text-sm">{JSON.stringify(activity.details)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && sessionData && (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none mb-4">
                    <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-2">Session Summary</h3>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Sessions: {sessionData.stats.totalSessions}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Avg Duration: {formatDuration(sessionData.stats.avgDuration)}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Play Time: {formatDuration(sessionData.stats.totalPlayTime)}</p>
                  </div>

                  <div className="space-y-2">
                    {sessionData.sessions.map((session, idx) => (
                      <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                        <p className="text-[color:var(--nn-text-primary)]">Started: {formatDateTime(session.startTime.toISOString())}</p>
                        {session.endTime && (
                          <p className="text-[color:var(--nn-text-secondary)]">Ended: {formatDateTime(session.endTime.toISOString())}</p>
                        )}
                        <p className="text-[color:var(--nn-text-secondary)]">Duration: {formatDuration(session.duration)}</p>
                        <p className="text-[color:var(--nn-text-secondary)]">Actions: {session.actionsPerformed}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags Tab */}
              {activeTab === 'flags' && flagData && (
                <div className="space-y-4">
                  {flagData.isBanned && (
                    <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] p-4 rounded-none">
                      <p className="text-[color:var(--nn-magenta)] font-bold">⚠️ PLAYER IS BANNED</p>
                    </div>
                  )}

                  {flagData.maxSeverity && (
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <h3 className="text-lg font-semibold text-[color:var(--nn-text-secondary)] mb-2">Max Severity</h3>
                      <p className={`text-lg font-bold ${
                        flagData.maxSeverity === 'CRITICAL' ? 'text-[color:var(--nn-magenta)]' :
                        flagData.maxSeverity === 'HIGH' ? 'text-[color:var(--nn-amber)]' :
                        flagData.maxSeverity === 'MEDIUM' ? 'text-[color:var(--nn-amber)]' :
                        'text-[color:var(--nn-cyan)]'
                      }`}>
                        {flagData.maxSeverity}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {flagData.flags.length === 0 ? (
                      <p className="text-[color:var(--nn-text-secondary)] text-center py-8">No flags for this player</p>
                    ) : (
                      flagData.flags.map((flag, idx) => (
                        <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[color:var(--nn-text-primary)] font-semibold">{flag.flagType}</p>
                              <p className={`text-sm font-bold ${
                                flag.severity === 'CRITICAL' ? 'text-[color:var(--nn-magenta)]' :
                                flag.severity === 'HIGH' ? 'text-[color:var(--nn-amber)]' :
                                flag.severity === 'MEDIUM' ? 'text-[color:var(--nn-amber)]' :
                                'text-[color:var(--nn-cyan)]'
                              }`}>
                                {flag.severity}
                              </p>
                              <p className="text-[color:var(--nn-text-secondary)] text-sm">{formatDateTime(flag.timestamp.toISOString())}</p>
                            </div>
                            <p className="text-[color:var(--nn-text-secondary)] text-sm">{flag.details}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Admin Actions Tab */}
              {activeTab === 'admin' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {flagData?.isBanned ? (
                      <button
                        onClick={handleUnbanPlayer}
                        disabled={actionLoading}
                        className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors"
                      >
                        ✅ Unban Player
                      </button>
                    ) : (
                      <button
                        onClick={handleBanPlayer}
                        disabled={actionLoading}
                        className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors"
                      >
                        🚫 Ban Player
                      </button>
                    )}

                    <button
                      onClick={handleGiveResources}
                      disabled={actionLoading}
                      className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors"
                    >
                      💎 Give Resources
                    </button>

                    <button
                      onClick={handleClearFlags}
                      disabled={actionLoading}
                      className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors"
                    >
                      🧹 Clear Flags
                    </button>

                    <button
                      disabled={actionLoading}
                      className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors"
                    >
                      🔄 Reset Progress
                    </button>
                  </div>

                  {actionLoading && (
                    <div className="text-center py-4">
                      <p className="text-[color:var(--nn-text-secondary)]">Processing admin action...</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Modal overlay with centered content
 * - Tabbed interface for organized data display
 * - Real-time data fetching from 4 endpoints
 * - Admin actions with confirmations
 * - Loading and error states
 * - Responsive design
 * 
 * 🎨 STYLING:
 * - Purple theme matching admin panel
 * - Dark background with border
 * - Tab navigation with active states
 * - Color-coded severity indicators
 * - Grid layouts for stats
 * 
 * 📊 DATA SOURCES:
 * - /api/admin/players/:username - Player data
 * - /api/admin/player-tracking/activity - Recent actions
 * - /api/admin/player-tracking/sessions - Session history
 * - /api/admin/anti-cheat/player-flags - Flag data
 * 
 * 🔧 ADMIN ACTIONS:
 * - Ban/Unban player
 * - Give resources (metal, energy)
 * - Clear anti-cheat flags
 * - Reset progress (TODO)
 * 
 * ⚡ FUTURE ENHANCEMENTS:
 * - Reset progress implementation
 * - Teleport player
 * - Edit inventory directly
 * - View achievements
 * - Export player data as JSON
 */

