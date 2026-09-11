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
import { Loader2 } from 'lucide-react';
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
  // FID-20260909-028 §2.2: VIP state rides the player payload (admin route).
  vip?: boolean;
  vipExpiration?: string | null;
}

interface ActivityData {
  activities: Array<{
    actionType: string;
    timestamp: string; // wire ISO string (see SessionData note)
    details: Record<string, unknown> | null;
  }>;
  stats: {
    totalActions: number;
    mostCommonAction: string;
  };
  // FID-20260909-032 §3-A: per-action tracking coverage (action, volume, last seen)
  perAction?: Array<{
    action: string;
    count: number;
    lastSeen: string;
  }>;
}

interface SessionData {
  // FID-20260909-028 §2.1: wire timestamps are ISO STRINGS (NextResponse.json
  // serializes drizzle Dates). The old `Date` typings made every render call
  // `.toISOString()` on a string → TypeError crash. formatDateTime consumes
  // the string directly.
  sessions: Array<{
    startTime: string;
    endTime?: string;
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
    timestamp: string; // wire ISO string (see SessionData note)
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

  // FID-20260909-028 §2.2: VIP grant/revoke from the player modal — same audited
  // route as AdminView's VIP Management panel. Failures surface the structured
  // error's message (createErrorResponse nests it under error.message).
  const handleVipAction = async (action: 'grant' | 'revoke', days?: number) => {
    if (action === 'grant') {
      if (!(await confirmDialog(`Grant VIP to ${username} for ${days} day(s)?`))) return;
    } else {
      if (!(await confirmDialog(`Revoke VIP from ${username}?`))) return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/vip/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'grant' ? { username, days } : { username })
      });

