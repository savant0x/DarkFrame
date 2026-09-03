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
  achievements?: any[];
}

interface ActivityData {
  activities: Array<{
    actionType: string;
    timestamp: Date;
    details: any;
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

        const [playerJson, activityJson, sessionJson, flagJson] = await Promise.all([
          playerRes.json(),
          activityRes.json(),
          sessionRes.json(),
          flagRes.json()
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
    if (!confirm(`Ban player ${username}? This will prevent them from logging in.`)) return;

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
        alert('Player banned successfully');
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to ban player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanPlayer = async () => {
    if (!confirm(`Unban player ${username}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/anti-cheat/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (data.success) {
        alert('Player unbanned successfully');
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to unban player');
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

    if (!confirm(`Give ${metal} metal and ${energy} energy to ${username}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/give-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, metal, energy })
      });

      const data = await res.json();
      if (data.success) {
        alert('Resources given successfully');
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to give resources');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearFlags = async () => {
    if (!confirm(`Clear all flags for ${username}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/anti-cheat/clear-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (data.success) {
        alert('Flags cleared successfully');
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to clear flags');
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border-2 border-purple-500 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-900/50 p-4 flex justify-between items-center border-b border-purple-500">
          <h2 className="text-2xl font-bold text-white">
            👤 {username}
            {playerData?.isBot && <span className="ml-2 text-sm text-cyan-400">(BOT)</span>}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 bg-gray-800 border-b border-gray-700">
          {(['overview', 'activity', 'sessions', 'flags', 'admin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-3"></div>
              <p className="text-gray-400">Loading player data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 font-semibold mb-1">Error loading player data</p>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && playerData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Level</p>
                      <p className="text-2xl font-bold text-yellow-400">{playerData.level}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Rank</p>
                      <p className="text-2xl font-bold text-purple-400">{playerData.rank}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Metal</p>
                      <p className="text-2xl font-bold text-blue-400">{playerData.resources.metal.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Energy</p>
                      <p className="text-2xl font-bold text-yellow-400">{playerData.resources.energy.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300 mb-3">Location</h3>
                    <p className="text-white">Position: ({playerData.position.x}, {playerData.position.y})</p>
                    {playerData.baseLocation && (
                      <p className="text-gray-400">Base: {playerData.baseLocation}</p>
                    )}
                  </div>

                  {playerData.createdAt && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-300 mb-3">Account Info</h3>
                      <p className="text-gray-400">Created: {formatDateTime(playerData.createdAt)}</p>
                      {playerData.lastActive && (
                        <p className="text-gray-400">Last Active: {formatDateTime(playerData.lastActive)}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && activityData && (
                <div className="space-y-4">
                  <div className="bg-gray-800 p-4 rounded-lg mb-4">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Activity Summary</h3>
                    <p className="text-gray-400">Total Actions: {activityData.stats.totalActions}</p>
                    <p className="text-gray-400">Most Common: {activityData.stats.mostCommonAction}</p>
                  </div>

                  <div className="space-y-2">
                    {activityData.activities.map((activity, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-semibold">{activity.actionType}</p>
                            <p className="text-gray-400 text-sm">{formatDateTime(activity.timestamp.toISOString())}</p>
                          </div>
                          {activity.details && (
                            <p className="text-gray-500 text-sm">{JSON.stringify(activity.details)}</p>
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
                  <div className="bg-gray-800 p-4 rounded-lg mb-4">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Session Summary</h3>
                    <p className="text-gray-400">Total Sessions: {sessionData.stats.totalSessions}</p>
                    <p className="text-gray-400">Avg Duration: {formatDuration(sessionData.stats.avgDuration)}</p>
                    <p className="text-gray-400">Total Play Time: {formatDuration(sessionData.stats.totalPlayTime)}</p>
                  </div>

                  <div className="space-y-2">
                    {sessionData.sessions.map((session, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded">
                        <p className="text-white">Started: {formatDateTime(session.startTime.toISOString())}</p>
                        {session.endTime && (
                          <p className="text-gray-400">Ended: {formatDateTime(session.endTime.toISOString())}</p>
                        )}
                        <p className="text-gray-400">Duration: {formatDuration(session.duration)}</p>
                        <p className="text-gray-400">Actions: {session.actionsPerformed}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags Tab */}
              {activeTab === 'flags' && flagData && (
                <div className="space-y-4">
                  {flagData.isBanned && (
                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg">
                      <p className="text-red-400 font-bold">⚠️ PLAYER IS BANNED</p>
                    </div>
                  )}

                  {flagData.maxSeverity && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">Max Severity</h3>
                      <p className={`text-lg font-bold ${
                        flagData.maxSeverity === 'CRITICAL' ? 'text-red-500' :
                        flagData.maxSeverity === 'HIGH' ? 'text-orange-500' :
                        flagData.maxSeverity === 'MEDIUM' ? 'text-yellow-500' :
                        'text-blue-500'
                      }`}>
                        {flagData.maxSeverity}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {flagData.flags.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No flags for this player</p>
                    ) : (
                      flagData.flags.map((flag, idx) => (
                        <div key={idx} className="bg-gray-800 p-3 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white font-semibold">{flag.flagType}</p>
                              <p className={`text-sm font-bold ${
                                flag.severity === 'CRITICAL' ? 'text-red-500' :
                                flag.severity === 'HIGH' ? 'text-orange-500' :
                                flag.severity === 'MEDIUM' ? 'text-yellow-500' :
                                'text-blue-500'
                              }`}>
                                {flag.severity}
                              </p>
                              <p className="text-gray-400 text-sm">{formatDateTime(flag.timestamp.toISOString())}</p>
                            </div>
                            <p className="text-gray-500 text-sm">{flag.details}</p>
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
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                      >
                        ✅ Unban Player
                      </button>
                    ) : (
                      <button
                        onClick={handleBanPlayer}
                        disabled={actionLoading}
                        className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                      >
                        🚫 Ban Player
                      </button>
                    )}

                    <button
                      onClick={handleGiveResources}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                    >
                      💎 Give Resources
                    </button>

                    <button
                      onClick={handleClearFlags}
                      disabled={actionLoading}
                      className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                    >
                      🧹 Clear Flags
                    </button>

                    <button
                      disabled={actionLoading}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                    >
                      🔄 Reset Progress
                    </button>
                  </div>

                  {actionLoading && (
                    <div className="text-center py-4">
                      <p className="text-gray-400">Processing admin action...</p>
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