      const data = await res.json();
      if (data.success) {
        showSuccess(data.message || (action === 'grant' ? 'VIP granted' : 'VIP revoked'));
        // Refresh so the Admin tab's VIP row reflects the new state.
        const refresh = await fetch(`/api/admin/players/${username}`);
        if (refresh.ok) {
          const refreshed = await refresh.json();
          if (refreshed.success) setPlayerData(refreshed.data);
        }
      } else {
        const reason = data?.error?.message ?? data?.message ?? data?.error ?? 'Request failed';
        showError(`VIP ${action} failed: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
      }
    } catch {
      showError(`Failed to ${action} VIP`);
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
      <div className="nn-panel nn-panel--violet nn-panel--x-pad max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="nn-panel__header nn-panel__header--bleed">
          <span className="nn-panel__title">Player ▸ {username}</span>
          <span className="flex items-center gap-3">
            {playerData?.isBot && <span className="nn-chip nn-chip--cyan">BOT</span>}
            <button
              onClick={onClose}
              aria-label="Close"
              className="font-mono text-sm text-[color:var(--nn-text-tertiary)] transition-colors hover:text-[color:var(--nn-magenta)]"
            >
              ×
            </button>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] pb-3">
          {(['overview', 'activity', 'sessions', 'flags', 'admin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nn-tabchip ${
                activeTab === tab ? 'nn-tabchip--on' : ''
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
              <Loader2 className="nn-spin-icon w-10 h-10 text-[color:var(--nn-violet)] mx-auto mb-3" aria-label="Loading player details" />
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
                    <div className="nn-stat">
                      <p className="nn-stat__lab">Level</p>
                      <p className="nn-stat__num nn-stat__num--glow-amber">{playerData.level}</p>
                    </div>
                    <div className="nn-stat">
                      <p className="nn-stat__lab">Rank</p>
                      <p className="nn-stat__num nn-stat__num--glow-violet">{playerData.rank}</p>
                    </div>
                    <div className="nn-stat">
                      <p className="nn-stat__lab">Metal</p>
                      <p className="nn-stat__num nn-stat__num--glow-cyan">{playerData.resources.metal.toLocaleString()}</p>
                    </div>
                    <div className="nn-stat">
                      <p className="nn-stat__lab">Energy</p>
                      <p className="nn-stat__num nn-stat__num--glow-amber">{playerData.resources.energy.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                    <h3 className="nn-lab mb-3">Location</h3>
                    <p className="text-[color:var(--nn-text-primary)]">Position: ({playerData.position.x}, {playerData.position.y})</p>
                    {playerData.baseLocation && (
                      <p className="text-[color:var(--nn-text-secondary)]">Base: {playerData.baseLocation}</p>
                    )}
                  </div>

                  {playerData.createdAt && (
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <h3 className="nn-lab mb-3">Account Info</h3>
                      <p className="text-[color:var(--nn-text-secondary)]">Created: {formatDateTime(playerData.createdAt)}</p>
                      {playerData.lastActive && (
                        <p className="text-[color:var(--nn-text-secondary)]">Last Active: {formatDateTime(playerData.lastActive)}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab — FID-20260909-032 §3-A: per-action coverage ledger
                  + recent actions; explicit empty and error states (the old tab
                  rendered blank on route failure with no indication). */}
              {activeTab === 'activity' && (
                activityData ? (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none mb-4">
                    <h3 className="nn-lab mb-2">Activity Summary</h3>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Actions: {activityData.stats.totalActions}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Most Common: {activityData.stats.mostCommonAction || '—'}</p>
                  </div>

                  {(activityData.perAction?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="nn-lab mb-2">Tracking Coverage</h3>
                      <div className="space-y-1.5">
                        {activityData.perAction!.map((row) => (
                          <div key={row.action} className="nn-row">
                            <span className="nn-row__label">{row.action}</span>
                            <span className="nn-row__value">
                              <span className="nn-num">{row.count.toLocaleString()}</span>
                              <span className="text-[color:var(--nn-text-tertiary)] text-xs ml-3">last {formatDateTime(row.lastSeen)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="nn-lab mb-2">Recent Actions (latest {activityData.activities.length})</h3>
                    {activityData.activities.length === 0 ? (
                      <p className="text-[color:var(--nn-text-tertiary)] text-sm">No tracked actions recorded for this player.</p>
                    ) : (
                      <div className="space-y-2">
                        {activityData.activities.map((activity, idx) => (
                          <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[color:var(--nn-text-primary)] font-semibold">{activity.actionType}</p>
                                <p className="text-[color:var(--nn-text-secondary)] text-sm">{formatDateTime(activity.timestamp)}</p>
                              </div>
                              {activity.details && (
                                <p className="text-[color:var(--nn-text-secondary)] text-sm max-w-[50%] truncate" title={JSON.stringify(activity.details)}>{JSON.stringify(activity.details)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  <div className="nn-note" style={{ borderColor: 'color-mix(in oklab, var(--nn-magenta) 45%, transparent)' }}>
                    <span>Activity data unavailable — the tracking endpoint returned an error. Check server logs.</span>
                  </div>
                )
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && sessionData && (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none mb-4">
                    <h3 className="nn-lab mb-2">Session Summary</h3>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Sessions: {sessionData.stats.totalSessions}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Avg Duration: {formatDuration(sessionData.stats.avgDuration)}</p>
                    <p className="text-[color:var(--nn-text-secondary)]">Total Play Time: {formatDuration(sessionData.stats.totalPlayTime)}</p>
                  </div>

                  <div className="space-y-2">
                    {sessionData.sessions.map((session, idx) => (
                      <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                        <p className="text-[color:var(--nn-text-primary)]">Started: {formatDateTime(session.startTime)}</p>
                        {session.endTime && (
                          <p className="text-[color:var(--nn-text-secondary)]">Ended: {formatDateTime(session.endTime)}</p>
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
                    <div className="nn-brief nn-brief--magenta">
                      <p className="font-bold"><strong>Banned</strong> — this player is currently banned</p>
                    </div>
                  )}

                  {flagData.maxSeverity && (
                    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none">
                      <h3 className="nn-lab mb-2">Max Severity</h3>
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
                              <p className="text-[color:var(--nn-text-secondary)] text-sm">{formatDateTime(flag.timestamp)}</p>
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
                        className="nn-abtn nn-abtn--green disabled:opacity-50"
                      >
                        Unban Player
                      </button>
                    ) : (
                      <button
                        onClick={handleBanPlayer}
                        disabled={actionLoading}
                        className="nn-abtn nn-abtn--danger disabled:opacity-50"
                      >
                        Ban Player
                      </button>
                    )}

                    <button
                      onClick={handleGiveResources}
                      disabled={actionLoading}
                      className="nn-abtn nn-abtn--cyan disabled:opacity-50"
                    >
                      Give Resources
                    </button>

                    <button
                      onClick={handleClearFlags}
                      disabled={actionLoading}
                      className="nn-abtn nn-abtn--amber disabled:opacity-50"
                    >
                      Clear Flags
                    </button>

                    <button
                      disabled={actionLoading}
                      className="nn-abtn nn-abtn--violet disabled:opacity-50"
                    >
                      Reset Progress
                    </button>
                  </div>

                  {/* VIP controls (FID-20260909-028 §2.2) — the modal workflow
                      (open player → Admin tab → act) previously had no way to
                      apply VIP at all. */}
                  <div className="nn-well p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="nn-lab">VIP STATUS</span>
                      {playerData?.vip ? (
                        <span className="nn-chip nn-chip--amber">
                          ACTIVE{playerData.vipExpiration ? ` · until ${formatDateTime(playerData.vipExpiration)}` : ''}
                        </span>
                      ) : (
                        <span className="nn-chip">NOT ACTIVE</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {playerData?.vip ? (
                        <button
                          onClick={() => handleVipAction('revoke')}
                          disabled={actionLoading}
                          className="nn-abtn nn-abtn--magenta disabled:opacity-50"
                        >
                          Revoke VIP
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleVipAction('grant', 7)} disabled={actionLoading} className="nn-abtn nn-abtn--amber disabled:opacity-50">Grant 7d</button>
                          <button onClick={() => handleVipAction('grant', 30)} disabled={actionLoading} className="nn-abtn nn-abtn--amber disabled:opacity-50">Grant 30d</button>
                          <button onClick={() => handleVipAction('grant', 365)} disabled={actionLoading} className="nn-abtn nn-abtn--cyan disabled:opacity-50">Grant 1yr</button>
                        </>
                      )}
                    </div>
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

